import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOTIFICATION_CATEGORIES,
  NotificationPreferenceResponse,
  NotificationPreferenceUpdateRequest,
  notificationCategoryPresentation,
} from './notification-preference-api.models';
import { NotificationPreferenceApiService } from './notification-preference-api.service';
import { NotificationSettingsSection } from './notification-settings-section';

const APPOINTMENT_PREFERENCE: NotificationPreferenceResponse = {
  category: 'APPOINTMENT',
  pushEnabled: true,
  smsEnabled: false,
  dndEnabled: false,
  dndStart: null,
  dndEnd: null,
};

interface NotificationApiStub {
  getAll: ReturnType<typeof vi.fn<() => Observable<readonly NotificationPreferenceResponse[]>>>;
  update: ReturnType<
    typeof vi.fn<
      (
        category: string,
        request: NotificationPreferenceUpdateRequest,
      ) => Observable<NotificationPreferenceResponse>
    >
  >;
}

describe('NotificationSettingsSection', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows only loading state until the authoritative GET completes', () => {
    const response = new Subject<readonly NotificationPreferenceResponse[]>();
    const { component, fixture, api } = createComponent({ getAll: vi.fn(() => response) });

    fixture.detectChanges();

    expect(api.getAll).toHaveBeenCalledOnce();
    expect(component.loadState()).toBe('loading');
    expect(fixture.nativeElement.textContent).toContain(
      'Chargement des préférences de notification',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Notifications email');
    expect(fixture.nativeElement.querySelector('oc-switch')).toBeNull();
  });

  it('renders authoritative categories and safely presents an unknown future category', () => {
    const unknown = { ...APPOINTMENT_PREFERENCE, category: 'FUTURE_CATEGORY' };
    const { component, fixture } = createComponent({
      getAll: vi.fn(() => of([unknown, APPOINTMENT_PREFERENCE])),
    });

    fixture.detectChanges();

    expect(component.loadState()).toBe('loaded');
    expect(component.preferences().map((item) => item.category)).toEqual([
      'APPOINTMENT',
      'FUTURE_CATEGORY',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Rendez-vous');
    expect(fixture.nativeElement.textContent).toContain('Autres notifications');
    expect(fixture.nativeElement.textContent).not.toContain('FUTURE_CATEGORY');
    expect(fixture.nativeElement.textContent).not.toContain('email');
  });

  it('maps every exact backend category to French presentation metadata', () => {
    expect(NOTIFICATION_CATEGORIES).toEqual([
      'CONSULTATION',
      'APPOINTMENT',
      'KINE',
      'NURSE',
      'MEDICATION',
      'PASSPORT',
      'MESSAGE',
      'CLINIC_OPS',
      'ADMIN',
    ]);
    for (const category of NOTIFICATION_CATEGORIES) {
      const presentation = notificationCategoryPresentation(category);
      expect(presentation.label).not.toBe(category);
      expect(presentation.description.length).toBeGreaterThan(0);
    }
    expect(notificationCategoryPresentation('CONSULTATION').pushRequired).toBe(true);
    expect(notificationCategoryPresentation('MESSAGE').pushRequired).toBe(true);
  });

  it('shows an authoritative empty result without manufacturing default rows', () => {
    const { component, fixture } = createComponent({ getAll: vi.fn(() => of([])) });

    fixture.detectChanges();

    expect(component.preferences()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Aucune préférence disponible');
    expect(fixture.nativeElement.querySelector('oc-switch')).toBeNull();
  });

  it('shows a load error and retries the authoritative GET', () => {
    const getAll = vi
      .fn<() => Observable<readonly NotificationPreferenceResponse[]>>()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of([APPOINTMENT_PREFERENCE]));
    const { component, fixture } = createComponent({ getAll });
    fixture.detectChanges();

    expect(component.loadState()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain('Impossible de charger');

    component.load();
    fixture.detectChanges();

    expect(getAll).toHaveBeenCalledTimes(2);
    expect(component.loadState()).toBe('loaded');
  });

  it('saves push, SMS and overnight DND using the exact category request', () => {
    const response = new Subject<NotificationPreferenceResponse>();
    const update = vi.fn(() => response);
    const { component } = createComponent({ update });
    TestBed.flushEffects();

    component.updateBoolean('APPOINTMENT', 'pushEnabled', false);
    component.updateBoolean('APPOINTMENT', 'smsEnabled', true);
    component.updateBoolean('APPOINTMENT', 'dndEnabled', true);
    component.updateTime('APPOINTMENT', 'dndStart', '22:00');
    component.updateTime('APPOINTMENT', 'dndEnd', '07:00');
    component.save('APPOINTMENT');

    expect(update).toHaveBeenCalledWith('APPOINTMENT', {
      pushEnabled: false,
      smsEnabled: true,
      dndEnabled: true,
      dndStart: '22:00',
      dndEnd: '07:00',
    });
    expect(component.preferences()[0]).toEqual(APPOINTMENT_PREFERENCE);

    response.next({
      category: 'APPOINTMENT',
      pushEnabled: false,
      smsEnabled: true,
      dndEnabled: true,
      dndStart: '22:00:00',
      dndEnd: '07:00:00',
    });
    response.complete();

    expect(component.preferences()[0].smsEnabled).toBe(true);
    expect(component.draftFor('APPOINTMENT').dndStart).toBe('22:00');
    expect(component.isDirty('APPOINTMENT')).toBe(false);
  });

  it('requires both DND times before mutation', () => {
    const { component, api } = createComponent();
    TestBed.flushEffects();

    component.updateBoolean('APPOINTMENT', 'dndEnabled', true);
    component.updateTime('APPOINTMENT', 'dndStart', '22:00');
    component.save('APPOINTMENT');

    expect(component.hasValidDndWindow('APPOINTMENT')).toBe(false);
    expect(api.update).not.toHaveBeenCalled();
  });

  it('can disable DND while preserving the authoritative time window', () => {
    const preference: NotificationPreferenceResponse = {
      ...APPOINTMENT_PREFERENCE,
      dndEnabled: true,
      dndStart: '22:00:00',
      dndEnd: '07:00:00',
    };
    const { component, fixture, api } = createComponent({
      getAll: vi.fn(() => of([preference])),
    });
    fixture.detectChanges();

    component.updateBoolean('APPOINTMENT', 'dndEnabled', false);
    component.save('APPOINTMENT');

    expect(api.update).toHaveBeenCalledWith('APPOINTMENT', {
      pushEnabled: true,
      smsEnabled: false,
      dndEnabled: false,
      dndStart: '22:00',
      dndEnd: '07:00',
    });
  });

  it('restores authoritative state and reports a scoped mutation failure', () => {
    const { component, api } = createComponent({
      update: vi.fn(() => throwError(() => new Error('rejected'))),
    });
    TestBed.flushEffects();

    component.updateBoolean('APPOINTMENT', 'smsEnabled', true);
    component.save('APPOINTMENT');

    expect(api.update).toHaveBeenCalledOnce();
    expect(component.draftFor('APPOINTMENT').smsEnabled).toBe(false);
    expect(component.preferences()[0].smsEnabled).toBe(false);
    expect(component.mutationErrors()['APPOINTMENT']).toContain('pas été enregistrées');
  });
});

function createComponent(overrides: Partial<NotificationApiStub> = {}): {
  component: NotificationSettingsSection;
  fixture: ComponentFixture<NotificationSettingsSection>;
  api: NotificationApiStub;
} {
  const api: NotificationApiStub = {
    getAll: vi.fn(() => of([APPOINTMENT_PREFERENCE])),
    update: vi.fn((category, request) => of({ category, ...request })),
    ...overrides,
  };
  TestBed.configureTestingModule({
    imports: [NotificationSettingsSection],
    providers: [{ provide: NotificationPreferenceApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(NotificationSettingsSection);
  return { component: fixture.componentInstance, fixture, api };
}
