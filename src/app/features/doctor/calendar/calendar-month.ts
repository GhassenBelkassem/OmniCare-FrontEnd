import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { OcButton } from '../../../shared/ui/button/oc-button';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { isFollowUpItem } from './calendar-event.adapter';
import { isStateVisible } from './calendar-filters';
import {
  DOT_COLOR,
  type DayDots,
  type DotKind,
  barWidthPercent,
  buildDayDots,
  buildTimeline,
  closedText,
  dayAriaLabel,
  dayNumber,
  dotKindOfState,
  legendDotItems,
  legendLevels,
  PAST_DAY_LABEL,
  isPastDay,
  levelChipLabel,
  longDateLabel,
  pastTimelinePercent,
  pendingCountShown,
  shortDateLabel,
  slotsText,
  timelineBar,
} from './calendar-month.model';
import { patientLabel } from './calendar-privacy';
import { presentCalendarItem, type CalendarState } from './calendar-presentation';
import type { CalendarDayLevel, CalendarSummaryDay } from './calendar-summary.models';
import {
  formatTunisTime,
  tunisDayBounds,
  tunisDayKey,
  tunisFormatter,
  tunisHourMinute,
  tunisToday,
} from './calendar-time';
import type {
  CalendarMonthInput,
  CalendarMonthMenuCommand,
  CalendarViewAction,
  CalendarViewModel,
} from './calendar-view.models';

/** Delay before a hovered day opens its preview (the day's appointments are loaded then, once). */
export const PREVIEW_DELAY_MS = 150;
const PREVIEW_ITEMS_SHOWN = 4;
const WEEK_DAYS = 7;
const WEEKDAYS = [
  { short: 'LUN', long: 'lundi' },
  { short: 'MAR', long: 'mardi' },
  { short: 'MER', long: 'mercredi' },
  { short: 'JEU', long: 'jeudi' },
  { short: 'VEN', long: 'vendredi' },
  { short: 'SAM', long: 'samedi' },
  { short: 'DIM', long: 'dimanche' },
] as const;
const DAY_LOAD_ERROR = 'Impossible de charger les rendez-vous de ce jour.';
const SHORT_DAY_MONTH = tunisFormatter({ day: 'numeric', month: 'short' });

interface PreviewItem {
  readonly id: string;
  readonly resource: 'appointment' | 'request';
  readonly timeLabel: string;
  readonly rawName: string;
  readonly color: string;
  readonly state: CalendarState;
  /** Confirmed, already ended and never started: « Non clôturé ». */
  readonly notClosed: boolean;
  readonly startMinutes: number;
  readonly endMinutes: number;
}

interface DayLoad {
  readonly status: 'loading' | 'ready' | 'error';
  readonly items: readonly PreviewItem[];
}

interface MonthCell {
  readonly key: string;
  readonly index: number;
  readonly number: number;
  readonly day: CalendarSummaryDay | null;
  readonly level: CalendarDayLevel | null;
  readonly outside: boolean;
  readonly past: boolean;
  readonly today: boolean;
  readonly aria: string;
  readonly dots: DayDots;
  readonly bar: number;
  readonly closedText: string;
  /** Every class of the cell in one string: level colour and fading (CAL-FIX-2 fix 2). */
  readonly cssClass: string;
}

interface MenuEntry {
  readonly command: CalendarMonthMenuCommand;
  readonly label: string;
}

/**
 * The month view of the doctor calendar (decision D-10: a custom component, not FullCalendar).
 *
 * It only shows what the calendar-summary API says: level, load percentage and slot counts are never
 * recomputed here. A day's appointments are loaded only when its preview opens (one Tunis day, once).
 */
@Component({
  selector: 'app-calendar-month',
  imports: [OcButton],
  host: { '(document:click)': 'onDocumentClick($event)' },
  templateUrl: './calendar-month.html',
  styleUrl: './calendar-month.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarMonth {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly scheduledCare = inject(ScheduledCareApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly model = input.required<CalendarViewModel>();
  readonly data = input.required<CalendarMonthInput>();
  readonly action = output<CalendarViewAction>();

  readonly weekdays = WEEKDAYS;
  readonly skeleton = Array.from({ length: 42 }, (_, index) => index);

  private readonly todayKey = signal(tunisToday());
  readonly focusKey = signal<string | null>(null);
  readonly previewKey = signal<string | null>(null);
  readonly menuKey = signal<string | null>(null);
  private readonly dayLoads = signal<ReadonlyMap<string, DayLoad>>(new Map());
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  readonly discreet = computed(() => this.model().discreet === true);
  readonly legendLevels = computed(() => {
    const thresholds = this.data().summary?.thresholds;
    return legendLevels(thresholds?.busyFromPercent, thresholds?.fullFromPercent);
  });

  readonly cells = computed<readonly MonthCell[]>(() => {
    const data = this.data();
    const byDate = new Map((data.summary?.days ?? []).map((day) => [day.date, day] as const));
    const today = this.todayKey();
    return data.gridKeys.map((key, index) => {
      const day = byDate.get(key) ?? null;
      const outside = key.slice(0, 7) !== data.referenceMonth;
      const past = key < today;
      return {
        key,
        index,
        number: dayNumber(key),
        day,
        level: day?.level ?? null,
        outside,
        past,
        today: key === today,
        cssClass: monthCellClass(day?.level ?? null, outside, past, key === today),
        aria: day === null ? shortDateLabel(key) : dayAriaLabel(day, data.hiddenStates),
        dots: day === null ? { dots: [], overflow: 0 } : buildDayDots(day, data.hiddenStates),
        bar: day === null ? 0 : barWidthPercent(day),
        closedText: day === null ? '' : closedText(day),
      };
    });
  });

  readonly rows = computed(() => {
    const cells = this.cells();
    const rows: MonthCell[][] = [];
    for (let start = 0; start < cells.length; start += WEEK_DAYS) rows.push(cells.slice(start, start + WEEK_DAYS));
    return rows;
  });

  /** The day whose cell is reachable with Tab (roving tabindex). */
  readonly tabStopKey = computed(() => {
    const keys = this.data().gridKeys;
    const focus = this.focusKey();
    if (focus !== null && keys.includes(focus)) return focus;
    const today = this.todayKey();
    if (keys.includes(today)) return today;
    return keys.find((key) => key.slice(0, 7) === this.data().referenceMonth) ?? keys[0] ?? null;
  });

  // ---- preview ----

  readonly preview = computed(() => {
    const key = this.previewKey();
    if (key === null) return null;
    const cell = this.cells().find((candidate) => candidate.key === key);
    const day = cell?.day ?? null;
    if (cell === undefined || day === null) return null;
    const hidden = this.data().hiddenStates;
    const load = this.dayLoads().get(key);
    const items = (load?.items ?? []).filter((item) => isStateVisible(item.state, hidden));
    const timeline = day.level === 'CLOSED' ? null : buildTimeline(day);
    const pending = pendingCountShown(day, hidden);
    // CAL-FIX-2 fix 6: a past day reads « Passé » and offers no booking; the timeline greys the time before now.
    const nowMs = Date.now();
    const past = isPastDay(key, nowMs);
    return {
      key,
      day,
      title: longDateLabel(key),
      level: day.level,
      past,
      // A closed day keeps « Fermé » even in the past.
      levelLabel: past && day.level !== 'CLOSED' ? PAST_DAY_LABEL : levelChipLabel(day.level),
      levelClass:
        past && day.level !== 'CLOSED' ? 'cal-pv__level cal-pv__level--past' : `cal-pv__level cal-pv__level--${day.level.toLowerCase()}`,
      pastPercent: timeline === null ? 0 : pastTimelinePercent(timeline.span, key, nowMs),
      closed: day.level === 'CLOSED',
      slots: slotsText(day) + (pending > 0 ? ` · ${pending} en attente` : ''),
      status: load?.status ?? 'loading',
      shown: items.slice(0, PREVIEW_ITEMS_SHOWN),
      more: Math.max(0, items.length - PREVIEW_ITEMS_SHOWN),
      empty: items.length === 0,
      timeline,
      booked:
        timeline === null
          ? []
          : items.flatMap((item) => {
              const bar = timelineBar(
                { start: minutesLabel(item.startMinutes), end: minutesLabel(item.endMinutes) },
                timeline.span.start,
                timeline.span.end,
              );
              return bar === null ? [] : [{ ...bar, color: item.color }];
            }),
      alignLeft: (cell.index % WEEK_DAYS) >= 4,
      alignUp: Math.floor(cell.index / WEEK_DAYS) >= 4,
    };
  });

  // ---- aside ----

  readonly todayCell = computed(() => this.cells().find((cell) => cell.today && cell.day !== null) ?? null);
  readonly todayTitle = computed(() => longDateLabel(this.todayKey()));
  readonly todayRows = computed(() => {
    const today = this.todayKey();
    const now = Date.now();
    return this.data()
      .appointments.filter(
        (item) => item.status !== 'CANCELLED' && tunisDayKey(item.start) === today,
      )
      .sort((left, right) => Date.parse(left.start) - Date.parse(right.start))
      .map((item) => ({
        id: item.appointmentId ?? item.start,
        timeLabel: formatTunisTime(new Date(item.start)),
        rawName: item.subject?.displayName ?? '',
        inProgress: item.status === 'IN_PROGRESS',
        past: Date.parse(item.end) < now,
      }));
  });
  readonly pendingRows = computed(() =>
    this.data()
      .requests.filter((item) => item.status === 'PENDING_DOCTOR' && item.requestId !== null)
      .map((item) => ({
        id: item.requestId as string,
        rawName: item.subject?.displayName ?? '',
        whenLabel: `${SHORT_DAY_MONTH.format(new Date(item.start))} · ${formatTunisTime(new Date(item.start))}`,
      })),
  );

  constructor() {
    // A new answer from the API (or a new period) empties the per-day cache.
    effect(() => {
      this.data().summary;
      this.dayLoads.set(new Map());
    });
    this.destroyRef.onDestroy(() => this.clearHoverTimer());
  }

  // Read through methods, not copied into fields: see the note in the report about the test bundler.
  legendDots(): readonly { readonly kind: DotKind; readonly label: string }[] {
    return legendDotItems();
  }

  dotColor(kind: DotKind): string {
    return DOT_COLOR[kind];
  }

  levelChip(level: CalendarDayLevel): string {
    return levelChipLabel(level);
  }

  name(raw: string): string {
    return patientLabel(raw, this.discreet());
  }

  menuEntries(cell: MonthCell): readonly MenuEntry[] {
    const prolong: MenuEntry = { command: 'EXTEND', label: 'Prolonger la journée' };
    if (cell.level === 'CLOSED' || cell.level === null) return [prolong];
    return [
      prolong,
      { command: 'CLOSE', label: 'Fermer la journée' },
      { command: 'ADD_BREAK', label: 'Ajouter une pause' },
    ];
  }

  // ---- mouse ----

  onCellEnter(key: string): void {
    this.clearHoverTimer();
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      this.openPreview(key);
    }, PREVIEW_DELAY_MS);
  }

  onCellLeave(key: string): void {
    this.clearHoverTimer();
    if (this.previewKey() === key) this.previewKey.set(null);
    if (this.menuKey() === key) this.menuKey.set(null);
  }

  onCellClick(event: Event, cell: MonthCell): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, .cal-month__preview, .cal-month__menu')) return;
    this.openDay(cell.key);
  }

  onCellFocusIn(key: string): void {
    this.focusKey.set(key);
  }

  /** A preview opened by the keyboard closes when the focus leaves its cell. */
  onCellFocusOut(event: FocusEvent, key: string): void {
    const cell = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next !== null && cell.contains(next)) return;
    if (this.previewKey() === key) this.previewKey.set(null);
    if (this.menuKey() === key) this.menuKey.set(null);
  }

  openDay(key: string): void {
    this.closeAll();
    this.action.emit({ kind: 'OPEN_DAY', date: key });
  }

  newAppointment(key: string): void {
    if (isPastDay(key, Date.now())) return; // no booking on a past day (fix 6)
    this.closeAll();
    this.action.emit({ kind: 'NEW_APPOINTMENT_ON', date: key });
  }

  toggleMenu(key: string, event: Event): void {
    event.stopPropagation();
    this.previewKey.set(null);
    this.menuKey.update((current) => (current === key ? null : key));
  }

  runMenuCommand(key: string, command: CalendarMonthMenuCommand, event: Event): void {
    event.stopPropagation();
    this.menuKey.set(null);
    this.action.emit({ kind: 'DAY_MENU', date: key, command });
  }

  onMenuKeydown(event: KeyboardEvent, key: string): void {
    const menu = event.currentTarget as HTMLElement;
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const index = items.indexOf(event.target as HTMLElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.stopPropagation();
      this.menuKey.set(null);
      if (event.key === 'Escape') this.focusMenuButton(key);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    }
  }

  onMenuButtonKeydown(event: KeyboardEvent, key: string): void {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.stopPropagation();
    if (this.menuKey() !== key) this.toggleMenu(key, event);
    queueMicrotask(() => this.cellElement(key)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
  }

  onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (this.menuKey() === null) return;
    if (target !== null && this.host.nativeElement.querySelector('.cal-month__menu')?.contains(target)) return;
    this.menuKey.set(null);
  }

  // ---- keyboard (called by the page, which owns the CAL-4 rules: switch, typing, dialogs) ----

  /**
   * Month shortcuts: arrows move the focus between days, Espace opens or closes the preview of the focused
   * day, Entrée opens the day. Acts only when a day cell itself has the focus. Returns whether it handled the key.
   */
  handleKey(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const cell = this.focusedCell(event.target);
    if (cell === null) return false;
    const key = cell.getAttribute('data-day');
    if (key === null) return false;
    const keys = this.data().gridKeys;
    const index = keys.indexOf(key);
    const move = (delta: number): boolean => {
      const next = keys[Math.min(keys.length - 1, Math.max(0, index + delta))];
      if (next !== undefined && next !== key) {
        this.previewKey.set(null);
        this.focusDay(next);
      }
      return true;
    };
    switch (event.key) {
      case 'ArrowLeft': return move(-1);
      case 'ArrowRight': return move(1);
      case 'ArrowUp': return move(-WEEK_DAYS);
      case 'ArrowDown': return move(WEEK_DAYS);
      case ' ':
      case 'Spacebar':
        this.togglePreview(key);
        return true;
      case 'Enter':
        this.openDay(key);
        return true;
      default:
        return false;
    }
  }

  /** Échap: closes the preview (or the day menu). Returns whether something was closed. */
  closePreview(): boolean {
    const had = this.previewKey() !== null || this.menuKey() !== null;
    this.clearHoverTimer();
    this.previewKey.set(null);
    this.menuKey.set(null);
    return had;
  }

  togglePreview(key: string): void {
    this.clearHoverTimer();
    this.menuKey.set(null);
    if (this.previewKey() === key) this.previewKey.set(null);
    else this.openPreview(key);
  }

  focusDay(key: string): void {
    this.focusKey.set(key);
    this.cellElement(key)?.focus();
  }

  /** True when the focus is inside the month grid. */
  containsFocus(target: EventTarget | null): boolean {
    return target instanceof Node && this.host.nativeElement.querySelector('[role="grid"]')?.contains(target) === true;
  }

  // ---- internals ----

  private openPreview(key: string): void {
    const day = this.data().summary?.days.find((candidate) => candidate.date === key);
    if (day === undefined) return;
    this.menuKey.set(null);
    this.previewKey.set(key);
    if (day.level !== 'CLOSED') this.loadDay(key);
  }

  /** One request per day: a loaded or loading day is never asked for again while the month stays open. */
  private loadDay(key: string): void {
    const known = this.dayLoads().get(key);
    if (known !== undefined && known.status !== 'error') return;
    const bounds = tunisDayBounds(key);
    if (bounds === null) return;
    this.setLoad(key, { status: 'loading', items: [] });
    this.scheduledCare
      .getDoctorScheduledCare(bounds.start.toISOString(), bounds.end.toISOString())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (agenda) => this.setLoad(key, { status: 'ready', items: toPreviewItems(agenda.items, key, Date.now()) }),
        error: () => this.setLoad(key, { status: 'error', items: [] }),
      });
  }

  private setLoad(key: string, load: DayLoad): void {
    this.dayLoads.update((loads) => new Map(loads).set(key, load));
  }

  errorText(): string {
    return DAY_LOAD_ERROR;
  }

  private closeAll(): void {
    this.clearHoverTimer();
    this.previewKey.set(null);
    this.menuKey.set(null);
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer !== null) clearTimeout(this.hoverTimer);
    this.hoverTimer = null;
  }

  private cellElement(key: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(`[role="gridcell"][data-day="${key}"]`);
  }

  private focusMenuButton(key: string): void {
    this.cellElement(key)?.querySelector<HTMLElement>('.cal-month__menu-btn')?.focus();
  }

  private focusedCell(target: EventTarget | null): HTMLElement | null {
    const element = target as HTMLElement | null;
    return element?.getAttribute?.('role') === 'gridcell' && this.host.nativeElement.contains(element) ? element : null;
  }
}

function minutesLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The appointments and requests of one Tunis day, cancelled ones left out, sorted by start. */
function toPreviewItems(items: readonly DoctorScheduledCareItem[], dayKey: string, nowMs: number): PreviewItem[] {
  const result: PreviewItem[] = [];
  for (const item of items) {
    if (tunisDayKey(item.start) !== dayKey) continue;
    const presentation = presentCalendarItem(item, { isFollowUp: isFollowUpItem(item), nowMs });
    if (presentation.state === 'cancelled') continue;
    const resource = item.resourceType === 'BOOKING_REQUEST' ? 'request' : 'appointment';
    const id = resource === 'request' ? item.requestId : item.appointmentId;
    if (id === null) continue;
    const kind = dotKindOfState(presentation.state);
    const start = tunisHourMinute(item.start);
    const end = tunisHourMinute(item.end);
    result.push({
      id,
      resource,
      timeLabel: formatTunisTime(new Date(item.start)),
      rawName: item.subject?.displayName ?? '',
      color: DOT_COLOR[kind ?? 'upcoming'],
      state: presentation.state,
      notClosed: presentation.notClosed,
      startMinutes: start.minutes,
      endMinutes: Number.isFinite(end.minutes) && end.minutes > start.minutes ? end.minutes : start.minutes + 20,
    });
  }
  return result.sort((left, right) => left.startMinutes - right.startMinutes);
}

/**
 * Classes of a month cell (CAL-FIX-2 fix 2). Every cell is coloured by its level; an out-of-month cell is
 * faded to 50 %, a past cell of the month to 60 %, today and the future are not faded.
 */
export function monthCellClass(level: CalendarDayLevel | null, outside: boolean, past: boolean, today: boolean): string {
  const classes = ['cal-month__cell', level === null ? 'cal-month__cell--none' : `cal-month__cell--${level.toLowerCase()}`];
  if (outside) classes.push('cal-month__cell--outside');
  else if (past) classes.push('cal-month__cell--past');
  if (today) classes.push('cal-month__cell--today');
  return classes.join(' ');
}
