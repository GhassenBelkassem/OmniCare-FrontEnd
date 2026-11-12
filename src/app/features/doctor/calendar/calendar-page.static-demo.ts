import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CalendarOptions,
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventInput,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import themePlugin from '@fullcalendar/angular/themes/monarch';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import frLocale from 'fullcalendar/locales/fr';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { OcAvatar } from '../../../shared/ui/avatar/oc-avatar';
import { OcButton } from '../../../shared/ui/button/oc-button';
import { OcStatusBadge } from '../../../shared/ui/status-badge/oc-status-badge';
import { OcTab, OcTabs } from '../../../shared/ui/tabs/oc-tabs';
import {
  DEMO_CALENDAR_APPOINTMENTS,
  DEMO_CALENDAR_DAY_STATES,
  DemoCalendarAppointment,
  DemoDayState,
} from './calendar-demo.fixtures';
import { CalendarView } from './calendar-view';
import type {
  CalendarPresentationInput,
  CalendarViewAction,
  CalendarViewModel,
} from './calendar-view.models';

type CalendarViewMode = 'day' | 'week' | 'month';
type FullCalendarView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
type PanelTab = 'details' | 'history' | 'documents' | 'notes';

interface AppointmentEventMetadata {
  readonly kind: 'appointment';
  readonly appointmentId: string;
  readonly patientLabel: string;
  readonly statusLabel: string;
  readonly categoryLabel: string;
  readonly detailLabel: string;
  readonly statusIcon: 'clock-circle' | 'check-circle';
}

interface DayStateEventMetadata {
  readonly kind: 'day-state';
  readonly state: DemoDayState;
  readonly title: string;
  readonly description: string;
  readonly icon: 'calendar' | 'clock-circle';
}

interface BreakEventMetadata {
  readonly kind: 'break';
  readonly title: string;
}

type DemoCalendarEventMetadata =
  AppointmentEventMetadata | DayStateEventMetadata | BreakEventMetadata;

const MODE_BY_VIEW: Readonly<Record<FullCalendarView, CalendarViewMode>> = {
  timeGridDay: 'day',
  timeGridWeek: 'week',
  dayGridMonth: 'month',
};

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  consultation: 'Consultation',
  'follow-up': 'Suivi',
  control: 'Contrôle',
  annual: 'Bilan',
  vaccination: 'Vaccination',
  results: 'Résultats',
  urgent: 'Urgence',
};

const FRENCH_DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const FRENCH_MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const FRENCH_DAY_LONG = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const FRENCH_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const FRENCH_TIME = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function titleCase(value: string): string {
  return value.length > 0 ? `${value[0]?.toLocaleUpperCase('fr-FR')}${value.slice(1)}` : value;
}

function toDateKey(value: Date): string {
  return `${value.getFullYear()}-${(value.getMonth() + 1).toString().padStart(2, '0')}-${value
    .getDate()
    .toString()
    .padStart(2, '0')}`;
}

@Component({
  selector: 'oc-calendar-page',
  imports: [
    RouterLink,
    CalendarView,
    NzIconModule,
    NzModalModule,
    OcAvatar,
    OcButton,
    OcStatusBadge,
    OcTabs,
  ],
  templateUrl: './calendar-page.static-demo.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly calendarView = viewChild.required<CalendarView>('calendarView');
  private readonly panelHeading = viewChild<ElementRef<HTMLHeadingElement>>('panelHeading');
  private previouslyFocusedEvent: HTMLElement | null = null;
  private lastFocusedAppointmentId: string | null = null;

  readonly viewMode = signal<CalendarViewMode>('month');
  readonly visibleTitle = signal('Octobre 2026');
  readonly visibleSubtitle = signal('');
  readonly weekNumber = signal('');
  readonly selectedAppointmentId = signal<string | null>(null);
  readonly activePanelTab = signal<PanelTab>('details');
  readonly scheduleDialogOpen = signal(false);
  readonly exceptionDialogOpen = signal(false);
  readonly actionMessage = signal<string | null>(null);

  readonly panelTabs: readonly OcTab[] = [
    { id: 'details', label: 'Détails' },
    { id: 'history', label: 'Historique' },
    { id: 'documents', label: 'Documents' },
    { id: 'notes', label: 'Notes' },
  ];

  readonly selectedAppointment = computed(() => {
    const id = this.selectedAppointmentId();
    return id === null
      ? null
      : (DEMO_CALENDAR_APPOINTMENTS.find((appointment) => appointment.id === id) ?? null);
  });

  readonly dayAppointmentCount = computed(
    () =>
      DEMO_CALENDAR_APPOINTMENTS.filter((appointment) => appointment.start.startsWith('2026-10-30'))
        .length,
  );

  readonly calendarEvents = computed<EventInput[]>(() => {
    const appointments: EventInput[] = DEMO_CALENDAR_APPOINTMENTS.map((appointment) => ({
      id: appointment.id,
      title: `${appointment.categoryLabel} · ${appointment.patientName}`,
      start: appointment.start,
      end: appointment.end,
      allDay: false,
      interactive: true,
      className: this.demoAppointmentToneClass(appointment),
      extendedProps: {
        kind: 'appointment',
        appointmentId: appointment.id,
        patientLabel: appointment.patientName,
        statusLabel: appointment.statusLabel,
        categoryLabel: this.eventCategoryLabel(appointment),
        detailLabel: appointment.reason,
        statusIcon: appointment.status === 'pending' ? 'clock-circle' : 'check-circle',
      } satisfies AppointmentEventMetadata,
    }));

    const states: EventInput[] = DEMO_CALENDAR_DAY_STATES.map((state) => ({
      id: `demo-state-${state.date}`,
      title: state.title,
      start: this.viewMode() === 'month' ? state.date : `${state.date}T11:30:00`,
      end: this.viewMode() === 'month' ? undefined : `${state.date}T13:30:00`,
      allDay: this.viewMode() === 'month',
      interactive: false,
      extendedProps: {
        kind: 'day-state',
        state,
        title: state.title,
        description: state.description,
        icon: state.kind === 'day-off' ? 'calendar' : 'clock-circle',
      } satisfies DayStateEventMetadata,
    }));

    const breakEvent: EventInput[] =
      this.viewMode() === 'day'
        ? [
            {
              id: 'demo-lunch-break',
              title: 'Pause déjeuner',
              start: '2026-10-30T12:00:00',
              end: '2026-10-30T13:00:00',
              allDay: false,
              interactive: false,
              extendedProps: { kind: 'break', title: 'Pause déjeuner' } satisfies BreakEventMetadata,
            },
          ]
        : [];

    return [...appointments, ...states, ...breakEvent];
  });

  readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [themePlugin, dayGridPlugin, timeGridPlugin],
    initialView: 'dayGridMonth',
    initialDate: '2026-10-30',
    locale: frLocale,
    firstDay: 1,
    headerToolbar: false,
    height: this.viewMode() === 'month' ? 798 : this.viewMode() === 'day' ? 638 : 714,
    expandRows: true,
    allDaySlot: false,
    slotMinTime: '08:00:00',
    slotMaxTime: '17:30:00',
    scrollTime: this.viewMode() === 'month' ? '00:00:00' : '08:00:00',
    scrollTimeReset: false,
    slotDuration: this.viewMode() === 'day' ? '01:00:00' : '00:30:00',
    slotLabelInterval: '01:00:00',
    slotMinHeight: this.viewMode() === 'day' ? 54 : 30,
    eventMinHeight: this.viewMode() === 'month' ? 28 : this.viewMode() === 'day' ? 40 : 34,
    eventShortHeight: 44,
    dayMaxEvents: 3,
    moreLinkText: (count) => `+${count} ${count === 1 ? 'autre' : 'autres'}`,
    moreLinkClass: 'demo-calendar-more-link',
    nowIndicator: false,
    navLinks: false,
    editable: false,
    selectable: false,
    eventStartEditable: false,
    eventDurationEditable: false,
    businessHours: {
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '08:00',
      endTime: '17:00',
    },
    dayHeaderFormat: { weekday: 'short', day: this.viewMode() === 'month' ? undefined : 'numeric' },
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
    dayCellClass: (info) => this.dayCellClasses(info.date, info.isOther),
    dayLaneClass: (info) => this.dayLaneClasses(info.date),
    slotLaneClass: (info) =>
      `demo-calendar-slot ${info.isMajor ? 'demo-calendar-slot--major' : 'demo-calendar-slot--minor'}`,
    slotHeaderClass: 'demo-calendar-slot-header',
    slotHeaderInnerClass: 'demo-calendar-slot-label',
    nonBusinessHoursClass: 'demo-calendar-non-business',
    eventClass: (info) => this.eventClasses(info),
    datesSet: (info) => this.onDatesSet(info),
    eventClick: (info) => this.openAppointment(info),
  }));

  readonly viewModel = computed<CalendarViewModel>(() => ({
    viewMode: this.viewMode(),
    visibleTitle: this.visibleTitle(),
    visibleSubtitle: this.visibleSubtitle(),
    weekNumber: this.weekNumber(),
    selectedAppointmentId: this.selectedAppointmentId(),
    panelOpen: this.selectedAppointment() !== null,
    loading: false,
    loadError: null,
    rulesError: null,
    exceptionsError: null,
    mutationError: null,
    noSchedule: false,
    realtimeDeferred: false,
    ariaBusy: false,
    daySummary:
      this.viewMode() === 'day'
        ? {
            appointmentCountLabel: `${this.dayAppointmentCount()} rendez-vous`,
            appointmentCountHint: "aujourd'hui",
            availabilityLabel: 'Disponible',
            availabilityHint: 'Journée active',
            workingHoursLabel: '08:00 – 17:00',
            workingHoursHint: 'Plage de travail',
          }
        : null,
    notice: null,
    quickBookingEnabled: false,
  }));

  readonly presentation = computed<CalendarPresentationInput>(() => ({
    options: this.calendarOptions(),
    events: this.calendarEvents(),
  }));

  constructor() {
    afterRenderEffect({
      write: () => {
        const selectedId = this.selectedAppointmentId();
        const heading = this.panelHeading()?.nativeElement;
        if (selectedId !== null && selectedId !== this.lastFocusedAppointmentId && heading) {
          heading.focus();
          this.lastFocusedAppointmentId = selectedId;
        }
        if (selectedId === null) this.lastFocusedAppointmentId = null;
      },
    });
  }

  setViewMode(value: string): void {
    if (value !== 'day' && value !== 'week' && value !== 'month') return;
    this.viewMode.set(value);
    this.closeAppointment(false);
    this.calendarView().changeView(value, value === 'day' ? '2026-10-30' : undefined);
  }

  previous(): void {
    this.closeAppointment(false);
    this.calendarView().previous();
  }

  next(): void {
    this.closeAppointment(false);
    this.calendarView().next();
  }

  goToday(): void {
    this.closeAppointment(false);
    this.calendarView().today('2026-10-30');
  }

  handleViewAction(action: CalendarViewAction): void {
    switch (action.kind) {
      case 'SET_VIEW': this.setViewMode(action.value); break;
      case 'PREVIOUS': this.previous(); break;
      case 'TODAY': this.goToday(); break;
      case 'NEXT': this.next(); break;
      case 'CONFIGURE_SCHEDULE': this.scheduleDialogOpen.set(true); break;
      case 'ADD_EXCEPTION': this.exceptionDialogOpen.set(true); break;
      case 'NEW_APPOINTMENT': break;
      case 'RETRY_APPOINTMENTS':
      case 'RETRY_RULES':
      case 'RETRY_EXCEPTIONS': break;
    }
  }

  openAppointment(info: EventClickInfo): void {
    const metadata = info.event.extendedProps as DemoCalendarEventMetadata;
    if (metadata.kind !== 'appointment') return;
    this.previouslyFocusedEvent = info.el;
    this.selectedAppointmentId.set(metadata.appointmentId);
    this.activePanelTab.set('details');
    this.actionMessage.set(null);
  }

  closeAppointment(restoreFocus = true): void {
    this.selectedAppointmentId.set(null);
    this.actionMessage.set(null);
    if (restoreFocus) this.previouslyFocusedEvent?.focus();
  }

  setPanelTab(tab: string): void {
    if (tab === 'details' || tab === 'history' || tab === 'documents' || tab === 'notes') {
      this.activePanelTab.set(tab);
    }
  }

  showDemoAction(message: string): void {
    this.actionMessage.set(message);
  }

  addDemoException(): void {
    this.exceptionDialogOpen.set(false);
    this.actionMessage.set('Exception simulée dans la démo — aucune donnée n’a été enregistrée.');
  }

  isAppointmentEvent(info: EventDisplayInfo): boolean {
    return (info.event.extendedProps as DemoCalendarEventMetadata).kind === 'appointment';
  }

  isDayStateEvent(info: EventDisplayInfo): boolean {
    return (info.event.extendedProps as DemoCalendarEventMetadata).kind === 'day-state';
  }

  isBreakEvent(info: EventDisplayInfo): boolean {
    return (info.event.extendedProps as DemoCalendarEventMetadata).kind === 'break';
  }

  appointmentForEvent(info: EventDisplayInfo): DemoCalendarAppointment | null {
    const metadata = info.event.extendedProps as DemoCalendarEventMetadata;
    if (metadata.kind !== 'appointment') return null;
    return (
      DEMO_CALENDAR_APPOINTMENTS.find((appointment) => appointment.id === metadata.appointmentId) ??
      null
    );
  }

  dayStateForEvent(info: EventDisplayInfo): DemoDayState | null {
    const metadata = info.event.extendedProps as DemoCalendarEventMetadata;
    return metadata.kind === 'day-state' ? metadata.state : null;
  }

  eventTimeRange(appointment: DemoCalendarAppointment): string {
    return `${FRENCH_TIME.format(new Date(appointment.start))} – ${FRENCH_TIME.format(
      new Date(appointment.end),
    )}`;
  }

  eventStartTime(appointment: DemoCalendarAppointment): string {
    return FRENCH_TIME.format(new Date(appointment.start));
  }

  eventCategoryLabel(appointment: DemoCalendarAppointment): string {
    return CATEGORY_LABELS[appointment.category] ?? appointment.categoryLabel;
  }

  formattedAppointmentDate(appointment: DemoCalendarAppointment): string {
    return titleCase(FRENCH_DATE.format(new Date(appointment.start)));
  }

  private onDatesSet(info: DatesSetInfo): void {
    const mode = MODE_BY_VIEW[info.view.type as FullCalendarView];
    if (mode) this.viewMode.set(mode);
    const focusDate = info.view.currentStart;
    if (mode === 'month') {
      this.visibleTitle.set(titleCase(FRENCH_MONTH.format(focusDate)));
      this.visibleSubtitle.set('');
      this.weekNumber.set('');
      globalThis.requestAnimationFrame(() => {
        globalThis.requestAnimationFrame(() => this.resetMonthScroll());
      });
      return;
    }
    if (mode === 'day') {
      this.visibleTitle.set(titleCase(FRENCH_DAY_LONG.format(focusDate)));
      this.visibleSubtitle.set(titleCase(FRENCH_DAY.format(focusDate)));
      this.weekNumber.set('');
      return;
    }
    const end = new Date(info.view.currentEnd);
    end.setDate(end.getDate() - 1);
    const startLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
      focusDate,
    );
    const endLabel = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(end);
    this.visibleTitle.set(`${startLabel} – ${endLabel}`);
    this.visibleSubtitle.set('');
    this.weekNumber.set('Semaine 44');
  }

  private dayCellClasses(date: Date, isOther: boolean): string {
    const state = DEMO_CALENDAR_DAY_STATES.find((candidate) => candidate.date === toDateKey(date));
    return [
      'demo-calendar-day-cell',
      isOther ? 'demo-calendar-day-cell--other' : '',
      state ? `demo-calendar-day-cell--${state.kind}` : '',
      toDateKey(date) === '2026-10-30' ? 'demo-calendar-day-cell--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private resetMonthScroll(): void {
    this.calendarView().resetScroll();
  }

  private dayLaneClasses(date: Date): string {
    const state = DEMO_CALENDAR_DAY_STATES.find((candidate) => candidate.date === toDateKey(date));
    return [
      'demo-calendar-day-lane',
      state ? `demo-calendar-day-lane--${state.kind}` : '',
      toDateKey(date) === '2026-10-30' ? 'demo-calendar-day-lane--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private eventClasses(info: EventDisplayInfo): string {
    const metadata = info.event.extendedProps as DemoCalendarEventMetadata;
    if (metadata.kind === 'day-state') {
      return `demo-calendar-state demo-calendar-state--${metadata.state.kind}`;
    }
    if (metadata.kind === 'break') return 'demo-calendar-break';
    return [
      'demo-calendar-appointment',
      this.selectedAppointmentId() === metadata.appointmentId
        ? 'demo-calendar-appointment--selected'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private demoAppointmentToneClass(appointment: DemoCalendarAppointment): string {
    if (appointment.category === 'urgent') return 'demo-calendar-appointment--urgent-request';
    if (appointment.patientId.startsWith('demo-practice-patient')) {
      return 'demo-calendar-appointment--external-patient';
    }
    if (appointment.category === 'follow-up' || appointment.category === 'control') {
      return 'demo-calendar-appointment--follow-up';
    }
    return 'demo-calendar-appointment--omnicare-patient';
  }
}
