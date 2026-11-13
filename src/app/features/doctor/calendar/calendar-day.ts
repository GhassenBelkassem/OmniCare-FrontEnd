import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { OcAvatar } from '../../../shared/ui/avatar/oc-avatar';
import {
  buildDayRows,
  buildDayTimeline,
  emptyDayText,
  firstFreeSlot,
  freeSlotCount,
  hasAnyItem,
  nextPatient,
  nextStartableId,
  pendingChipText,
  summaryLines,
  untilLabel,
  dayIsToday,
  type DayRow,
  type FreeRow,
  type ItemRow,
} from './calendar-day.model';
import { PAST_DAY_LABEL, isPastDay, levelChipLabel, longDateLabel, slotsText } from './calendar-month.model';
import { eventAriaLabel, patientLabel } from './calendar-privacy';
import { DAY_SUMMARY_LOAD_ERROR } from './calendar-summary.service';
import type {
  CalendarDayInput,
  CalendarViewAction,
  CalendarViewModel,
} from './calendar-view.models';

export const ITEMS_DAY_ERROR = 'Impossible de charger les rendez-vous.';

/**
 * Day view (canvas « Agenda médecin » v3.3, board « Jour », decision D-10): a compact list of the day with a
 * timeline, the free time, the break and the closed windows. It draws what the three sources say and
 * emits actions; the page owns the commands (the same ones as the CAL-3 panel).
 */
@Component({
  selector: 'app-calendar-day',
  imports: [NzIconModule, NzPopconfirmModule, OcAvatar],
  templateUrl: './calendar-day.html',
  styleUrl: './calendar-day.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarDay {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly model = input.required<CalendarViewModel>();
  readonly data = input.required<CalendarDayInput>();
  readonly action = output<CalendarViewAction>();

  readonly summaryDay = computed(() => this.data().summary.day);
  readonly closedDay = computed(() => this.summaryDay()?.level === 'CLOSED');
  readonly today = computed(() => dayIsToday(this.data().dayKey, this.data().nowMs));
  /** CAL-FIX-2 fix 6: the whole day is before today (Tunis). */
  readonly past = computed(() => isPastDay(this.data().dayKey, this.data().nowMs));
  /** Number of FREE slots as the API lists them; `null` while they are not loaded. */
  private readonly freeCount = computed(() =>
    this.data().slots.status === 'ready' ? freeSlotCount(this.data().slots.list) : null,
  );
  /** Fix 8: « Premier créneau libre » of the aside card; none on a past day. */
  readonly firstFree = computed(() =>
    this.past() || this.data().slots.status !== 'ready' ? null : firstFreeSlot(this.data().slots.list),
  );
  readonly dateTitle = computed(() => longDateLabel(this.data().dayKey));

  readonly startableId = computed(() =>
    nextStartableId(this.data().items.list, this.data().dayKey, this.data().nowMs, this.data().canStart),
  );

  readonly rows = computed<readonly DayRow[]>(() =>
    buildDayRows({
      dayKey: this.data().dayKey,
      nowMs: this.data().nowMs,
      items: this.data().items.list,
      hiddenStates: this.data().hiddenStates,
      slots: this.data().slots.status === 'ready' ? this.data().slots.list : null,
      summary: this.summaryDay(),
      blockExceptions: this.data().blockExceptions,
      startableId: this.startableId(),
    }),
  );

  readonly timeline = computed(() =>
    buildDayTimeline(
      this.summaryDay(),
      this.data().items.list,
      this.data().hiddenStates,
      this.data().dayKey,
      this.data().nowMs,
      this.model().discreet === true,
    ),
  );

  readonly nextUp = computed(() =>
    nextPatient(this.data().items.list, this.data().dayKey, this.data().nowMs, this.data().hiddenStates),
  );

  readonly lines = computed(() =>
    summaryLines(
      this.summaryDay(),
      this.data().slots.status === 'ready' ? freeSlotCount(this.data().slots.list) : null,
    ),
  );

  /** The day has no appointment or request at all (before the filters). */
  readonly empty = computed(
    () => this.data().items.status === 'ready' && !hasAnyItem(this.data().items.list, this.data().dayKey),
  );

  // Texts and classes are read through methods, never copied from module constants (see CAL-5 notes).
  summaryError(): string {
    return this.data().summary.error ?? DAY_SUMMARY_LOAD_ERROR;
  }
  itemsError(): string {
    return this.data().items.error ?? ITEMS_DAY_ERROR;
  }
  slotsText(): string {
    const day = this.summaryDay();
    return day === null ? '' : slotsText(day);
  }
  levelLabel(): string {
    const day = this.summaryDay();
    if (day === null) return '';
    return this.past() && day.level !== 'CLOSED' ? PAST_DAY_LABEL : levelChipLabel(day.level);
  }
  levelClass(): string {
    const day = this.summaryDay();
    if (day === null) return '';
    return this.past() && day.level !== 'CLOSED' ? 'cal-day__level--past' : `cal-day__level--${day.level.toLowerCase()}`;
  }
  /** Fix 7: « Aucun rendez-vous · n créneaux libres », or « Aucun rendez-vous ce jour ». */
  emptyText(): string {
    return emptyDayText(this.freeCount() ?? 0);
  }
  /** Fix 8: opens the existing booking drawer on the first free slot. */
  bookFirstFree(): void {
    const slot = this.firstFree();
    if (slot !== null) this.action.emit({ kind: 'DAY_ADD_SLOT', date: this.data().dayKey, start: slot.start });
  }
  pendingText(): string {
    const day = this.summaryDay();
    return day === null || day.pendingRequestCount <= 0 ? '' : pendingChipText(day.pendingRequestCount);
  }
  untilText(minutes: number): string {
    return untilLabel(minutes);
  }

  name(raw: string): string {
    return patientLabel(raw, this.model().discreet === true);
  }

  itemAria(row: ItemRow): string {
    return eventAriaLabel(row.timeLabel, row.rawName, row.stateLabel, this.model().discreet === true);
  }

  isDimmed(row: ItemRow): boolean {
    const search = this.model().search;
    return search !== undefined && search.active && !search.ids.has(row.id);
  }

  isSelected(row: ItemRow): boolean {
    return this.model().selectedAppointmentId === row.id;
  }

  typeIconName(row: ItemRow): string {
    return row.typeIcon === 'external' ? 'user-add' : 'home';
  }

  typeLabel(row: ItemRow): string {
    return row.typeIcon === 'external' ? 'Patient externe' : 'Cabinet';
  }

  freeAria(row: FreeRow): string {
    return `Ajouter un rendez-vous, libre de ${row.start} à ${row.end}`;
  }

  rowKey(_index: number, row: DayRow): string {
    return row.key;
  }

  asItem(row: DayRow): ItemRow {
    return row as ItemRow;
  }

  open(row: ItemRow): void {
    this.action.emit({ kind: 'OPEN_ITEM', resource: row.resource, id: row.id });
  }

  start(row: ItemRow): void {
    this.action.emit({ kind: 'DAY_START', id: row.id });
  }

  accept(row: ItemRow): void {
    this.action.emit({ kind: 'DAY_ACCEPT', id: row.id });
  }

  decline(row: ItemRow): void {
    this.action.emit({ kind: 'DAY_DECLINE', id: row.id });
  }

  addOnSlot(row: FreeRow): void {
    this.action.emit({ kind: 'DAY_ADD_SLOT', date: this.data().dayKey, start: row.start });
  }

  reopen(exceptionId: string): void {
    this.action.emit({ kind: 'REOPEN_EXCEPTION', exceptionId });
  }

  /** Scrolls the row of an appointment or request into view (the search result and Entrée use it). */
  scrollToRow(id: string): void {
    const row = this.findRow(id);
    row?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  /** The row that has the keyboard focus, if any. */
  focusedRow(): { readonly id: string; readonly resource: 'appointment' | 'request' } | null {
    const element = this.host.nativeElement;
    const active = element.ownerDocument.activeElement as HTMLElement | null;
    if (active === null || !element.contains(active)) return null;
    const row = active.matches('[data-cal-id]') ? active : active.closest<HTMLElement>('[data-cal-id]');
    const id = row?.getAttribute('data-cal-id');
    const kind = row?.getAttribute('data-cal-kind');
    return id && (kind === 'appointment' || kind === 'request') ? { id, resource: kind } : null;
  }

  private findRow(id: string): HTMLElement | undefined {
    const rows = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-cal-id]');
    return [...rows].find((element) => element.getAttribute('data-cal-id') === id);
  }
}
