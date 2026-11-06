import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
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

import { OcButton } from '../../../shared/ui/button/oc-button';
import {
  OcSegmentedControl,
  type OcSegmentOption,
} from '../../../shared/ui/segmented-control/oc-segmented-control';
import {
  type CalendarPresentationInput,
  type CalendarPresentationMetadata,
  type CalendarViewAction,
  type CalendarViewMode,
  type CalendarViewModel,
} from './calendar-view.models';
import { formatCalendarTime, formatCalendarTimeRange } from './calendar-time.adapter';

const VIEW_BY_MODE = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
} as const;

@Component({
  selector: 'app-calendar-view',
  imports: [FullCalendarModule, NzIconModule, OcButton, OcSegmentedControl],
  templateUrl: './calendar-view.html',
  styleUrls: [
    './calendar-page.static-demo.scss',
    './calendar-page.static-demo.responsive.scss',
    './calendar-view.states.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class CalendarView {
  private readonly calendar = viewChild.required<FullCalendarComponent>('calendar');
  private readonly calendarHost = viewChild.required<ElementRef<HTMLElement>>('calendarHost');

  readonly model = input.required<CalendarViewModel>();
  readonly presentation = input.required<CalendarPresentationInput>();
  readonly action = output<CalendarViewAction>();

  readonly viewOptions: readonly OcSegmentOption[] = [
    { value: 'day', label: 'Jour' },
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' },
  ];

  changeView(mode: CalendarViewMode, date?: string): void {
    const api = this.calendar().getApi();
    api.changeView(VIEW_BY_MODE[mode]);
    if (date) api.gotoDate(date);
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

  isAppointment(info: EventDisplayInfo): boolean {
    return this.metadata(info).kind === 'appointment';
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

  appointmentAccessibleLabel(info: EventDisplayInfo): string {
    const metadata = this.metadata(info);
    if (metadata.kind !== 'appointment') return '';
    return `${this.eventTimeRange(info)}, ${metadata.patientLabel}, ${this.appointmentSecondaryLabel(info)}`;
  }
}
