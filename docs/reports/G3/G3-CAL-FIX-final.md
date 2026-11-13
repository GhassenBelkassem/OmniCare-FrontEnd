# G3-CAL-FIX — Final fix pass of the doctor calendar

Repo `omniCareDash`. No git command was used. Files changed are inside `src/app/features/doctor/calendar/`, plus the one exception the brief allows:

- (a) `scheduled-care/scheduled-care.models.ts`: one new type field.

The other allowed exception, (b) `styles/vendor/ng-zorro-theme.less`, was edited and then **reverted** on the CTO's decision (fix 12), so it has no net change.

Not touched: `shared/ui/appointment-status.ts`, the look of QuickBookingDrawer, the Requests page, the command center, the secretary agenda, the static-demo files. The static demo still compiles.

## 1. The fixes: cause, change, test

| # | Cause (found) | Change | Test |
|---|---|---|---|
| 1 | Weekday twice in the week header: FullCalendar 7's **monarch theme draws its own weekday and day number**, then appends our `#dayHeaderContent` template inside the same header. A probe of the real DOM showed `lun.` `9` followed by our `<span>lun.</span><span>9</span>`. | Removed the `#dayHeaderContent` template (`calendar-view.html`) and its dead CSS. The theme's single rendering stays; today keeps the tinted column (`demo-calendar-day-header--today`). | page spec: every header contains exactly one weekday plus a digit, and no `.oc-day-header` |
| 2 | Striped sliver beside the lunch break: the break is a `display: 'block'` event, and the theme leaves a small gap at the end of each event column. The business hours excluded the pause, so the hatched « hors horaires » background showed through that gap. | New `projectGridBusinessHours` (calendar-time.adapter): the segment drawn on the grid runs from start to end with the pause included, because the « Pause déjeuner » block covers that time. Working-time decisions (`isWorkingTime`, the « en dehors de vos horaires » hint) still use `projectBusinessHours`, which cuts the pause out. | adapter spec: one segment drawn, and 13:00 is still not working time; page spec: `calendarOptions().businessHours` |
| 3 | A hard-coded `notice` string in `calendar-page.ts`. | `notice: null`. | page spec: no `.doctor-calendar-demo__notice`, and the text is absent |
| 4 | Narrow pills: **the short-card style, not a column split.** For a short event the monarch theme lays the inner box out as `flex-direction: row; align-items: center` (`columnEventInnerClass`, `isShort`), so our `.oc-event` (a flex item through `display: contents`) shrank to its text, about a third of the column. Taller events use `flex-direction: column` and stretch. A probe of two single events showed both harnesses at `inset 0% / 0%` (no split). | `.oc-event:not(.oc-event--month)` gets `flex: 1 1 auto; align-self: stretch; width: 100%` (`calendar-week.scss`). Two events that really overlap still share the column; that is FullCalendar's own placement. | page spec asserts the rule is present (jsdom has no layout, so the width itself cannot be measured) |
| 5 | Nothing marked a past confirmed appointment. | `presentCalendarItem(item, { nowMs })`: a CONFIRMED appointment whose end is at or before now shows the label « Non clôturé », class `oc-cal-state--not-closed` (muted grey card, amber bar and chip) and `notClosed: true`. The **state** stays `upcoming` / `followUpUpcoming`, so « Filtres » still works. Wired into: week card (muted, warning icon, chip), day row, month preview (chip « Non clôturé »), search results, and side panel. | presentation (3), week adapter (2), day model, month preview, search, panel |
| 6 | The hint was a `<p>` in the page flow. | A small toast in a live region that is always present (`role="status"`, `aria-live="polite"`) and `position: fixed`, so it is out of the layout. It disappears after `SLOT_HINT_MS` = 4 s. The timer's cleanup is registered once (it was registered once per hint). | page spec with fake timers: text, region outside the flow, gone at exactly 4 s |
| 7 | `height: 760` gave FullCalendar its own scroll area inside a scrolling page. | `height: 'auto'` for week and day, `stickyHeaderDates: true`, and the host uses `overflow: clip` (rounded corners without becoming a scroll container, so the sticky header follows the page). The month keeps 798. | not testable in jsdom (no layout): browser checklist |
| 8 | Our rules already used `:focus-visible`. After a mouse click the switch kept the focus, and the next key press (a shortcut or an arrow) switches Chrome to keyboard mode, which draws the ring on it. | The switch gives the focus back after a mouse or touch click (`event.detail > 0`); Espace or Entrée keeps it. Calendar-wide guard `.doctor-calendar-demo :focus:not(:focus-visible) { outline: none }`. | page spec: mouse click → focus left; keyboard click → focus kept |
| 9 | The preferences store registered a reset with `SensitiveStateRegistry`. | Registration removed. « Mode discret » and the shortcuts preference are both kept in `localStorage` and survive logout (CTO decision a). | store spec (3 tests updated or added) and page spec (`clearAll()` keeps Mode discret) |
| 10 | The FullCalendar `title` carried the full name. | `discreetTitles()` in the page: in Mode discret the title passed to FullCalendar is the initials. | page spec on the real FullCalendar: the name is in the grid when not discreet, and no « Ahmed » / « Ben Ali » anywhere in the grid's HTML once discreet |
| 11 | The field was read through a cast. | `followUp?: boolean` added to `DoctorScheduledCareItem` (file a). `isFollowUpItem` reads `item.followUp === true`; the `& { followUp?: boolean }` casts in the specs were removed. | adapter spec (typed field, `true` only) |
| 12 | See section 3. | **Reverted** after the budget check (CTO decision). The local `.oc-cal-reopen-popconfirm` styles stay. | — |
| 13 | See section 4. | Workarounds kept, cause narrowed and documented. | — |
| 14 | Already correct in code: the month (`closedText`, preview `closed`, no timeline) and the day (`closedDay`, no timeline, no break or closed rows) use `level === 'CLOSED'` / `closedReason` only. Not tested with a real backend payload. | The fixture's EXCEPTION day now has the backend shape (section 2). New helper `backendClosedExceptionDay()` holds the exact G4-2b sample. | day spec and month spec, each with that payload |
| 15 | Any 400 was read as « bad period / date ». | `isProblem400(error, code)`: the French message is shown for `CALENDAR_RANGE_INVALID` (summary, month and day) and `DAY_SLOTS_DATE_INVALID` (day-slots). The same applies to a 400 without a body. A 400 with another code, or a 401/403/500, gets the generic message. The texts are ours (« La période demandée n'est pas valide. » / « La date demandée n'est pas valide. »), not the server's `detail`, which contains the jargon « AAAA-MM-JJ ». | summary and day-slots service specs |

Also found while testing: `calendar-search.spec.ts` checked « À venir » for 16 November 2026 against the real clock, so it would have flipped to « Non clôturé » after that date. Its clock is now pinned.

## 2. Contract conformance (read-only)

Compared with the samples in `OmniCare-BackEnd/docs/reports/G4/G4-2b-calendar-summary.md` and `G4-3-day-slots.md`, and with the backend DTOs.

| Field | Backend | Front model / fixture | Result |
|---|---|---|---|
| summary top level | `timeZone, from, to, thresholds{busyFromPercent, fullFromPercent}, days` | same | ✔ |
| day key order and names | `date, level, closedReason, workingSegments, breakWindow, blockedWindows, extraWindows, bookableSlots, takenSlots, loadPercent, countsByStatus, followUpCountsByStatus, pendingRequestCount, awaitingPatientRequestCount` | identical (checked on all 42 fixture days) | ✔ |
| `level` | AVAILABLE, BUSY, FULL, CLOSED | same union | ✔ |
| `closedReason` | `WEEKLY_OFF`, `EXCEPTION`, `null` | same | ✔ |
| `loadPercent` | `null` when bookable = 0 | `number \| null`; `null` on every closed fixture day | ✔ |
| `breakWindow` | object or `null` | same | ✔ |
| `countsByStatus` | six keys, always present | typed as optional keys (tolerant reader); the fixture has all six | ✔ (kept tolerant on purpose) |
| WEEKLY_OFF day | empty segments, `breakWindow: null`, empty blocked | fixture identical | ✔ |
| **EXCEPTION day** | **still returns its working segments, break and blocked window** | the fixture had empty segments | **✘, fixed**: fixture 2026-11-12 now has its segments, break and blocked window; closed detection is tested with that payload and with the exact backend sample |
| day-slots top level | `timeZone, date, generatedAt (ISO UTC, seconds), slots[start, end, state]` | same; `state` = FREE / TAKEN / PAST | ✔ |
| closed day | `slots: []` | handled (day spec renders `list: []`) | ✔ |
| 400 codes | `CALENDAR_RANGE_INVALID`, `DAY_SLOTS_DATE_INVALID` (ProblemDetail `errorCode`) | now matched by code (fix 15) | ✔ |

## 3. nz-popover / nz-popconfirm (fix 12)

**Usage across the whole app** (`src/app`, every `.ts` and `.html`):
- `calendar/calendar-view.html`: « Rouvrir » on a closed slot (week), a popconfirm.
- `calendar/calendar-day.html`: « Rouvrir » on a closed window (day), a popconfirm.

There is no `nz-popover`, and no other screen uses either.

**Why it was reverted.** Adding `popover` and `popconfirm` (index and patch) to `ng-zorro-theme.less` added about 6.4 kB to the **initial** `styles.css`. The production build then failed: the initial bundle was 1.00 MB against the hard 1.00 MB error budget, over by 39 bytes.

**CTO decision:** revert the imports and keep the calendar's scoped `.oc-cal-reopen-popconfirm` styles, since only the calendar uses popconfirms. Re-add the global import when a second screen needs popovers, together with a budget decision in `angular.json`.

## 4. Fix 13 — the test-bundler quirk

**Reproduced.** I put `rows` / `note` / `minSearch` back as plain fields in `CalendarToolbar`. The combined run, and even a two-file run (`calendar-page.spec` plus `calendar-shortcuts.spec`), then failed the shortcuts-window test. The page spec alone passes.

**What the build output shows** (`ng test --dump-virtual-files`):
- Angular's vitest runner sets **`isolate: false`** (`@angular/build/.../vitest/plugins.js`), so every spec file in a worker shares one module graph.
- Because the specs are separate entry points sharing chunks, esbuild emits every module as a **lazy `__esm(...)` initializer**. A module's `const`s are `undefined` until its `init_*()` has run. For example, `calendar-shortcuts.ts` becomes `var CALENDAR_SHORTCUT_ROWS…; var init_calendar_shortcuts = __esm(…)`, and each importer calls `init_calendar_shortcuts()` first.

**What it is not:**
- There is no import cycle among the calendar modules; the only cross imports are type-only.
- An instrumented build (the field throws if the constant is `undefined` at construction) never threw, and that build passed.
- The symptom moves: once 0 rows rendered, once the 12 rows rendered without the note. So it depends on how the shared graph is split and ordered, not on a plain undefined import in the source.

**Conclusion.** The root cause is the interaction between `isolate: false` and esbuild's lazy module initializers across the shared chunks of several spec entries. I could not prove which initializer runs late for a given order. Fixing it at the root means changing the test builder setup (outside `calendar/`), for example a test project with `isolate: true`. That is out of scope here. Both workarounds stay (CAL-4 getters, CAL-5 methods), and the comments now point here.

**Rule for new code:** read module constants from templates through a getter or a method, not through a field initialized at construction.

## 5. Test results

| Run | Result |
|---|---|
| Calendar + scheduled-care + routes + appointment-status specs, before (same selection) | 27 files, 651 tests, all pass |
| Same selection, after | **27 files, 675 tests, all pass** (+24 new; 3 existing assertions changed: the store's « reset at logout » became « survives logout », the search test's clock was pinned, and a day-model follow-up moved to 11:00 so it stays « à venir ») |
| Forced zones America/New_York, Asia/Tokyo, UTC (CAL-T method: `TZ` set inside every worker, plus a probe spec asserting the offset, deleted afterwards) | **28 files, 676 tests (675 + probe), all pass in each zone** |
| `tsc --noEmit -p tsconfig.app.json` | clean |
| Production build | OK (after the fix 12 revert) |
| Static-demo build | OK |
| `npm run check:ui-boundaries` | passes (all four checks) |

### Budgets vs CAL-6 (report only)

| Budget | CAL-6 | CAL-FIX |
|---|---|---|
| Initial bundle (production) | 993.66 kB, over the 750 kB warning by 243.66 kB | 993.66 kB, unchanged |
| waiting-room static-demo scss | over by 955 bytes | unchanged |
| Calendar lazy chunk (production) | 550.47 kB | 551.52 kB (+1.05 kB) |
| Static-demo calendar chunk | 466.48 kB | 467.24 kB (+0.76 kB) |

No new warning.

## 6. Consolidated browser checklist (CAL-2 … CAL-6 and CAL-FIX)

Run it on a doctor with rules, a lunch break, one closed exception, requests and a follow-up, once G4-2b and G4-3 are live.

**Week**
1. Week: each header shows the weekday once (« lun. 9 »); today's column is tinted; there is no grey note under the grid; there is one scrollbar (the page's) and the header stays on top while scrolling.
2. The lunch break is one grey « Pause déjeuner » block with no striped sliver beside it. A closed slot is striped with « Rouvrir »: it asks first, then the slot reopens.
3. Every card fills its column (30-minute ones too); only two appointments at the same time share it. States: À venir (blue), Suivi à venir (violet), Demande (dashed amber), En attente du patient (dashed blue), Terminé, Absent, Annulé (struck through).
4. A confirmed appointment that ended earlier today and was never started: muted card with « Non clôturé ». Check the same in the day row, the month preview, search and the side panel; never « À venir ».
5. Click a past slot or one outside hours: a small dark toast at the bottom says why, the grid does not move, and it disappears after about 4 s.

**Day**

6. Day (press J): the network tab shows exactly one each of `scheduled-care`, `calendar-summary?from=D&to=D` and `day-slots?date=D`. Check the header counts and level chip, the timeline, and the red marker only today.
7. Day rows: « Démarrer » only on the next appointment; « Accepter » / « Refuser » on a request; free rows merge neighbouring slots; « + Ajouter » opens the booking drawer on that slot.
8. Closed days: a Sunday shows « Journée fermée » and « Prolonger la journée ». A day closed by an exception shows the same message in the day view, and « Congé » in the month, with no timeline.

**Month**

9. Month (press M): one `calendar-summary` call from the Monday before the 1st to the Sunday after the last day. Colours and bars match `level` / `loadPercent`; closed days read « Fermé » or « Congé ».
10. Hover a day: after a moment the card opens, with one `scheduled-care` call for that day only. « Ouvrir la journée », « + Rendez-vous » and « ⋯ » open the right forms.
11. Keyboard in the month: arrows move the focus, Espace opens or closes the card, Échap closes it.

**Toolbar and side panel**

12. Toolbar: the date picker goes to a date; search (2+ letters) dims other cards and lists results with their state; it is greyed in the month. « Filtres » hides a state.
13. Shortcuts (? opens the list): T, J, S, M, ← →, N, /, G, D, Échap. With « Raccourcis clavier activés » off, single keys do nothing. No key accepts, refuses, cancels or starts.
14. Side panel: Démarrer, Voir le dossier, Appeler (only with a phone number), Annuler (a motif is required). A request shows Accepter / Proposer un autre horaire / Refuser.

**Mode discret**

15. Mode discret: initials on cards, rows, the month card, search, the panel and the aside; the motif and phone read « Masqué (mode discret) ». In DevTools → Elements, search the grid for a patient's full name: no match.
16. Click the Mode discret switch with the mouse, then press an arrow key: no heavy focus ring on the switch. Tab to it with the keyboard: the ring shows.
17. Turn Mode discret on and switch shortcuts off, log out, log back in: both are still set.

**Time zone**

18. DevTools → Sensors → time zone `America/New_York`, then `Asia/Tokyo`: the same days, the same « now » line and the same times as in Tunis, in week, day and month.

**Errors**

19. Block each endpoint in turn (DevTools request blocking). Month: « Impossible de charger le mois. » + « Réessayer ». Day: an inline error for that source only. A 400 shows « La période demandée n'est pas valide. » / « La date demandée n'est pas valide. ».

## 7. Path to deliver G-3

| Step | Status | Missing |
|---|---|---|
| CAL-1 … CAL-6, CAL-T | built, tested against the contract fixtures | browser pass |
| CAL-FIX (this report) | done: 14 of 15 fixes applied, fix 12 reverted by decision; fix 13 documented, not removed | browser pass (checklist above) |
| Backend G4-2b / G4-3 | live, contract v2 confirmed (section 2) | — |
| Browser verification | **remaining** | the 19 lines above on a running stack, in particular fixes 2, 4 and 7, which jsdom cannot check |
| Global popover styles | parked | when a second screen needs nz-popover: re-add the import together with an initial-budget decision |
| Test builder | parked | `isolate: true` (or another runner setup) to remove the fix 13 workarounds; outside `calendar/` |
| Initial bundle | handled separately | 993.66 kB against the 750 kB warning; the 1 MB error budget has about 6 kB of room |
| Parked backend items | parked | `practicePatientId` in the agenda item (direct « Voir le dossier »), Déplacer / Message / Marquer absent, a create card with type and duration |

G-3's « Done when » for the calendar page is met in code: ranked fix list, approved design, UI-only prompts, backend needs flagged and parked. It is not yet confirmed in a browser.
