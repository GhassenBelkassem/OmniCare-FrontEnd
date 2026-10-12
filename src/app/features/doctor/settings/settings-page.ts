import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { NzModalModule } from 'ng-zorro-antd/modal';

import {
  OcPageHeader,
  OcTabs,
  OcCard,
  OcButton,
  OcEmptyState,
  OcConfirmDialog,
  OcTimeField,
} from '../../../shared/ui';
import { AppointmentApiService } from '../appointment-api.service';
import {
  AvailabilityRuleDto,
  AvailabilityExceptionDto,
  DayOfWeekDto,
} from '../appointment-api.models';
import { AvailabilityRuleDialog } from './availability-rule-dialog';
import {
  BulkScheduleChange,
  BulkScheduleEditor,
  BulkScheduleMode,
  WEEKDAYS,
  WEEKDAY_LABELS,
  mergeScheduleRules,
  removeScheduleDay,
} from './bulk-schedule-editor';
import { CabinetSettingsSection } from './cabinet-settings-section';
import { ProfessionalReadinessOverview } from './professional-readiness-overview';
import { ProfessionalProfileSection } from './professional-profile-section';
import { ReadinessSettingsTab } from './readiness-reason-presentation';
import { ServicesSettingsSection } from './services-settings-section';
import { NotificationSettingsSection } from './notification-settings-section';
import { AccountSecuritySection } from './account-security-section';
import { ScheduledCarePrototypeStore } from '../scheduled-care-prototype.store';
import { activeSlot } from '../scheduled-care-prototype.models';
import {
  AvailabilityExceptionScope,
  fullWorkingDayWindow,
  wallClockMinute,
} from '../availability-exception.adapter';

type ExceptionLoadState = 'notLoaded' | 'loading' | 'loaded' | 'error';
export const REAL_SCHEDULE_CONTEXT = 'REAL_CURRENT';

function exceptionWindowValidator(control: AbstractControl): ValidationErrors | null {
  if (control.get('scope')?.value !== 'TIME_WINDOW') {
    return null;
  }
  const startTime = control.get('startTime')?.value as string | null;
  const endTime = control.get('endTime')?.value as string | null;
  if (!startTime || !endTime) {
    return { timeWindowRequired: true };
  }
  return startTime < endTime ? null : { timeWindowOrder: true };
}

@Component({
  selector: 'app-settings-page',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    OcPageHeader,
    OcTabs,
    OcCard,
    OcButton,
    OcEmptyState,
    OcConfirmDialog,
    OcTimeField,
    AvailabilityRuleDialog,
    BulkScheduleEditor,
    CabinetSettingsSection,
    ProfessionalReadinessOverview,
    ProfessionalProfileSection,
    ServicesSettingsSection,
    AccountSecuritySection,
    NotificationSettingsSection,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly scheduledCare = inject(ScheduledCarePrototypeStore);

  readonly activeTab = signal('overview');

  readonly tabs = signal([
    { id: 'overview', label: 'Vue d’ensemble', icon: 'dashboard' },
    { id: 'profile', label: 'Profil', icon: 'user' },
    { id: 'cabinets', label: 'Cabinets', icon: 'environment' },
    { id: 'schedule', label: 'Emploi du temps', icon: 'calendar' },
    { id: 'services', label: 'Services', icon: 'medicine-box' },
    { id: 'account', label: 'Compte & sécurité', icon: 'audit' },
    { id: 'notifications', label: 'Notifications', icon: 'notification' },
  ]);

  readonly availabilityRules = signal<readonly AvailabilityRuleDto[]>([]);
  readonly selectedScheduleContext = signal<string>(REAL_SCHEDULE_CONTEXT);
  readonly prototypeRulesByCabinet = signal<
    Readonly<Record<string, readonly AvailabilityRuleDto[]>>
  >({
    'cabinet-lac-2': [
      {
        id: 'prototype-lac-monday',
        dayOfWeek: 'MONDAY',
        active: true,
        startTime: '09:00',
        endTime: '13:00',
        pauseStart: null,
        pauseEnd: null,
        slotDurationMinutes: 30,
      },
      {
        id: 'prototype-lac-wednesday',
        dayOfWeek: 'WEDNESDAY',
        active: true,
        startTime: '09:00',
        endTime: '17:00',
        pauseStart: '13:00',
        pauseEnd: '14:00',
        slotDurationMinutes: 30,
      },
    ],
    'cabinet-ariana': [
      {
        id: 'prototype-ariana-monday',
        dayOfWeek: 'MONDAY',
        active: true,
        startTime: '15:00',
        endTime: '19:00',
        pauseStart: null,
        pauseEnd: null,
        slotDurationMinutes: 20,
      },
    ],
  });
  readonly scheduleLoading = signal(false);
  readonly scheduleLoadError = signal<string | null>(null);
  readonly scheduleError = signal<string | null>(null);
  readonly scheduleSuccess = signal<string | null>(null);
  readonly scheduleConflictWarning = signal<string | null>(null);

  readonly scheduleContexts = computed(() => [
    ...this.scheduledCare.cabinets().map((cabinet) => ({
      id: cabinet.id,
      label: `${cabinet.name} — prototype P2`,
    })),
    { id: REAL_SCHEDULE_CONTEXT, label: 'Planning actuel tous cabinets — API réelle' },
  ]);
  readonly scheduleContextIsPrototype = computed(
    () => this.selectedScheduleContext() !== REAL_SCHEDULE_CONTEXT,
  );
  readonly scheduleContextLabel = computed(
    () =>
      this.scheduleContexts().find((context) => context.id === this.selectedScheduleContext())
        ?.label ?? 'Planning actuel',
  );
  readonly visibleAvailabilityRules = computed(() => {
    const context = this.selectedScheduleContext();
    return context === REAL_SCHEDULE_CONTEXT
      ? this.availabilityRules()
      : (this.prototypeRulesByCabinet()[context] ?? []);
  });
  readonly existingRuleDays = computed(() =>
    this.scheduleContextIsPrototype()
      ? this.visibleAvailabilityRules().map((rule) => rule.dayOfWeek)
      : [],
  );

  readonly dayKeys = WEEKDAYS.map((day) => day.value);
  readonly selectedScheduleDays = signal<ReadonlySet<DayOfWeekDto>>(new Set());
  readonly bulkEditorOpen = signal(false);
  readonly bulkEditorMode = signal<BulkScheduleMode>('setup');
  readonly bulkEditorDays = signal<readonly DayOfWeekDto[]>([]);
  readonly copySourceRule = signal<AvailabilityRuleDto | null>(null);

  readonly ruleDialogOpen = signal(false);
  readonly editingRule = signal<AvailabilityRuleDto | null>(null);
  readonly editingDay = signal<DayOfWeekDto>('MONDAY');
  readonly ruleSaving = signal(false);

  readonly exceptions = signal<readonly AvailabilityExceptionDto[]>([]);
  readonly exceptionLoadState = signal<ExceptionLoadState>('notLoaded');
  readonly exceptionLoadError = signal<string | null>(null);
  readonly exceptionMutationError = signal<string | null>(null);
  readonly exceptionSaving = signal(false);
  readonly exceptionDialogOpen = signal(false);
  readonly exceptionForm = new FormGroup(
    {
      exceptionDate: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      type: new FormControl<'BLOCK' | 'EXTRA'>('BLOCK', { nonNullable: true }),
      scope: new FormControl<AvailabilityExceptionScope>('FULL_DAY', { nonNullable: true }),
      startTime: new FormControl('09:00', { nonNullable: true }),
      endTime: new FormControl('10:00', { nonNullable: true }),
      reason: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(300)],
      }),
    },
    { validators: exceptionWindowValidator },
  );

  readonly deleteRuleConfirmOpen = signal(false);
  readonly ruleToDelete = signal<AvailabilityRuleDto | null>(null);
  readonly deleteExceptionConfirmOpen = signal(false);
  readonly exceptionToDelete = signal<AvailabilityExceptionDto | null>(null);

  constructor() {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params['tab']) {
        const tab = this.normalizeTab(params['tab']);
        this.activeTab.set(tab);
        if (tab === 'schedule') {
          this.ensureExceptionsLoaded();
        }
      }
    });
    this.loadSchedule();
  }

  onTabChange(id: string): void {
    this.activeTab.set(id);
    if (id === 'schedule') {
      this.ensureExceptionsLoaded();
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id === 'overview' ? null : id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onScheduleContextChange(contextId: string): void {
    if (!this.scheduleContexts().some((context) => context.id === contextId)) return;
    this.selectedScheduleContext.set(contextId);
    this.scheduleError.set(null);
    this.scheduleConflictWarning.set(null);
  }

  onOverviewNavigate(tab: ReadinessSettingsTab): void {
    this.onTabChange(tab);
  }

  getDayLabel(day: DayOfWeekDto): string {
    return WEEKDAY_LABELS[day];
  }

  getDayRule(day: DayOfWeekDto): AvailabilityRuleDto | null {
    return this.visibleAvailabilityRules().find((rule) => rule.dayOfWeek === day) ?? null;
  }

  formatTime(time: string): string {
    return wallClockMinute(time);
  }

  formatExceptionWindow(exception: AvailabilityExceptionDto): string {
    return `${this.formatTime(exception.startTime)} – ${this.formatTime(exception.endTime)}`;
  }

  formatExceptionDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  scheduleMutationBlocked(): boolean {
    return this.ruleSaving() || this.scheduleLoading() || Boolean(this.scheduleLoadError());
  }

  trackByExceptionId(_index: number, exception: AvailabilityExceptionDto): string {
    return exception.id;
  }

  openAddRule(): void {
    this.openInitialSetup();
  }

  openInitialSetup(): void {
    if (this.scheduleMutationBlocked()) return;
    this.scheduleError.set(null);
    this.scheduleSuccess.set(null);
    this.bulkEditorMode.set('setup');
    this.bulkEditorDays.set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
    this.copySourceRule.set(null);
    this.bulkEditorOpen.set(true);
  }

  toggleScheduleDay(day: DayOfWeekDto, selected: boolean): void {
    if (this.scheduleMutationBlocked()) return;
    this.selectedScheduleDays.update((current) => {
      const next = new Set(current);
      if (selected) next.add(day);
      else next.delete(day);
      return next;
    });
  }

  openBulkEdit(): void {
    const days = WEEKDAYS.map((day) => day.value).filter((day) =>
      this.selectedScheduleDays().has(day),
    );
    if (days.length === 0 || this.scheduleMutationBlocked()) return;
    this.scheduleError.set(null);
    this.scheduleSuccess.set(null);
    this.bulkEditorMode.set('edit');
    this.bulkEditorDays.set(days);
    this.copySourceRule.set(this.getDayRule(days[0]));
    this.bulkEditorOpen.set(true);
  }

  openCopyRule(rule: AvailabilityRuleDto): void {
    if (this.scheduleMutationBlocked()) return;
    this.scheduleError.set(null);
    this.scheduleSuccess.set(null);
    this.bulkEditorMode.set('copy');
    this.bulkEditorDays.set([]);
    this.copySourceRule.set(rule);
    this.bulkEditorOpen.set(true);
  }

  closeBulkEditor(): void {
    if (this.ruleSaving()) return;
    this.bulkEditorOpen.set(false);
    this.copySourceRule.set(null);
  }

  onBulkScheduleSaved(change: BulkScheduleChange): void {
    if (this.scheduleContextIsPrototype()) return;
    const updated = mergeScheduleRules(this.availabilityRules(), change.days, change.rule);
    this.saveFullSchedule(updated, () => {
      this.bulkEditorOpen.set(false);
      this.copySourceRule.set(null);
      this.selectedScheduleDays.set(new Set());
    });
  }

  openEditDay(day: DayOfWeekDto): void {
    if (this.scheduleMutationBlocked()) return;
    const rule = this.getDayRule(day);
    this.scheduleError.set(null);
    this.scheduleSuccess.set(null);
    this.editingDay.set(day);
    this.editingRule.set(rule);
    this.ruleDialogOpen.set(true);
  }

  openEditRule(rule: AvailabilityRuleDto): void {
    this.openEditDay(rule.dayOfWeek);
  }

  onRuleDialogClose(): void {
    this.ruleDialogOpen.set(false);
    this.editingRule.set(null);
  }

  onRuleSaved(rule: AvailabilityRuleDto): void {
    if (this.scheduleContextIsPrototype()) {
      const cabinetId = this.selectedScheduleContext();
      const current = this.prototypeRulesByCabinet()[cabinetId] ?? [];
      const saved = mergeScheduleRules(current, [rule.dayOfWeek], rule);
      this.prototypeRulesByCabinet.update((all) => ({ ...all, [cabinetId]: saved }));
      this.scheduleConflictWarning.set(
        this.ruleConflictsWithCommitment(rule, cabinetId)
          ? 'Un ou plusieurs rendez-vous existants se trouvent hors de cette nouvelle disponibilité. Ils restent confirmés et ne seront pas annulés automatiquement.'
          : null,
      );
      this.onRuleDialogClose();
      return;
    }
    const updated = mergeScheduleRules(this.availabilityRules(), [rule.dayOfWeek], rule);
    this.saveFullSchedule(updated, () => this.onRuleDialogClose());
  }

  deleteRule(rule: AvailabilityRuleDto): void {
    this.markDayClosed(rule);
  }

  markDayClosed(rule: AvailabilityRuleDto): void {
    if (this.scheduleMutationBlocked()) return;
    this.ruleToDelete.set(rule);
    this.deleteRuleConfirmOpen.set(true);
  }

  confirmDeleteRule(): void {
    const rule = this.ruleToDelete();
    if (!rule) return;
    this.deleteRuleConfirmOpen.set(false);
    this.ruleToDelete.set(null);
    if (this.scheduleContextIsPrototype()) {
      const cabinetId = this.selectedScheduleContext();
      const updated = (this.prototypeRulesByCabinet()[cabinetId] ?? []).filter(
        (candidate) => candidate !== rule,
      );
      this.prototypeRulesByCabinet.update((all) => ({ ...all, [cabinetId]: updated }));
      this.scheduleConflictWarning.set(
        'Les rendez-vous existants de ce jour restent inchangés. Seule la configuration locale du prototype est retirée.',
      );
      return;
    }
    const updated = removeScheduleDay(this.availabilityRules(), rule.dayOfWeek);
    this.saveFullSchedule(updated, undefined, "Le jour n'a pas pu être marqué comme fermé.");
  }

  cancelDeleteRule(): void {
    this.deleteRuleConfirmOpen.set(false);
    this.ruleToDelete.set(null);
  }

  loadExceptions(): void {
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    this.exceptionLoadState.set('loading');
    this.exceptionLoadError.set(null);
    this.appointmentApi
      .listExceptions(today, future)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.exceptions.set(list);
          this.exceptionLoadState.set('loaded');
        },
        error: () => {
          this.exceptionLoadError.set('Impossible de charger les exceptions.');
          this.exceptionLoadState.set('error');
        },
      });
  }

  openExceptionDialog(): void {
    this.ensureExceptionsLoaded();
    if (this.exceptionLoadState() !== 'loaded') return;
    this.exceptionMutationError.set(null);
    this.exceptionForm.reset({
      exceptionDate: '',
      type: 'BLOCK',
      scope: 'FULL_DAY',
      startTime: '09:00',
      endTime: '10:00',
      reason: '',
    });
    this.exceptionDialogOpen.set(true);
  }

  closeExceptionDialog(): void {
    this.exceptionDialogOpen.set(false);
    this.exceptionMutationError.set(null);
  }

  addException(): void {
    if (this.exceptionSaving()) return;
    this.exceptionForm.markAllAsTouched();
    if (this.exceptionForm.invalid) return;
    const value = this.exceptionForm.getRawValue();
    const fullDay = value.scope === 'FULL_DAY';
    const window = fullDay
      ? fullWorkingDayWindow(this.availabilityRules(), value.exceptionDate)
      : { startTime: value.startTime, endTime: value.endTime };
    if (window === null) {
      this.exceptionMutationError.set("Aucun horaire actif n'est configuré pour cette journée.");
      return;
    }
    this.exceptionSaving.set(true);
    this.exceptionMutationError.set(null);
    this.appointmentApi
      .addException({
        exceptionDate: value.exceptionDate,
        type: value.type,
        startTime: window.startTime,
        endTime: window.endTime,
        reason: value.reason.trim() || null,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.exceptionSaving.set(false)),
      )
      .subscribe({
        next: (created) => {
          this.exceptions.update((list) => [...list, created]);
          this.exceptionLoadState.set('loaded');
          this.exceptionDialogOpen.set(false);
        },
        error: () => {
          this.exceptionMutationError.set("L'exception n'a pas pu être ajoutée.");
        },
      });
  }

  deleteException(exception: AvailabilityExceptionDto): void {
    if (this.exceptionSaving()) return;
    this.exceptionMutationError.set(null);
    this.exceptionToDelete.set(exception);
    this.deleteExceptionConfirmOpen.set(true);
  }

  confirmDeleteException(): void {
    if (this.exceptionSaving()) return;
    const exception = this.exceptionToDelete();
    if (!exception) return;
    this.exceptionSaving.set(true);
    this.exceptionMutationError.set(null);
    this.appointmentApi
      .deleteException(exception.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.exceptionSaving.set(false)),
      )
      .subscribe({
        next: () => {
          this.exceptions.update((list) => list.filter((e) => e.id !== exception.id));
          this.deleteExceptionConfirmOpen.set(false);
          this.exceptionToDelete.set(null);
        },
        error: () => this.exceptionMutationError.set("L'exception n'a pas pu être supprimée."),
      });
  }

  cancelDeleteException(): void {
    if (this.exceptionSaving()) return;
    this.deleteExceptionConfirmOpen.set(false);
    this.exceptionToDelete.set(null);
    this.exceptionMutationError.set(null);
  }

  private loadSchedule(): void {
    this.scheduleLoading.set(true);
    this.scheduleLoadError.set(null);

    this.appointmentApi
      .listRules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rules) => {
          this.availabilityRules.set(rules);
          this.scheduleLoading.set(false);
        },
        error: () => {
          this.scheduleLoadError.set('Impossible de charger les regles de disponibilite.');
          this.scheduleLoading.set(false);
        },
      });
  }

  private saveFullSchedule(
    updated: readonly AvailabilityRuleDto[],
    afterSuccess?: () => void,
    errorMessage = "Les horaires n'ont pas pu être enregistrés.",
  ): void {
    if (this.ruleSaving()) return;
    this.ruleSaving.set(true);
    this.scheduleError.set(null);
    this.scheduleSuccess.set(null);
    this.appointmentApi
      .saveRules(updated)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.ruleSaving.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.availabilityRules.set(saved);
          this.scheduleSuccess.set('Les horaires ont été enregistrés.');
          afterSuccess?.();
        },
        error: () => this.scheduleError.set(errorMessage),
      });
  }

  private ensureExceptionsLoaded(): void {
    if (this.exceptionLoadState() === 'notLoaded') {
      this.loadExceptions();
    }
  }

  private normalizeTab(value: unknown): string {
    if (value === 'preferences') return 'notifications';
    return this.tabs().some((tab) => tab.id === value) ? String(value) : 'overview';
  }

  private ruleConflictsWithCommitment(rule: AvailabilityRuleDto, cabinetId: string): boolean {
    const weekdayIndex: Record<DayOfWeekDto, number> = {
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
      SUNDAY: 0,
    };
    return this.scheduledCare.activeCalendarRecords().some((record) => {
      const commitment = activeSlot(record);
      if (record.cabinet.id !== cabinetId) return false;
      const start = new Date(commitment.start);
      if (start.getDay() !== weekdayIndex[rule.dayOfWeek]) return false;
      const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      const end = new Date(commitment.end);
      const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      if (!rule.active || startTime < rule.startTime || endTime > rule.endTime) return true;
      return Boolean(
        rule.pauseStart && rule.pauseEnd && startTime < rule.pauseEnd && rule.pauseStart < endTime,
      );
    });
  }
}
