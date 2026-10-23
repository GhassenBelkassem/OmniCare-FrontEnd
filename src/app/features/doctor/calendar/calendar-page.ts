import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CalendarOptions,
  DatesSetInfo,
  DayHeaderInfo,
  EventClickInfo,
  EventDisplayInfo,
  FullCalendarComponent,
  FullCalendarModule,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import themePlugin from '@fullcalendar/angular/themes/monarch';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import frLocale from 'fullcalendar/locales/fr';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { interval } from 'rxjs';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { OcButton } from '../../../shared/ui/button/oc-button';
import { OcPageHeader } from '../../../shared/ui/page-header/oc-page-header';
import {
  OcSegmentedControl,
  OcSegmentOption,
} from '../../../shared/ui/segmented-control/oc-segmented-control';
import { OcTimeField } from '../../../shared/ui/time-field/oc-time-field';
import type {
  AvailabilityExceptionDto,
  AvailabilityExceptionRequestDto,
  AvailabilityRuleDto,
} from '../appointment-api.models';
import { AppointmentApiService } from '../appointment-api.service';
import {
  AvailabilityExceptionScope,
  fullWorkingDayWindow,
} from '../availability-exception.adapter';
import { ScheduledAppointmentDetailPanel } from '../scheduled-care/scheduled-appointment-detail-panel';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import {
  AppointmentEventMetadata,
  ExceptionEventMetadata,
  projectScheduledAppointmentEvents,
  projectExceptionEvents,
} from './calendar-event.adapter';
import {
  CalendarVisibleRange,
  fullyBlockedDateKeys,
  formatCalendarTime,
  formatCalendarTimeRange,
  projectBusinessHours,
  toCalendarVisibleRange,
  toLocalDateOnly,
} from './calendar-time.adapter';

function escapeHeaderText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

type CalendarViewMode = 'day' | 'week' | 'month';
type FullCalendarView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
type CalendarEventMetadata = AppointmentEventMetadata | ExceptionEventMetadata;

const REALTIME_FALLBACK_REFETCH_MS = 120_000;
const CALENDAR_VIEW_BY_MODE: Readonly<Record<CalendarViewMode, FullCalendarView>> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
};
const MODE_BY_CALENDAR_VIEW: Readonly<Record<FullCalendarView, CalendarViewMode>> = {
  timeGridDay: 'day',
  timeGridWeek: 'week',
  dayGridMonth: 'month',
};

function exceptionWindowValidator(control: AbstractControl): ValidationErrors | null {
  if (control.get('scope')?.value !== 'TIME_WINDOW') return null;
  const startTime = control.get('startTime')?.value as string | null;
  const endTime = control.get('endTime')?.value as string | null;
  return startTime && endTime && startTime < endTime ? null : { timeWindowOrder: true };
}

@Component({
  selector: 'oc-calendar-page',
  imports: [
    FullCalendarModule,
    ReactiveFormsModule,
    NzModalModule,
    OcButton,
    OcPageHeader,
    OcSegmentedControl,
    OcTimeField,
    ScheduledAppointmentDetailPanel,
  ],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly scheduledCareApi = inject(ScheduledCareApiService);
  private readonly scheduledCare = inject(ScheduledCareFacade);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly calendar = viewChild.required<FullCalendarComponent>('calendar');
  private readonly appointmentPanel =
    viewChild.required<ScheduledAppointmentDetailPanel>('appointmentPanel');
  private readonly expectsRealtimeActivity = signal(true);
  private readonly visibleRange = signal<CalendarVisibleRange | null>(null);
  private automaticRangeKey: string | null = null;
  private pendingRangeKey: string | null = null;
  private rangeLoadGeneration = 0;
  private rulesLoadAttempted = false;

  readonly viewMode = signal<CalendarViewMode>('month');
  readonly visibleTitle = signal('');
  readonly appointments = signal<readonly DoctorScheduledCareItem[]>([]);
  readonly rules = signal<readonly AvailabilityRuleDto[]>([]);
  readonly exceptions = signal<readonly AvailabilityExceptionDto[]>([]);
  readonly selectedException = signal<AvailabilityExceptionDto | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly rulesLoading = signal(false);
  readonly rulesLoaded = signal(false);
  readonly rulesError = signal<string | null>(null);
  readonly exceptionsLoading = signal(false);
  readonly exceptionsError = signal<string | null>(null);
  readonly mutationError = signal<string | null>(null);
  readonly deletingException = signal(false);
  readonly exceptionFormOpen = signal(false);
  readonly exceptionSaving = signal(false);
  readonly exceptionFormError = signal<string | null>(null);
  readonly realtimeHealth = this.realtime.health(this.expectsRealtimeActivity);
  readonly businessHours = computed(() => projectBusinessHours(this.rules()));
  readonly fullyBlockedDates = computed(() =>
    fullyBlockedDateKeys(this.rules(), this.exceptions()),
  );
  readonly noSchedule = computed(
    () => this.rulesLoaded() && !this.rulesError() && this.businessHours().length === 0,
  );
  readonly appointmentEvents = computed(() =>
    projectScheduledAppointmentEvents(this.appointments()),
  );
  readonly exceptionEvents = computed(() =>
    projectExceptionEvents(this.exceptions(), this.viewMode()),
  );
  readonly calendarEvents = computed(() => [
    ...this.appointmentEvents(),
    ...this.exceptionEvents(),
  ]);

  readonly exceptionForm = new FormGroup(
    {
      type: new FormControl<'BLOCK' | 'EXTRA'>('BLOCK', { nonNullable: true }),
      scope: new FormControl<AvailabilityExceptionScope>('FULL_DAY', { nonNullable: true }),
      date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      startTime: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      endTime: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      reason: new FormControl('', { nonNullable: true }),
    },
    { validators: exceptionWindowValidator },
  );

  readonly viewOptions: readonly OcSegmentOption[] = [
    { value: 'day', label: 'Jour' },
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' },
  ];

  readonly renderDayHeader = (info: DayHeaderInfo): { html: string } => {
    const weekday = escapeHeaderText(info.weekdayText);
    const date = escapeHeaderText(info.dayNumberText);
    const todayClass = info.isToday ? ' omnicare-calendar-day-heading--today' : '';
    const dateContent =
      info.view.type === 'dayGridMonth' || !date
        ? ''
        : `<strong class="omnicare-calendar-day-heading__date">${date}</strong>`;

    return {
      html: `<span class="omnicare-calendar-day-heading${todayClass}"><span class="omnicare-calendar-day-heading__weekday">${weekday}</span>${dateContent}</span>`,
    };
  };

  readonly calendarOptions = computed<CalendarOptions>(() => {
    const fullyBlockedDates = this.fullyBlockedDates();
    return {
      plugins: [themePlugin, dayGridPlugin, timeGridPlugin],
      initialView: 'dayGridMonth',
      locale: frLocale,
      firstDay: 1,
      headerToolbar: false,
      height: 'clamp(36rem, 68vh, 46rem)',
      expandRows: true,
      allDaySlot: false,
      scrollTime: '07:00:00',
      scrollTimeReset: false,
      slotDuration: '00:30:00',
      slotMinHeight: 28,
      eventMinHeight: 30,
      dayMaxEvents: true,
      nowIndicator: true,
      navLinks: false,
      editable: false,
      selectable: false,
      eventStartEditable: false,
      eventDurationEditable: false,
      businessHours: [...this.businessHours()],
      dayHeaderFormat: { weekday: 'short', day: 'numeric' },
      dayHeaderContent: this.renderDayHeader,
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      slotHeaderFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      viewClass: (info) => `omnicare-fc-view omnicare-fc-view--${info.view.type}`,
      dayHeaderClass: (info) =>
        `omnicare-fc-day-header${info.isToday ? ' omnicare-fc-day-header--today' : ''}`,
      dayHeaderInnerClass: 'omnicare-fc-day-header__inner',
      dayCellClass: (info) =>
        [
          'omnicare-fc-day-cell',
          info.isToday ? 'omnicare-fc-day-cell--today' : '',
          info.isOther ? 'omnicare-fc-day-cell--other' : '',
          fullyBlockedDates.has(toLocalDateOnly(info.date)) ? 'omnicare-fc-day-cell--blocked' : '',
        ]
          .filter(Boolean)
          .join(' '),
      dayCellTopClass: 'omnicare-fc-day-cell__top',
      dayCellInnerClass: 'omnicare-fc-day-cell__events',
      dayLaneClass: (info) =>
        `omnicare-fc-day-lane${info.isToday ? ' omnicare-fc-day-lane--today' : ''}`,
      slotLaneClass: (info) =>
        `omnicare-fc-slot-lane ${
          info.isMajor ? 'omnicare-fc-slot-lane--major' : 'omnicare-fc-slot-lane--minor'
        }`,
      slotHeaderClass: 'omnicare-fc-slot-header',
      slotHeaderInnerClass: 'omnicare-fc-slot-header__inner',
      nonBusinessHoursClass: 'omnicare-fc-non-business',
      nowIndicatorLineClass: 'omnicare-fc-now-line',
      nowIndicatorDotClass: 'omnicare-fc-now-dot',
      eventClass: (info) => this.calendarEventClasses(info),
      backgroundEventClass: 'omnicare-fc-background-event',
      datesSet: (info) => this.onDatesSet(info),
      eventClick: (info) => this.onEventClick(info),
    };
  });

  constructor() {
    let observedProjectionEpoch = this.scheduledCare.projectionInvalidationEpoch();
    effect(() => {
      const epoch = this.scheduledCare.projectionInvalidationEpoch();
      if (epoch === observedProjectionEpoch) return;
      observedProjectionEpoch = epoch;
      const range = this.visibleRange();
      if (range !== null) this.loadVisibleRange(range, true, true);
    });
    interval(REALTIME_FALLBACK_REFETCH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshIfRealtimeDegraded());
    afterNextRender(() => {
      const appointmentId = this.route?.snapshot.queryParamMap.get('appointmentId');
      if (appointmentId) this.appointmentPanel().openWith(appointmentId);
    });
  }

  setViewMode(value: string): void {
    if (this.isCalendarViewMode(value)) {
      this.viewMode.set(value);
      this.calendar().getApi().changeView(CALENDAR_VIEW_BY_MODE[value]);
    }
  }
  previous(): void {
    this.calendar().getApi().prev();
  }
  goToday(): void {
    this.calendar().getApi().today();
  }
  next(): void {
    this.calendar().getApi().next();
  }

  onDatesSet(info: DatesSetInfo): void {
    this.updateVisibleTitle(info.view.title, info.view.type);
    const range = toCalendarVisibleRange(info.start, info.end);
    this.visibleRange.set(range);
    this.loadRules();
    this.loadVisibleRange(range);
  }

  onEventClick(info: EventClickInfo): void {
    const metadata = info.event.extendedProps as Partial<CalendarEventMetadata>;
    if (metadata.kind === 'appointment' && typeof metadata.appointmentId === 'string') {
      this.mutationError.set(null);
      this.appointmentPanel().openWith(metadata.appointmentId);
      return;
    }
    if (metadata.kind === 'exception-annotation' && typeof metadata.exceptionId === 'string') {
      const exception = this.exceptions().find(
        (candidate) => candidate.id === metadata.exceptionId,
      );
      if (exception) {
        this.exceptionFormError.set(null);
        this.selectedException.set(exception);
      }
    }
  }

  retryLoad(): void {
    const range = this.visibleRange();
    if (range !== null) this.loadVisibleRange(range, true, false);
  }
  retryRules(): void {
    this.loadRules(true);
  }
  refreshIfRealtimeDegraded(): void {
    const range = this.visibleRange();
    if (range !== null && this.realtimeHealth() !== 'live') {
      this.loadVisibleRange(range, true, true);
    }
  }
  configureSchedule(): void {
    void this.router.navigate(['/doctor/settings'], { queryParams: { tab: 'schedule' } });
  }

  openExceptionForm(): void {
    const now = new Date();
    const startMinutes = Math.min(
      Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15,
      1380,
    );
    this.exceptionForm.setValue({
      type: 'BLOCK',
      scope: 'FULL_DAY',
      date: toLocalDateOnly(now),
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(Math.min(startMinutes + 60, 1439)),
      reason: '',
    });
    this.exceptionFormError.set(null);
    this.exceptionFormOpen.set(true);
  }

  closeExceptionForm(): void {
    this.exceptionFormOpen.set(false);
    this.exceptionFormError.set(null);
  }

  saveException(): void {
    if (this.exceptionSaving()) return;
    this.exceptionForm.markAllAsTouched();
    if (this.exceptionForm.invalid) return;
    const value = this.exceptionForm.getRawValue();
    const window =
      value.scope === 'FULL_DAY'
        ? fullWorkingDayWindow(this.rules(), value.date)
        : { startTime: value.startTime, endTime: value.endTime };
    if (window === null) {
      this.exceptionFormError.set("Aucun horaire actif n'est configuré pour cette journée.");
      return;
    }
    const input: AvailabilityExceptionRequestDto = {
      exceptionDate: value.date,
      type: value.type,
      startTime: window.startTime,
      endTime: window.endTime,
      reason: value.reason.trim() || null,
    };
    this.exceptionSaving.set(true);
    this.exceptionFormError.set(null);
    this.appointmentApi
      .addException(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.exceptionSaving.set(false);
          this.exceptions.update((exceptions) => [...exceptions, created]);
          this.exceptionFormOpen.set(false);
        },
        error: () => {
          this.exceptionSaving.set(false);
          this.exceptionFormError.set("Erreur lors de l'enregistrement de l'exception.");
        },
      });
  }

  closeExceptionDetail(): void {
    this.selectedException.set(null);
    this.exceptionFormError.set(null);
  }

  confirmDeleteException(): void {
    const exception = this.selectedException();
    if (!exception || this.deletingException()) return;
    this.deletingException.set(true);
    this.exceptionFormError.set(null);
    this.appointmentApi
      .deleteException(exception.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingException.set(false);
          this.exceptions.update((exceptions) =>
            exceptions.filter((candidate) => candidate.id !== exception.id),
          );
          this.selectedException.set(null);
        },
        error: () => {
          this.deletingException.set(false);
          this.exceptionFormError.set("Erreur lors de la suppression de l'exception.");
        },
      });
  }

  eventMetadata(info: EventDisplayInfo): CalendarEventMetadata {
    return info.event.extendedProps as CalendarEventMetadata;
  }
  calendarEventClasses(info: EventDisplayInfo): string {
    const metadata = this.eventMetadata(info);
    const classes = ['omnicare-fc-event'];

    if (metadata.kind === 'appointment') {
      classes.push('omnicare-fc-event--appointment');
      if (metadata.status === 'CONFIRMED') classes.push('omnicare-fc-event--confirmed');
      if (metadata.status === 'IN_PROGRESS') classes.push('omnicare-fc-event--in-progress');
      if (metadata.status === 'COMPLETED') classes.push('omnicare-fc-event--completed');
    } else if (metadata.exceptionType === 'BLOCK') {
      classes.push('omnicare-fc-event--block');
    } else {
      classes.push('omnicare-fc-event--extra');
    }

    return classes.join(' ');
  }
  isAppointmentEvent(info: EventDisplayInfo): boolean {
    return this.eventMetadata(info).kind === 'appointment';
  }
  eventTime(info: EventDisplayInfo): string {
    return formatCalendarTime(info.event.start);
  }
  eventTimeRange(info: EventDisplayInfo): string {
    return formatCalendarTimeRange(info.event.start, info.event.end);
  }
  compactPatientLabel(info: EventDisplayInfo): string {
    const metadata = this.eventMetadata(info);
    if (metadata.kind !== 'appointment') return '';
    const parts = metadata.patientLabel.trim().split(/\s+/);
    return parts.length < 2
      ? metadata.patientLabel
      : `${parts[0]} ${parts.at(-1)?.charAt(0) ?? ''}.`;
  }

  eventAccessibleLabel(info: EventDisplayInfo): string {
    const metadata = this.eventMetadata(info);
    if (metadata.kind === 'appointment') {
      return `${metadata.patientLabel}, ${this.eventTimeRange(info)}, ${metadata.statusLabel}`;
    }
    return [metadata.typeLabel, metadata.reason, metadata.timeLabel].filter(Boolean).join(', ');
  }

  private loadRules(force = false): void {
    if ((!force && this.rulesLoadAttempted) || this.rulesLoading()) return;
    this.rulesLoadAttempted = true;
    this.rulesLoading.set(true);
    this.rulesError.set(null);
    this.appointmentApi
      .listRules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rules) => {
          this.rules.set(rules);
          this.rulesLoaded.set(true);
          this.rulesLoading.set(false);
        },
        error: () => {
          this.rulesLoading.set(false);
          this.rulesLoaded.set(false);
          this.rulesError.set('Impossible de charger les horaires habituels.');
        },
      });
  }

  private loadVisibleRange(range: CalendarVisibleRange, force = false, silent = false): void {
    if ((!force && range.key === this.automaticRangeKey) || range.key === this.pendingRangeKey)
      return;
    this.automaticRangeKey = range.key;
    this.pendingRangeKey = range.key;
    const generation = ++this.rangeLoadGeneration;
    let pendingSources = 2;
    const settleSource = (): void => {
      if (generation === this.rangeLoadGeneration && --pendingSources === 0)
        this.pendingRangeKey = null;
    };
    if (!silent) {
      this.loading.set(true);
      this.loadError.set(null);
      this.exceptionsLoading.set(true);
      this.exceptionsError.set(null);
    }

    this.scheduledCareApi
      .getDoctorScheduledCare(range.appointmentFrom, range.appointmentTo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (agenda) => {
          if (generation !== this.rangeLoadGeneration) return;
          this.appointments.set(
            agenda.items
              .filter((item) => item.resourceType === 'APPOINTMENT')
              .sort(byAppointmentStart),
          );
          this.loading.set(false);
          this.loadError.set(null);
          settleSource();
        },
        error: () => {
          if (generation !== this.rangeLoadGeneration) return;
          this.loading.set(false);
          this.loadError.set('Impossible de charger les rendez-vous.');
          settleSource();
        },
      });
    this.appointmentApi
      .listExceptions(range.exceptionFrom, range.exceptionToInclusive)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (exceptions) => {
          if (generation !== this.rangeLoadGeneration) return;
          this.exceptions.set(exceptions);
          this.exceptionsLoading.set(false);
          this.exceptionsError.set(null);
          settleSource();
        },
        error: () => {
          if (generation !== this.rangeLoadGeneration) return;
          this.exceptionsLoading.set(false);
          this.exceptionsError.set('Impossible de charger les exceptions.');
          settleSource();
        },
      });
  }

  private updateVisibleTitle(title: string, calendarView: string): void {
    this.visibleTitle.set(title);
    if (this.isFullCalendarView(calendarView))
      this.viewMode.set(MODE_BY_CALENDAR_VIEW[calendarView]);
  }
  private isCalendarViewMode(value: string): value is CalendarViewMode {
    return value in CALENDAR_VIEW_BY_MODE;
  }
  private isFullCalendarView(value: string): value is FullCalendarView {
    return value in MODE_BY_CALENDAR_VIEW;
  }
}

function byAppointmentStart(left: DoctorScheduledCareItem, right: DoctorScheduledCareItem): number {
  return new Date(left.start).getTime() - new Date(right.start).getTime();
}
function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
