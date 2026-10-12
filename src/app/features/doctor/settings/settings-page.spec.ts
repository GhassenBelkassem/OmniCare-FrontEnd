import { registerLocaleData } from '@angular/common';
import enGb from '@angular/common/locales/en-GB';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AvailabilityExceptionDto,
  AvailabilityExceptionRequestDto,
  AvailabilityRuleDto,
} from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';
import { OMNICARE_ICONS } from '../../../app.icons';
import { OcTimeField } from '../../../shared/ui';
import { NotificationPreferenceApiService } from './notification-preference-api.service';
import { AccountSecurityApiService } from './account-security-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { REAL_SCHEDULE_CONTEXT, SettingsPage } from './settings-page';

registerLocaleData(enGb);

const MONDAY_RULE: AvailabilityRuleDto = {
  id: 'rule-monday',
  doctorId: 'doctor-1',
  dayOfWeek: 'MONDAY',
  active: true,
  startTime: '08:00',
  endTime: '12:00',
  pauseStart: null,
  pauseEnd: null,
  slotDurationMinutes: 30,
};

const TUESDAY_RULE: AvailabilityRuleDto = {
  ...MONDAY_RULE,
  id: 'rule-tuesday',
  dayOfWeek: 'TUESDAY',
};

const CERTIFIED_MONDAY_RULE: AvailabilityRuleDto = {
  ...MONDAY_RULE,
  startTime: '09:00:00',
  endTime: '15:00:00',
  pauseStart: '13:00:00',
  pauseEnd: '13:30:00',
};

const BLOCK_EXCEPTION: AvailabilityExceptionDto = {
  id: 'exception-1',
  doctorId: 'doctor-1',
  exceptionDate: '2026-10-12',
  type: 'BLOCK',
  startTime: '10:00',
  endTime: '11:30',
  reason: 'Réunion',
};

interface ApiStub {
  listRules: ReturnType<typeof vi.fn>;
  saveRules: ReturnType<typeof vi.fn>;
  listExceptions: ReturnType<typeof vi.fn>;
  addException: ReturnType<typeof vi.fn>;
  deleteException: ReturnType<typeof vi.fn>;
}

interface NotificationApiStub {
  getAll: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

interface AccountSecurityApiStub {
  getSummary: ReturnType<typeof vi.fn>;
  getDevices: ReturnType<typeof vi.fn>;
  changePassword: ReturnType<typeof vi.fn>;
  logoutDevice: ReturnType<typeof vi.fn>;
}

describe('SettingsPage schedule correctness', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('opens Overview first and preserves all existing Settings navigation', () => {
    const { component, api } = createComponent();

    expect(component.tabs().map((tab) => tab.id)).toEqual([
      'overview',
      'profile',
      'cabinets',
      'schedule',
      'services',
      'account',
      'notifications',
    ]);
    expect(component.activeTab()).toBe('overview');
    expect(component.exceptionLoadState()).toBe('notLoaded');
    expect(api.listExceptions).not.toHaveBeenCalled();

    component.onTabChange('schedule');

    expect(component.activeTab()).toBe('schedule');
    expect(api.listExceptions).toHaveBeenCalledOnce();
  });

  it('keeps the real Doctor-wide schedule authoritative by default', () => {
    const { component } = createComponent(
      { tab: 'schedule' },
      { listRules: vi.fn(() => of([MONDAY_RULE, { ...MONDAY_RULE, id: 'second' }])) },
    );

    expect(component.selectedScheduleContext()).toBe(REAL_SCHEDULE_CONTEXT);
    expect(component.scheduleContextIsPrototype()).toBe(false);
    expect(component.visibleAvailabilityRules()).toHaveLength(2);
    expect(component.existingRuleDays()).toEqual([]);
    expect(component.scheduleContexts().map((context) => context.id)).toEqual([
      REAL_SCHEDULE_CONTEXT,
    ]);
  });

  it('preserves direct query-parameter navigation and loads exceptions for Schedule', () => {
    const { component, api } = createComponent({ tab: 'schedule' });

    expect(component.activeTab()).toBe('schedule');
    expect(component.exceptionLoadState()).toBe('loaded');
    expect(api.listExceptions).toHaveBeenCalledOnce();
  });

  it('aliases the old Preferences deep link to Notifications', () => {
    const { component, fixture, notificationApi } = createComponent({ tab: 'preferences' });
    fixture.detectChanges();

    expect(component.activeTab()).toBe('notifications');
    expect(notificationApi.getAll).toHaveBeenCalledOnce();
  });

  it('falls removed Templates and unknown deep links back to Overview', () => {
    expect(createComponent({ tab: 'templates' }).component.activeTab()).toBe('overview');
    TestBed.resetTestingModule();
    expect(createComponent({ tab: 'unknown' }).component.activeTab()).toBe('overview');
  });

  it('activates Notifications with an authoritative load and no fake Settings content', () => {
    const { component, fixture, notificationApi } = createComponent();

    component.onTabChange('notifications');
    fixture.detectChanges();

    expect(notificationApi.getAll).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Aucune préférence disponible');
    expect(fixture.nativeElement.textContent).not.toContain('Modèles');
    expect(fixture.nativeElement.textContent).not.toContain('Notifications email');
    expect(fixture.nativeElement.textContent).not.toContain('Utiliser');
    expect(fixture.nativeElement.textContent).not.toContain('Copier');
  });

  it('preserves the Account deep link and loads both authoritative security resources', () => {
    const { component, fixture, accountApi } = createComponent({ tab: 'account' });
    fixture.detectChanges();

    expect(component.activeTab()).toBe('account');
    expect(accountApi.getSummary).toHaveBeenCalledOnce();
    expect(accountApi.getDevices).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Compte & sécurité');
  });

  it('deletes one of several weekly rules only after the authoritative response', () => {
    const response = new Subject<readonly AvailabilityRuleDto[]>();
    const { component, api } = createComponent(
      {},
      {
        listRules: vi.fn(() => of([MONDAY_RULE, TUESDAY_RULE])),
        saveRules: vi.fn(() => response),
      },
    );

    component.deleteRule(MONDAY_RULE);
    component.confirmDeleteRule();

    expect(api.saveRules).toHaveBeenCalledWith([TUESDAY_RULE]);
    expect(component.availabilityRules()).toEqual([MONDAY_RULE, TUESDAY_RULE]);

    response.next([TUESDAY_RULE]);
    response.complete();
    expect(component.availabilityRules()).toEqual([TUESDAY_RULE]);
  });

  it('sends an empty replacement for the final rule and renders the authoritative empty state', () => {
    const { component, fixture, api } = createComponent(
      { tab: 'schedule' },
      {
        listRules: vi.fn(() => of([MONDAY_RULE])),
        saveRules: vi.fn(() => of([])),
      },
    );
    fixture.detectChanges();

    component.deleteRule(MONDAY_RULE);
    component.confirmDeleteRule();
    fixture.detectChanges();

    expect(api.saveRules).toHaveBeenCalledWith([]);
    expect(component.availabilityRules()).toEqual([]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.settings-page__closed-label'),
    ).toHaveLength(7);
    expect(fixture.nativeElement.textContent).toContain('Configurer mes horaires');
  });

  it('keeps the final weekly rule visible when deletion fails', () => {
    const { component } = createComponent(
      { tab: 'schedule' },
      {
        listRules: vi.fn(() => of([MONDAY_RULE])),
        saveRules: vi.fn(() => throwError(() => new Error('backend failed'))),
      },
    );

    component.deleteRule(MONDAY_RULE);
    component.confirmDeleteRule();

    expect(component.availabilityRules()).toEqual([MONDAY_RULE]);
    expect(component.scheduleError()).toContain('marqué comme fermé');
  });

  it('can add a weekly rule after the authoritative empty state', () => {
    const { component, api } = createComponent(
      {},
      {
        saveRules: vi.fn((rules: readonly AvailabilityRuleDto[]) => of(rules)),
      },
    );
    const newRule: AvailabilityRuleDto = { ...MONDAY_RULE, id: undefined };

    component.onRuleSaved(newRule);

    expect(api.saveRules).toHaveBeenCalledOnce();
    expect(component.availabilityRules()).toHaveLength(1);
  });

  it('always renders the seven-day overview with closed labels for an empty schedule', () => {
    const { fixture } = createComponent({ tab: 'schedule' });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.settings-page__schedule-day')).toHaveLength(7);
    expect(host.querySelectorAll('.settings-page__closed-label')).toHaveLength(7);
    for (const label of ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']) {
      expect(host.textContent).toContain(label);
    }
  });

  it('applies Monday through Friday in one whole-list PUT and uses the server response', () => {
    const serverRules = [
      MONDAY_RULE,
      { ...MONDAY_RULE, id: 'server-tuesday', dayOfWeek: 'TUESDAY' as const },
      { ...MONDAY_RULE, id: 'server-wednesday', dayOfWeek: 'WEDNESDAY' as const },
      { ...MONDAY_RULE, id: 'server-thursday', dayOfWeek: 'THURSDAY' as const },
      { ...MONDAY_RULE, id: 'server-friday', dayOfWeek: 'FRIDAY' as const },
    ];
    const { component, api } = createComponent({}, { saveRules: vi.fn(() => of(serverRules)) });

    component.openInitialSetup();
    component.onBulkScheduleSaved({
      days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      rule: { ...MONDAY_RULE, id: undefined, startTime: '09:00', endTime: '17:00' },
    });

    expect(api.saveRules).toHaveBeenCalledOnce();
    expect(api.saveRules.mock.calls[0]?.[0]).toHaveLength(5);
    expect(component.availabilityRules()).toEqual(serverRules);
    expect(component.bulkEditorOpen()).toBe(false);
    expect(component.scheduleSuccess()).toBe('Les horaires ont été enregistrés.');
  });

  it('bulk edit preserves unselected days and replaces each selected day once', () => {
    const { component, api } = createComponent(
      {},
      { listRules: vi.fn(() => of([MONDAY_RULE, TUESDAY_RULE])) },
    );
    const replacement = {
      ...MONDAY_RULE,
      id: undefined,
      startTime: '10:00',
      endTime: '18:00',
      slotDurationMinutes: 45,
    };

    component.onBulkScheduleSaved({
      days: ['MONDAY', 'WEDNESDAY', 'WEDNESDAY'],
      rule: replacement,
    });

    const submitted = api.saveRules.mock.calls[0]?.[0] as readonly AvailabilityRuleDto[];
    expect(api.saveRules).toHaveBeenCalledOnce();
    expect(submitted.find((candidate) => candidate.dayOfWeek === 'TUESDAY')).toEqual(TUESDAY_RULE);
    expect(submitted.filter((candidate) => candidate.dayOfWeek === 'WEDNESDAY')).toHaveLength(1);
    expect(submitted.find((candidate) => candidate.dayOfWeek === 'MONDAY')).toMatchObject({
      id: MONDAY_RULE.id,
      startTime: '10:00',
      endTime: '18:00',
      slotDurationMinutes: 45,
    });
  });

  it('keeps bulk editor state and schedule data when the whole-list PUT fails', () => {
    const { component } = createComponent(
      {},
      { saveRules: vi.fn(() => throwError(() => new Error('rejected'))) },
    );
    component.openInitialSetup();

    component.onBulkScheduleSaved({
      days: ['MONDAY'],
      rule: { ...MONDAY_RULE, id: undefined },
    });

    expect(component.bulkEditorOpen()).toBe(true);
    expect(component.bulkEditorDays()).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
    ]);
    expect(component.availabilityRules()).toEqual([]);
    expect(component.scheduleError()).toContain("n'ont pas pu être enregistrés");
  });

  it('individual editing replaces only its weekday', () => {
    const { component, api } = createComponent(
      {},
      { listRules: vi.fn(() => of([MONDAY_RULE, TUESDAY_RULE])) },
    );

    component.onRuleSaved({ ...MONDAY_RULE, startTime: '10:00', endTime: '16:00' });

    const submitted = api.saveRules.mock.calls[0]?.[0] as readonly AvailabilityRuleDto[];
    expect(submitted).toHaveLength(2);
    expect(submitted.find((candidate) => candidate.dayOfWeek === 'MONDAY')).toMatchObject({
      startTime: '10:00',
      endTime: '16:00',
    });
    expect(submitted.find((candidate) => candidate.dayOfWeek === 'TUESDAY')).toEqual(TUESDAY_RULE);
  });

  it('copies one source day only to chosen destinations and leaves exceptions untouched', () => {
    const { component, api } = createComponent(
      {},
      { listRules: vi.fn(() => of([MONDAY_RULE, TUESDAY_RULE])) },
    );
    component.exceptions.set([BLOCK_EXCEPTION]);

    component.onBulkScheduleSaved({ days: ['WEDNESDAY', 'THURSDAY'], rule: MONDAY_RULE });

    const submitted = api.saveRules.mock.calls[0]?.[0] as readonly AvailabilityRuleDto[];
    expect(submitted.find((candidate) => candidate.dayOfWeek === 'TUESDAY')).toEqual(TUESDAY_RULE);
    expect(submitted.find((candidate) => candidate.dayOfWeek === 'WEDNESDAY')).toMatchObject({
      startTime: MONDAY_RULE.startTime,
      endTime: MONDAY_RULE.endTime,
    });
    expect(submitted.find((candidate) => candidate.dayOfWeek === 'THURSDAY')).toMatchObject({
      startTime: MONDAY_RULE.startTime,
      endTime: MONDAY_RULE.endTime,
    });
    expect(component.exceptions()).toEqual([BLOCK_EXCEPTION]);
    expect(api.addException).not.toHaveBeenCalled();
    expect(api.deleteException).not.toHaveBeenCalled();
  });

  it('keeps all competing schedule actions disabled while saving', () => {
    const pending = new Subject<readonly AvailabilityRuleDto[]>();
    const { component, fixture } = createComponent(
      { tab: 'schedule' },
      {
        listRules: vi.fn(() => of([MONDAY_RULE])),
        saveRules: vi.fn(() => pending),
      },
    );
    component.onRuleSaved({ ...MONDAY_RULE, startTime: '09:00' });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(component.ruleSaving()).toBe(true);
    expect(host.querySelector<HTMLInputElement>('#schedule-day-MONDAY')?.disabled).toBe(true);
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('.settings-page__schedule-day button')].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });

  it('uses Doctor-wide product wording and exposes no technical add-rule action', () => {
    const { fixture } = createComponent({ tab: 'schedule' });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Planning du médecin — tous les cabinets');
    expect(host.textContent).toContain('Les rendez-vous existants restent inchangés.');
    expect(host.textContent).not.toContain('Ajouter une règle');
    expect(host.textContent).not.toContain('Ajouter une regle');
    expect(host.querySelector('#scheduleCabinetContext')).toBeNull();
  });

  it('does not let a prototype Cabinet context write the real Doctor-wide schedule', () => {
    const { component, api } = createComponent({}, { listRules: vi.fn(() => of([MONDAY_RULE])) });
    component.selectedScheduleContext.set('cabinet-lac-2');

    component.onBulkScheduleSaved({ days: ['TUESDAY'], rule: TUESDAY_RULE });

    expect(api.saveRules).not.toHaveBeenCalled();
    expect(component.availabilityRules()).toEqual([MONDAY_RULE]);
  });

  it('does not present unrequested exceptions as an authoritative empty result', () => {
    const { component, fixture } = createComponent();
    fixture.detectChanges();

    expect(component.exceptionLoadState()).toBe('notLoaded');
    expect(fixture.nativeElement.textContent).not.toContain('Aucune exception configurée');
  });

  it('renders a scoped loading state while exceptions are requested', () => {
    const pending = new Subject<readonly AvailabilityExceptionDto[]>();
    const { component, fixture } = createComponent(
      { tab: 'schedule' },
      {
        listExceptions: vi.fn(() => pending),
      },
    );
    fixture.detectChanges();

    expect(component.exceptionLoadState()).toBe('loading');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Chargement des exceptions"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Aucune exception configurée');
  });

  it('renders loaded empty and loaded populated exception states distinctly', () => {
    const response = new Subject<readonly AvailabilityExceptionDto[]>();
    const { component, fixture } = createComponent(
      { tab: 'schedule' },
      {
        listExceptions: vi.fn(() => response),
      },
    );
    fixture.detectChanges();

    response.next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucune exception configurée');

    component.exceptions.set([BLOCK_EXCEPTION]);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('.settings-page__exception-row');
    expect(row.querySelector('.settings-page__exception-date').textContent).toContain(
      '12 oct. 2026',
    );
    expect(row.querySelector('.settings-page__exception-type').textContent).toContain('Blocage');
    expect(row.querySelector('.settings-page__exception-window').textContent).toContain(
      '10:00 – 11:30',
    );
    expect(row.querySelector('.settings-page__exception-reason').textContent).toContain('Réunion');
    expect(row.querySelector('.settings-page__exception-delete').textContent).toContain(
      'Supprimer',
    );
  });

  it('renders a clean fallback when an exception has no reason', () => {
    const { component, fixture } = createComponent({ tab: 'schedule' });
    component.exceptions.set([{ ...BLOCK_EXCEPTION, reason: null }]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.settings-page__exception-reason').textContent.trim(),
    ).toBe('—');
  });

  it('opens a native delete confirmation with explicit cancel and delete actions', () => {
    const { component, fixture } = createComponent({ tab: 'schedule' });
    component.exceptions.set([BLOCK_EXCEPTION]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.settings-page__exception-delete').click();
    fixture.detectChanges();

    const modal = document.body.querySelector('.ant-modal') as HTMLElement;
    expect(component.deleteExceptionConfirmOpen()).toBe(true);
    expect(modal.textContent).toContain("Supprimer l'exception");
    expect(modal.textContent).toContain('Êtes-vous sûr de vouloir supprimer cette exception ?');
    expect(modal.textContent).toContain('12 oct. 2026 · 10:00 – 11:30');
    expect(modal.textContent).toContain('Annuler');
    expect(modal.textContent).toContain('Supprimer');
  });

  it('keeps delete open while pending and prevents duplicate DELETE requests', () => {
    const pending = new Subject<void>();
    const { component, api } = createComponent(
      { tab: 'schedule' },
      { deleteException: vi.fn(() => pending) },
    );
    component.exceptions.set([BLOCK_EXCEPTION]);
    component.deleteException(BLOCK_EXCEPTION);

    component.confirmDeleteException();
    component.confirmDeleteException();

    expect(api.deleteException).toHaveBeenCalledOnce();
    expect(component.exceptionSaving()).toBe(true);
    expect(component.deleteExceptionConfirmOpen()).toBe(true);

    pending.next();
    pending.complete();

    expect(component.deleteExceptionConfirmOpen()).toBe(false);
    expect(component.exceptionToDelete()).toBeNull();
  });

  it('keeps the delete modal open when deletion fails', () => {
    const { component } = createComponent(
      { tab: 'schedule' },
      { deleteException: vi.fn(() => throwError(() => new Error('failed'))) },
    );
    component.deleteException(BLOCK_EXCEPTION);

    component.confirmDeleteException();

    expect(component.deleteExceptionConfirmOpen()).toBe(true);
    expect(component.exceptionToDelete()).toBe(BLOCK_EXCEPTION);
    expect(component.exceptionMutationError()).toContain("n'a pas pu être supprimée");
  });

  it('preserves weekly rules on exception failure and retries only the exception request', () => {
    const retry = new Subject<readonly AvailabilityExceptionDto[]>();
    const listExceptions = vi
      .fn<() => Observable<readonly AvailabilityExceptionDto[]>>()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(retry);
    const { component, api } = createComponent(
      { tab: 'schedule' },
      {
        listRules: vi.fn(() => of([MONDAY_RULE])),
        listExceptions,
      },
    );

    expect(component.exceptionLoadState()).toBe('error');
    expect(component.availabilityRules()).toEqual([MONDAY_RULE]);

    component.loadExceptions();
    expect(component.exceptionLoadState()).toBe('loading');
    expect(api.listRules).toHaveBeenCalledOnce();
    expect(api.listExceptions).toHaveBeenCalledTimes(2);

    retry.next([]);
    expect(component.exceptionLoadState()).toBe('loaded');
  });

  it.each([
    ['BLOCK', 'FULL_DAY', '09:00', '15:00'],
    ['EXTRA', 'FULL_DAY', '09:00', '15:00'],
    ['BLOCK', 'TIME_WINDOW', '10:00', '11:30'],
    ['EXTRA', 'TIME_WINDOW', '10:00', '11:30'],
  ] as const)(
    'submits %s with %s using the existing backend time-window contract',
    (type, scope, expectedStart, expectedEnd) => {
      const addException = vi.fn((input: AvailabilityExceptionRequestDto) =>
        of({ ...BLOCK_EXCEPTION, ...input, id: `created-${type}-${scope}` }),
      );
      const { component } = createComponent(
        {},
        { addException, listRules: vi.fn(() => of([CERTIFIED_MONDAY_RULE])) },
      );
      component.exceptionForm.setValue({
        exceptionDate: '2026-10-12',
        type,
        scope,
        startTime: '10:00',
        endTime: '11:30',
        reason: 'Test',
      });

      component.addException();

      expect(addException).toHaveBeenCalledWith({
        exceptionDate: '2026-10-12',
        type,
        startTime: expectedStart,
        endTime: expectedEnd,
        reason: 'Test',
      });
    },
  );

  it('rejects a full-working-day exception when the selected weekday is closed', () => {
    const { component, api } = createComponent();
    component.exceptionForm.patchValue({ exceptionDate: '2026-10-10', scope: 'FULL_DAY' });

    component.addException();

    expect(api.addException).not.toHaveBeenCalled();
    expect(component.exceptionMutationError()).toContain('Aucun horaire actif');
  });

  it('allows only one exception POST while the first command is in flight', () => {
    const pending = new Subject<AvailabilityExceptionDto>();
    const { component, api } = createComponent(
      {},
      {
        listRules: vi.fn(() => of([CERTIFIED_MONDAY_RULE])),
        addException: vi.fn(() => pending),
      },
    );
    component.exceptionForm.patchValue({
      exceptionDate: '2026-10-12',
      type: 'BLOCK',
      scope: 'FULL_DAY',
    });

    component.addException();
    component.addException();

    expect(api.addException).toHaveBeenCalledOnce();
    expect(component.exceptionSaving()).toBe(true);
  });

  it('does not resubmit an exception when the authoritative list is refetched', () => {
    const { component, api } = createComponent(
      { tab: 'schedule' },
      { listRules: vi.fn(() => of([CERTIFIED_MONDAY_RULE])) },
    );
    component.exceptionForm.patchValue({ exceptionDate: '2026-10-12', scope: 'FULL_DAY' });
    component.addException();

    component.loadExceptions();

    expect(api.addException).toHaveBeenCalledOnce();
    expect(api.listExceptions).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid timed window before calling the backend', () => {
    const { component, api } = createComponent();
    component.exceptionForm.setValue({
      exceptionDate: '2026-10-12',
      type: 'BLOCK',
      scope: 'TIME_WINDOW',
      startTime: '12:00',
      endTime: '11:00',
      reason: '',
    });

    component.addException();

    expect(component.exceptionForm.hasError('timeWindowOrder')).toBe(true);
    expect(api.addException).not.toHaveBeenCalled();
  });

  it('uses shared time fields only for partial-time exceptions', () => {
    const { component, fixture } = createComponent({ tab: 'schedule' });
    component.openExceptionDialog();
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(OcTimeField))).toHaveLength(0);

    component.exceptionForm.controls.scope.setValue('TIME_WINDOW');
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(OcTimeField))).toHaveLength(2);
    expect(component.exceptionForm.getRawValue()).toMatchObject({
      startTime: '09:00',
      endTime: '10:00',
    });
  });

  it('uses real labels and a modal footer for adding an exception', () => {
    const { component, fixture } = createComponent({ tab: 'schedule' });
    component.openExceptionDialog();
    fixture.detectChanges();

    const modal = document.body.querySelector('.ant-modal') as HTMLElement;
    expect(modal.querySelector('label[for="exceptionDate"]')?.textContent).toContain('Date');
    expect(modal.querySelector('label[for="exceptionType"]')?.textContent).toContain('Type');
    expect(modal.querySelector('label[for="exceptionScope"]')?.textContent).toContain('Durée');
    expect(modal.querySelector('label[for="exceptionReason"]')?.textContent).toContain('Raison');
    expect(modal.querySelector('#exceptionReason')?.getAttribute('placeholder')).toBe('Optionnel');
    expect(modal.querySelector('.ant-modal-footer')?.textContent).toContain('Annuler');
    expect(modal.querySelector('.ant-modal-footer')?.textContent).toContain('Ajouter');
  });

  it('disables the add footer action while the request is pending', () => {
    const pending = new Subject<AvailabilityExceptionDto>();
    const { component, fixture } = createComponent(
      { tab: 'schedule' },
      {
        listRules: vi.fn(() => of([CERTIFIED_MONDAY_RULE])),
        addException: vi.fn(() => pending),
      },
    );
    component.openExceptionDialog();
    component.exceptionForm.patchValue({ exceptionDate: '2026-10-12' });
    component.addException();
    fixture.detectChanges();

    const addButton = document.body.querySelector(
      'button[form="availabilityExceptionForm"]',
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    expect(addButton.getAttribute('aria-busy')).toBe('true');
  });

  it('renders a backend exception error without closing the form', () => {
    const { component } = createComponent(
      { tab: 'schedule' },
      {
        listRules: vi.fn(() => of([CERTIFIED_MONDAY_RULE])),
        addException: vi.fn(() => throwError(() => new Error('rejected'))),
      },
    );
    component.openExceptionDialog();
    component.exceptionForm.patchValue({ exceptionDate: '2026-10-12' });

    component.addException();

    expect(component.exceptionDialogOpen()).toBe(true);
    expect(component.exceptionMutationError()).toContain("n'a pas pu être ajoutée");
  });
});

function createComponent(
  queryParams: Record<string, string> = {},
  overrides: Partial<ApiStub> = {},
): {
  component: SettingsPage;
  fixture: ComponentFixture<SettingsPage>;
  api: ApiStub;
  notificationApi: NotificationApiStub;
  accountApi: AccountSecurityApiStub;
} {
  const api: ApiStub = {
    listRules: vi.fn(() => of([])),
    saveRules: vi.fn((rules: readonly AvailabilityRuleDto[]) => of(rules)),
    listExceptions: vi.fn(() => of([])),
    addException: vi.fn((input: AvailabilityExceptionRequestDto) =>
      of({ ...BLOCK_EXCEPTION, ...input, id: 'created-exception' }),
    ),
    deleteException: vi.fn(() => of(undefined)),
    ...overrides,
  };
  const notificationApi: NotificationApiStub = {
    getAll: vi.fn(() => of([])),
    update: vi.fn(),
  };
  const accountApi: AccountSecurityApiStub = {
    getSummary: vi.fn(() =>
      of({
        accountType: 'DOCTOR',
        email: 'doctor@omnicare.tn',
        emailVerified: true,
        phone: '+21620123456',
        phoneVerified: true,
        hasPassword: true,
        mustChangePassword: false,
        mfaMethod: 'NONE',
      }),
    ),
    getDevices: vi.fn(() => of([])),
    changePassword: vi.fn(() => of(undefined)),
    logoutDevice: vi.fn(() => of(undefined)),
  };
  const auth = { logoutAll: vi.fn(() => of(undefined)) };

  TestBed.configureTestingModule({
    imports: [SettingsPage],
    providers: [
      provideRouter([]),
      provideNzIcons(OMNICARE_ICONS),
      provideNzI18n(en_GB),
      { provide: ActivatedRoute, useValue: { queryParams: of(queryParams) } },
      { provide: AppointmentApiService, useValue: api },
      { provide: NotificationPreferenceApiService, useValue: notificationApi },
      { provide: AccountSecurityApiService, useValue: accountApi },
      { provide: AuthService, useValue: auth },
    ],
  });
  const fixture = TestBed.createComponent(SettingsPage);
  return { component: fixture.componentInstance, fixture, api, notificationApi, accountApi };
}
