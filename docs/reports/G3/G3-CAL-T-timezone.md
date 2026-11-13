# G3-CAL-T — The doctor calendar always shows Africa/Tunis time

Scope: `src/app/features/doctor/calendar/` only. No backend change, no new endpoint, and what is sent to the API has the same shape as before (only the zone in which the values are computed changed). Not touched: the secretary agenda, `shared/ui/appointment-status.ts`, QuickBookingDrawer, the Requests page, the command center, the static-demo calendar. **No git command of any kind was run.** The app was **not run**: nothing was checked in a browser.

## 1. Plan findings

### How FullCalendar 7.1.1 handles `timeZone`
| Fact | Where I read it |
|---|---|
| `timeZone` is a string option, default `'local'` | `node_modules/fullcalendar/chunks/ce43400c.d.ts:788,1307,1897-1898`; default at `chunks/6b921645.js:816` |
| A named zone is resolved with `temporal-polyfill` (already a dependency): `timestampToMarker` converts an instant to the zone's wall clock (a « marker »), and `toDate(marker)` converts a wall clock back to a **real instant** (`PlainDateTime → ZonedDateTime → epochMilliseconds`) | `node_modules/@full-ui/headless-calendar/index.js:829-857` |
| Therefore, with `timeZone: 'Africa/Tunis'`: the `Date`s handed back in callbacks (`datesSet` start/end, `dateClick.date`, `dayCellClass` date, `view.currentStart/End`) are **true instants** (Tunis midnight is `…T23:00:00Z`); event inputs written as zone-less wall-clock strings (breaks, exceptions: `2026-11-16T12:30:00`) are read **in Tunis**; strings with `Z` or an offset are instants | same file, plus `fullcalendar/chunks/e1b02ccd.js:984,1115` (the option goes to `DateEnv`) |
| Consequence for our code | after the switch every callback `Date` must be **read in Tunis**; a browser-local getter (`getHours`, `getDay`, …) on it would read the wrong clock in any other zone. No offline official docs were available; the conclusion comes from the installed source |

### Every browser-local time operation in `calendar/` (before the change)
| File:line (before) | What it did | Fix |
|---|---|---|
| `calendar-time.adapter.ts:33-37,195-196` | `Intl.DateTimeFormat('fr-FR', {hour, minute})` without a zone: card times, tooltips, aria labels | `formatTunisTime` (fixed zone) |
| `calendar-time.adapter.ts:41-52` | exception dates for the API from `toLocalDateOnly(start)` and `(end − 1 ms)` | `tunisDayKey` |
| `calendar-time.adapter.ts:126` | `new Date(ms).getDay()` for the hidden weekdays | `tunisWeekday` |
| `calendar-time.adapter.ts:159,213-216` | `new Date(y, m, d).getDay()` (local date) for fully blocked days | `weekdayOfDayKey` (pure calendar arithmetic) |
| `calendar-time.adapter.ts:205-210` | `toLocalDateOnly`: `getFullYear/getMonth/getDate` | removed; replaced by `tunisDayKey` everywhere |
| `calendar-time.adapter.ts:299-300,313` | `isWorkingTime`: `getHours/getMinutes/getDay` | `tunisDayKey`, `tunisHourMinute`, `tunisWeekday` |
| `calendar-time.adapter.ts:319-321,331,343` | day / month / year / title formatters without a zone | `tunisFormatter` |
| `calendar-time.adapter.ts:347-348` | `getFullYear/getMonth` for the week title | `tunisParts` |
| `calendar-event.adapter.ts:343` | « Consultation non clôturée »: `toLocalDateOnly(start) < toLocalDateOnly(now)` | `tunisDayKey` |
| `calendar-event.adapter.ts:536-544` | lunch breaks: loop over **local** days with `getDay` and `toLocalDateOnly` | loop over Tunis day keys (`addDaysToKey`, `weekdayOfDayKey`) |
| `calendar-event.adapter.ts:375,463` | `formatCalendarTimeRange` for cards | fixed through the formatter above |
| `calendar-page.ts:335,340` | day-cell / lane class: `toLocalDateOnly(info.date)` | `tunisDayKey(info.date)` |
| `calendar-page.ts:520-528` | exception form defaults: `now.getHours()/getMinutes()` and `toLocalDateOnly(now)` | `tunisHourMinute(now)`, `tunisDayKey(now)` |
| `calendar-page.ts` (options) | **no `timeZone`**: FullCalendar rendered in the browser's zone | `timeZone: 'Africa/Tunis'` |
| `calendar-page.ts` `loadedPeriod` (CAL-2) | the whole week taken from FullCalendar's `currentStart/End` | computed with `tunisWeekRange` (Monday 00:00 → Sunday 24:00 Tunis), so it never depends on FullCalendar or the browser |
| `calendar-detail-panel.ts` (CAL-3) | `formatScheduledRange/Instant(…, cabinet or slot timezone)` | always `Africa/Tunis` |
| **Checked, already correct** | `calendar-page.ts:451` `start.getTime() < Date.now()` and `:460` `toISOString()` (instants); `:223`, `:792`, `calendar-event.adapter.ts:239,253,408` (`Date.parse` of ISO instants); the whole of `quick-booking-drawer.ts` (own `instantDateKey`, `todayDateKey`, `Intl … timeZone` at `:72,1086-1135`) — **not touched** |
| **Outside `calendar/` (read, not changed)** | `availability-exception.adapter.ts` (UTC date arithmetic: zone-independent); `oc-date-field` (shared UI, how it turns a click into `YYYY-MM-DD` was **not verified**); secretary agenda (own UTC-day bug, out of scope); facade `loadProposalAvailability` (sends instants) |

After the change a grep of `calendar/` (non-test, outside `calendar-time.ts` and the already-correct booking drawer) finds **no** `getHours`, `getMinutes`, `getDay(`, `getDate(`, `getFullYear`, `getMonth(`, `setHours`, `new Date(y, m, …)`, `toLocale…String`, `new Intl.DateTimeFormat(` or `toLocalDateOnly`.

### API formats (unchanged), and how each value is computed now
| Call | Backend expects | Computed before | Now |
|---|---|---|---|
| `GET /doctor/scheduled-care?from&to` | `Instant` (ISO UTC) | `start/end.toISOString()` of FullCalendar's range | the Tunis week / day / month range as instants (`…T23:00:00.000Z` = Tunis midnight) |
| `GET /appointments/availability/exceptions?from&to` | `LocalDate`, read as Tunis dates | `toLocalDateOnly(...)` (browser zone) — **wrong dates in another zone** | `tunisDayKey(...)`: Monday → Sunday of the Tunis week |
| `POST …/exceptions` body | `exceptionDate` (date), `startTime`/`endTime` (wall clock, Tunis) | date from the form (default from the browser's today), times from the browser's clock | defaults from the Tunis date and clock; values typed by the doctor are sent as before |
| `GET /appointments/availability/slots` (request « proposer un autre horaire ») | `Instant` | facade, instants | unchanged (facade, outside `calendar/`) |
| Quick create (`GET/POST /patients/{id}/appointments…`) | instants | the click sent `info.date.toISOString()`; the drawer works in Tunis | the click is the **Tunis wall clock** the doctor clicked (09:00 Tunis → `…T08:00:00.000Z`); drawer unchanged |
| Request actions (accept, propose, decline) | `expectedVersion`, `proposedSlot {start,end}` instants | no local time involved | unchanged |

## 2. What was built
- **`calendar-time.ts` (new): the one helper.** `TUNIS_TIME_ZONE`, `tunisParts`, `tunisDayKey`, `tunisToday`, `tunisHourMinute`, `tunisWeekday`, `weekdayOfDayKey`, `addDaysToKey`, `tunisInstant(dayKey, 'HH:mm')` (Tunis wall clock → instant, computed from the IANA zone, two-pass, no hand-written offset), `tunisDayBounds`, `tunisWeekRange` (Monday 00:00 → Sunday 24:00), `formatTunisTime`, `formatTunisTimeRange`, `tunisFormatter`. No `+01:00` anywhere in app code.
- `calendar-time.testing.ts` (new, tests only): `at('2031-04-07', '09:30')` = that Tunis wall clock as an instant.
- Every other file in `calendar/` now goes through it (table above).

| File | Change |
|---|---|
| `calendar-time.ts` (new), `calendar-time.testing.ts` (new) | as above |
| `calendar-time.adapter.ts` | all browser-local operations replaced; `toLocalDateOnly` and `localDateFromKey` removed |
| `calendar-event.adapter.ts` | break loop and « non clôturée » rule in Tunis |
| `calendar-page.ts` | `timeZone: 'Africa/Tunis'`; Tunis day keys for blocked-day classes; Tunis defaults of the exception form; Tunis week range for the API |
| `calendar-detail-panel.ts` | times always in Tunis |
| specs | section 4 |

Not changed: `calendar-view.ts/.html` (they already call `formatCalendarTime`), `calendar-week.scss`, `quick-booking-drawer.*`, static-demo files, all other folders.

## 3. Required behaviours
| Behaviour | How it is now computed in Tunis |
|---|---|
| Week range and API from/to | `tunisWeekRange`: Monday 00:00 → next Monday 00:00 Tunis (= Sunday 24:00), sent as instants; exception dates as Tunis dates |
| Today column and date pill, red now line | FullCalendar's `isToday` and `nowIndicator` follow its `timeZone` (Tunis); the blocked-day classes use the Tunis day key |
| Hidden days | weekday of each appointment/request **in Tunis** (a 23:30 UTC Sunday appointment keeps Monday visible) |
| Lunch break | one block per Tunis day, wall-clock times read by FullCalendar in Tunis |
| Closed slots and « Rouvrir » | exception wall-clock strings are read by FullCalendar in Tunis; dates are Tunis dates |
| Working hours (click validation) | `isWorkingTime` on the Tunis clock and Tunis date |
| Quick create click | the instant of the clicked slot (`…T08:00:00.000Z` for 09:00) is passed unchanged; judged working/past on the Tunis clock |
| Request placement | request `start/end` are instants, drawn by FullCalendar in Tunis; hidden-day rule in Tunis |
| Side-panel times | always `Africa/Tunis` (the cabinet snapshot's zone is ignored, per the project invariant) |
| Header range label | `calendarPeriodTitle` with Tunis dates |

## 4. Tests
**Existing assertions changed:**
| File | Change |
|---|---|
| `calendar-page.spec.ts`, `calendar-event.adapter.spec.ts`, `calendar-time.adapter.spec.ts` | 39 occurrences of `new Date(y, m, d, h, mi)` (browser-local) replaced by `at('YYYY-MM-DD', 'HH:mm')` (Tunis); the booking-drawer test builds « one week from today, 10:00 » in Tunis instead of with `setDate/setHours/getDay` |
| `calendar-page.spec.ts` « loads exceptions with the visible date range » | now expects the whole Tunis week around 1 April 2031: `listExceptions('2031-03-31', '2031-04-06')` (it used to expect dates matching `2031-04-`) |
| `calendar-page.spec.ts` « falls back to the active range when the view does not report its current period » | renamed « computes the whole Tunis week itself … » and expects Monday 00:00 → next Monday 00:00 Tunis |

**New: 39 tests** (291 → 330): `calendar-time.spec.ts` (new, 19 tests: fixed instants crossing midnight, month, year and leap-day ends — `2026-11-15T23:30Z` is Monday 16 Nov 00:30 in Tunis; the Tunis day boundary at 22:59:59.999Z / 23:00Z; hour and weekday; wall clock → instant, 24:00, invalid input, round trips; Monday 00:00 → Sunday 24:00 for any instant of the week, week starts, month/year crossings, seven-day length; fr-FR times); `calendar-time.adapter.spec.ts` (+6); `calendar-event.adapter.spec.ts` (+3); `calendar-detail-panel.spec.ts` (+1); `calendar-page.spec.ts` (+10).

Proofs requested:
- **23:30 UTC lands on the next Tunis day:** an appointment at `2026-11-15T23:30:00Z` has Tunis day `2026-11-16`, label `00:30–01:00`, keeps Monday visible and Sunday hidden; the same instant is not a working time for a Sunday rule; a consultation started Monday 00:10 Tunis is « today » although its UTC day is yesterday.
- **Quick create at 09:00 in the grid sends 09:00 Tunis:** clicking 09:00 Tunis sets `quickBookingStart` to `…T08:00:00.000Z`; 16:30 UTC (17:30 Tunis) is refused as outside working hours; 08:30 UTC accepted, 07:30 UTC refused.
- **Week range sent to the API:** `getDoctorScheduledCare('2026-11-15T23:00:00.000Z', '2026-11-22T23:00:00.000Z')` and `listExceptions('2026-11-16', '2026-11-22')` (Monday 00:00 → Sunday 24:00 Tunis), also when the view first reports a Wednesday.
- Also: `timeZone` option is exactly `'Africa/Tunis'`; the exception form defaults to Tunis today/clock under a faked system clock; breaks start on the first Tunis day of the range; side-panel times stay Tunis even when the snapshot says `America/New_York` or `Asia/Tokyo`.

**Results**
| Check | Result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | exit 0 |
| Calendar specs (temporary tsconfig in the calendar folder, deleted afterwards), machine zone | **16 files, 330 tests, 0 failed** |
| Same specs forced to **America/New_York**, **Asia/Tokyo** and **UTC** | **330 / 330 pass in each** (+1 temporary probe test, deleted, which asserted the zone's real offset: 300/240, −540, 0 minutes; so the zones were genuinely applied) |
| `ng build --configuration production` | exit 0, 67 s. Warnings: initial bundle 993.18 kB (243.18 kB over) and `waiting-room-page.static-demo.scss` 955 bytes over: **identical to CAL-3**. Calendar lazy chunk 447.76 → 449.38 kB (+1.6 kB) |
| `ng build --configuration static-demo` | exit 0 |
| Full `ng test --watch=false` | not run: blocked by `secretary/team/team-page.spec.ts` (other chat) |

**How the other zones were run on Windows.** `TZ=… command` is **ignored by Node on this Windows machine**, so a plain `TZ=America/New_York ng test` would have run in the machine zone and proved nothing. Setting `process.env.TZ` *inside* the process does work, so I preloaded a one-line script through `NODE_OPTIONS=--require …` (it sets `TZ` from `FORCE_TZ` in every test worker), and used a temporary probe spec to assert the zone really changed.

**Important caveat about the past.** This machine's own zone is `Etc/GMT-1` (UTC+1, no daylight saving), i.e. the same as Tunis. Before this task every « local » assertion therefore passed here **by coincidence**; they proved nothing about other zones. The suite is now meaningful: it passes under three other zones.

## 5. Not verified, risks
- **Nothing was seen in a browser.** In particular how FullCalendar 7 renders with `timeZone: 'Africa/Tunis'` (the component initialises and renders in jsdom in the page spec, with the polyfill; the grid, scroll position, now line and today pill were not checked).
- `oc-date-field` (shared UI, used by the exception form): how it builds the `YYYY-MM-DD` it returns was not read; if it uses browser-local dates, a doctor abroad could still pick the wrong day there. It is outside `calendar/`.
- The tests assume Tunis is UTC+1 all year (true since Tunisia has no daylight saving time). The helper itself uses the IANA zone; only the hard-coded expectations would need updating if the zone rules ever changed.
- The **static-demo** calendar has its own FullCalendar options (no `timeZone`) but shares `CalendarView`, whose card times are now Tunis: in a browser outside Tunis the demo's grid (local) and its card labels (Tunis) can differ. Demo only, fixtures; it compiles.
- The secretary agenda keeps its UTC-day query (out of scope).

## 6. Noticed, not touched (final fix pass)
- The weekday possibly shown twice in the week header (`dayHeaderFormat` with the template's own weekday); the striped sliver beside the lunch break (hatched gap next to the new break block) — both hypotheses from the code, not seen.
- FullCalendar still receives the full patient name as the event `title` (Mode discret may leak it there; unverified).
- `compactPatientLabel`, `calendarEventClasses`, `eventAccessibleLabel` on `CalendarPage` are unused by the templates.
- Break blocks overlapping a card split the column width.
- The old `.fc-*` selectors of the static-demo SCSS match nothing in FullCalendar 7.

## 7. Open questions
1. The side panel now ignores `cabinet.timezone` and always uses Africa/Tunis (project invariant). Is that what you want, or should a cabinet in another zone be shown in its own?
2. May I check `oc-date-field` (shared UI) for browser-local date building, which would be a change outside `calendar/`?
3. Should the static-demo calendar also get `timeZone: 'Africa/Tunis'` (its files are off-limits here)?
4. Do you want the non-Tunis zone run (the `NODE_OPTIONS` preload) turned into a documented script (`package.json` or `tools/`) so it can run in CI? Not added here (outside `calendar/`).

## Chat summary
The calendar now runs FullCalendar in `Africa/Tunis` and every time operation in `calendar/` goes through one helper (`calendar-time.ts`): the week range and exception dates sent to the API, today column, hidden days, lunch breaks, working-hours checks, the quick-create click (09:00 Tunis → `08:00Z`), request placement, the side panel and the header label. The API contract is unchanged. 330 calendar tests (39 new) pass on the machine **and** forced to New York, Tokyo and UTC; both builds pass with the same warnings as CAL-3. Caveat: this machine is itself on UTC+1, so older local-time tests had passed by coincidence; and `TZ=` is ignored by Node on Windows, so I forced the zone from inside the process. Nothing was checked in a browser.

**Browser check for the CTO:** Chrome DevTools → ⋮ → More tools → **Sensors** → *Location* → set **Timezone ID** to `America/New_York`, reload `/doctor/calendar`. The times must be **unchanged**: same cards at the same hours (e.g. a 09:00 appointment still shows 09:00), the red now line and today's green pill on the same day and hour as in Tunis, lunch break at the same hours, the header range label the same, the first hour of the grid the same. Click an empty 09:00 slot: the booking drawer must show 09:00 (the same time as before the zone change). Set the zone back to « Default » afterwards.

## Path to deliver G-3
| Step | Status | What it still needs |
|---|---|---|
| CAL-1 presentation layer | done | — |
| CAL-2 week view restyle | done, not seen | CTO browser review |
| CAL-3 requests, follow-ups, panel | done, not seen | browser checklist of its report; answers to its questions; backend G4-1 for follow-ups |
| **CAL-T time zone** | **done, not seen** | the browser check above; answers to questions 1-4 |
| CAL-4 month and day views | **remaining** | new month component (tiles, dots, hover preview, day menu) and compact day list, built on `calendar-time.ts` (Tunis day keys and ranges are ready); exact workload needs the backend per-day summary and free slots (G4-2/G4-3) or a client approximation |
| CAL-5 chrome | **remaining** | « Mode discret » toggle, date picker, patient search, filters, keyboard shortcuts (none for Accepter / Refuser / Annuler / Démarrer); the date picker must use `tunisDayKey` |
| CAL-6 | **scope not described in the briefs I received** | needs its brief |
| Final fix pass (CTO) | **remaining** | the visual items of section 6 plus anything seen in the browser review |
| Backend-dependent actions | parked | Déplacer, Message, Marquer absent; per-day summary and doctor free slots |
| Close-out | **remaining** | unblock the full `ng test` (`team-page.spec.ts`, other chat); a documented non-Tunis zone run (question 4); a visual regression check of the calendar |
