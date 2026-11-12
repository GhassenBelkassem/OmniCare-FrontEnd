import { computed, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthTokenStore } from '../auth/auth-token.store';
import { RUNTIME_CONFIG } from '../config/runtime-config';
import { REALTIME_CLIENT_FACTORY, RealtimeService } from './realtime.service';

interface MockClientConfig {
  connectHeaders: Record<string, string>;
  webSocketFactory: () => unknown;
  reconnectDelay: number;
  onConnect?: () => void;
  onWebSocketClose?: () => void;
  onStompError?: () => void;
}

type FrameHandler = (message: { body: string }) => void;

const stomp = (() => {
  class MockClient {
    static instances: MockClient[] = [];

    readonly config: {
      connectHeaders: Record<string, string>;
      webSocketFactory: () => unknown;
      reconnectDelay: number;
      onConnect?: () => void;
      onWebSocketClose?: () => void;
      onStompError?: () => void;
    };

    activated = false;
    deactivated = false;
    subscriptions: { destination: string; handler: (message: { body: string }) => void }[] = [];

    constructor(config: {
      connectHeaders: Record<string, string>;
      webSocketFactory: () => unknown;
      reconnectDelay: number;
      onConnect?: () => void;
      onWebSocketClose?: () => void;
      onStompError?: () => void;
    }) {
      this.config = config;
      MockClient.instances.push(this);
    }

    activate(): Promise<void> {
      this.activated = true;
      return Promise.resolve();
    }

    deactivate(): Promise<void> {
      this.deactivated = true;
      return Promise.resolve();
    }

    subscribe(
      destination: string,
      handler: (message: { body: string }) => void,
    ): { id: string; unsubscribe: () => void } {
      this.subscriptions.push({ destination, handler });
      return { id: `sub-${this.subscriptions.length}`, unsubscribe: (): void => undefined };
    }
  }

  return { MockClient };
})();

function session(
  token: string,
  role: Parameters<AuthTokenStore['setSession']>[0]['user']['role'] = 'DOCTOR',
): Parameters<AuthTokenStore['setSession']>[0] {
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresAt: '2026-08-21T23:59:59Z',
    refreshToken: 'refresh-token',
    refreshExpiresAt: '2026-08-22T23:59:59Z',
    user: { id: 'user-1', role, mustChangePassword: false },
  };
}

describe('RealtimeService', () => {
  function create(options: { token?: string | null; platformId?: string } = {}): {
    service: RealtimeService;
    tokens: AuthTokenStore;
  } {
    stomp.MockClient.instances.length = 0;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: PLATFORM_ID, useValue: options.platformId ?? 'browser' },
        {
          provide: REALTIME_CLIENT_FACTORY,
          useValue: (config: MockClientConfig) => new stomp.MockClient(config),
        },
      ],
    });
    const tokens = TestBed.inject(AuthTokenStore);
    if (options.token !== undefined && options.token !== null) {
      tokens.setSession(session(options.token));
    }
    const service = TestBed.inject(RealtimeService);
    TestBed.tick();
    return { service, tokens };
  }

  function lastClient(): InstanceType<typeof stomp.MockClient> | undefined {
    return stomp.MockClient.instances.at(-1);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('connects with the Bearer header and subscribes doctors to urgent request updates', () => {
    const { service } = create({ token: 'token-a' });

    expect(stomp.MockClient.instances).toHaveLength(1);
    const client = stomp.MockClient.instances[0];
    expect(client.activated).toBe(true);
    expect(client.config.connectHeaders['Authorization']).toBe('Bearer token-a');

    client.config.onConnect?.();
    expect(service.status()).toBe('connected');
    expect(client.subscriptions.map((sub) => sub.destination)).toEqual([
      '/user/queue/urgent-requests',
      '/user/queue/appointments',
      '/user/queue/scheduled-care',
      '/user/queue/notifications',
    ]);
    expect(service.connectionEpoch()).toBe(1);
  });

  it('does not connect without a session', () => {
    const { service } = create();

    expect(stomp.MockClient.instances).toHaveLength(0);
    expect(service.status()).toBe('disconnected');
  });

  it('never connects during SSR', () => {
    create({ token: 'token-a', platformId: 'server' });

    expect(stomp.MockClient.instances).toHaveLength(0);
  });

  it('routes appointment events to their own stream', () => {
    const { service } = create({ token: 'token-a' });
    const client = lastClient()!;
    client.config.onConnect?.();

    const appointments: string[] = [];
    service.appointmentEvents$.subscribe((event) => appointments.push(event.name));

    client.subscriptions
      .find((subscription) => subscription.destination === '/user/queue/appointments')!
      .handler({
        body: JSON.stringify({
          event: 'APPOINTMENT_STARTED',
          data: { appointmentId: 'a-1' },
          timestamp: '2026-08-21T10:00:00Z',
        }),
      });

    expect(appointments).toEqual(['APPOINTMENT_STARTED']);
  });

  it('routes urgent request invalidations to doctors', () => {
    const { service } = create({ token: 'token-a' });
    const client = lastClient()!;
    client.config.onConnect?.();
    const received: string[] = [];
    service.urgentEvents$.subscribe((event) => received.push(event.name));

    client.subscriptions
      .find((subscription) => subscription.destination === '/user/queue/urgent-requests')!
      .handler({
        body: JSON.stringify({
          event: 'NEW_OFFER',
          data: { requestId: 'request-1', patientName: 'Patient autorisé' },
          timestamp: '2026-10-31T14:24:00Z',
        }),
      });

    expect(received).toEqual(['NEW_OFFER']);
  });

  it('emits a scheduled-care invalidation once for duplicate event IDs', () => {
    const { service } = create({ token: 'token-a' });
    const client = lastClient()!;
    client.config.onConnect?.();
    const received: string[] = [];
    service.scheduledCareEvents$.subscribe((event) => received.push(event.eventId));
    const frame = {
      body: JSON.stringify({
        eventId: 'event-1',
        eventType: 'BOOKING_REQUEST_PROPOSED',
        resourceType: 'BOOKING_REQUEST',
        resourceId: 'request-1',
        version: 2,
        occurredAt: '2026-08-21T10:00:00Z',
      }),
    };

    const subscription = client.subscriptions.find(
      (candidate) => candidate.destination === '/user/queue/scheduled-care',
    )!;
    subscription.handler(frame);
    subscription.handler(frame);

    expect(received).toEqual(['event-1']);
  });

  it('emits typed notification invalidations and drops malformed frames', () => {
    const { service } = create({ token: 'token-a' });
    const client = lastClient()!;
    client.config.onConnect?.();
    const received: string[] = [];
    service.notificationEvents$.subscribe((event) => received.push(event.notificationId));

    const subscription = client.subscriptions.find(
      (candidate) => candidate.destination === '/user/queue/notifications',
    )!;
    subscription.handler({
      body: JSON.stringify({
        eventType: 'NOTIFICATION_CREATED',
        notificationId: 'notification-1',
        occurredAt: '2026-10-09T10:00:00Z',
      }),
    });
    subscription.handler({ body: JSON.stringify({ eventType: 'UNKNOWN' }) });

    expect(received).toEqual(['notification-1']);
  });

  it('reconnects with a fresh token when the access token changes', () => {
    const { tokens } = create({ token: 'token-a' });
    const first = stomp.MockClient.instances[0];

    tokens.setSession(session('token-b'));
    TestBed.tick();

    expect(first.deactivated).toBe(true);
    expect(stomp.MockClient.instances).toHaveLength(2);
    expect(lastClient()!.config.connectHeaders['Authorization']).toBe('Bearer token-b');
    expect(lastClient()!.activated).toBe(true);
  });

  it('stops the client on logout without reconnecting', () => {
    const { service, tokens } = create({ token: 'token-a' });
    const first = stomp.MockClient.instances[0];

    tokens.clear();
    TestBed.tick();

    expect(first.deactivated).toBe(true);
    expect(stomp.MockClient.instances).toHaveLength(1);
    expect(service.status()).toBe('disconnected');
  });

  it('cannot reconnect with cleared credentials after central termination', () => {
    const { service, tokens } = create({ token: 'token-a' });
    const first = stomp.MockClient.instances[0];

    service.terminateSession();
    tokens.clear();
    TestBed.tick();

    expect(first.deactivated).toBe(true);
    expect(stomp.MockClient.instances).toHaveLength(1);
    expect(service.status()).toBe('disconnected');

    tokens.setSession(session('token-b'));
    TestBed.tick();
    expect(stomp.MockClient.instances).toHaveLength(2);
    expect(lastClient()!.config.connectHeaders['Authorization']).toBe('Bearer token-b');
  });

  it('reports down while the socket is not connected', () => {
    const { service } = create({ token: 'token-a' });

    const health = service.health(computed(() => true));
    expect(health()).toBe('down');
  });

  it('goes stale when connected but silent while activity is expected, and recovers on events', () => {
    vi.useFakeTimers();
    const { service } = create({ token: 'token-a' });
    const client = lastClient()!;
    client.config.onConnect?.();

    const health = service.health(computed(() => true));
    expect(health()).toBe('live');

    vi.advanceTimersByTime(120_000);
    expect(health()).toBe('stale');

    client.subscriptions
      .find((subscription) => subscription.destination === '/user/queue/appointments')!
      .handler({
        body: JSON.stringify({
          event: 'APPOINTMENT_STARTED',
          data: { appointmentId: 'appointment-9' },
          timestamp: '2026-08-21T10:02:00Z',
        }),
      });
    expect(health()).toBe('live');
  });

  it('stays live when connected and no activity is expected', () => {
    vi.useFakeTimers();
    const { service } = create({ token: 'token-a' });
    const client = lastClient()!;
    client.config.onConnect?.();

    const health = service.health(computed(() => false));
    vi.advanceTimersByTime(120_000);

    expect(health()).toBe('live');
  });
});
