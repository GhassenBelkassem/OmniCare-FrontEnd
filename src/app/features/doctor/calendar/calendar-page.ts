import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
  DateClickInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import themePlugin from '@fullcalendar/angular/themes/monarch';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import frLocale from 'fullcalendar/locales/fr';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { interval } from 'rxjs';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { OcButton } from '../../../shared/ui/button/oc-button';
import { OcDateField } from '../../../shared/ui/date-field/oc-date-field';
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
import { ActiveConsultationStore } from '../active-consultation.store';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { PracticePatientAppointmentDto } from '../practice-patient-api.models';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import {
  AppointmentEventMetadata,
  BreakEventMetadata,
  ExceptionEventMetadata,
  countAppointmentsOfDay,
  hasExactTime,
  isFollowUpItem,
  isUnplacedRequest,
  projectBreakEvents,
  projectRequestEvents,
  projectScheduledAppointmentEvents,
  projectExceptionEvents,
  toRequestCalendarEvent,
} from './calendar-event.adapter';
import { CALENDAR_FILTER_OPTIONS, isStateVisible } from './calendar-filters';
import { presentCalendarItem, type CalendarState } from './calendar-presentation';
import { isPastDay } from './calendar-month.model';
import { searchCalendarItems } from './calendar-search';
import { patientLabel } from './calendar-privacy';
import { isActivatableTarget, isTypingTarget, resolveShortcut } from './calendar-shortcuts';
import { CalendarDetailPanel } from './calendar-detail-panel';
import { CalendarPreferencesStore } from './calendar-preferences.store';
import { CalendarView } from './calendar-view';
import {
  CalendarSummaryService,
  daySummaryErrorMessage,
  monthGridOfMonth,
  summaryErrorMessage,
} from './calendar-summary.service';
import type { CalendarSummary, CalendarSummaryDay } from './calendar-summary.models';
import type { DaySlot } from './calendar-day-slots.models';
import { CalendarDaySlotsService, daySlotsErrorMessage } from './calendar-day-slots.service';
import type { BlockException } from './calendar-day.model';
import { clockMinutes } from './calendar-month.model';
import { QuickBookingDrawer } from './quick-booking-drawer';
import type {
  CalendarDayInput,
  CalendarMonthInput,
  CalendarMonthMenuCommand,
  DaySourceStatus,
  CalendarPresentationInput,
  CalendarRequestPresentationMetadata,
  CalendarViewAction,
  CalendarViewMode,
  CalendarViewModel,
} from './calendar-view.models';
import {
  CalendarVisibleRange,
  calendarPeriodTitle,
  consultationSlotMinutes,
  fullyBlockedDateKeys,
  isWorkingTime,
  minutesToDuration,
  paddedSlotBounds,
  formatCalendarTime,
  formatCalendarTimeRange,
  projectBusinessHours,
  projectGridBusinessHours,
  toCalendarVisibleRange,
  weekdaysToHide,
} from './calendar-time.adapter';
import {
  TUNIS_TIME_ZONE,
  tunisDayKey,
  tunisHourMinute,
  tunisInstant,
  tunisWeekRange,
} from './calendar-time';

type FullCalendarView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
type CalendarEventMetadata =
  | AppointmentEventMetadata
  | CalendarRequestPresentationMetadata
  | ExceptionEventMetadata
  | BreakEventMetadata;

const REALTIME_FALLBACK_REFETCH_MS = 120_000;
/** The day view's « now » (marker, « Patient suivant ») moves once a minute. */
const DAY_CLOCK_MS = 60_000;
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


/** The FullCalendar title of each card: initials in « Mode discret », the name otherwise. */
export function discreetTitles<T extends { readonly title: string }>(events: readonly T[], discreet: boolean): T[] {
  return discreet ? events.map((event) => ({ ...event, title: patientLabel(event.title, true) })) : [...events];
}

/** How long the « déjà passé » / « en dehors de vos horaires » toast stays (fix 6). */
export const SLOT_HINT_MS = 4_000;
@Component({
  selector: 'oc-calendar-page',
  imports: [
    ReactiveFormsModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    OcButton,
    OcDateField,
    OcTimeField,
    CalendarDetailPanel,
    CalendarView,
    QuickBookingDrawer,
  ],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly scheduledCareApi = inject(ScheduledCareApiService);
  private readonly scheduledCare = inject(ScheduledCareFacade);
  private readonly summaryApi = inject(CalendarSummaryService);
  private readonly daySlotsApi = inject(CalendarDaySlotsService);
  private readonly consultations = inject(ActiveConsultationStore);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly calendarView = viewChild.required<CalendarView>('calendarView');
  private readonly preferences = inject(CalendarPreferencesStore);
  private readonly document = inject(DOCUMENT);
  private readonly appointmentPanel = viewChild.required<CalendarDetailPanel>('detailPanel');
  private readonly expectsRealtimeActivity = signal(true);
  // Compared by key: every `datesSet` builds a new object, and `hiddenDays`/break events derive from it.
  private readonly visibleRange = signal<CalendarVisibleRange | null>(null, {
    equal: (left, right) => left?.key === right?.key,
  });
  private automaticRangeKey: string | null = null;
  private pendingRangeKey: string | null = null;
  private rangeLoadGeneration = 0;
  private rulesLoadAttempted = false;

  readonly viewMode = signal<CalendarViewMode>('week');

  // ---- month view (CAL-5): the summary of the visible grid, straight from the API ----
  /** FullCalendar's view type of the last `datesSet`: the visible range belongs to the month only when it says so. */
  private readonly renderedView = signal('');
  /** `YYYY-MM` of the month FullCalendar is showing (Tunis). */
  private readonly renderedMonth = signal<string | null>(null);
  readonly summary = signal<CalendarSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly summaryError = signal<string | null>(null);
  private summaryKey: string | null = null;
  private summaryGeneration = 0;

  // ---- day view (CAL-6): the three sources of one Tunis day, each with its own state ----
  /** Calendar summary of the displayed day (from = to = the day), straight from the API. */
  readonly daySummary = signal<CalendarSummaryDay | null>(null);
  readonly daySummaryStatus = signal<DaySourceStatus>('loading');
  readonly daySummaryError = signal<string | null>(null);
  /** Slots of the displayed day (FREE / TAKEN / PAST as the API says). */
  readonly daySlots = signal<readonly DaySlot[] | null>(null);
  readonly daySlotsStatus = signal<DaySourceStatus>('loading');
  readonly daySlotsError = signal<string | null>(null);
  private dayLoadedKey: string | null = null;
  private daySummaryGeneration = 0;
  private daySlotsGeneration = 0;
  /** « Now » for the day view, refreshed every minute. */
  readonly dayNowMs = signal(Date.now());
  readonly startingAppointmentId = signal<string | null>(null);
  /** Request being accepted from a row: opened in the facade first, then accepted once it is loaded. */
  readonly acceptingRequestId = signal<string | null>(null);
  private readonly acceptPhase = signal<'idle' | 'opening' | 'accepting'>('idle');
  /** The facade's command error belongs to a row action (not to the panel) and may be shown in the day view. */
  private readonly rowCommandShown = signal(false);
  /** Start time preselected in the booking drawer when opened from an empty slot. */
  readonly quickBookingStart = signal<string | null>(null);
  readonly slotHint = signal<string | null>(null);
  private slotHintTimer: ReturnType<typeof setTimeout> | null = null;
  readonly visibleTitle = signal('');
  readonly selectedAppointmentId = signal<string | null>(null);
  readonly appointments = signal<readonly DoctorScheduledCareItem[]>([]);
  /** Pending booking requests of the visible range (drawn on the grid at their requested time). */
  readonly requests = signal<readonly DoctorScheduledCareItem[]>([]);
  /** Pending requests without an exact time: not drawn, only counted. */
  readonly unplacedRequestCount = computed(
    () => this.requests().filter((item) => isUnplacedRequest(item)).length,
  );
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
  readonly quickBookingOpen = signal(false);
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
  /** Earliest opening − 1 h to latest closing + 1 h. */
  // CAL-FIX-2 fix 5: earliest working start of the week − 1 h, widened by the loaded appointments and
  // requests of the visible period; the grid opens scrolled there (`scrollTime`).
  // Equal by value: a reload with the same bounds must not rebuild the FullCalendar options.
  readonly calendarSlotBounds = computed(
    () =>
      paddedSlotBounds(this.rules(), this.exceptions(), [
        ...this.appointments().filter((item) => item.status !== 'CANCELLED'),
        ...this.requests().filter(hasExactTime),
      ]),
    { equal: (left, right) => left.min === right.min && left.max === right.max },
  );
  readonly slotDuration = computed(() => minutesToDuration(consultationSlotMinutes(this.rules())));
  readonly workingHoursLabel = computed(() => {
    const bounds = this.calendarSlotBounds();
    return `${bounds.min.slice(0, 5)} – ${bounds.max.slice(0, 5)}`;
  });
  /** States the doctor switched off in « Filtres » (all shown by default, not persisted). */
  readonly hiddenStates = signal<ReadonlySet<CalendarState>>(new Set());
  /** Text typed in « Rechercher dans l'agenda… ». */
  readonly searchQuery = signal('');
  // Fix 10: in « Mode discret » the FullCalendar `title` is the initials, so the full name never
  // reaches the grid's DOM (the card template already shows initials; the title is FullCalendar's own copy).
  readonly appointmentEvents = computed(() =>
    discreetTitles(
      projectScheduledAppointmentEvents(this.appointments()).filter((event) =>
        isStateVisible(event.extendedProps.calendarState, this.hiddenStates()),
      ),
      this.preferences.discreet(),
    ),
  );
  readonly requestEvents = computed(() =>
    discreetTitles(
      projectRequestEvents(this.requests()).filter((event) =>
        isStateVisible(event.extendedProps.calendarState, this.hiddenStates()),
      ),
      this.preferences.discreet(),
    ),
  );
  /** What the search looks through: the cards actually drawn (not hidden by a filter, requests with a time). */
  private readonly searchableItems = computed(() => {
    const hidden = this.hiddenStates();
    const shown = (item: DoctorScheduledCareItem): boolean =>
      isStateVisible(presentCalendarItem(item, { isFollowUp: isFollowUpItem(item) }).state, hidden);
    return [
      ...this.appointments().filter(shown),
      ...this.requests().filter((item) => toRequestCalendarEvent(item) !== null && shown(item)),
    ];
  });
  readonly searchOutcome = computed(() =>
    searchCalendarItems(this.searchableItems(), this.searchQuery(), this.preferences.discreet()),
  );
  /** First Tunis day of the visible period. */
  readonly visibleDayKey = computed(() => {
    const range = this.visibleRange();
    return range === null ? '' : tunisDayKey(range.startMs);
  });
  /** Appointments of the displayed day only, cancelled ones excluded. */
  readonly dayAppointmentCount = computed(() =>
    countAppointmentsOfDay(this.appointments(), this.visibleDayKey()),
  );
  readonly exceptionEvents = computed(() =>
    projectExceptionEvents(this.exceptions(), this.viewMode()),
  );
  readonly breakEvents = computed(() =>
    projectBreakEvents(this.rules(), this.visibleRange(), this.viewMode()),
  );
  readonly calendarEvents = computed(() => [
    ...this.appointmentEvents(),
    ...this.requestEvents(),
    ...this.exceptionEvents(),
    ...this.breakEvents(),
  ]);
  /**
   * Week view only: hide weekdays with no active weekly rule and no loaded appointment in the
   * visible week. Display logic on loaded data; nothing is hidden until the rules have loaded.
   */
  readonly hiddenDays = computed(
    () =>
      this.viewMode() === 'week' && this.rulesLoaded() && !this.rulesError()
        ? weekdaysToHide(
            this.rules(),
            [...this.appointments(), ...this.requests()].map((item) => Date.parse(item.start)),
            this.visibleRange(),
          )
        : [],
    // Value equality: a fresh array with the same weekdays must not rebuild the FullCalendar options,
    // which would re-emit `datesSet` and loop.
    { equal: (left, right) => left.length === right.length && left.every((day, i) => day === right[i]) },
  );

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

  readonly viewModel = computed<CalendarViewModel>(() => ({
    viewMode: this.viewMode(),
    visibleTitle: this.visibleTitle(),
    visibleSubtitle: '',
    weekNumber: '',
    selectedAppointmentId: this.selectedAppointmentId(),
    panelOpen: false,
    loading: this.loading(),
    loadError: this.loadError(),
    rulesError: this.rulesError(),
    exceptionsError: this.exceptionsError(),
    mutationError: this.mutationError(),
    slotHint: this.slotHint(),
    noSchedule: this.noSchedule(),
    // 'stale' only means no event arrived recently; the socket is still up.
    realtimeDeferred: this.realtimeHealth() === 'down',
    ariaBusy: this.loading() || this.exceptionsLoading() || this.rulesLoading(),
    daySummary:
      this.viewMode() === 'day'
        ? {
            appointmentCountLabel: `${this.dayAppointmentCount()} rendez-vous`,
            appointmentCountHint: "pour la journée affichée",
            availabilityLabel: this.noSchedule() ? 'Non configuré' : 'Horaires configurés',
            availabilityHint: this.noSchedule() ? 'Aucune plage habituelle' : 'Disponibilité habituelle',
            workingHoursLabel: this.workingHoursLabel(),
            workingHoursHint: 'Plage utile affichée',
          }
        : null,
    // Fix 3: no permanent footer note under the calendar.
    notice: null,
    quickBookingEnabled: true,
    discreet: this.preferences.discreet(),
    currentDate: this.visibleDayKey(),
    searchQuery: this.searchQuery(),
    search: this.searchOutcome(),
    filters: CALENDAR_FILTER_OPTIONS.map((option) => ({
      ...option,
      visible: !this.hiddenStates().has(option.state),
    })),
    hiddenFilterCount: CALENDAR_FILTER_OPTIONS.filter((option) => this.hiddenStates().has(option.state)).length,
    shortcutsEnabled: this.preferences.shortcutsEnabled(),
  }));

  readonly presentation = computed<CalendarPresentationInput>(() => ({
    options: this.calendarOptions(),
    // The month and the day are drawn by their own components: FullCalendar (hidden there) gets no events to lay out.
    events: this.viewMode() === 'month' || this.dayInput() !== null ? [] : this.calendarEvents(),
  }));

  /**
   * The grid of the month (Tunis dates, Monday first, 4 to 6 weeks). It is computed from the month itself, not
   * from FullCalendar's range, which is trimmed by hidden weekdays.
   */
  private readonly monthGrid = computed(() => {
    const month = this.renderedMonth();
    return this.renderedView() === 'dayGridMonth' && month !== null ? monthGridOfMonth(month) : null;
  });

  readonly monthInput = computed<CalendarMonthInput>(() => {
    const grid = this.monthGrid();
    const summary = this.summary();
    const matches = grid !== null && summary !== null && summary.from === grid.from;
    const status: CalendarMonthInput['status'] =
      this.summaryError() !== null && !this.summaryLoading() ? 'error' : matches ? 'ready' : 'loading';
    return {
      status,
      error: this.summaryError(),
      gridKeys: grid?.keys ?? [],
      referenceMonth: this.renderedMonth() ?? '',
      summary: matches ? summary : null,
      hiddenStates: this.hiddenStates(),
      appointments: this.appointments(),
      requests: this.requests(),
    };
  });

  /** Closing exceptions of the displayed day, matched to the closed windows of the summary by their times. */
  private readonly dayBlockExceptions = computed<readonly BlockException[]>(() => {
    const key = this.visibleDayKey();
    return this.exceptions()
      .filter((exception) => exception.type === 'BLOCK' && exception.exceptionDate === key)
      .map((exception) => ({
        id: exception.id,
        start: exception.startTime.slice(0, 5),
        end: exception.endTime.slice(0, 5),
      }));
  });

  readonly dayInput = computed<CalendarDayInput | null>(() => {
    if (this.viewMode() !== 'day') return null;
    const dayKey = this.visibleDayKey();
    if (dayKey === '') return null;
    // Until FullCalendar reports the Jour view, the day is the previous period's first day: show loading.
    const settled = this.renderedView() === 'timeGridDay';
    const itemsStatus: DaySourceStatus =
      !settled || this.loading() ? 'loading' : this.loadError() !== null ? 'error' : 'ready';
    const panelOpen = this.appointmentPanel().open();
    return {
      dayKey,
      nowMs: this.dayNowMs(),
      items: {
        status: itemsStatus,
        error: this.loadError(),
        list: [...this.appointments(), ...this.requests()],
      },
      summary: {
        status: settled ? this.daySummaryStatus() : 'loading',
        error: this.daySummaryError(),
        day: this.daySummary(),
      },
      slots: {
        status: settled ? this.daySlotsStatus() : 'loading',
        error: this.daySlotsError(),
        list: this.daySlots(),
      },
      hiddenStates: this.hiddenStates(),
      canStart:
        this.consultations.active() === null &&
        !this.consultations.loading() &&
        this.consultations.error() === null,
      startingId: this.startingAppointmentId(),
      acceptingId: this.acceptingRequestId(),
      commandBusy: this.scheduledCare.commandLoading() || this.consultations.starting(),
      commandError:
        panelOpen || !this.rowCommandShown()
          ? null
          : (this.scheduledCare.commandError() ??
            this.consultations.startError() ??
            this.scheduledCare.requestError()),
      blockExceptions: this.dayBlockExceptions(),
    };
  });

  readonly calendarOptions = computed<CalendarOptions>(() => {
    const fullyBlockedDates = this.fullyBlockedDates();
    return {
      plugins: [themePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'timeGridWeek',
      locale: frLocale,
      // Every date and time of the calendar is Africa/Tunis time, whatever the browser's zone.
      // FullCalendar then hands back real instants (datesSet, dateClick, view.currentStart).
      timeZone: TUNIS_TIME_ZONE,
      firstDay: 1,
      hiddenDays: this.hiddenDays(),
      headerToolbar: false,
      // Fix 7: the time grid takes its natural height and the page is the only scroll area; the
      // day header stays visible while the page scrolls.
      height: this.viewMode() === 'month' ? 798 : 'auto',
      stickyHeaderDates: true,
      expandRows: true,
      allDaySlot: false,
      slotMinTime: this.calendarSlotBounds().min,
      slotMaxTime: this.calendarSlotBounds().max,
      scrollTime: this.calendarSlotBounds().min,
      scrollTimeReset: false,
      slotDuration: this.slotDuration(),
      slotLabelInterval: '01:00:00',
      slotMinHeight: 28,
      eventMinHeight: this.viewMode() === 'month' ? 22 : 26,
      eventShortHeight: 40,
      dayMaxEvents: 3,
      moreLinkText: (count) => `+${count}`,
      moreLinkClass: 'demo-calendar-more-link',
      nowIndicator: true,
      nowIndicatorLineClass: 'demo-calendar-now-line',
      nowIndicatorDotClass: 'demo-calendar-now-dot',
      navLinks: false,
      editable: false,
      selectable: false,
      eventStartEditable: false,
      eventDurationEditable: false,
      businessHours: projectGridBusinessHours(this.rules()),
      dayHeaderFormat: {
        weekday: 'short',
        day: this.viewMode() === 'month' ? undefined : 'numeric',
      },
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      slotLabelFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        omitZeroMinute: false,
      },
      viewClass: (info) => `demo-calendar-view demo-calendar-view--${info.view.type}`,
      dayHeaderClass: (info) =>
        `demo-calendar-day-header${info.isToday ? ' demo-calendar-day-header--today' : ''}`,
      dayCellClass: (info) =>
        [
          'demo-calendar-day-cell',
          info.isToday ? 'demo-calendar-day-cell--today' : '',
          info.isOther ? 'demo-calendar-day-cell--other' : '',
          fullyBlockedDates.has(tunisDayKey(info.date)) ? 'demo-calendar-day-cell--exception' : '',
        ]
          .filter(Boolean)
          .join(' '),
      dayLaneClass: (info) =>
        `demo-calendar-day-lane${info.isToday ? ' demo-calendar-day-lane--today' : ''}${fullyBlockedDates.has(tunisDayKey(info.date)) ? ' demo-calendar-day-lane--exception' : ''}`,
      slotLaneClass: (info) =>
        `demo-calendar-slot ${
          info.isMajor ? 'demo-calendar-slot--major' : 'demo-calendar-slot--minor'
        }`,
      slotHeaderClass: 'demo-calendar-slot-header',
      slotHeaderInnerClass: 'demo-calendar-slot-label',
      nonBusinessHoursClass: 'demo-calendar-non-business',
      eventClass: (info) => this.calendarEventClasses(info),
      backgroundEventClass: 'omnicare-fc-background-event',
      datesSet: (info) => this.onDatesSet(info),
      eventClick: (info) => this.onEventClick(info),
      dateClick: (info) => this.onDateClick(info),
    };
  });

  constructor() {
    // One keydown listener, owned by this page and removed with it (no global listener left behind).
    const onKeydown = (event: KeyboardEvent): void => this.onKeydown(event);
    this.document.addEventListener('keydown', onKeydown);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('keydown', onKeydown));
    // The slot-hint timer is cleared once, with the page (it used to register one callback per hint).
    this.destroyRef.onDestroy(() => {
      if (this.slotHintTimer !== null) clearTimeout(this.slotHintTimer);
    });

    // Month view: load the summary of the visible grid (again when the grid changes or the month is re-entered).
    effect(() => {
      const grid = this.monthGrid();
      const isMonth = this.viewMode() === 'month';
      untracked(() => {
        if (!isMonth || grid === null) {
          if (!isMonth) this.summaryKey = null;
          return;
        }
        this.loadSummary(grid.from, grid.to);
      });
    });

    // Day view: load the summary and the slots of the displayed Tunis day (again when the day changes or the view is re-entered).
    effect(() => {
      const isDay = this.viewMode() === 'day';
      const settled = this.renderedView() === 'timeGridDay';
      const dayKey = this.visibleDayKey();
      untracked(() => {
        if (!isDay) {
          this.dayLoadedKey = null;
          return;
        }
        if (settled && dayKey !== '') this.loadDay(dayKey);
      });
    });

    // The accept of a request row: the facade works on the request it has open, so open it, then accept it once loaded.
    effect(() => {
      const id = this.acceptingRequestId();
      const phase = this.acceptPhase();
      const active = this.scheduledCare.activeRequest();
      const loading = this.scheduledCare.requestLoading();
      const requestError = this.scheduledCare.requestError();
      const commandLoading = this.scheduledCare.commandLoading();
      untracked(() => {
        if (id === null) return;
        if (phase === 'opening') {
          if (loading) return;
          if (requestError !== null) {
            this.finishAccept(false);
          } else if (active?.requestId === id) {
            this.acceptPhase.set('accepting');
            this.scheduledCare.acceptRequest();
          }
          return;
        }
        if (phase === 'accepting' && !commandLoading) this.finishAccept(this.scheduledCare.commandError() === null);
      });
    });
    interval(DAY_CLOCK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dayNowMs.set(Date.now()));

    let observedProjectionEpoch = this.scheduledCare.projectionInvalidationEpoch();
    effect(() => {
      const epoch = this.scheduledCare.projectionInvalidationEpoch();
      if (epoch === observedProjectionEpoch) return;
      observedProjectionEpoch = epoch;
      const range = this.visibleRange();
      if (range !== null) this.loadVisibleRange(range, true, true);
      this.refreshSummary();
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
      this.selectedAppointmentId.set(null);
      this.viewMode.set(value);
      this.calendarView().changeView(value);
    }
  }
  previous(): void {
    this.selectedAppointmentId.set(null);
    this.calendarView().previous();
  }
  goToday(): void {
    this.selectedAppointmentId.set(null);
    this.calendarView().today();
  }
  next(): void {
    this.selectedAppointmentId.set(null);
    this.calendarView().next();
  }

  handleViewAction(action: CalendarViewAction): void {
    switch (action.kind) {
      case 'SET_VIEW': this.setViewMode(action.value); break;
      case 'PREVIOUS': this.previous(); break;
      case 'TODAY': this.goToday(); break;
      case 'NEXT': this.next(); break;
      case 'CONFIGURE_SCHEDULE': this.configureSchedule(); break;
      case 'ADD_EXCEPTION': this.openExceptionForm(); break;
      case 'NEW_APPOINTMENT':
        this.quickBookingStart.set(null);
        this.quickBookingOpen.set(true);
        break;
      case 'RETRY_RULES': this.retryRules(); break;
      case 'RETRY_APPOINTMENTS':
      case 'RETRY_EXCEPTIONS': this.retryLoad(); break;
      case 'REOPEN_EXCEPTION': this.reopenException(action.exceptionId); break;
      case 'GO_TO_DATE':
        this.selectedAppointmentId.set(null);
        this.calendarView().goToDate(action.date);
        break;
      case 'SET_SEARCH': this.searchQuery.set(action.query); break;
      case 'OPEN_ITEM': this.openItem(action.resource, action.id); break;
      case 'TOGGLE_FILTER': this.toggleFilter(action.state); break;
      case 'RESET_FILTERS': this.hiddenStates.set(new Set()); break;
      case 'TOGGLE_DISCREET': this.preferences.toggle(); break;
      case 'TOGGLE_SHORTCUTS': this.preferences.toggleShortcuts(); break;
      case 'OPEN_DAY': this.openDay(action.date); break;
      case 'NEW_APPOINTMENT_ON': this.newAppointmentOn(action.date); break;
      case 'DAY_MENU': this.openDayMenuCommand(action.date, action.command); break;
      case 'RETRY_SUMMARY': this.refreshSummary(); break;
      case 'SHOW_SHORTCUTS': this.calendarView().toolbar().openShortcuts(); break;
      case 'DAY_START': void this.startAppointment(action.id); break;
      case 'DAY_ACCEPT': this.acceptFromRow(action.id); break;
      case 'DAY_DECLINE': this.declineFromRow(action.id); break;
      case 'DAY_ADD_SLOT': this.addOnSlot(action.date, action.start); break;
      case 'DAY_EXTEND': this.openDayMenuCommand(action.date, 'EXTEND'); break;
      case 'DAY_OPEN_PATIENT_FILE': this.openItem('appointment', action.id); break;
      case 'RETRY_DAY_SUMMARY': this.loadDay(this.visibleDayKey(), true, false, 'summary'); break;
      case 'RETRY_DAY_SLOTS': this.loadDay(this.visibleDayKey(), true, false, 'slots'); break;
    }
  }

  /** A day of the month: the Jour view on that Tunis date. */
  openDay(dayKey: string): void {
    this.selectedAppointmentId.set(null);
    this.viewMode.set('day');
    this.calendarView().changeView('day', dayKey);
  }

  /** « + Rendez-vous » of a day preview: the booking drawer on that day, at its first working hour. */
  newAppointmentOn(dayKey: string): void {
    // CAL-FIX-2 fix 6: never on a past day; today, a start already past is not pre-filled (the drawer opens
    // without a time and only offers the slots the API still lists).
    if (isPastDay(dayKey, Date.now())) return;
    const opening = this.summary()?.days.find((day) => day.date === dayKey)?.workingSegments[0]?.start ?? '09:00';
    const start = tunisInstant(dayKey, opening);
    this.quickBookingStart.set(start === null || start.getTime() < Date.now() ? null : start.toISOString());
    this.quickBookingOpen.set(true);
  }

  /**
   * « Prolonger / Fermer / Ajouter une pause » of a day: opens the existing exception form, already filled
   * for that day. Nothing is saved until the doctor confirms there.
   */
  openDayMenuCommand(dayKey: string, command: CalendarMonthMenuCommand): void {
    const day =
      this.summary()?.days.find((candidate) => candidate.date === dayKey) ??
      (this.daySummary()?.date === dayKey ? this.daySummary() : null) ??
      undefined;
    const lastEnd = day?.workingSegments.at(-1)?.end ?? '18:00';
    const lastEndMinutes = clockMinutes(lastEnd) ?? 18 * 60;
    const breakStart = day?.breakWindow?.start ?? '12:00';
    const breakEnd = day?.breakWindow?.end ?? minutesToTime((clockMinutes(breakStart) ?? 720) + 60);
    const preset =
      command === 'CLOSE'
        ? { type: 'BLOCK' as const, scope: 'FULL_DAY' as const, startTime: '00:00', endTime: '00:00' }
        : command === 'EXTEND'
          ? {
              type: 'EXTRA' as const,
              scope: 'TIME_WINDOW' as const,
              startTime: minutesToTime(Math.min(lastEndMinutes, 1380)),
              endTime: minutesToTime(Math.min(lastEndMinutes + 60, 1439)),
            }
          : { type: 'BLOCK' as const, scope: 'TIME_WINDOW' as const, startTime: breakStart, endTime: breakEnd };
    this.exceptionForm.setValue({ ...preset, date: dayKey, reason: '' });
    this.exceptionFormError.set(null);
    this.exceptionFormOpen.set(true);
  }

  private loadSummary(from: string, to: string, force = false, silent = false): void {
    const key = `${from}|${to}`;
    if (!force && key === this.summaryKey) return;
    this.summaryKey = key;
    const generation = ++this.summaryGeneration;
    if (!silent) {
      this.summaryLoading.set(true);
      this.summaryError.set(null);
    }
    this.summaryApi
      .getSummary(from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          if (generation !== this.summaryGeneration) return;
          this.summary.set(summary);
          this.summaryLoading.set(false);
          this.summaryError.set(null);
        },
        error: (error: unknown) => {
          if (generation !== this.summaryGeneration) return;
          this.summaryLoading.set(false);
          this.summaryError.set(summaryErrorMessage(error));
          if (!silent) this.summary.set(null);
        },
      });
  }

  /** Reloads the month summary (retry, or after a change); nothing happens outside the month view. */
  refreshSummary(): void {
    const grid = this.monthGrid();
    if (this.viewMode() === 'month' && grid !== null) this.loadSummary(grid.from, grid.to, true);
    this.refreshDay();
  }

  /** Reloads the summary and the slots of the displayed day after a change (no skeleton, no flicker). */
  refreshDay(): void {
    const dayKey = this.visibleDayKey();
    if (this.viewMode() === 'day' && this.renderedView() === 'timeGridDay' && dayKey !== '') {
      this.loadDay(dayKey, true, true);
    }
  }

  /**
   * The summary (from = to = the day) and the slots of one Tunis day. The appointments and requests of the day are
   * the page's usual range load. `only` reloads one source (the « Réessayer » of that source).
   */
  private loadDay(dayKey: string, force = false, silent = false, only?: 'summary' | 'slots'): void {
    if (!force && dayKey === this.dayLoadedKey) return;
    this.dayLoadedKey = dayKey;
    if (only !== 'slots') this.loadDaySummary(dayKey, silent);
    if (only !== 'summary') this.loadDaySlots(dayKey, silent);
  }

  private loadDaySummary(dayKey: string, silent: boolean): void {
    const generation = ++this.daySummaryGeneration;
    if (!silent) {
      this.daySummaryStatus.set('loading');
      this.daySummaryError.set(null);
      this.daySummary.set(null);
    }
    this.summaryApi
      .getSummary(dayKey, dayKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          if (generation !== this.daySummaryGeneration) return;
          this.daySummary.set(summary.days.find((day) => day.date === dayKey) ?? null);
          this.daySummaryStatus.set('ready');
          this.daySummaryError.set(null);
        },
        error: (error: unknown) => {
          if (generation !== this.daySummaryGeneration) return;
          this.daySummaryStatus.set('error');
          this.daySummaryError.set(daySummaryErrorMessage(error));
          if (!silent) this.daySummary.set(null);
        },
      });
  }

  private loadDaySlots(dayKey: string, silent: boolean): void {
    const generation = ++this.daySlotsGeneration;
    if (!silent) {
      this.daySlotsStatus.set('loading');
      this.daySlotsError.set(null);
      this.daySlots.set(null);
    }
    this.daySlotsApi
      .getDaySlots(dayKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (generation !== this.daySlotsGeneration) return;
          this.daySlots.set(response.slots);
          this.daySlotsStatus.set('ready');
          this.daySlotsError.set(null);
        },
        error: (error: unknown) => {
          if (generation !== this.daySlotsGeneration) return;
          this.daySlotsStatus.set('error');
          this.daySlotsError.set(daySlotsErrorMessage(error));
          if (!silent) this.daySlots.set(null);
        },
      });
  }

  // ---- day rows: the same commands as the CAL-3 panel ----

  /** « Démarrer »: the panel's command (`startScheduledAppointment`), then the consultation opens. */
  async startAppointment(appointmentId: string): Promise<void> {
    const item = this.appointments().find((candidate) => candidate.appointmentId === appointmentId);
    if (item === undefined || item.status !== 'CONFIRMED' || this.startingAppointmentId() !== null) return;
    this.mutationError.set(null);
    this.rowCommandShown.set(true);
    this.startingAppointmentId.set(appointmentId);
    try {
      const outcome = await this.consultations.startScheduledAppointment(appointmentId, item.version);
      if (outcome.kind === 'STARTED' || outcome.kind === 'RECOVERED') {
        await this.router.navigate(['/doctor', 'consultation', outcome.consultation.consultationId]);
      }
    } finally {
      this.startingAppointmentId.set(null);
    }
  }

  /** « Accepter »: opens the request in the facade, then calls its `acceptRequest()` once, as the panel does. */
  acceptFromRow(requestId: string): void {
    if (this.acceptingRequestId() !== null || this.scheduledCare.commandLoading()) return;
    this.mutationError.set(null);
    this.rowCommandShown.set(true);
    this.acceptingRequestId.set(requestId);
    this.acceptPhase.set('opening');
    this.scheduledCare.openRequest(requestId);
  }

  private finishAccept(succeeded: boolean): void {
    this.acceptPhase.set('idle');
    this.acceptingRequestId.set(null);
    // Nothing keeps the request open behind the day view once it is accepted; on failure the error stays visible.
    if (succeeded) this.scheduledCare.closeRequest();
  }

  /** « Refuser »: the panel opens on its two-step refusal (reason, then confirmation). Nothing is refused here. */
  declineFromRow(requestId: string): void {
    const request = this.requests().find((candidate) => candidate.requestId === requestId);
    this.mutationError.set(null);
    this.rowCommandShown.set(false);
    this.selectedAppointmentId.set(requestId);
    this.appointmentPanel().openRequest(request ?? requestId);
    this.appointmentPanel().openDecline();
  }

  /** « + Ajouter » on a free row: the booking drawer, preselected on that slot. */
  addOnSlot(dayKey: string, start: string): void {
    const instant = tunisInstant(dayKey, start);
    if (instant !== null && instant.getTime() < Date.now()) return; // past time is never offered (fix 6)
    this.quickBookingStart.set(instant?.toISOString() ?? null);
    this.quickBookingOpen.set(true);
  }

  private toggleFilter(state: CalendarState): void {
    this.hiddenStates.update((hidden) => {
      const next = new Set(hidden);
      if (!next.delete(state)) next.add(state);
      return next;
    });
  }

  /** Chosen from the search or opened from the keyboard: scroll to the card, then open the side panel. */
  openItem(resource: 'appointment' | 'request', id: string): void {
    this.mutationError.set(null);
    this.rowCommandShown.set(false);
    this.selectedAppointmentId.set(id);
    this.calendarView().scrollToCard(id);
    if (resource === 'request') {
      const request = this.requests().find((candidate) => candidate.requestId === id);
      this.appointmentPanel().openRequest(request ?? id);
      return;
    }
    const appointment = this.appointments().find((candidate) => candidate.appointmentId === id);
    this.appointmentPanel().openWith(appointment ?? id);
  }

  /** True while a window, drawer or dialog of the page is open: single-key shortcuts stay quiet. */
  private overlayOpen(): boolean {
    return (
      this.appointmentPanel().open() ||
      this.quickBookingOpen() ||
      this.exceptionFormOpen() ||
      this.selectedException() !== null
    );
  }

  /**
   * Keyboard shortcuts (canvas « Agenda médecin »). Navigation and display only: nothing here accepts,
   * refuses, cancels, starts, moves or marks anything. Registered by this page, removed with it.
   */
  private onKeydown(event: KeyboardEvent): void {
    const toolbar = this.calendarView().toolbar();
    // Échap always closes what is transient (window, popover, search), shortcuts on or off.
    if (event.key === 'Escape') {
      if (toolbar.closeTransient() || this.calendarView().closeMonthPreview()) event.preventDefault();
      return;
    }
    if (!this.preferences.shortcutsEnabled() || event.defaultPrevented) return;
    if (isTypingTarget(event.target) || isTypingTarget(this.document.activeElement)) return;
    if (toolbar.blocksShortcuts() || this.overlayOpen()) return;
    // Month view: arrows, Espace and Entrée act on the focused day (arrows keep moving the period elsewhere).
    if (this.viewMode() === 'month' && this.calendarView().handleMonthKey(event)) {
      event.preventDefault();
      return;
    }
    const shortcut = resolveShortcut(event);
    if (shortcut === null) return;

    switch (shortcut) {
      case 'TODAY': this.goToday(); break;
      case 'VIEW_DAY': this.setViewMode('day'); break;
      case 'VIEW_WEEK': this.setViewMode('week'); break;
      case 'VIEW_MONTH': this.setViewMode('month'); break;
      case 'PREVIOUS': this.previous(); break;
      case 'NEXT': this.next(); break;
      case 'NEW_APPOINTMENT': this.handleViewAction({ kind: 'NEW_APPOINTMENT' }); break;
      case 'FOCUS_SEARCH': toolbar.focusSearch(); break;
      case 'OPEN_PICKER': toolbar.openPicker(); break;
      case 'TOGGLE_DISCREET': this.preferences.toggle(); break;
      case 'SHOW_SHORTCUTS': toolbar.openShortcuts(); break;
      case 'OPEN_SELECTED': {
        // Entrée keeps its own meaning on buttons and links; it only opens a focused card.
        if (isActivatableTarget(event.target)) return;
        const card = this.calendarView().focusedCard();
        if (card === null) return;
        this.openItem(card.resource, card.id);
        break;
      }
    }
    event.preventDefault();
  }

  onQuickBookingCreated(appointment: PracticePatientAppointmentDto): void {
    this.quickBookingOpen.set(false);
    this.mutationError.set(null);
    const range = this.visibleRange();
    if (range !== null) this.loadVisibleRange(range, true, true);
    this.refreshSummary();
    this.selectedAppointmentId.set(appointment.id);
    this.appointmentPanel().openWith(appointment.id);
  }

  onDatesSet(info: DatesSetInfo): void {
    this.renderedView.set(info.view.type);
    if (info.view.type === 'dayGridMonth') this.renderedMonth.set(monthOfView(info));
    const { start, end } = this.loadedPeriod(info);
    this.updateVisibleTitle(info.view.title, info.view.type, start, end);
    const range = toCalendarVisibleRange(start, end);
    this.visibleRange.set(range);
    this.loadRules();
    this.loadVisibleRange(range);
  }

  /**
   * `datesSet` reports the *active* range, which FullCalendar trims when a hidden weekday sits at
   * the edge of the week (e.g. a closed Sunday). The week is always loaded in full so an
   * appointment on a hidden day can never be left unfetched and therefore unseen.
   */
  private loadedPeriod(info: DatesSetInfo): { start: Date; end: Date } {
    const { currentStart } = info.view as Partial<DatesSetInfo['view']>;
    if (info.view.type === 'timeGridWeek') {
      // Monday 00:00 → Sunday 24:00 in Tunis, computed here so it never depends on the browser's zone.
      const week = tunisWeekRange(isValidDate(currentStart) ? currentStart : info.start);
      if (week !== null) return { start: week.start, end: week.end };
    }
    return { start: info.start, end: info.end };
  }

  /**
   * Empty-slot click in day/week view: open the booking drawer on that start time.
   * Past or non-working slots are ignored with a short French hint.
   */
  onDateClick(info: DateClickInfo): void {
    if (info.view.type === 'dayGridMonth' || info.allDay) return;
    const start = info.date;
    if (start.getTime() < Date.now()) {
      this.showSlotHint('Ce créneau est déjà passé.');
      return;
    }
    if (!isWorkingTime(start, this.rules(), this.exceptions())) {
      this.showSlotHint('Ce créneau est en dehors de vos horaires de consultation.');
      return;
    }
    this.slotHint.set(null);
    this.quickBookingStart.set(start.toISOString());
    this.quickBookingOpen.set(true);
  }

  private showSlotHint(message: string): void {
    this.slotHint.set(message);
    if (this.slotHintTimer !== null) clearTimeout(this.slotHintTimer);
    this.slotHintTimer = setTimeout(() => this.slotHint.set(null), SLOT_HINT_MS);
  }

  onEventClick(info: EventClickInfo): void {
    const metadata = info.event.extendedProps as Partial<CalendarEventMetadata>;
    if (metadata.kind === 'appointment' && typeof metadata.appointmentId === 'string') {
      this.mutationError.set(null);
      this.selectedAppointmentId.set(metadata.appointmentId);
      const appointment = this.appointments().find(
        (candidate) => candidate.appointmentId === metadata.appointmentId,
      );
      this.appointmentPanel().openWith(appointment ?? metadata.appointmentId);
      return;
    }
    if (metadata.kind === 'request' && typeof metadata.requestId === 'string') {
      this.mutationError.set(null);
      this.selectedAppointmentId.set(metadata.requestId);
      const request = this.requests().find((candidate) => candidate.requestId === metadata.requestId);
      this.appointmentPanel().openRequest(request ?? metadata.requestId);
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
    // Tunis clock and date, not the browser's.
    const startMinutes = Math.min(Math.ceil(tunisHourMinute(now).minutes / 15) * 15, 1380);
    this.exceptionForm.setValue({
      type: 'BLOCK',
      scope: 'FULL_DAY',
      date: tunisDayKey(now),
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
          this.refreshSummary();
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
    this.removeException(
      exception,
      (message) => this.exceptionFormError.set(message),
      () => this.selectedException.set(null),
    );
  }

  /** « Rouvrir » on a closed slot: same delete-exception flow, errors shown in the page banner. */
  reopenException(exceptionId: string): void {
    const exception = this.exceptions().find((candidate) => candidate.id === exceptionId);
    if (!exception || this.deletingException()) return;
    this.removeException(
      exception,
      (message) => this.mutationError.set(message),
      () => undefined,
    );
  }

  private removeException(
    exception: AvailabilityExceptionDto,
    report: (message: string | null) => void,
    afterSuccess: () => void,
  ): void {
    this.deletingException.set(true);
    report(null);
    this.appointmentApi
      .deleteException(exception.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingException.set(false);
          this.exceptions.update((exceptions) =>
            exceptions.filter((candidate) => candidate.id !== exception.id),
          );
          afterSuccess();
          this.refreshSummary();
        },
        error: () => {
          this.deletingException.set(false);
          report("Erreur lors de la suppression de l'exception.");
        },
      });
  }

  /** `yyyy-MM-dd` → « jj/mm/aaaa ». */
  frenchDate(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  eventMetadata(info: EventDisplayInfo): CalendarEventMetadata {
    return info.event.extendedProps as CalendarEventMetadata;
  }
  calendarEventClasses(info: EventDisplayInfo): string {
    const metadata = this.eventMetadata(info);
    const classes: string[] = [];

    if (metadata.kind === 'appointment' || metadata.kind === 'request') {
      classes.push('demo-calendar-appointment');
    } else if (metadata.kind === 'break') {
      classes.push('demo-calendar-break');
    } else if (metadata.exceptionType === 'BLOCK') {
      classes.push('demo-calendar-state', 'demo-calendar-state--unavailable');
    } else {
      classes.push('demo-calendar-state', 'demo-calendar-state--exception');
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
    if (metadata.kind === 'appointment' || metadata.kind === 'request') {
      return `${metadata.patientLabel}, ${this.eventTimeRange(info)}, ${metadata.statusLabel}`;
    }
    if (metadata.kind === 'break') return `${metadata.title}, ${metadata.timeLabel}`;
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
          // Booking requests are drawn too (CAL-3); closed ones never come back from the agenda.
          this.requests.set(
            agenda.items
              .filter((item) => item.resourceType === 'BOOKING_REQUEST')
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

  private updateVisibleTitle(title: string, calendarView: string, start?: Date, end?: Date): void {
    if (this.isFullCalendarView(calendarView)) {
      const mode = MODE_BY_CALENDAR_VIEW[calendarView];
      this.viewMode.set(mode);
      this.visibleTitle.set(start && end ? calendarPeriodTitle(mode, start, end) : title);
      return;
    }
    this.visibleTitle.set(title);
  }
  private isCalendarViewMode(value: string): value is CalendarViewMode {
    return value === 'day' || value === 'week' || value === 'month';
  }
  private isFullCalendarView(value: string): value is FullCalendarView {
    return value in MODE_BY_CALENDAR_VIEW;
  }
}

/** `YYYY-MM` (Tunis) of a month view: its first day, or the middle of its range when FullCalendar gives none. */
function monthOfView(info: DatesSetInfo): string {
  const { currentStart } = info.view as Partial<DatesSetInfo['view']>;
  const reference = isValidDate(currentStart)
    ? currentStart
    : new Date((info.start.getTime() + info.end.getTime()) / 2);
  return tunisDayKey(reference).slice(0, 7);
}

function isValidDate(value: Date | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
function byAppointmentStart(left: DoctorScheduledCareItem, right: DoctorScheduledCareItem): number {
  return new Date(left.start).getTime() - new Date(right.start).getTime();
}
function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
