import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
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
  FullCalendarComponent,
  FullCalendarModule,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import themePlugin from '@fullcalendar/angular/themes/monarch';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import frLocale from 'fullcalendar/locales/fr';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { OcAvatar } from '../../../shared/ui/avatar/oc-avatar';
import { OcButton } from '../../../shared/ui/button/oc-button';
import {
  OcSegmentedControl,
  OcSegmentOption,
} from '../../../shared/ui/segmented-control/oc-segmented-control';
import { OcStatusBadge } from '../../../shared/ui/status-badge/oc-status-badge';
import { OcTab, OcTabs } from '../../../shared/ui/tabs/oc-tabs';
import {
  DEMO_CALENDAR_APPOINTMENTS,
  DEMO_CALENDAR_DAY_STATES,
  DemoCalendarAppointment,
  DemoDayState,
} from './calendar-demo.fixtures';

type CalendarViewMode = 'day' | 'week' | 'month';
type FullCalendarView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';
type PanelTab = 'details' | 'history' | 'documents' | 'notes';

interface AppointmentEventMetadata {
  readonly kind: 'appointment';
  readonly appointmentId: string;
}

interface DayStateEventMetadata {
  readonly kind: 'day-state';
  readonly state: DemoDayState;
}

interface BreakEventMetadata {
  readonly kind: 'break';
}

type DemoCalendarEventMetadata =
  AppointmentEventMetadata | DayStateEventMetadata | BreakEventMetadata;

const VIEW_BY_MODE: Readonly<Record<CalendarViewMode, FullCalendarView>> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
};

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
    FullCalendarModule,
    NzIconModule,
    NzModalModule,
    OcAvatar,
    OcButton,
    OcSegmentedControl,
    OcStatusBadge,
    OcTabs,
  ],
  templateUrl: './calendar-page.static-demo.html',
  styleUrls: ['./calendar-page.static-demo.scss', './calendar-page.static-demo.responsive.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class CalendarPage {
  private readonly calendar = viewChild.required<FullCalendarComponent>('calendar');
  private readonly calendarHost = viewChild.required<ElementRef<HTMLElement>>('calendarHost');
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

  readonly viewOptions: readonly OcSegmentOption[] = [
    { value: 'day', label: 'Jour' },
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' },
  ];

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
      extendedProps: {
        kind: 'appointment',
        appointmentId: appointment.id,
      } satisfies AppointmentEventMetadata,
    }));

    const states: EventInput[] = DEMO_CALENDAR_DAY_STATES.map((state) => ({
      id: `demo-state-${state.date}`,
      title: state.title,
      start: this.viewMode() === 'month' ? state.date : `${state.date}T11:30:00`,
      end: this.viewMode() === 'month' ? undefined : `${state.date}T13:30:00`,
      allDay: this.viewMode() === 'month',
      interactive: false,
      extendedProps: { kind: 'day-state', state } satisfies DayStateEventMetadata,
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
              extendedProps: { kind: 'break' } satisfies BreakEventMetadata,
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
    eventMinHeight: this.viewMode() === 'month' ? 28 : this.viewMode() === 'day' ? 36 : 44,
    dayMaxEvents: 3,
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
    eventClass: (info) => this.eventClasses(info),
    datesSet: (info) => this.onDatesSet(info),
    eventClick: (info) => this.openAppointment(info),
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
    this.calendar().getApi().changeView(VIEW_BY_MODE[value]);
    if (value === 'day') this.calendar().getApi().gotoDate('2026-10-30');
  }

  previous(): void {
    this.closeAppointment(false);
    this.calendar().getApi().prev();
  }

  next(): void {
    this.closeAppointment(false);
    this.calendar().getApi().next();
  }

  goToday(): void {
    this.closeAppointment(false);
    this.calendar().getApi().gotoDate('2026-10-30');
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
    const scrollContainers = [
      ...this.calendarHost().nativeElement.querySelectorAll<HTMLElement>('div'),
    ].filter((element) => element.scrollHeight > element.clientHeight + 1);
    scrollContainers.forEach((element) => {
      element.scrollTop = 0;
    });
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
    const appointment = DEMO_CALENDAR_APPOINTMENTS.find(
      (candidate) => candidate.id === metadata.appointmentId,
    );
    return [
      'demo-calendar-appointment',
      appointment ? `demo-calendar-appointment--${appointment.category}` : '',
      this.selectedAppointmentId() === metadata.appointmentId
        ? 'demo-calendar-appointment--selected'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
