import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  OcPageHeader,
  OcTabs,
  OcCard,
  OcButton,
  OcEmptyState,
  OcConfirmDialog,
} from '../../../shared/ui';
import { AppointmentApiService } from '../appointment-api.service';
import { AvailabilityRuleDto, AvailabilityExceptionDto, DayOfWeekDto } from '../appointment-api.models';
import { AvailabilityRuleDialog } from './availability-rule-dialog';
import { ProfessionalProfileSection } from './professional-profile-section';

interface ServiceItem {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly active: boolean;
  readonly duration: string;
}

interface ConsultationTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly lastUsed: string;
}

const DAY_LABELS: Record<DayOfWeekDto, string> = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
};

@Component({
  selector: 'app-settings-page',
  imports: [
    FormsModule,
    OcPageHeader,
    OcTabs,
    OcCard,
    OcButton,
    OcEmptyState,
    OcConfirmDialog,
    AvailabilityRuleDialog,
    ProfessionalProfileSection,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  readonly activeTab = signal('profile');

  readonly tabs = signal([
    { id: 'profile', label: 'Profil', icon: 'user' },
    { id: 'schedule', label: 'Emploi du temps', icon: 'calendar' },
    { id: 'services', label: 'Services', icon: 'medicine-box' },
    { id: 'templates', label: 'Modeles', icon: 'file-text' },
    { id: 'preferences', label: 'Preferences', icon: 'setting' },
  ]);

  readonly availabilityRules = signal<readonly AvailabilityRuleDto[]>([]);
  readonly scheduleLoading = signal(false);
  readonly scheduleError = signal<string | null>(null);

  readonly services = signal<ServiceItem[]>([
    { id: 'srv-1', name: 'Consultation generale', price: 80, active: true, duration: '20 min' },
    { id: 'srv-2', name: 'Consultation de suivi', price: 60, active: true, duration: '15 min' },
    { id: 'srv-3', name: 'Bilan sanguin', price: 120, active: true, duration: '10 min' },
    { id: 'srv-4', name: 'ECG', price: 100, active: true, duration: '15 min' },
    { id: 'srv-5', name: 'Vaccination', price: 50, active: true, duration: '10 min' },
    { id: 'srv-6', name: 'Certificat medical', price: 40, active: true, duration: '10 min' },
    { id: 'srv-7', name: 'Ordonnance', price: 30, active: false, duration: '5 min' },
    { id: 'srv-8', name: 'Teleconsultation', price: 100, active: true, duration: '25 min' },
  ]);

  readonly templates = signal<ConsultationTemplate[]>([
    {
      id: 'tpl-1',
      name: 'Consultation initiale - Hypertension',
      category: 'Cardiologie',
      description: 'Bilan initial avec mesure PA, examen clinique, biologie prescrite et initiation traitement.',
      lastUsed: '2026-08-15',
    },
    {
      id: 'tpl-2',
      name: 'Suivi diabete type 2',
      category: 'Diabetologie',
      description: 'Controle glycemie, HbA1c, examen pieds, ajustement metformine.',
      lastUsed: '2026-08-12',
    },
    {
      id: 'tpl-3',
      name: 'Consultation pediatrique standard',
      category: 'Pediatrie',
      description: 'Examen clinique complet, courbes de croissance, vaccinations a jour.',
      lastUsed: '2026-08-10',
    },
    {
      id: 'tpl-4',
      name: 'Certificat sportif',
      category: 'Administratif',
      description: 'Examen clinique cardiaque, questionnaire medical, delivrance certificat.',
      lastUsed: '2026-08-05',
    },
  ]);

  readonly emailNotifications = signal(true);
  readonly smsNotifications = signal(false);
  readonly urgentAlerts = signal(true);

  readonly dayLabels = computed(() => DAY_LABELS);

  readonly dayKeys = computed<DayOfWeekDto[]>(() => Object.keys(DAY_LABELS) as DayOfWeekDto[]);

  readonly ruleDialogOpen = signal(false);
  readonly editingRule = signal<AvailabilityRuleDto | null>(null);
  readonly ruleSaving = signal(false);

  readonly exceptions = signal<readonly AvailabilityExceptionDto[]>([]);
  readonly exceptionsLoading = signal(false);
  readonly exceptionsError = signal<string | null>(null);
  readonly exceptionDialogOpen = signal(false);
  readonly newExceptionDate = signal('');
  readonly newExceptionType = signal<'BLOCK' | 'EXTRA'>('BLOCK');
  readonly newExceptionReason = signal('');

  readonly deleteRuleConfirmOpen = signal(false);
  readonly ruleToDelete = signal<AvailabilityRuleDto | null>(null);
  readonly deleteExceptionConfirmOpen = signal(false);
  readonly exceptionToDelete = signal<AvailabilityExceptionDto | null>(null);

  readonly groupedRules = computed(() => {
    const rules = this.availabilityRules();
    const grouped = new Map<DayOfWeekDto, AvailabilityRuleDto[]>();
    const dayOrder: DayOfWeekDto[] = [
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
    ];

    for (const day of dayOrder) {
      grouped.set(day, []);
    }

    for (const rule of rules) {
      const existing = grouped.get(rule.dayOfWeek);
      if (existing) {
        existing.push(rule);
      }
    }

    return grouped;
  });

  constructor() {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params['tab']) {
          this.activeTab.set(params['tab']);
        }
      });
    this.loadSchedule();
  }

  onTabChange(id: string): void {
    this.activeTab.set(id);
  }

  onServiceToggle(serviceId: string): void {
    this.services.update((list) =>
      list.map((s) => (s.id === serviceId ? { ...s, active: !s.active } : s)),
    );
  }

  onEmailNotificationsToggle(): void {
    this.emailNotifications.update((v) => !v);
  }

  onSmsNotificationsToggle(): void {
    this.smsNotifications.update((v) => !v);
  }

  onUrgentAlertsToggle(): void {
    this.urgentAlerts.update((v) => !v);
  }

  getDayLabel(day: DayOfWeekDto): string {
    return DAY_LABELS[day];
  }

  getDayRules(day: DayOfWeekDto): readonly AvailabilityRuleDto[] {
    return this.groupedRules().get(day) ?? [];
  }

  formatTime(time: string): string {
    return time.substring(0, 5);
  }

  trackByServiceId(_index: number, service: ServiceItem): string {
    return service.id;
  }

  trackByTemplateId(_index: number, template: ConsultationTemplate): string {
    return template.id;
  }

  trackByRuleId(_index: number, rule: AvailabilityRuleDto): string {
    return rule.id ?? `${rule.dayOfWeek}-${rule.startTime}`;
  }

  trackByExceptionId(_index: number, exception: AvailabilityExceptionDto): string {
    return exception.id;
  }

  openAddRule(): void {
    this.editingRule.set(null);
    this.ruleDialogOpen.set(true);
  }

  openEditRule(rule: AvailabilityRuleDto): void {
    this.editingRule.set(rule);
    this.ruleDialogOpen.set(true);
  }

  onRuleDialogClose(): void {
    this.ruleDialogOpen.set(false);
    this.editingRule.set(null);
  }

  onRuleSaved(rule: AvailabilityRuleDto): void {
    this.ruleSaving.set(true);
    let updated: readonly AvailabilityRuleDto[];
    if (rule.id) {
      updated = this.availabilityRules().map((r) => (r.id === rule.id ? rule : r));
    } else {
      updated = [...this.availabilityRules(), { ...rule, id: `rule-${Date.now()}` }];
    }
    this.appointmentApi.saveRules(updated)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.ruleSaving.set(false)),
      )
      .subscribe({
        next: (saved: readonly AvailabilityRuleDto[]) => this.availabilityRules.set(saved),
        error: () => this.scheduleError.set('Erreur lors de l\'enregistrement de la regle.'),
      });
  }

  deleteRule(rule: AvailabilityRuleDto): void {
    this.ruleToDelete.set(rule);
    this.deleteRuleConfirmOpen.set(true);
  }

  confirmDeleteRule(): void {
    const rule = this.ruleToDelete();
    if (!rule) return;
    this.deleteRuleConfirmOpen.set(false);
    this.ruleToDelete.set(null);
    const updated = this.availabilityRules().filter((r) => r !== rule);
    this.appointmentApi.saveRules(updated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => this.availabilityRules.set(saved),
        error: () => this.scheduleError.set('Erreur lors de la suppression.'),
      });
  }

  cancelDeleteRule(): void {
    this.deleteRuleConfirmOpen.set(false);
    this.ruleToDelete.set(null);
  }

  loadExceptions(): void {
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    this.exceptionsLoading.set(true);
    this.exceptionsError.set(null);
    this.appointmentApi.listExceptions(today, future)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => { this.exceptions.set(list); this.exceptionsLoading.set(false); },
        error: () => { this.exceptionsError.set('Erreur de chargement des exceptions.'); this.exceptionsLoading.set(false); },
      });
  }

  addException(): void {
    if (!this.newExceptionDate()) return;
    this.exceptionsLoading.set(true);
    this.appointmentApi.addException({
      exceptionDate: this.newExceptionDate(),
      type: this.newExceptionType(),
      startTime: '00:00',
      endTime: '23:59',
      reason: this.newExceptionReason() || null,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.exceptions.update((list) => [...list, created]);
          this.exceptionsLoading.set(false);
          this.exceptionDialogOpen.set(false);
          this.newExceptionDate.set('');
          this.newExceptionReason.set('');
        },
        error: () => { this.exceptionsError.set('Erreur lors de l\'ajout.'); this.exceptionsLoading.set(false); },
      });
  }

  deleteException(exception: AvailabilityExceptionDto): void {
    this.exceptionToDelete.set(exception);
    this.deleteExceptionConfirmOpen.set(true);
  }

  confirmDeleteException(): void {
    const exception = this.exceptionToDelete();
    if (!exception) return;
    this.deleteExceptionConfirmOpen.set(false);
    this.exceptionToDelete.set(null);
    this.appointmentApi.deleteException(exception.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.exceptions.update((list) => list.filter((e) => e.id !== exception.id)),
        error: () => this.exceptionsError.set('Erreur lors de la suppression.'),
      });
  }

  cancelDeleteException(): void {
    this.deleteExceptionConfirmOpen.set(false);
    this.exceptionToDelete.set(null);
  }

  private loadSchedule(): void {
    this.scheduleLoading.set(true);
    this.scheduleError.set(null);

    this.appointmentApi.listRules().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rules) => {
        this.availabilityRules.set(rules);
        this.scheduleLoading.set(false);
      },
      error: () => {
        this.scheduleError.set('Impossible de charger les regles de disponibilite.');
        this.scheduleLoading.set(false);
      },
    });
  }
}
