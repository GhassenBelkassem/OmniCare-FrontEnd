# G3-CAL-2 — Calendar week view restyle

UI only: no API, DTO, facade, backend, `shared/ui/appointment-status.ts`, `quick-booking-drawer.*`, `scheduled-care/*`, static-demo, `styles/tokens.scss` or `styles/vendor/*` change. No git command. The app was **not run**, so nothing below was checked by eye (see « What is not verified »).

## 1. Files changed
Everything is under `src/app/features/doctor/calendar/` except the icon registration.

| File | Change |
|---|---|
| `calendar-week.scss` (**new**) | All new rules: cards, status chip, hover/pressed/selected/focus, reduced motion, lunch break, closed-slot stripes, « Rouvrir » button + local popconfirm card, grid polish. `@use`s `calendar-status-tokens.scss` |
| `calendar-view.ts` | `styleUrls` += `calendar-week.scss` (last); `NzPopconfirmModule`; `appointmentAccessibleLabel` now uses `eventAriaLabel(…, discreet = false)`; new `breakLabel`, `canReopen`, `reopen` |
| `calendar-view.html` | Card markup (time + name + type icon, status chip when `!info.isShort`); `[class]="meta.cssClass"` on the card; closed-slot annotation gets the « Rouvrir » button with `nz-popconfirm`; break block uses the existing `isBreak` slot with the cup icon; tooltip shows the state label |
| `calendar-view.models.ts` | Appointment metadata += `calendarState, stateLabel, dashed, cssClass`; state metadata += `exceptionId, exceptionType`; break metadata += `timeLabel`; new action `REOPEN_EXCEPTION` |
| `calendar-event.adapter.ts` | `toScheduledAppointmentCalendarEvent` calls `presentCalendarItem(item, { isFollowUp: false })`: adds `oc-cal-state--<state>` to the event `className` and the state fields to `extendedProps`; type icon now comes from the presentation (`cabinet` / `external`, same icons as before); new `projectBreakEvents` |
| `calendar-time.adapter.ts` | `hasValidPause` exported; new `weekdaysToHide` |
| `calendar-page.ts` | `breakEvents` (added to `calendarEvents`, after exceptions); `hiddenDays` computed (+ `hiddenDays` in the FullCalendar options); `visibleRange` compared by key; `onDatesSet` loads the full week (deviation 2); `REOPEN_EXCEPTION` handling; delete-exception flow extracted into one private method shared by the modal and « Rouvrir »; break kind in `calendarEventClasses` / `eventAccessibleLabel` |
| `calendar-status-tokens.scss` (CAL-1 file) | Scope widened to `.omnicare-calendar, .doctor-calendar-demo` (deviation 1) |
| `../../../app.icons.ts` (**outside the folder, item h**) | `CoffeeOutline` registered (import + `OMNICARE_ICONS`), the way the app registers every icon. No new package |
| specs | `calendar-event.adapter.spec.ts`, `calendar-time.adapter.spec.ts`, `calendar-page.spec.ts`: new tests only (section 3) |

Not touched: `calendar-presentation.ts`, `calendar-privacy.ts`, the preferences store (not wired yet), `calendar-page.html`, `calendar-page.scss`, all static-demo files.

## 2. How each item was done
| Item | Result |
|---|---|
| a) Cards | Every appointment event carries `oc-cal-state--<state>` on the FullCalendar event (`className`) **and** on the inner card. Card: 3 px left bar `--oc-cal-bar`, `--oc-cal-bg`, `--oc-cal-border`, radius 8 px, semibold time + patient name + type icon, chip with `labelFr` when the card is not short. Hover `translateY(-1px)` + soft shadow (150 ms ease-out); pressed `scale(.99)`; focus ring 2 px `#0F826D`, offset 2 px (on the focusable event wrapper); selected = 2 px ring in the state colour; all motion removed under `prefers-reduced-motion`. aria-label = `eventAriaLabel(time, name, state, false)`, e.g. « Rendez-vous à 09:30 avec Test Patient. Statut : À venir. » (+ « Sélectionné. »; an unclosed consultation says « Consultation non clôturée » as its status) |
| b) Requests | Still filtered out; `calendar-page.ts` request filter (`:636-640` before, same lines moved down) untouched |
| c) Lunch break | `projectBreakEvents` → one `kind: 'break'` block per visible day from each active rule's **valid** pause (same validity test as the business-hours helper). Not produced in month. Shown in week and day. `pointer-events: none`, so a click inside it reaches the slot lane and keeps today's « en dehors de vos horaires » hint. Text « Pause déjeuner · 12:30 – 14:00 », white circle with the cup icon |
| d) Closed slots | BLOCK background = `repeating-linear-gradient(135deg, #F2F4F7 0 6px, #E4E7EC 6px 12px)`. The annotation card shows a « Rouvrir » pill (BLOCK only, hidden on short cards) with `nz-popconfirm` « Rouvrir ce créneau ? Il redeviendra réservable par les patients. » (Rouvrir / Annuler) → `REOPEN_EXCEPTION` → the **same** `deleteException` flow as the modal. The button stops click propagation, so the detail modal opens only from the card body. A failure shows the page banner (`mutationError`) because the modal is not open |
| e) Hidden days | `hiddenDays` exists in FullCalendar 7.1.1 (`fullcalendar/chunks/ce43400c.d.ts:1769`). Week view hides weekdays with no active rule and no loaded appointment **inside the visible week**; nothing is hidden before the rules load, after a rules error, in day/month, or when no day would remain (FullCalendar throws on seven hidden days: `chunks/f728e8d3.js:274`). `firstDay` stays 1 |
| f) Grid polish | Hour lines `#F2F4F7` (also `--fc-monarch-border`), today lane and header `#EDFBF6`, today's date pill `#0F826D` with white text, now line/dot `#D92D20` (also `--fc-monarch-now`); `nowIndicator` kept |
| g) Styles | New file, added last to `styleUrls`; static-demo files untouched (overridden rules listed in section 5) |
| h) Icons | `CoffeeOutline` was not registered → registered in `src/app/app.icons.ts` |

## 3. Tests
**Existing assertions changed: none.** All 219 existing calendar/scheduled-care/routes/status tests pass unchanged. (The brief expected some to change because of new classes/labels; none asserted them exactly. The only existing exact-label check, `eventAccessibleLabel` in `calendar-page.spec.ts`, is a method of `CalendarPage` that I did not change.)

**New: 35 tests.**
- `calendar-event.adapter.spec.ts`: state hook, label and dashed flag for each of the 6 appointment statuses; no follow-up derived; legacy status class and shared label preserved; cabinet/external icon; `projectBreakEvents` (shape, per-weekday rules, day view and 2-week range, inactive/invalid/missing pauses, month/no rules/no range, `HH:mm:ss` input).
- `calendar-time.adapter.spec.ts`: `weekdaysToHide` (rules only, closed day with an appointment, stale/out-of-range appointments, inactive rule, nothing to show → `[]`, unknown range).
- `calendar-page.spec.ts` › « CAL-2 week view »: break items in `calendarEvents`, break hook/label and month exclusion; `hiddenDays` (also in the options), closed day with an appointment, not hidden before rules / on rules error / in day and month; options not rebuilt when the recomputation gives the same days (the loop guard); full week loaded when the active range is trimmed; fallback when the view reports no current period.
- `calendar-page.spec.ts` › « CAL-2 Rouvrir »: delete via the existing API call, list updated, no modal; failure keeps the slot and shows the banner error; unknown id and double click ignored; the modal delete flow unchanged; `CalendarView.canReopen` true only for BLOCK annotations and `reopen` emits `REOPEN_EXCEPTION`; French aria/break labels.
- **Not covered by a spec:** the popconfirm itself (opening the overlay and pressing « Rouvrir ») and the rendered card/break DOM. I did not attempt to render events through FullCalendar in the jsdom spec (the existing page spec drives the component through its methods and signals), so those need a browser (see section 6).

**Results**
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `sass` compile of `calendar-week.scss` | exit 0 |
| Calendar specs (temporary tsconfig in the calendar folder, deleted afterwards; `team-page.spec.ts` of another chat not touched) | **14 files, 254 tests, 0 failed** (was 219) |
| `npx ng build --configuration production` | **exit 0**, 73 s. Warnings: initial bundle 993.18 kB over the 750 kB budget, and `waiting-room-page.static-demo.scss` 955 bytes over 18 kB. Neither file is part of this change (the calendar is a lazy chunk, 426 kB); I have no baseline to prove they pre-exist. The build wrote `dist/omniCareDash` |
| Full `npx ng test --watch=false` | not run: still blocked by `team-page.spec.ts` (other chat), as in CAL-1 |

**A real defect found and fixed during testing.** My first version of `hiddenDays` made the FullCalendar options depend on `visibleRange`; every `datesSet` creates a new range object and a new `hiddenDays` array, so the options changed, FullCalendar re-emitted `datesSet`, and Angular threw NG0103 (infinite change detection) on first render (all `CalendarPage` tests failed). Fixed by comparing `visibleRange` by `key` and `hiddenDays` by value; a spec guards it.

## 4. Deviations from the brief (please confirm)
1. **Token scope.** `.omnicare-calendar` is on no element in the production calendar (it exists only in `styles/vendor/_fullcalendar.scss`, where it also remaps every `--fc-monarch-*` colour). CAL-1's selectors would never have matched. I widened the scope of the tokens file to `.omnicare-calendar, .doctor-calendar-demo` (the real `CalendarView` root) instead of putting `.omnicare-calendar` on an element, which would have switched the vendor remap on with an effect I cannot check without running the app.
2. **Full week is always loaded.** FullCalendar's `datesSet` reports the *active* range, and the installed source trims hidden days at the edge of that range (`fullcalendar/chunks/f728e8d3.js:44-45`, same logic as `fullcalendar/all/global.js:6565-6566`). With Sunday hidden, an appointment on a closed Sunday would never be fetched and so never shown. In week view `onDatesSet` therefore loads and titles from `view.currentStart/currentEnd` (the whole week). This changes the *arguments* of the existing agenda request (the full Monday–Sunday week instead of the trimmed range); no endpoint or contract changes.
3. **Popconfirm styling.** `styles/vendor/ng-zorro-theme.less` does not import `popconfirm` or `popover` (only button and tooltip are imported), so a plain `nz-popconfirm` would be unstyled. That file may not be edited here, so the card is styled in `calendar-week.scss`, scoped to the overlay class `oc-cal-reopen-popconfirm` (no arrow, white card, 12 px radius, buttons right-aligned). The proper fix is two `@import` lines in the vendor theme.
4. **Type label text removed from week/day cards.** The brief asks for the type *icon*; the old second line « Cabinet » / « Patient externe » is replaced by the status chip. The type label is no longer shown anywhere on the card; the tooltip still shows the cabinet name.
5. **Accessible label content.** It is now the CAL-1 sentence (start time only, status, no type); the old label had the time range and the type.
6. **Month pills** take the CAL-1 state colours (background, border, dot) so the shared card event is not two-coloured. The month redesign itself is untouched.
7. **Tooltip** shows the new state label (« À venir ») instead of the shared label (« Confirmé »).

## 5. Old rules overridden by `calendar-week.scss` (not edited; line numbers approximate)
| Old rule | File | Overridden by the new file |
|---|---|---|
| `--fc-monarch-border` on `.doctor-calendar-demo` | `calendar-page.static-demo.scss:9` | `#F2F4F7`; also defines `--fc-monarch-now` |
| `.demo-calendar-day-lane--today`, `.demo-calendar-day-header--today` (brand tint) | `static-demo.scss:~519` | `#EDFBF6` |
| `.demo-calendar-appointment` radius, `:hover` (border + card shadow), `:focus-visible` (outline colour), `--selected` | `static-demo.scss:295-327`; `calendar-view.states.scss:230-234` | overflow visible, radius 8 px, focus ring `#0F826D`; hover lift moved to the inner card |
| `.oc-event` (tint, left rule, radius), `--selected`, `__time`, `--muted`, `--month`, `__dot` | `calendar-view.states.scss:240-334` | CAL-1 state variables; `--muted` no longer greys « Terminé » |
| `.oc-day-header__date--today` (`--oc-primary`) | `calendar-view.states.scss:223-228` | `#0F826D` pill, white text |
| `.demo-calendar-now-line`, `.demo-calendar-now-dot` | `calendar-view.states.scss:68-76` | `#D92D20` |
| `.demo-calendar-break` (dashed border) and `.demo-break` (no longer used by the template) | `static-demo.scss:483-503` | `.oc-cal-break` (solid `#E4E7EC`, `#F2F4F7`) |
| `.omnicare-exception-background--block` (red/grey hatch, `!important`) | `calendar-view.states.scss:184-200` | greys `#F2F4F7/#E4E7EC`, `!important` (same selector, later in the cascade) |
| `.demo-calendar-state--unavailable`, `.demo-state` | `calendar-view.states.scss:123-128`; `static-demo.scss:452-462` | white card on stripes; compact padding |

**Important finding about the existing styles.** FullCalendar 7 emits short generated class names (`.fc-0`, `.fc-1v`, …; `node_modules/@fullcalendar/angular/skeleton.css`), so the old `.fc-event`, `.fc-scrollgrid`, `.fc-col-header-cell`, `.fc-daygrid-*`, `.fc-timegrid-event` selectors in `calendar-page.static-demo.scss` match nothing today. Only the custom hook classes from the options (`demo-calendar-*`) and our own markup (`oc-*`) take effect. The new file uses only those, so it does not depend on FullCalendar internals.

## 6. What is not verified (needs eyes / a browser)
- The visual result of every item (not run, as instructed).
- That the hour-line colour actually changes: it relies on the `--fc-monarch-border` variable (which the page already sets) and on the `demo-calendar-slot--major` hook being the lane border; neither can be confirmed without the rendered DOM.
- Pointer-events pass-through on the break block (a click reaching the slot lane and showing the hint) and that FullCalendar keeps no tab stop on it (`interactive: false`).
- Where `nzPopconfirmOverlayClassName` lands in the overlay DOM (the CSS works whether it is on `.ant-popover` or on its pane).
- Break block layout when an appointment overlaps the pause window (FullCalendar would split the column width).
- `info.isShort` thresholds for the chip and the « Rouvrir » button.

## 7. Open questions (not decided)
1. Accept the token-scope change (deviation 1), or apply `.omnicare-calendar` on an element and review the vendor colour remap?
2. Accept loading the full week in week view (deviation 2)?
3. Add the popconfirm/popover imports to the vendor theme (then the local popconfirm CSS can go), or keep the local styling?
4. Is dropping the type label text (deviation 4) and the time range/type from the aria label (deviation 5) acceptable?
5. A closed weekday that only has an *exceptional opening* (EXTRA) and no appointment is hidden; only active rules and appointments count, as specified. Intended?
6. Hidden days and break days use the **browser's** local calendar, like the rest of the grid today; CAL-3 (time zone) must move them to Africa/Tunis.
7. The break validity test (`start < pauseStart < pauseEnd < end`) is the UI one; the server only checks that both pause times exist. A pause the server applies but the UI rejects would be unmarked. Align?
8. « Rouvrir » only exists for BLOCK closures and is hidden on short cards; an EXTRA opening is still removed from the detail modal. Confirm.
9. Breaks are also produced in day view (visible days). Keep, or week only?
10. Do you want a Playwright visual check added for the week view (the existing e2e only covers the static demo)?
11. `dist/omniCareDash` was rewritten by the production build: confirm it is ignored/disposable in this repo (no git here to check).

## Chat summary
The week view is restyled with the CAL-1 presentation layer: state-coloured cards (left bar, chip, hover/pressed/focus/selected, reduced motion), lunch-break blocks, striped closed slots with a confirmed « Rouvrir », hidden empty weekdays and the grid polish. `tsc`, 254 calendar tests (35 new, 0 existing assertions changed) and the production build pass. Three things need your call: the token scope (`.omnicare-calendar` was never on any element), the week is now always loaded in full because FullCalendar trims hidden edge days from `datesSet`, and the popconfirm is styled locally because the vendor theme lacks its stylesheet. I also fixed an infinite-change-detection loop I introduced and caught in tests. Nothing was checked visually.

## Path to deliver G-3
1. **Review CAL-2 in a browser** (week, day, today column, break, closed slot + Rouvrir, hidden Sunday with and without an appointment), then answer questions 1–4.
2. **CAL-3 — requests and time zone:** show pending booking requests (the filter at `calendar-page.ts` ~`:636-640`; orange/blue dashed states already exist in CAL-1) with the existing accept/propose/decline panel; set `timeZone: 'Africa/Tunis'` and replace the browser-local getters listed in the CAL-1 report (also fixes question 6).
3. **CAL-4 — month and day views:** new month component (workload tiles, dots, hover preview, day menu) and compact day list; until G-4, workload is a client approximation.
4. **CAL-5 — chrome:** date picker, patient search, filters, « Mode discret » (the CAL-1 store/helpers, aria `discreet = true`), keyboard shortcuts.
5. **G-4 (backend, parked):** `followUp` flag, per-day summary, doctor free slots; then switch the calendar from client approximations to those fields and pass `isFollowUp` into `presentCalendarItem`.
6. **Close-out:** unblock the full `ng test` (`team-page.spec.ts`, other chat), run `ng build --configuration production`, and add a visual regression check for the calendar.
