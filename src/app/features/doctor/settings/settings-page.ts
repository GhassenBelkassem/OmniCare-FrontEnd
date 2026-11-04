import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  OcButton,
  OcCard,
  OcConfirmDialog,
  OcEmptyState,
  OcPageHeader,
  OcTabs,
} from '../../../shared/ui';
import { AppointmentApiService } from '../appointment-api.service';
import { AvailabilityRuleDto, DayOfWeekDto } from '../appointment-api.models';
import { wallClockMinute } from '../availability-exception.adapter';
import { UnsavedChangesAware } from '../unsaved-changes.guard';
import { AccountSecuritySection } from './account-security-section';
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
import { NotificationSettingsSection } from './notification-settings-section';
import { ProfessionalProfileSection } from './professional-profile-section';
import { ServicesSettingsSection } from './services-settings-section';

@Component({
  selector: 'app-settings-page',
  imports: [
    OcButton,
    OcCard,
    OcConfirmDialog,
    OcEmptyState,
    OcPageHeader,
    OcTabs,
    AvailabilityRuleDialog,
    BulkScheduleEditor,
    CabinetSettingsSection,
    ProfessionalProfileSection,
    ServicesSettingsSection,
    AccountSecuritySection,
    NotificationSettingsSection,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class SettingsPage implements UnsavedChangesAware {
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  readonly activeTab = signal('profile');
  readonly urgentConfigurationDirty = signal(false);
  readonly tabs = signal([
    { id: 'profile', label: 'Profil', icon: 'user' },
    { id: 'cabinets', label: 'Cabinets', icon: 'environment' },
    { id: 'schedule', label: 'Horaires et disponibilités', icon: 'calendar' },
    { id: 'services', label: 'Services', icon: 'medicine-box' },
    { id: 'account', label: 'Sécurité', icon: 'audit' },
    { id: 'notifications', label: 'Notifications', icon: 'notification' },
  ]);

  readonly availabilityRules = signal<readonly AvailabilityRuleDto[]>([]);
  readonly scheduleLoading = signal(false);
  readonly scheduleLoadError = signal<string | null>(null);
  readonly scheduleError = signal<string | null>(null);
  readonly scheduleSuccess = signal<string | null>(null);
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
  readonly deleteRuleConfirmOpen = signal(false);
  readonly ruleToDelete = signal<AvailabilityRuleDto | null>(null);

  constructor() {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = this.normalizeTab(params['tab']);
      if (
        this.activeTab() === 'services' &&
        tab !== 'services' &&
        !this.confirmDiscardUrgentChanges()
      ) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { tab: 'services' },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      }
      this.activeTab.set(tab);
    });
    this.loadSchedule();
  }

  onTabChange(id: string): void {
    if (
      this.activeTab() === 'services' &&
      id !== 'services' &&
      !this.confirmDiscardUrgentChanges()
    ) {
      return;
    }
    this.activeTab.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id === 'profile' ? null : id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  canDeactivate(): boolean {
    return this.confirmDiscardUrgentChanges();
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.urgentConfigurationDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  getDayLabel(day: DayOfWeekDto): string {
    return WEEKDAY_LABELS[day];
  }

  getDayRule(day: DayOfWeekDto): AvailabilityRuleDto | null {
    return this.availabilityRules().find((rule) => rule.dayOfWeek === day) ?? null;
  }

  formatTime(time: string): string {
    return wallClockMinute(time);
  }

  scheduleMutationBlocked(): boolean {
    return this.ruleSaving() || this.scheduleLoading() || Boolean(this.scheduleLoadError());
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
    const updated = mergeScheduleRules(this.availabilityRules(), change.days, change.rule);
    this.saveFullSchedule(updated, () => {
      this.bulkEditorOpen.set(false);
      this.copySourceRule.set(null);
      this.selectedScheduleDays.set(new Set());
    });
  }

  openEditDay(day: DayOfWeekDto): void {
    if (this.scheduleMutationBlocked()) return;
    this.scheduleError.set(null);
    this.scheduleSuccess.set(null);
    this.editingDay.set(day);
    this.editingRule.set(this.getDayRule(day));
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
    const updated = removeScheduleDay(this.availabilityRules(), rule.dayOfWeek);
    this.saveFullSchedule(updated, undefined, "Le jour n'a pas pu être marqué comme fermé.");
  }

  cancelDeleteRule(): void {
    this.deleteRuleConfirmOpen.set(false);
    this.ruleToDelete.set(null);
  }

  openCalendar(): void {
    void this.router.navigate(['/doctor/calendar']);
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
          this.scheduleLoadError.set('Impossible de charger les horaires habituels.');
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
          this.scheduleSuccess.set('Horaires enregistrés.');
          afterSuccess?.();
        },
        error: () => this.scheduleError.set(errorMessage),
      });
  }

  private normalizeTab(value: unknown): string {
    if (value === 'preferences') return 'notifications';
    if (value === 'overview') return 'profile';
    return this.tabs().some((tab) => tab.id === value) ? String(value) : 'profile';
  }

  private confirmDiscardUrgentChanges(): boolean {
    if (!this.urgentConfigurationDirty()) return true;
    return (
      this.document.defaultView?.confirm(
        'Des modifications de configuration urgente ne sont pas enregistrées. Voulez-vous les abandonner ?',
      ) ?? false
    );
  }
}
