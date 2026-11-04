import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

import {
  OcButton,
  OcDialog,
  OcEmptyState,
  OcIcon,
  OcStatus,
  OcStatusBadge,
  OcTab,
  OcTabs,
} from '../../../shared/ui';
import {
  DEMO_PRACTICE_PATIENTS,
  DEMO_WAITING_ROOM_DATE,
  DemoQueueEvent,
  DemoQueueStatus,
  DemoWaitingRoomAppointmentType,
  DemoWaitingRoomCabinet,
  DemoWaitingRoomPatient,
} from './waiting-room-demo.fixtures';
import {
  QueueActionResult,
  WaitingRoomDemoStore,
} from './waiting-room-demo.store';

type WaitingRoomTab =
  | 'all'
  | 'WAITING'
  | 'CALLED'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'inactive';
type WaitingRoomStatusFilter = DemoQueueStatus | 'NO_SHOW' | 'all';
type WaitingRoomSortKey =
  | 'patient'
  | 'appointmentTime'
  | 'checkedInAt'
  | 'wait'
  | 'appointmentType'
  | 'status';
type SortDirection = 'asc' | 'desc';
type DrawerTab = 'details' | 'history' | 'documents';
type WalkInMode = 'existing' | 'temporary';
type ConfirmationKind = 'no_show' | 'left' | 'complete' | 'reset';

interface ConfirmationRequest {
  readonly kind: ConfirmationKind;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly patientId?: string;
}

interface FeedbackMessage {
  readonly tone: 'success' | 'error';
  readonly text: string;
}

interface QueueTabItem {
  readonly id: WaitingRoomTab;
  readonly label: string;
  readonly count: number;
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR');
}

function compareNullable(left: string | number | null, right: string | number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), 'fr');
}

function allowedParam<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return value !== null && values.includes(value as T) ? (value as T) : fallback;
}

function positivePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

@Component({
  selector: 'oc-waiting-room-page',
  imports: [
    A11yModule,
    ReactiveFormsModule,
    NzIconModule,
    OcButton,
    OcDialog,
    OcEmptyState,
    OcIcon,
    OcStatusBadge,
    OcTabs,
  ],
  providers: [WaitingRoomDemoStore],
  templateUrl: './waiting-room-page.static-demo.html',
  styleUrls: [
    './waiting-room-page.static-demo.scss',
    './waiting-room-page.static-demo.responsive.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closePatient()' },
})
export class WaitingRoomPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  readonly store = inject(WaitingRoomDemoStore);

  readonly demoDate = DEMO_WAITING_ROOM_DATE;
  readonly practicePatients = DEMO_PRACTICE_PATIENTS;
  readonly pageSize = 7;
  readonly patients = this.store.patients;
  readonly searchTerm = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly activeTab = signal<WaitingRoomTab>(
    allowedParam(
      this.route.snapshot.queryParamMap.get('tab'),
      ['all', 'WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'inactive'],
      'all',
    ),
  );
  readonly cabinetFilter = signal<DemoWaitingRoomCabinet | 'all'>(
    allowedParam(
      this.route.snapshot.queryParamMap.get('cabinet'),
      ['all', 'Cabinet principal', 'Cabinet annexe'],
      'all',
    ),
  );
  readonly typeFilter = signal<DemoWaitingRoomAppointmentType | 'all'>(
    allowedParam(
      this.route.snapshot.queryParamMap.get('type'),
      ['all', 'Suivi', 'Consultation', 'Cabinet', 'Urgence', 'Sans rendez-vous'],
      'all',
    ),
  );
  readonly statusFilter = signal<WaitingRoomStatusFilter>(
    allowedParam(
      this.route.snapshot.queryParamMap.get('status'),
      [
        'all', 'EXPECTED', 'WAITING', 'CALLED', 'IN_CONSULTATION',
        'COMPLETED', 'MISSED_CALL', 'LEFT', 'NO_SHOW',
      ],
      'all',
    ),
  );
  readonly sortKey = signal<WaitingRoomSortKey>(
    allowedParam(
      this.route.snapshot.queryParamMap.get('sort'),
      ['patient', 'appointmentTime', 'checkedInAt', 'wait', 'appointmentType', 'status'],
      'appointmentTime',
    ),
  );
  readonly sortDirection = signal<SortDirection>(
    allowedParam(this.route.snapshot.queryParamMap.get('direction'), ['asc', 'desc'], 'asc'),
  );
  readonly page = signal(positivePage(this.route.snapshot.queryParamMap.get('page')));
  readonly selectedPatientId = signal<string | null>(
    this.route.snapshot.queryParamMap.get('patient') === 'closed'
      ? null
      : (this.route.snapshot.queryParamMap.get('patient') ?? 'demo-waiting-marie'),
  );
  readonly drawerTab = signal<DrawerTab>(
    allowedParam(this.route.snapshot.queryParamMap.get('panel'), ['details', 'history', 'documents'], 'details'),
  );
  readonly feedback = signal<FeedbackMessage | null>(null);
  readonly confirmation = signal<ConfirmationRequest | null>(null);
  readonly walkInOpen = signal(false);
  private returnFocusElement: HTMLElement | null = null;

  readonly walkInForm = this.formBuilder.nonNullable.group({
    mode: this.formBuilder.nonNullable.control<WalkInMode>('existing'),
    practicePatientId: this.formBuilder.nonNullable.control('practice-amira'),
    name: this.formBuilder.nonNullable.control('', [Validators.maxLength(80)]),
    phone: this.formBuilder.nonNullable.control('', [Validators.maxLength(30)]),
  });

  readonly drawerTabs: readonly OcTab[] = [
    { id: 'details', label: 'Détails' },
    { id: 'history', label: 'Historique' },
    { id: 'documents', label: 'Documents' },
  ];

  readonly statusCounts = computed(() => ({
    all: this.patients().length,
    WAITING: this.patients().filter(({ queueStatus }) => queueStatus === 'WAITING').length,
    CALLED: this.patients().filter(({ queueStatus }) => ['CALLED', 'MISSED_CALL'].includes(queueStatus)).length,
    IN_CONSULTATION: this.patients().filter(({ queueStatus }) => queueStatus === 'IN_CONSULTATION').length,
    COMPLETED: this.patients().filter(({ queueStatus }) => queueStatus === 'COMPLETED').length,
    inactive: this.patients().filter(
      ({ queueStatus, appointmentStatus }) =>
        ['LEFT'].includes(queueStatus) || appointmentStatus === 'NO_SHOW',
    ).length,
  }));
  readonly queueTabs = computed<readonly QueueTabItem[]>(() => [
    { id: 'all', label: 'Tous', count: this.statusCounts().all },
    { id: 'WAITING', label: 'En attente', count: this.statusCounts().WAITING },
    { id: 'CALLED', label: 'Appelés', count: this.statusCounts().CALLED },
    { id: 'IN_CONSULTATION', label: 'En consultation', count: this.statusCounts().IN_CONSULTATION },
    { id: 'COMPLETED', label: 'Terminés', count: this.statusCounts().COMPLETED },
    { id: 'inactive', label: 'Sortis', count: this.statusCounts().inactive },
  ]);

  readonly waitingCount = computed(() => this.statusCounts().WAITING);
  readonly consultationCount = computed(() => this.statusCounts().IN_CONSULTATION);
  readonly noShowCount = computed(
    () => this.patients().filter(({ appointmentStatus }) => appointmentStatus === 'NO_SHOW').length,
  );
  readonly averageWait = computed(() => {
    const values = this.patients()
      .filter(({ queueStatus }) => queueStatus === 'WAITING')
      .map((patient) => this.store.waitMinutes(patient))
      .filter((value): value is number => value !== null);
    return values.length === 0
      ? 0
      : Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  });

  readonly filteredPatients = computed(() => {
    const query = normalized(this.searchTerm().trim());
    return this.patients().filter((patient) => {
      if (!this.matchesTab(patient, this.activeTab())) return false;
      if (this.cabinetFilter() !== 'all' && patient.cabinet !== this.cabinetFilter()) return false;
      if (this.typeFilter() !== 'all' && patient.appointmentType !== this.typeFilter()) return false;
      if (!this.matchesStatus(patient, this.statusFilter())) return false;
      if (!query) return true;
      return normalized(
        `${patient.name} ${patient.phone} ${patient.insuranceNumber} ${patient.appointmentTime ?? ''}`,
      ).includes(query);
    });
  });

  readonly sortedPatients = computed(() => {
    const key = this.sortKey();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...this.filteredPatients()].sort((left, right) => {
      let comparison = 0;
      if (key === 'patient') comparison = left.name.localeCompare(right.name, 'fr');
      if (key === 'appointmentTime') comparison = compareNullable(left.appointmentTime, right.appointmentTime);
      if (key === 'checkedInAt') comparison = compareNullable(left.checkedInAt, right.checkedInAt);
      if (key === 'wait') comparison = compareNullable(this.store.waitMinutes(left), this.store.waitMinutes(right));
      if (key === 'appointmentType') comparison = left.appointmentType.localeCompare(right.appointmentType, 'fr');
      if (key === 'status') comparison = this.statusLabel(left).localeCompare(this.statusLabel(right), 'fr');
      return comparison * direction;
    });
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.sortedPatients().length / this.pageSize)));
  readonly visiblePatients = computed(() => {
    const currentPage = Math.min(this.page(), this.pageCount());
    return this.sortedPatients().slice((currentPage - 1) * this.pageSize, currentPage * this.pageSize);
  });
  readonly pageNumbers = computed(() => Array.from({ length: this.pageCount() }, (_, index) => index + 1));
  readonly resultStart = computed(() =>
    this.sortedPatients().length === 0 ? 0 : (Math.min(this.page(), this.pageCount()) - 1) * this.pageSize + 1,
  );
  readonly resultEnd = computed(() =>
    Math.min(this.resultStart() + this.visiblePatients().length - 1, this.sortedPatients().length),
  );
  readonly selectedPatient = computed(
    () => this.patients().find(({ id }) => id === this.selectedPatientId()) ?? null,
  );

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.resetPageAndSync();
  }

  onCabinetChange(event: Event): void {
    this.cabinetFilter.set((event.target as HTMLSelectElement).value as DemoWaitingRoomCabinet | 'all');
    this.resetPageAndSync();
  }

  onTypeChange(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value as DemoWaitingRoomAppointmentType | 'all');
    this.resetPageAndSync();
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as WaitingRoomStatusFilter);
    this.resetPageAndSync();
  }

  selectTab(tab: WaitingRoomTab): void {
    this.activeTab.set(tab);
    this.statusFilter.set('all');
    this.resetPageAndSync();
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.activeTab.set('all');
    this.cabinetFilter.set('all');
    this.typeFilter.set('all');
    this.statusFilter.set('all');
    this.resetPageAndSync();
  }

  toggleSort(key: WaitingRoomSortKey): void {
    if (this.sortKey() === key) this.sortDirection.update((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
    this.resetPageAndSync();
  }

  ariaSort(key: WaitingRoomSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  setPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
    this.syncQueryState();
  }

  openPatient(patient: DemoWaitingRoomPatient, event?: Event): void {
    if (event?.currentTarget instanceof HTMLElement) this.returnFocusElement = event.currentTarget;
    this.selectedPatientId.set(patient.id);
    this.drawerTab.set('details');
    this.feedback.set(null);
    this.syncQueryState();
  }

  openPatientFromAction(event: Event, patient: DemoWaitingRoomPatient): void {
    event.stopPropagation();
    this.openPatient(patient, event);
  }

  closePatient(): void {
    if (!this.selectedPatientId() || this.confirmation() || this.walkInOpen()) return;
    this.selectedPatientId.set(null);
    this.drawerTab.set('details');
    this.feedback.set(null);
    this.syncQueryState();
    this.returnFocusElement?.focus();
  }

  setDrawerTab(tab: string): void {
    this.drawerTab.set(tab as DrawerTab);
    this.syncQueryState();
  }

  callNext(): void {
    const result = this.store.callNext();
    this.handleResult(result, true);
  }

  markArrived(patient: DemoWaitingRoomPatient): void { this.handleResult(this.store.markArrived(patient.id)); }
  callPatient(patient: DemoWaitingRoomPatient): void { this.handleResult(this.store.callPatient(patient.id)); }
  startConsultation(patient: DemoWaitingRoomPatient): void {
    const result = this.store.startConsultation(patient.id);
    this.handleResult(result);
    if (result.ok) this.openDemoConsultation(patient);
  }

  continueConsultation(patient: DemoWaitingRoomPatient): void {
    const result = this.store.continueConsultation(patient.id);
    this.handleResult(result);
    if (result.ok) this.openDemoConsultation(patient);
  }
  markMissedCall(patient: DemoWaitingRoomPatient): void { this.handleResult(this.store.markMissedCall(patient.id)); }
  requeue(patient: DemoWaitingRoomPatient): void { this.handleResult(this.store.requeue(patient.id)); }

  openConfirmation(kind: ConfirmationKind, patient?: DemoWaitingRoomPatient): void {
    const requests: Record<ConfirmationKind, ConfirmationRequest> = {
      no_show: {
        kind, patientId: patient?.id, title: 'Confirmer la non-présentation',
        description: `${patient?.name ?? 'Ce patient'} n’a pas été enregistré comme présent. Cette action reste manuelle et fictive.`,
        confirmLabel: 'Signaler non présenté',
      },
      left: {
        kind, patientId: patient?.id, title: 'Confirmer le départ',
        description: `Confirmer que ${patient?.name ?? 'ce patient'} a quitté le cabinet sans consultation.`,
        confirmLabel: 'Patient parti',
      },
      complete: {
        kind, patientId: patient?.id, title: 'Terminer la consultation',
        description: `Clore la consultation fictive de ${patient?.name ?? 'ce patient'} ?`,
        confirmLabel: 'Terminer',
      },
      reset: {
        kind, title: 'Réinitialiser la démonstration',
        description: 'Toutes les modifications locales de cette salle d’attente fictive seront effacées.',
        confirmLabel: 'Réinitialiser',
      },
    };
    this.confirmation.set(requests[kind]);
  }

  closeConfirmation(): void { this.confirmation.set(null); }

  confirmAction(): void {
    const request = this.confirmation();
    if (!request) return;
    let result: QueueActionResult;
    if (request.kind === 'no_show') result = this.store.confirmNoShow(request.patientId ?? '');
    else if (request.kind === 'left') result = this.store.markLeft(request.patientId ?? '');
    else if (request.kind === 'complete') result = this.store.completeConsultation(request.patientId ?? '');
    else {
      result = this.store.reset();
      this.selectedPatientId.set('demo-waiting-marie');
    }
    this.confirmation.set(null);
    this.handleResult(result);
  }

  openWalkIn(): void {
    this.walkInForm.reset({ mode: 'existing', practicePatientId: 'practice-amira', name: '', phone: '' });
    this.walkInOpen.set(true);
  }

  closeWalkIn(): void { this.walkInOpen.set(false); }

  setWalkInMode(mode: WalkInMode): void {
    this.walkInForm.controls.mode.setValue(mode);
  }

  addWalkIn(): void {
    const value = this.walkInForm.getRawValue();
    const result = value.mode === 'existing'
      ? this.store.addExistingWalkIn(value.practicePatientId)
      : this.store.addTemporaryWalkIn({ name: value.name, phone: value.phone });
    if (result.ok) this.walkInOpen.set(false);
    this.handleResult(result, result.ok);
  }

  waitMinutes(patient: DemoWaitingRoomPatient): number | null { return this.store.waitMinutes(patient); }
  queuePosition(patient: DemoWaitingRoomPatient): number | null { return this.store.queuePosition(patient.id); }
  historyEvents(patient: DemoWaitingRoomPatient): readonly DemoQueueEvent[] {
    return [...patient.events].reverse();
  }

  waitClass(patient: DemoWaitingRoomPatient): string {
    const minutes = this.store.waitMinutes(patient);
    return minutes !== null && minutes >= 20 ? 'waiting-table__wait--long' : '';
  }

  statusLabel(patient: DemoWaitingRoomPatient): string {
    if (patient.appointmentStatus === 'NO_SHOW') return 'Non présenté';
    const labels: Record<DemoQueueStatus, string> = {
      EXPECTED: 'Prévu', WAITING: 'En attente', CALLED: 'Appelé',
      IN_CONSULTATION: 'En consultation', COMPLETED: 'Terminé',
      MISSED_CALL: 'Absent à l’appel', LEFT: 'Parti',
    };
    return labels[patient.queueStatus];
  }

  statusTone(patient: DemoWaitingRoomPatient): OcStatus {
    if (patient.appointmentStatus === 'NO_SHOW') return 'draft';
    const tones: Record<DemoQueueStatus, OcStatus> = {
      EXPECTED: 'draft', WAITING: 'pending', CALLED: 'in-progress',
      IN_CONSULTATION: 'confirmed', COMPLETED: 'completed',
      MISSED_CALL: 'pending', LEFT: 'draft',
    };
    return tones[patient.queueStatus];
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('fr-FR');
  }

  hasConsultationConflict(patient: DemoWaitingRoomPatient): boolean {
    const active = this.store.activeConsultation();
    return patient.queueStatus === 'CALLED' && active !== null && active.id !== patient.id;
  }

  private matchesTab(patient: DemoWaitingRoomPatient, tab: WaitingRoomTab): boolean {
    if (tab === 'all') return true;
    if (tab === 'CALLED') return ['CALLED', 'MISSED_CALL'].includes(patient.queueStatus);
    if (tab === 'inactive') return patient.queueStatus === 'LEFT' || patient.appointmentStatus === 'NO_SHOW';
    return patient.queueStatus === tab;
  }

  private matchesStatus(patient: DemoWaitingRoomPatient, status: WaitingRoomStatusFilter): boolean {
    if (status === 'all') return true;
    if (status === 'NO_SHOW') return patient.appointmentStatus === 'NO_SHOW';
    return patient.queueStatus === status && patient.appointmentStatus !== 'NO_SHOW';
  }

  private handleResult(result: QueueActionResult, selectPatient = false): void {
    this.feedback.set({ tone: result.ok ? 'success' : 'error', text: result.message });
    if (selectPatient && result.patientId) {
      this.selectedPatientId.set(result.patientId);
      this.drawerTab.set('details');
      this.syncQueryState();
    }
  }

  private openDemoConsultation(patient: DemoWaitingRoomPatient): void {
    void this.router.navigate(['/doctor', 'consultation', `waiting-room-${patient.id}`], {
      queryParams: { demoSource: 'waiting-room' },
    });
  }

  private resetPageAndSync(): void {
    this.page.set(1);
    this.syncQueryState();
  }

  private syncQueryState(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        q: this.searchTerm().trim() || null,
        tab: this.activeTab() === 'all' ? null : this.activeTab(),
        cabinet: this.cabinetFilter() === 'all' ? null : this.cabinetFilter(),
        type: this.typeFilter() === 'all' ? null : this.typeFilter(),
        status: this.statusFilter() === 'all' ? null : this.statusFilter(),
        sort: this.sortKey() === 'appointmentTime' ? null : this.sortKey(),
        direction: this.sortDirection() === 'asc' ? null : this.sortDirection(),
        page: this.page() === 1 ? null : this.page(),
        patient: this.selectedPatientId() ?? 'closed',
        panel: this.drawerTab() === 'details' ? null : this.drawerTab(),
      },
      queryParamsHandling: 'merge',
    });
  }
}
