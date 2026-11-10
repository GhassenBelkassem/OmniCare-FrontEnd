import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AvailabilityRuleDto } from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';
import { SettingsPage } from './settings-page';

const MONDAY: AvailabilityRuleDto = {
  id: 'monday',
  doctorId: 'doctor-1',
  dayOfWeek: 'MONDAY',
  active: true,
  startTime: '08:00',
  endTime: '12:00',
  pauseStart: null,
  pauseEnd: null,
  slotDurationMinutes: 30,
};

const TUESDAY: AvailabilityRuleDto = {
  ...MONDAY,
  id: 'tuesday',
  dayOfWeek: 'TUESDAY',
};

describe('SettingsPage production state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('uses only current production tabs and safely normalizes legacy or unknown deep links', () => {
    const current = createPage();
    expect(current.page.tabs().map(({ id }) => id)).toEqual([
      'profile',
      'cabinets',
      'schedule',
      'services',
      'account',
      'notifications',
    ]);
    expect(current.page.activeTab()).toBe('profile');

    current.query.next({ tab: 'preferences' });
    expect(current.page.activeTab()).toBe('notifications');
    current.query.next({ tab: 'overview' });
    expect(current.page.activeTab()).toBe('profile');
    current.query.next({ tab: 'templates' });
    expect(current.page.activeTab()).toBe('profile');
  });

  it('protects dirty urgent configuration from tab, route, and unload navigation', () => {
    const { page } = createPage({ tab: 'services' });
    page.urgentConfigurationDirty.set(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    page.onTabChange('schedule');
    const unload = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    page.onBeforeUnload(unload);

    expect(page.activeTab()).toBe('services');
    expect(page.canDeactivate()).toBe(false);
    expect(unload.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalled();
  });

  it('keeps schedule load failure distinct from an authoritative empty schedule', () => {
    const { page } = createPage({}, { listRules: vi.fn(() => throwError(() => new Error())) });

    expect(page.scheduleLoading()).toBe(false);
    expect(page.scheduleLoadError()).toBe('Impossible de charger les horaires habituels.');
    expect(page.availabilityRules()).toEqual([]);
    expect(page.scheduleMutationBlocked()).toBe(true);
  });

  it('removes a rule only after the authoritative whole-list response', () => {
    const saved = new Subject<readonly AvailabilityRuleDto[]>();
    const { page, api } = createPage(
      {},
      {
        listRules: vi.fn(() => of([MONDAY, TUESDAY])),
        saveRules: vi.fn(() => saved),
      },
    );

    page.markDayClosed(MONDAY);
    page.confirmDeleteRule();
    expect(api.saveRules).toHaveBeenCalledWith([TUESDAY]);
    expect(page.availabilityRules()).toEqual([MONDAY, TUESDAY]);

    saved.next([TUESDAY]);
    saved.complete();
    expect(page.availabilityRules()).toEqual([TUESDAY]);
  });

  it('blocks duplicate schedule mutations while the first request is pending', () => {
    const saved = new Subject<readonly AvailabilityRuleDto[]>();
    const { page, api } = createPage({}, { saveRules: vi.fn(() => saved) });
    const changed = { ...MONDAY, startTime: '09:00' };

    page.onRuleSaved(changed);
    page.onRuleSaved(changed);

    expect(api.saveRules).toHaveBeenCalledTimes(1);
    expect(page.ruleSaving()).toBe(true);
  });

  it('uses the server response as the new schedule authority', () => {
    const certified = { ...MONDAY, startTime: '09:00:00', endTime: '15:00:00' };
    const { page } = createPage({}, { saveRules: vi.fn(() => of([certified])) });

    page.onRuleSaved({ ...MONDAY, startTime: '09:00', endTime: '15:00' });

    expect(page.availabilityRules()).toEqual([certified]);
    expect(page.scheduleSuccess()).toBe('Horaires enregistrés.');
  });

  it('keeps availability exceptions owned by Calendar', () => {
    const { page, router } = createPage();

    page.openCalendar();

    expect(router.navigate).toHaveBeenCalledWith(['/doctor/calendar']);
  });
});

function createPage(
  initialQuery: Record<string, string> = {},
  overrides: Partial<{
    listRules: ReturnType<typeof vi.fn>;
    saveRules: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const query = new BehaviorSubject<Record<string, string>>(initialQuery);
  const api = {
    listRules: vi.fn(() => of([])),
    saveRules: vi.fn((rules: readonly AvailabilityRuleDto[]) => of(rules)),
    ...overrides,
  };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AppointmentApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { queryParams: query.asObservable() } },
      { provide: Router, useValue: router },
    ],
  });
  const page = TestBed.runInInjectionContext(() => new SettingsPage());
  return { page, api, query, router };
}
