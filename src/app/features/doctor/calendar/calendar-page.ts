import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NzModalModule } from 'ng-zorro-antd/modal';

import {
  OcButton,
  OcEmptyState,
  OcPageHeader,
  OcSegmentedControl,
} from '../../../shared/ui';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import type { AppointmentLiveEvent, UrgentLiveEvent } from '../../../core/realtime/live-event.models';
import type {
  AppointmentIdData,
  DoctorArrivedData,
  RequestIdData,
  RequestMatchedData,
} from '../../../core/realtime/live-event.models';
import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import { AppointmentApiService } from '../appointment-api.service';
import type {
  AppointmentDto,
  AvailabilityExceptionDto,
  AvailabilityExceptionRequestDto,
  AvailabilityRuleDto,
  SlotDto,
  } from '../appointment-api.models';
  import { DoctorUrgentApiService } from '../doctor-urgent-api.service';
import { ActiveMatchedRequestStore } from '../active-matched-request.store';
import { UrgentAcceptedStore } from '../urgent-accepted.store';
import { AppointmentDetailPanel } from '../shared/appointment-detail-panel';

const URGENT_BLOCK_ESTIMATED_MINUTES = 30;
const REALTIME_FALLBACK_REFETCH_MS = 120_000;
const CLOCK_TICK_MS = 30_000;
const PX_PER_MINUTE = 1;
const DEFAULT_AXIS_START_MIN = 8 * 60;
const DEFAULT_AXIS_END_MIN = 20 * 60;
const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_EXCEPTION_DURATION_MINUTES = 60;
const TOAST_DURATION_MS = 4_000;

type CalendarViewMode = 'day' | 'week' | 'month';
type SlotState = 'HAS_APPOINTMENT' | 'FREE_BOOKABLE' | 'BLOCKED' | 'NOT_GENERATED' | 'PASSED' | 'EXTRA';

interface UrgentBlock {
  readonly requestId: string;
  readonly patientName: string;
  readonly start: Date;
  readonly end: Date;
  readonly arrivedAt: Date | null;
}

interface CalendarCell {
  readonly state: SlotState;
  readonly startMin: number;
  readonly endMin: number;
  readonly appointment: AppointmentDto | null;
  readonly exception: AvailabilityExceptionDto | null;
}

interface DayColumn {
  readonly date: Date;
  readonly key: string;
  readonly weekdayLabel: string;
  readonly dayNumber: number;
  readonly isToday: boolean;
  readonly cells: readonly CalendarCell[];
  readonly urgent: readonly UrgentBlock[];
  readonly startMin: number;
  readonly endMin: number;
}

interface MonthGridCell {
  readonly date: Date;
  readonly key: string;
  readonly dayOfMonth: number;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly appointmentCount: number;
  readonly urgentCount: number;
}

const WEEKDAY_KEYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const CLOSED_REQUEST_STATUSES: ReadonlySet<string> = new Set([
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return start;
}

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

@Component({
  selector: 'oc-calendar-page',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    OcPageHeader,
    OcSegmentedControl,
    OcButton,
    OcEmptyState,
    AppointmentDetailPanel,
  ],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly urgentApi = inject(DoctorUrgentApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly matchedRequests = inject(ActiveMatchedRequestStore);
  private readonly acceptedOffers = inject(UrgentAcceptedStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly aptPanel = viewChild.required<AppointmentDetailPanel>('aptPanel');

  private readonly expectsRealtimeActivity = signal(true);
  readonly realtimeHealth = this.realtime.health(this.expectsRealtimeActivity);

  viewMode = signal<CalendarViewMode>('month');
  currentDate = signal(new Date());

  loading = signal(true);
  loadError = signal<string | null>(null);

  rules = signal<readonly AvailabilityRuleDto[]>([]);
  appointments = signal<readonly AppointmentDto[]>([]);
  slots = signal<readonly SlotDto[]>([]);
  exceptions = signal<readonly AvailabilityExceptionDto[]>([]);
  urgentBlocks = signal<readonly UrgentBlock[]>([]);

  selectedAppointment = signal<AppointmentDto | null>(null);
  selectedException = signal<AvailabilityExceptionDto | null>(null);
  deletingException = signal(false);

  exceptionFormOpen = signal(false);
  exceptionSaving = signal(false);
  exceptionError = signal<string | null>(null);
  exceptionForm = new FormGroup({
    type: new FormControl<'BLOCK' | 'EXTRA'>('BLOCK', { nonNullable: true }),
    date: new FormControl('', { nonNullable: true }),
    startTime: new FormControl('', { nonNullable: true }),
    endTime: new FormControl('', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true }),
  });

  toast = signal<string | null>(null);
  currentHour = signal(new Date().getHours());
  currentMinute = signal(new Date().getMinutes());
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  freeSlotModalOpen = signal(false);
  passedSlotModalOpen = signal(false);
  passedSlotAppointment = signal<AppointmentDto | null>(null);

  viewOptions: readonly { readonly value: string; readonly label: string }[] = [
    { label: 'Jour', value: 'day' },
    { label: 'Semaine', value: 'week' },
    { label: 'Mois', value: 'month' },
  ];

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly urgentEstimatedMinutes = URGENT_BLOCK_ESTIMATED_MINUTES;

  readonly doctorId = computed(() => this.tokens.user()?.id ?? '');

  private periodDaysInternal = computed<Date[]>(() => {
    const mode = this.viewMode();
    const base = this.currentDate();
    if (mode === 'day') {
      return [this.startOfDay(base)];
    }
    const weekStart = startOfWeek(base);
    if (mode === 'week') {
      return Array.from({ length: 7 }, (_, i) => this.startOfDay(addDays(weekStart, i)));
    }
    const firstOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, i) => this.startOfDay(addDays(gridStart, i)));
  });

  range = computed(() => {
    const days = this.periodDaysInternal();
    const from = days[0] ?? new Date();
    const to = days[days.length - 1] ?? new Date();
    return {
      fromIso: this.startOfDay(from).toISOString(),
      toIso: this.endOfDay(to).toISOString(),
      fromYmd: isoDate(from),
      toYmd: isoDate(to),
    };
  });

  axis = computed(() => {
    const columns = this.dayColumns();
    if (columns.length === 0) {
      return { startMin: DEFAULT_AXIS_START_MIN, endMin: DEFAULT_AXIS_END_MIN };
    }
    let startMin = DEFAULT_AXIS_END_MIN;
    let endMin = DEFAULT_AXIS_START_MIN;
    for (const col of columns) {
      startMin = Math.min(startMin, col.startMin);
      endMin = Math.max(endMin, col.endMin);
    }
    if (endMin <= startMin) endMin = startMin + 60;
    return { startMin, endMin };
  });

  laneHeight = computed(() => (this.axis().endMin - this.axis().startMin) * PX_PER_MINUTE);

  hourLabels = computed(() => {
    const labels: { hour: number; label: string; topPx: number }[] = [];
    const firstHour = Math.ceil(this.axis().startMin / 60);
    const lastHour = Math.floor(this.axis().endMin / 60);
    for (let hour = firstHour; hour <= lastHour; hour++) {
      labels.push({
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        topPx: (hour * 60 - this.axis().startMin) * PX_PER_MINUTE,
      });
    }
    return labels;
  });

  dayColumns = computed<readonly DayColumn[]>(() =>
    this.periodDaysInternal().map((date) => this.buildDayColumn(date)),
  );

  monthCells = computed<readonly MonthGridCell[]>(() => {
    const today = this.startOfDay(new Date());
    const month = this.currentDate().getMonth();
    return this.periodDaysInternal().map((date) => {
      const key = isoDate(date);
      const appointmentCount = this.appointments().filter(
        (a) => isoDate(new Date(a.startTime)) === key && a.status !== 'CANCELLED',
      ).length;
      const urgentCount = this.urgentBlocks().filter((b) => isoDate(b.start) === key).length;
      return {
        date,
        key,
        dayOfMonth: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        appointmentCount,
        urgentCount,
      };
    });
  });

  currentTitle = computed(() => {
    const base = this.currentDate();
    if (this.viewMode() === 'day') {
      return base.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (this.viewMode() === 'week') {
      const days = this.periodDaysInternal();
      const first = days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const last = days[6].toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${first} \u2014 ${last}`;
    }
    return base.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  });

  constructor() {
    effect(() => {
      this.viewMode();
      this.currentDate();
      this.loadVisibleRange();
    });

    this.refreshUrgentBlocks();

    this.realtime.appointmentEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onAppointmentEvent(event));

    this.realtime.urgentEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onUrgentEvent(event));

    interval(REALTIME_FALLBACK_REFETCH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.realtimeHealth() !== 'live') {
          this.loadVisibleRange(true);
          this.refreshUrgentBlocks();
        }
      });

    interval(CLOCK_TICK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const now = new Date();
        this.currentHour.set(now.getHours());
        this.currentMinute.set(now.getMinutes());
      });

    this.destroyRef.onDestroy(() => {
      if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    });
  }

  setViewMode(mode: string): void {
    if (mode === 'day' || mode === 'week' || mode === 'month') {
      this.viewMode.set(mode);
    }
  }

  previous(): void {
    this.shiftPeriod(-1);
  }

  next(): void {
    this.shiftPeriod(1);
  }

  goToday(): void {
    this.currentDate.set(new Date());
  }

  goToDate(date: Date): void {
    this.currentDate.set(this.startOfDay(date));
    this.viewMode.set('day');
  }

  goToSchedule(): void {
    this.router.navigate(['/doctor/settings'], { queryParams: { tab: 'schedule' } });
  }

  onLaneBackgroundClick(event: MouseEvent, column: DayColumn): void {
    if (event.target !== event.currentTarget) return;
    const lane = event.currentTarget as HTMLElement;
    const rect = lane.getBoundingClientRect();
    const offsetMinutes = (event.clientY - rect.top) / PX_PER_MINUTE;
    const rawMinutes = column.startMin + offsetMinutes;
    const snapped = Math.max(
      column.startMin,
      Math.min(column.endMin - DEFAULT_EXCEPTION_DURATION_MINUTES, Math.floor(rawMinutes / 15) * 15),
    );
    this.openExceptionForm(column.date, snapped, snapped + DEFAULT_EXCEPTION_DURATION_MINUTES);
  }

  onCellClick(cell: CalendarCell, column: DayColumn): void {
    switch (cell.state) {
      case 'HAS_APPOINTMENT':
        if (cell.appointment) this.openAppointment(cell.appointment);
        break;
      case 'PASSED':
        if (cell.appointment) {
          this.openAppointment(cell.appointment);
        } else {
          this.passedSlotAppointment.set(null);
          this.passedSlotModalOpen.set(true);
        }
        break;
      case 'FREE_BOOKABLE':
        this.freeSlotModalOpen.set(true);
        break;
      case 'BLOCKED':
        if (cell.exception) this.selectedException.set(cell.exception);
        break;
      case 'NOT_GENERATED':
        this.openExceptionForm(
          column.date,
          cell.startMin,
          cell.startMin + DEFAULT_EXCEPTION_DURATION_MINUTES,
        );
        break;
    }
  }

  openAppointment(appointment: AppointmentDto): void {
    this.selectedAppointment.set(appointment);
    this.aptPanel().openWith(appointment);
  }

  onAppointmentUpdated(updated: AppointmentDto): void {
    this.upsertAppointment(updated);
  }

  cancelSelectedAppointment(): void {
    const appointment = this.selectedAppointment();
    if (!appointment || this.selectedAppointment()?.id !== appointment.id) return;
    this.appointmentApi.cancelAppointment(appointment.id).subscribe({
      next: (updated) => this.upsertAppointment(updated),
      error: () => this.showToast("Impossible d'annuler le rendez-vous."),
    });
  }

  confirmDeleteException(): void {
    const exception = this.selectedException();
    if (!exception || this.deletingException()) return;
    this.deletingException.set(true);
    this.appointmentApi.deleteException(exception.id).subscribe({
      next: () => {
        this.deletingException.set(false);
        this.exceptions.update((list) => list.filter((e) => e.id !== exception.id));
        this.selectedException.set(null);
      },
      error: () => {
        this.deletingException.set(false);
        this.exceptionError.set('Erreur lors de la suppression du blocage.');
      },
    });
  }

  closeExceptionDetail(): void {
    this.selectedException.set(null);
    this.exceptionError.set(null);
  }

  closeFreeSlotModal(): void {
    this.freeSlotModalOpen.set(false);
  }

  closePassedSlotModal(): void {
    this.passedSlotModalOpen.set(false);
    this.passedSlotAppointment.set(null);
  }

  openExceptionForm(date?: Date, startMin?: number, endMin?: number): void {
    const toTime = (minutes: number): string =>
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const now = new Date();
    const targetDate = date ?? now;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const targetStart = startMin ?? Math.ceil(currentMinutes / 15) * 15;
    const targetEnd = endMin ?? Math.min(targetStart + DEFAULT_EXCEPTION_DURATION_MINUTES, DEFAULT_AXIS_END_MIN);
    this.exceptionForm.setValue({
      type: 'BLOCK',
      date: isoDate(targetDate),
      startTime: toTime(targetStart),
      endTime: toTime(targetEnd),
      reason: '',
    });
    this.exceptionError.set(null);
    this.exceptionFormOpen.set(true);
  }

  saveException(): void {
    if (this.exceptionSaving() || this.exceptionForm.invalid) return;
    const value = this.exceptionForm.getRawValue();
    const input: AvailabilityExceptionRequestDto = {
      exceptionDate: value.date,
      type: value.type,
      startTime: value.startTime,
      endTime: value.endTime,
      reason: value.reason.trim() ? value.reason.trim() : null,
    };
    this.exceptionSaving.set(true);
    this.exceptionError.set(null);
    this.appointmentApi.addException(input).subscribe({
      next: (created) => {
        this.exceptionSaving.set(false);
        this.exceptions.update((list) => [...list, created]);
        this.exceptionFormOpen.set(false);
      },
      error: () => {
        this.exceptionSaving.set(false);
        this.exceptionError.set("Erreur lors de l'enregistrement de l'exception.");
      },
    });
  }

  closeExceptionForm(): void {
    this.exceptionFormOpen.set(false);
    this.exceptionError.set(null);
  }

  statusFr(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'Confirmé';
      case 'IN_PROGRESS': return 'En cours';
      case 'CANCELLED': return 'Annulé';
      case 'COMPLETED': return 'Terminé';
      case 'NO_SHOW': return 'Absent';
      default: return status;
    }
  }

  slotStateLabel(state: SlotState): string {
    switch (state) {
      case 'HAS_APPOINTMENT': return 'Rendez-vous';
      case 'FREE_BOOKABLE': return 'Libre';
      case 'BLOCKED': return 'Bloqué';
      default: return '';
    }
  }

  timeFromMinutes(minutes: number): string {
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  formatTime(value: Date): string {
    return value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatIsoTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : this.formatTime(parsed);
  }

  nowLineTop(column: DayColumn): number {
    return (
      (this.currentHour() * 60 + this.currentMinute() - column.startMin) * PX_PER_MINUTE
    );
  }

  nowLineVisible(column: DayColumn): boolean {
    if (!column.isToday) return false;
    const nowMinutes = this.currentHour() * 60 + this.currentMinute();
    return nowMinutes >= column.startMin && nowMinutes <= column.endMin;
  }

  cellTop(cell: CalendarCell, dayStartMin: number): number {
    return (cell.startMin - dayStartMin) * PX_PER_MINUTE;
  }

  cellHeight(cell: CalendarCell): number {
    return (cell.endMin - cell.startMin) * PX_PER_MINUTE;
  }

  patientName(appointment: AppointmentDto): string {
    return appointment.patientName ?? appointment.patientId;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'confirmed';
      case 'IN_PROGRESS': return 'in-progress';
      case 'COMPLETED': return 'completed';
      case 'CANCELLED':
      case 'NO_SHOW': return 'cancelled';
      default: return 'confirmed';
    }
  }

  urgentTop(block: UrgentBlock, dayStartMin: number): number {
    return Math.max(0, (minutesOf(block.start) - dayStartMin) * PX_PER_MINUTE);
  }

  urgentHeight(block: UrgentBlock): number {
    const duration =
      (block.end.getTime() - block.start.getTime()) / 60_000 || URGENT_BLOCK_ESTIMATED_MINUTES;
    return Math.min(
      this.laneHeight(),
      Math.max(20, duration * PX_PER_MINUTE),
    );
  }

  showToast(message: string): void {
    this.toast.set(message);
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_DURATION_MS);
  }

  retryLoad(): void {
    this.loadVisibleRange();
    this.refreshUrgentBlocks();
  }

  trackByKey(index: number, item: { key: string }): string {
    return item.key;
  }

  private shiftPeriod(direction: number): void {
    this.currentDate.update((current) => {
      if (this.viewMode() === 'day') return addDays(current, direction);
      if (this.viewMode() === 'week') return addDays(current, direction * 7);
      const shifted = new Date(current);
      shifted.setDate(1);
      shifted.setMonth(shifted.getMonth() + direction);
      return shifted;
    });
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private endOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private loadVisibleRange(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      this.loadError.set(null);
    }
    const { fromIso, toIso, fromYmd, toYmd } = this.range();
    const doctorId = this.doctorId();
    if (!doctorId) {
      this.loading.set(false);
      this.loadError.set('Session invalide.');
      return;
    }

    forkJoin({
      appointments: this.appointmentApi.listAppointments(fromIso, toIso),
      slots: this.appointmentApi.listSlots(doctorId, fromIso, toIso),
      exceptions: this.appointmentApi.listExceptions(fromYmd, toYmd),
      rules: this.rules().length
        ? of(this.rules())
        : this.appointmentApi.listRules().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ appointments, slots, exceptions, rules }) => {
        this.appointments.set([...appointments].sort(byStartTime));
        this.slots.set(slots);
        this.exceptions.set(exceptions);
        this.rules.set(rules);
        this.loading.set(false);
        this.loadError.set(null);
        this.refreshUrgentBlocks();
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Impossible de charger le planning.');
      },
    });
  }

  private buildDayColumn(date: Date): DayColumn {
    const key = isoDate(date);
    const weekdayIndex = (date.getDay() + 6) % 7;
    const weekdayKey = WEEKDAY_KEYS[weekdayIndex];
    const dayAppointments = this.appointments().filter(
      (a) => isoDate(new Date(a.startTime)) === key
        && a.status !== 'CANCELLED'
        && a.status !== 'NO_SHOW',
    );
    const dayExceptions = this.exceptions().filter((e) => e.exceptionDate === key);
    const blockExceptions = dayExceptions.filter((e) => e.type === 'BLOCK');
    const extraExceptions = dayExceptions.filter((e) => e.type === 'EXTRA');
    const activeRules = this.rules().filter((r) => r.active && r.dayOfWeek === weekdayKey);

    let dayStartMin = DEFAULT_AXIS_END_MIN;
    let dayEndMin = DEFAULT_AXIS_START_MIN;

    type Window = { start: number; end: number; slotMinutes: number; isExtra: boolean };
    const windows: Window[] = [];
    for (const rule of activeRules) {
      const ruleStart = parseHm(rule.startTime) ?? DEFAULT_AXIS_START_MIN;
      const ruleEnd = parseHm(rule.endTime) ?? DEFAULT_AXIS_END_MIN;
      const pauseStart = rule.pauseStart ? parseHm(rule.pauseStart) : null;
      const pauseEnd = rule.pauseEnd ? parseHm(rule.pauseEnd) : null;
      const slotMinutes = rule.slotDurationMinutes > 0 ? rule.slotDurationMinutes : DEFAULT_SLOT_MINUTES;
      dayStartMin = Math.min(dayStartMin, ruleStart);
      dayEndMin = Math.max(dayEndMin, ruleEnd);
      if (pauseStart !== null && pauseEnd !== null && pauseStart > ruleStart && pauseEnd < ruleEnd) {
        windows.push({ start: ruleStart, end: pauseStart, slotMinutes, isExtra: false });
        windows.push({ start: pauseEnd, end: ruleEnd, slotMinutes, isExtra: false });
      } else {
        windows.push({ start: ruleStart, end: ruleEnd, slotMinutes, isExtra: false });
      }
    }
    for (const extra of extraExceptions) {
      const extraStart = parseHm(extra.startTime);
      const extraEnd = parseHm(extra.endTime);
      if (extraStart === null || extraEnd === null || extraEnd <= extraStart) continue;
      dayStartMin = Math.min(dayStartMin, extraStart);
      dayEndMin = Math.max(dayEndMin, extraEnd);
      windows.push({ start: extraStart, end: extraEnd, slotMinutes: DEFAULT_SLOT_MINUTES, isExtra: true });
    }
    for (const apt of dayAppointments) {
      const aptStart = minutesOf(new Date(apt.startTime));
      const aptEnd = minutesOf(new Date(apt.endTime));
      if (!Number.isNaN(aptStart)) dayStartMin = Math.min(dayStartMin, aptStart);
      if (!Number.isNaN(aptEnd)) dayEndMin = Math.max(dayEndMin, aptEnd);
    }
    if (windows.length === 0) {
      dayStartMin = DEFAULT_AXIS_START_MIN;
      dayEndMin = DEFAULT_AXIS_END_MIN;
    } else {
      dayStartMin = Math.max(dayStartMin - 30, DEFAULT_AXIS_START_MIN);
      dayEndMin = Math.min(dayEndMin + 30, DEFAULT_AXIS_END_MIN);
    }
    windows.sort((a, b) => a.start - b.start);

    const cells: CalendarCell[] = [];
    const isToday = key === isoDate(new Date());
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    for (const window of windows) {
      for (let start = window.start; start < window.end; start += window.slotMinutes) {
        const end = Math.min(start + window.slotMinutes, window.end);
        if (isToday && end <= nowMinutes) {
          const pastAppointment = dayAppointments.find((a) => {
            const apptStart = minutesOf(new Date(a.startTime));
            const apptEnd = minutesOf(new Date(a.endTime));
            return overlaps(start, end, apptStart, apptEnd);
          });
          this.pushCell(cells, {
            state: 'PASSED',
            startMin: start,
            endMin: end,
            appointment: pastAppointment ?? null,
            exception: null,
          });
          continue;
        }
        const blocked = blockExceptions.find((e) => {
          const blockStart = parseHm(e.startTime);
          const blockEnd = parseHm(e.endTime);
          return (
            blockStart !== null &&
            blockEnd !== null &&
            overlaps(start, end, blockStart, blockEnd)
          );
        });
        if (blocked) {
          this.pushCell(cells, {
            state: 'BLOCKED',
            startMin: start,
            endMin: end,
            appointment: null,
            exception: blocked,
          });
          continue;
        }
        const appointment = dayAppointments.find((a) => {
          const apptStart = minutesOf(new Date(a.startTime));
          const apptEnd = minutesOf(new Date(a.endTime));
          return overlaps(start, end, apptStart, apptEnd);
        });
        if (appointment) {
          this.pushCell(cells, {
            state: 'HAS_APPOINTMENT',
            startMin: start,
            endMin: end,
            appointment,
            exception: null,
          });
          continue;
        }
        const bookable = this.slots().some((slot) => {
          const slotStart = minutesOf(new Date(slot.start));
          const slotEnd = minutesOf(new Date(slot.end));
          return overlaps(start, end, slotStart, slotEnd);
        });
        if (window.isExtra) {
          this.pushCell(cells, {
            state: 'EXTRA',
            startMin: start,
            endMin: end,
            appointment: null,
            exception: null,
          });
        } else {
          this.pushCell(cells, {
            state: bookable ? 'FREE_BOOKABLE' : 'NOT_GENERATED',
            startMin: start,
            endMin: end,
            appointment: null,
            exception: null,
          });
        }
      }
    }

    if (cells.length === 0 && dayAppointments.length > 0) {
      for (const appointment of dayAppointments) {
        const apptStart = minutesOf(new Date(appointment.startTime));
        const apptEnd = minutesOf(new Date(appointment.endTime));
        if (apptStart < apptEnd) {
          this.pushCell(cells, {
            state: 'HAS_APPOINTMENT',
            startMin: apptStart,
            endMin: apptEnd,
            appointment,
            exception: null,
          });
        }
      }
    }

    return {
      date,
      key,
      weekdayLabel: WEEKDAY_LABELS[weekdayIndex],
      dayNumber: date.getDate(),
      isToday: key === isoDate(new Date()),
      cells,
      urgent: this.urgentBlocks().filter((b) => isoDate(b.start) === key),
      startMin: dayStartMin,
      endMin: dayEndMin,
    };
  }

  private pushCell(cells: CalendarCell[], cell: CalendarCell): void {
    const previous = cells[cells.length - 1];
    if (previous && previous.state === cell.state && previous.endMin === cell.startMin) {
      cells[cells.length - 1] = { ...previous, endMin: cell.endMin };
      return;
    }
    cells.push(cell);
  }

  private upsertAppointment(appointment: AppointmentDto): void {
    const { fromYmd, toYmd } = this.range();
    const appointmentDay = isoDate(new Date(appointment.startTime));
    const inRange = appointmentDay >= fromYmd && appointmentDay <= toYmd;
    this.appointments.update((list) => {
      const withoutOld = list.filter((a) => a.id !== appointment.id);
      if (!inRange) return [...withoutOld].sort(byStartTime);
      return [...withoutOld, appointment].sort(byStartTime);
    });
  }

  private refreshAppointmentsForRange(): void {
    const { fromIso, toIso } = this.range();
    this.appointmentApi.listAppointments(fromIso, toIso).subscribe({
      next: (list) => this.appointments.set([...list].sort(byStartTime)),
      error: () => {},
    });
  }

  private refreshSlots(): void {
    const doctorId = this.doctorId();
    if (!doctorId) return;
    const { fromIso, toIso } = this.range();
    this.appointmentApi.listSlots(doctorId, fromIso, toIso).subscribe({
      next: (slots) => this.slots.set(slots),
      error: () => {},
    });
  }

  private onAppointmentEvent(event: AppointmentLiveEvent): void {
    const appointmentId =
      event.name === 'BOOKING_CONFIRMED'
        ? (event.data as { readonly appointmentId: string }).appointmentId
        : (event.data as AppointmentIdData).appointmentId;
    this.appointmentApi.getAppointment(appointmentId).subscribe({
      next: (dto) => {
        this.upsertAppointment(dto);
        this.refreshSlots();
      },
      error: () => {
        this.refreshAppointmentsForRange();
        this.refreshSlots();
      },
    });
  }

  private onUrgentEvent(event: UrgentLiveEvent): void {
    switch (event.name) {
      case 'REQUEST_MATCHED': {
        const data = event.data as RequestMatchedData;
        if (data.doctorId !== this.doctorId()) break;
        this.matchedRequests.markMatched(data.requestId);
        this.refreshUrgentBlocks();
        break;
      }
      case 'DOCTOR_ARRIVED': {
        const data = event.data as DoctorArrivedData;
        const arrivedAt = new Date();
        this.urgentBlocks.update((blocks) =>
          blocks.map((block) =>
            block.requestId === data.requestId ? { ...block, arrivedAt } : block,
          ),
        );
        break;
      }
      case 'REQUEST_CANCELLED':
      case 'REQUEST_EXPIRED': {
        const data = event.data as RequestIdData;
        this.matchedRequests.markClosed(data.requestId);
        this.urgentBlocks.update((blocks) =>
          blocks.filter((block) => block.requestId !== data.requestId),
        );
        break;
      }
      default:
        break;
    }
  }

  private refreshUrgentBlocks(): void {
    const candidateIds = new Set<string>([
      ...this.matchedRequests.requestIds(),
      ...this.acceptedOffers.offers().map((offer) => offer.requestId),
    ]);
    if (!candidateIds.size) {
      this.urgentBlocks.set([]);
      return;
    }
    const ids = [...candidateIds];
    const offers = this.acceptedOffers.offers();
    forkJoin(
      ids.map((id) => this.urgentApi.request(id).pipe(catchError(() => of(null)))),
    ).subscribe((summaries) => {
      const blocks: UrgentBlock[] = [];
      summaries.forEach((summary, index) => {
        if (summary === null) return;
        if (CLOSED_REQUEST_STATUSES.has(summary.status)) return;
        if (summary.status !== 'MATCHED' && !summary.arrivedAt) return;
        const anchorRaw = summary.matchedAt ?? summary.arrivedAt;
        const anchor = anchorRaw ? new Date(anchorRaw) : null;
        if (!anchor || Number.isNaN(anchor.getTime())) return;
        const requestId = ids[index];
        const offer = offers.find((candidate) => candidate.requestId === requestId);
        blocks.push({
          requestId,
          patientName: offer?.patientName ?? 'Patient urgent',
          start: anchor,
          end: new Date(anchor.getTime() + URGENT_BLOCK_ESTIMATED_MINUTES * 60_000),
          arrivedAt: summary.arrivedAt ? new Date(summary.arrivedAt) : null,
        });
      });
      this.urgentBlocks.set(blocks.sort(byUrgentStart));
    });
  }
}

function byStartTime(a: AppointmentDto, b: AppointmentDto): number {
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

function byUrgentStart(a: UrgentBlock, b: UrgentBlock): number {
  return a.start.getTime() - b.start.getTime();
}
