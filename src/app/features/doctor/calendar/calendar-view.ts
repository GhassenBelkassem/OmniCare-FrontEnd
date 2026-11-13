import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  ViewEncapsulation,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  EventDisplayInfo,
  FullCalendarComponent,
  FullCalendarModule,
} from '@fullcalendar/angular';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { FormsModule } from '@angular/forms';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

import { OcButton } from '../../../shared/ui/button/oc-button';
import { OcPageHeader } from '../../../shared/ui/page-header/oc-page-header';
import { CalendarDay } from './calendar-day';
import { CalendarMonth } from './calendar-month';
import { CalendarToolbar } from './calendar-toolbar';
import {
  type CalendarCardMetadata,
  type CalendarDayInput,
  type CalendarMonthInput,
  type CalendarPresentationInput,
  type CalendarPresentationMetadata,
  type CalendarViewAction,
  type CalendarViewMode,
  type CalendarViewModel,
} from './calendar-view.models';
import { eventAriaLabel, patientLabel } from './calendar-privacy';
import { formatCalendarTime, formatCalendarTimeRange } from './calendar-time.adapter';

const VIEW_BY_MODE = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
} as const;

@Component({
  selector: 'app-calendar-view',
  imports: [
    FormsModule,
    FullCalendarModule,
    NzIconModule,
    NzPopconfirmModule,
    NzTooltipModule,
    CalendarDay,
    CalendarMonth,
    CalendarToolbar,
    OcButton,
    OcPageHeader,
  ],
  templateUrl: './calendar-view.html',
  styleUrls: [
    './calendar-page.static-demo.scss',
    './calendar-page.static-demo.responsive.scss',
    './calendar-view.states.scss',
    './calendar-week.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class CalendarView {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly calendar = viewChild.required<FullCalendarComponent>('calendar');
  private readonly calendarHost = viewChild.required<ElementRef<HTMLElement>>('calendarHost');

  readonly model = input.required<CalendarViewModel>();
  readonly presentation = input.required<CalendarPresentationInput>();
  readonly action = output<CalendarViewAction>();
  /**
   * Data of the custom month view (CAL-5). When absent (the static demo), the FullCalendar month grid
   * stays in use.
   */
  readonly month = input<CalendarMonthInput | null>(null);
  readonly monthActive = computed(() => this.model().viewMode === 'month' && this.month() !== null);
  private readonly monthView = viewChild(CalendarMonth);
  /**
   * Data of the custom day view (CAL-6). When absent (the static demo), FullCalendar's time grid stays in
   * use for the day.
   */
  readonly day = input<CalendarDayInput | null>(null);
  readonly dayActive = computed(() => this.model().viewMode === 'day' && this.day() !== null);
  private readonly dayView = viewChild(CalendarDay);

  /** The toolbar (picker, search, filters, shortcuts window); the page drives it from the keyboard. */
  readonly toolbar = viewChild.required<CalendarToolbar>('toolbar');

  /**
   * CAL-FIX-2 fix 3: after a mouse or touch click (`detail > 0`) a plain control of the calendar (Jour /
   * Semaine / Mois, the navigation buttons, a month cell, a day-view button) gives its focus back, so a later
   * key press never draws the keyboard ring on it. Keyboard activation (`detail === 0`) keeps the focus.
   * Text fields, the date picker, dialogs, menus and confirmations keep their focus handling.
   */
  releasePointerFocus(event: MouseEvent): void {
    if (event.detail === 0) return;
    const root = this.host.nativeElement;
    const active = root.ownerDocument.activeElement as HTMLElement | null;
    if (active === null || !root.contains(active)) return;
    if (!shouldReleaseFocus(active)) return;
    active.blur();
  }

  constructor() {
    // Capture phase: NG-ZORRO's segmented control stops the click on its radio, so a bubbling listener
    // would never hear it. The listener belongs to this view and goes with it.
    const host = this.host.nativeElement;
    const onClick = (event: MouseEvent): void => this.releasePointerFocus(event);
    host.addEventListener('click', onClick, true);
    inject(DestroyRef).onDestroy(() => host.removeEventListener('click', onClick, true));
  }

  changeView(mode: CalendarViewMode, date?: string): void {
    const api = this.calendar().getApi();
    api.changeView(VIEW_BY_MODE[mode]);
    if (date) api.gotoDate(date);
  }

  /** Month keyboard shortcuts (arrows, Espace, Entrée); true when the month view handled the key. */
  handleMonthKey(event: KeyboardEvent): boolean {
    return this.monthActive() && (this.monthView()?.handleKey(event) ?? false);
  }

  /** Échap in the month view: closes the day preview or menu; true when something was closed. */
  closeMonthPreview(): boolean {
    return this.monthActive() && (this.monthView()?.closePreview() ?? false);
  }

  /** True when the keyboard focus is on a day of the month grid. */
  monthHasFocus(target: EventTarget | null): boolean {
    return this.monthActive() && (this.monthView()?.containsFocus(target) ?? false);
  }

  /** Goes to the period that contains a Tunis calendar date (`YYYY-MM-DD`) in the current view. */
  goToDate(dayKey: string): void {
    this.calendar().getApi().gotoDate(dayKey);
  }

  /** Scrolls the card of an appointment or a request into view (nothing happens if it is not drawn). */
  scrollToCard(id: string): void {
    if (this.dayActive()) {
      this.dayView()?.scrollToRow(id);
      return;
    }
    const cards = this.calendarHost().nativeElement.querySelectorAll<HTMLElement>('[data-cal-id]');
    const card = [...cards].find((element) => element.getAttribute('data-cal-id') === id);
    card?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  /** The card that has the keyboard focus, if any (Entrée opens it). */
  focusedCard(): { readonly id: string; readonly resource: 'appointment' | 'request' } | null {
    if (this.dayActive()) return this.dayView()?.focusedRow() ?? null;
    const active = this.calendarHost().nativeElement.ownerDocument.activeElement as HTMLElement | null;
    if (active === null || !this.calendarHost().nativeElement.contains(active)) return null;
    const card = active.matches('[data-cal-id]') ? active : active.querySelector<HTMLElement>('[data-cal-id]');
    const id = card?.getAttribute('data-cal-id');
    const kind = card?.getAttribute('data-cal-kind');
    return id && (kind === 'appointment' || kind === 'request') ? { id, resource: kind } : null;
  }

  /** Identity of a card: the appointment id, or the request id. */
  cardId(meta: CalendarCardMetadata): string {
    return meta.kind === 'request' ? meta.requestId : meta.appointmentId;
  }

  /** While a search is active, cards that do not match are dimmed (the matching ones stay normal). */
  isDimmed(meta: CalendarCardMetadata): boolean {
    const search = this.model().search;
    return search !== undefined && search.active && !search.ids.has(this.cardId(meta));
  }

  previous(): void {
    this.calendar().getApi().prev();
  }

  next(): void {
    this.calendar().getApi().next();
  }

  today(date?: string): void {
    const api = this.calendar().getApi();
    date ? api.gotoDate(date) : api.today();
  }

  resetScroll(): void {
    const scrollContainers = [
      ...this.calendarHost().nativeElement.querySelectorAll<HTMLElement>('div'),
    ].filter((element) => element.scrollHeight > element.clientHeight + 1);
    scrollContainers.forEach((element) => {
      element.scrollTop = 0;
    });
  }

  metadata(info: EventDisplayInfo): CalendarPresentationMetadata {
    return info.event.extendedProps as CalendarPresentationMetadata;
  }

  /** Card fields of an appointment or a booking request. */
  appointmentMeta(info: EventDisplayInfo): CalendarCardMetadata {
    return info.event.extendedProps as CalendarCardMetadata;
  }

  /** True for every card drawn on the grid: an appointment or a booking request. */
  isAppointment(info: EventDisplayInfo): boolean {
    const kind = this.metadata(info).kind;
    return kind === 'appointment' || kind === 'request';
  }

  isSelectedAppointment(info: EventDisplayInfo): boolean {
    const metadata = this.metadata(info);
    const selected = this.model().selectedAppointmentId;
    if (selected === null) return false;
    if (metadata.kind === 'appointment') return metadata.appointmentId === selected;
    return metadata.kind === 'request' && metadata.requestId === selected;
  }

  /** Patient name as shown on a card: full name, or initials in « Mode discret ». */
  displayName(meta: { readonly patientLabel: string }): string {
    return patientLabel(meta.patientLabel, this.model().discreet === true);
  }

  isState(info: EventDisplayInfo): boolean {
    const kind = this.metadata(info).kind;
    return kind === 'day-state' || kind === 'exception-annotation';
  }

  isBreak(info: EventDisplayInfo): boolean {
    return this.metadata(info).kind === 'break';
  }

  eventStartTime(info: EventDisplayInfo): string {
    return formatCalendarTime(info.event.start);
  }

  eventTimeRange(info: EventDisplayInfo): string {
    return formatCalendarTimeRange(info.event.start, info.event.end);
  }

  appointmentLabel(info: EventDisplayInfo): string {
    const metadata = this.metadata(info);
    return metadata.kind === 'appointment' ? metadata.patientLabel : '';
  }

  appointmentSecondaryLabel(info: EventDisplayInfo): string {
    const metadata = this.metadata(info);
    if (metadata.kind !== 'appointment') return '';
    return metadata.detailLabel ?? metadata.categoryLabel ?? metadata.statusLabel;
  }

  appointmentMonthLabel(info: EventDisplayInfo): string {
    const metadata = this.metadata(info);
    if (metadata.kind !== 'appointment') return '';
    return metadata.categoryLabel ?? metadata.statusLabel;
  }

  /** French sentence from the CAL-1 privacy helper; no patient name in « Mode discret ». */
  appointmentAccessibleLabel(info: EventDisplayInfo): string {
    const metadata = this.metadata(info);
    if (metadata.kind !== 'appointment' && metadata.kind !== 'request') return '';
    const state = metadata.unclosed
      ? 'Consultation non clôturée'
      : (metadata.stateLabel ?? metadata.statusLabel);
    const label = eventAriaLabel(
      formatCalendarTime(info.event.start),
      metadata.patientLabel,
      state,
      this.model().discreet === true,
    );
    return this.isSelectedAppointment(info) ? `${label} Sélectionné.` : label;
  }

  /** « Pause déjeuner · 12:30 – 14:00 ». */
  breakLabel(info: EventDisplayInfo): string {
    const metadata = this.metadata(info);
    return metadata.kind === 'break' ? `${metadata.title} · ${metadata.timeLabel}` : '';
  }

  /** Only a closed (BLOCK) slot can be reopened; an exceptional opening is removed from its detail. */
  canReopen(info: EventDisplayInfo): boolean {
    const props = info.event.extendedProps as { kind?: string; exceptionType?: string };
    return props.kind === 'exception-annotation' && props.exceptionType === 'BLOCK';
  }

  reopen(info: EventDisplayInfo): void {
    const { exceptionId } = info.event.extendedProps as { exceptionId?: string };
    if (typeof exceptionId === 'string') this.action.emit({ kind: 'REOPEN_EXCEPTION', exceptionId });
  }
}

/** Controls whose focus is given back after a pointer click (fix 3); never a text field or a popup owner. */
export function shouldReleaseFocus(element: HTMLElement): boolean {
  if (element.closest('[role="dialog"], [role="menu"], .ant-picker, nz-date-picker')) return false;
  if (element.getAttribute('aria-expanded') === 'true' || element.hasAttribute('nz-popconfirm')) return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (element as HTMLInputElement).type;
    return type === 'radio' || type === 'checkbox';
  }
  return tag === 'button' || element.getAttribute('role') === 'gridcell' || element.getAttribute('role') === 'switch';
}

