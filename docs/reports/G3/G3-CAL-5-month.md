# G3-CAL-5 — Month view

Scope: UI only, `src/app/features/doctor/calendar/`. No backend change, no git command of any kind. Built against the agreed calendar-summary contract (backend G4-2b is not live yet). **Nothing was seen in a browser.**

## 1. What was built

The month is now a custom component (decision D-10). FullCalendar still serves the Jour and Semaine views. In the month view it stays mounted but hidden (`display: none`) and only drives navigation (‹ ›, Aujourd'hui, date picker, title). It is given no events there.

| Brief item | Where |
|---|---|
| 1. Data: service, typed contract, fixture | `calendar-summary.models.ts`, `calendar-summary.service.ts`, `testing/calendar-summary.fixture.json` (+ `testing/calendar-summary.testing.ts` helper) |
| 2. Grid (7 columns LUN…DIM, 108 px cells, radius 14, level colours, bar = `loadPercent`, out-of-month 0.5, past 0.6, today pill, « Fermé » / « Congé ») | `calendar-month.ts`, `.html`, `.scss` |
| 3. Dots (mapping, max 5 then « +n », cancelled never shown) | `calendar-month.model.ts` (`buildDayDots`) |
| 4. Legend row (thresholds read from the API answer) | `calendar-month.model.ts` (`legendLevels`, `legendDotItems`) |
| 5. Hover / Espace preview (304 px, beside the cell, flips near right and bottom edges, 150 ms delay, one Tunis day, per-day cache) | `calendar-month.ts` (`preview`, `loadDay`) |
| 6. Click / Entrée → Jour view; « ⋯ » menu | `calendar-month.ts`, page: `openDay`, `openDayMenuCommand` |
| 7. Left panel: « Aujourd'hui », « Demandes en attente », « Raccourcis clavier » | `calendar-month.html` (`.cal-month__aside`) |
| 8. CAL-4: filters hide dots and counts; search disabled with hint; month shortcuts | model, `calendar-toolbar.ts`, page `onKeydown` |
| 9. Mode discret | `name()` → `patientLabel()` in preview, aside, request rows |
| 10. States: skeleton, error + « Réessayer », 400 message | `calendar-month.html`, page `loadSummary` |
| 11. Accessibility | `role="grid"/"row"/"columnheader"/"gridcell"`, cell `aria-label`, roving `tabindex`, 2 px `#1FBF9A` focus ring, `prefers-reduced-motion` |

### Files

New: `calendar-summary.models.ts`, `calendar-summary.service.ts`, `calendar-month.ts`, `calendar-month.html`, `calendar-month.scss`, `calendar-month.model.ts`, `testing/calendar-summary.fixture.json`, `testing/calendar-summary.testing.ts`. New specs: `calendar-summary.service.spec.ts`, `calendar-month.model.spec.ts`, `calendar-month.spec.ts`, `calendar-month-page.spec.ts`.

Changed: `calendar-page.ts`, `calendar-page.html`, `calendar-view.ts`, `calendar-view.html`, `calendar-view.models.ts`, `calendar-view.states.scss` (hides the FullCalendar host in the month), `calendar-toolbar.ts`, `calendar-toolbar.scss`.

Not touched: `shared/ui/appointment-status.ts`, QuickBookingDrawer, the Requests page, the command center, the secretary agenda, the static-demo files. The static-demo page does not pass the new `month` input, so it keeps the FullCalendar month grid it had. `app.icons.ts` was not needed.

## 2. Contract usage

`GET /api/v1/doctor/scheduled-care/calendar-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`, typed exactly as agreed (`calendar-summary.models.ts`). The contract was not changed.

- **Range.** The grid is computed from the Tunis month (`monthGridOfMonth('2026-11')`): the Monday of the week of the 1st to the Sunday of the week of the last day, 4 to 6 weeks, never more than 42 days (November 2026 → `2026-10-26`…`2026-12-06`, 42 days, as in the contract example). The dates go through `calendar-time.ts` (`weekdayOfDayKey`, `addDaysToKey`).
  - **Why not FullCalendar's range?** I found that FullCalendar 7's `datesSet` for a month reports the month only, and a week-view `hiddenDays` trims it while the view is switching (real run: `2026-11-02`…`2026-11-30`). The page therefore takes only the month from FullCalendar (`view.currentStart`, or the middle of its range) and builds the grid itself.
- **No recomputation (G-4 « Done when » 1).** The level picks the cell colour, the bar width is `loadPercent`, the counts are shown as sent (`6 / 16 créneaux réservés`). The thresholds in the legend come from `thresholds`. The only arithmetic is the one the brief asks for: splitting `CONFIRMED` / `COMPLETED` into follow-up and non-follow-up dots (`count − followUpCount`, clamped at 0).
- **Preview.** It calls the existing `GET /doctor/scheduled-care?from&to` for exactly one Tunis day (`tunisDayBounds`), once per day while the month is open. The cache is emptied when a new summary arrives. A failed day is not cached (it asks again next time). A closed day loads nothing.
- **Errors.** 400 → « La période demandée n'est pas valide. »; anything else → « Impossible de charger le mois. » with « Réessayer ». Until G4-2b exists the browser will show that error state, as expected. There is no fake data in production code; the fixture is only under `testing/`.
- **Reload after a change.** The summary is reloaded after saving an exception, after « Rouvrir », after a quick booking, and when the scheduled-care projection is invalidated.

## 3. Day menu

« ⋯ » on a cell (keyboard reachable, ArrowDown opens it, Échap closes it) offers « Prolonger la journée », « Fermer la journée », « Ajouter une pause ». They open the **existing** exception form with the day pre-filled (nothing is saved until the doctor confirms there, via the existing `addException`):

| Item | Prefill |
|---|---|
| Prolonger la journée | exceptional opening, time window, from the day's last working end, +1 h |
| Fermer la journée | block, whole working day |
| Ajouter une pause | block, time window = the day's break (12:00 + 1 h when there is none) |

« Patients à prévenir » is not shown (parked).

## 4. Keyboard (CAL-4 rules)

- Handled by the page's single `keydown` listener, **after** the CAL-4 checks: switch on, not typing, no dialog or popover open.
- Applies only when a day cell itself has the focus: ← → ↑ ↓ move between days (clamped to the grid), Espace opens or closes the preview, Entrée opens the day. Elsewhere ← → still change the period.
- Échap closes the transient things first (shortcuts window, popovers, search), then the month preview or menu.
- Search is disabled in the month, with the visible hint « La recherche fonctionne en vue Jour et Semaine ». The `/` shortcut does nothing there.
- With the CAL-4 switch off, none of the arrows, Espace or Entrée act (tested).

## 5. Tests

| Run | Result |
|---|---|
| Calendar specs before CAL-5 (today, this machine) | 13 files, 391 tests, all pass |
| Calendar specs after CAL-5 | **17 files, 473 tests, all pass** (+82 new) |
| Forced zones America/New_York, Asia/Tokyo, UTC (CAL-T method, probe spec asserting the zone, deleted) | **18 files, 474 tests (473 + probe), all pass in each** |
| `tsc --noEmit -p tsconfig.app.json` | clean |
| Production build | OK |
| Static-demo build | OK |
| `npm run check:ui-boundaries` | passes |

Coverage:
- **`calendar-summary.service.spec.ts`** — `HttpTestingController`: exact URL and params; the fixture (every level, both closed reasons, null `loadPercent`, follow-ups, requests, blocked and extra windows); a disagreeing `takenSlots`/`bookableSlots` vs `loadPercent` passes through untouched; 400 vs other errors; month grid Mon→Sun (Nov 2026 = 42 days, Feb 2027 = 4 weeks, cap 42).
- **`calendar-month.model.spec.ts`** — dot mapping, follow-ups, « +n », cancelled excluded, filters hide dots, labels, closed texts, API-width, timeline.
- **`calendar-month.spec.ts`** — grid and headers, classes by level, **API level and width shown as sent when they disagree with the counts**, today / past / out-of-month, dots, filters, legend, skeleton, error + retry, 400, click, menu (3 items, none for « Patients à prévenir », only « Prolonger » on a closed day), preview (150 ms delay, one request for one Tunis day, cache, content, « Demande », empty, closed, edges flip, filters, Mode discret initials, error), arrows / Espace / Entrée / Échap, left panel (today, requests, shortcuts card, initials).
- **`calendar-month-page.spec.ts`** — drives the real FullCalendar: summary requested for `2026-10-26`…`2026-12-06`, skeleton → grid, error → retry, 400 message, not requested outside the month, FullCalendar host hidden, day opens Jour view, « + Rendez-vous » start, menu → existing exception form → `addException` payload → summary reloaded, keyboard rules (including **off with the CAL-4 switch**, ignored while typing or with a dialog), search disabled and hint, Mode discret in request rows.

### Budgets vs CAL-4

| Budget | CAL-4 | CAL-5 |
|---|---|---|
| Initial bundle (production) | 993.18 kB, over by 243.18 kB | 993.18 kB, over by 243.18 kB (unchanged) |
| waiting-room static-demo scss | over by 955 bytes | over by 955 bytes (unchanged) |
| Calendar lazy chunk (production) | 472.98 kB | 514.52 kB (**+41.5 kB**) |
| Static-demo calendar chunk | 394.93 kB | 435.07 kB (+40.1 kB) |

No new warnings. (CAL-4 counted 19 files / 441 tests; the same folder gives 13 files / 391 tests today before my changes. The 330 → 441 jump in the CAL-4 report probably counted other specs; I compared like with like.)

## 6. Things worth knowing

- **Test bundler quirk.** In the combined spec run, constants exported from `calendar-month.model.ts` and copied into component fields (`levelChip = LEVEL_CHIP`, then `dotColor = DOT_COLOR`) came back `undefined` when the model's own spec was part of the run. Alone they worked. I did not find the root cause. The component now reads them through methods (`dotColor()`, `levelChip()`, `legendDots()`), and all runs are green. The production build is a single graph and was never affected in the way the tests were, but the pattern is worth avoiding.
- The shortcuts window opened from the new left card is the CAL-4 window (`toolbar.openShortcuts()`).

## 7. Parked / not verified

- **Nothing seen in a browser.** In particular: how the preview popover sits inside `.doctor-calendar-demo__calendar` (a parent with `overflow: hidden` would clip it), FullCalendar re-measuring itself when it is shown again after the month (FullCalendar 7 observes its own size, not checked), the 280 px left card next to the open side panel, and the hover timing.
- The month needs the backend endpoint. Until G4-2b is live the screen shows « Impossible de charger le mois. » (expected).
- « Aujourd'hui » is read once when the month opens (it does not roll over at midnight with the page left open).
- The « Aujourd'hui » card lists appointments from the month's already-loaded agenda (not filtered by « Filtres »). Its numbers come from the summary.
- On a closed day only « Prolonger la journée » is offered. On an EXCEPTION day, extending does not undo the block. Open question for the CTO.
- Two « Demandes en attente » differences to check against the canvas: the chip counts the requests with a time loaded for the month (status `PENDING_DOCTOR`), not the sum of the per-day `pendingRequestCount`. Requests without an exact time are not listed.
- Known visual bugs of the final fix list are not fixed (weekday twice in the week header, striped sliver beside the lunch break, permanent footer note). The footer note still shows in the month.
- The old FullCalendar month branches in `calendar-view.html` (`dayGridMonth` card layout) are still there for the static demo.

## 8. Browser checklist (once G4-2b is live)

1. Open `/doctor/calendar`, press **M** (or « Mois »). The network tab shows one `calendar-summary` call with `from` = the Monday on or before the 1st and `to` = the Sunday on or after the last day (`?from=2026-10-26&to=2026-12-06` for November 2026). No other `calendar-summary` call on hover.
2. Cells: 7 columns LUN…DIM, 108 px high; colour and bottom bar match the level and `loadPercent` of the response (compare 3 days by hand). Closed days show « Fermé » / « Congé » and no bar. Today is a green pill; past days faded.
3. Hover a day: after a moment a 304 px card opens beside it (left of the cell in the last columns, upward in the last rows). One `scheduled-care?from&to` call for that day only; hovering it again makes no second call. Check the timeline (break hatched, blocked window, booked bars).
4. Click a day or press Entrée → Jour view on that date. « Ouvrir la journée » and « + Rendez-vous » in the card do the same / open the booking drawer on that day.
5. « ⋯ » on a cell: the three items open the exception form pre-filled; after saving, the month reloads and the cell changes.
6. Keyboard: Tab onto the grid, arrows move day to day, Espace opens/closes the card, Échap closes it. Switch « Raccourcis clavier activés » off: arrows, Espace and Entrée stop acting.
7. « Filtres »: switch off « Demande »: the orange dots and the « en attente » wording disappear, colours and bars stay. « Mode discret »: initials in the card, the left panel and the request rows.
8. Left panel: « Aujourd'hui » (booked / bookable, « En cours »), « Demandes en attente » (a row opens the side panel, no accept/refuse button), « Raccourcis clavier ».
9. Search is greyed with « La recherche fonctionne en vue Jour et Semaine »; it works again in Jour and Semaine.
10. Break it: block the endpoint → « Impossible de charger le mois. » + « Réessayer ». Check the clip, scroll, and DevTools timezone `America/New_York`: same days, same today.

## 9. Path to deliver G-3 (calendar)

Done: CAL-1 presentation, CAL-2 week, CAL-3 requests, CAL-T time zone, CAL-4 toolbar, **CAL-5 month view** (built and tested against the contract fixture).

Remaining:
1. **CAL-6 — day view** (the Jour grid with the day summary and the same card states; reuses `countAppointmentsOfDay` and the week card). Its scope was never written down: please confirm it is the day view.
2. **Connect and verify against the real endpoint** (G4-2b): run the checklist above; confirm the contract on a real answer (null `loadPercent`, `extraWindows`, `awaitingPatientRequestCount`).
3. **Final fix pass**: the three known visual bugs, the budget warnings (initial bundle +243 kB, waiting-room scss +955 bytes), the open questions above, and a browser pass of the whole calendar.
