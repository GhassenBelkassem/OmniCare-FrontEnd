# G3-CAL-6 — Day view (compact list)

Scope: UI only, `src/app/features/doctor/calendar/` (plus `app.icons.ts`, see section 5). No backend change, no git command of any kind. Built against the agreed contracts; the day-slots endpoint (G4-3) and calendar-summary (G4-2b) are not live yet. **Nothing was seen in a browser.**

## 1. What was built

The day is now a custom component (decision D-10). FullCalendar still serves the Semaine view; in the Jour view it stays mounted but hidden and only drives navigation (‹ ›, Aujourd'hui, date picker, title), exactly as for the month. It is given no events there.

| Brief item | Where |
|---|---|
| Header line « 6 / 16 créneaux réservés » + level chip (Disponible / Chargé / Complet / Fermé, CAL-5 colours) + « 2 demandes en attente » chip | `calendar-day.html`, `slotsText` / `levelChipLabel` from `calendar-month.model.ts` |
| Timeline bar 14 px: working segments, break (grey hatch), closed windows, booked appointments coloured by CAL-1 state, red now marker, hour labels under it | `buildDayTimeline` in `calendar-day.model.ts` |
| Rows in time order, 64 px time column; appointment and request rows (avatar, name, type icon + cabinet line, CAL-1 status chip, « ⋯ », row click opens the CAL-3 panel) | `buildDayRows`, `calendar-day.html` |
| « Démarrer » on the next CONFIRMED appointment that can start | `nextStartableId`; command = the panel's `startScheduledAppointment` |
| « Accepter » / « Refuser » on a « Demande » | `acceptFromRow` / `declineFromRow` in the page |
| Free row: consecutive FREE slots merged, « Libre · 11:30 – 12:30 », « + Ajouter » → booking drawer on that slot; PAST free time not shown | `mergeFreeSlots`, `addOnSlot` |
| Break row (cup icon, « Pause déjeuner », « 12:30 – 14:00 · 1 h 30 », « Modifier » → `/doctor/settings?tab=schedule`) | model + `CONFIGURE_SCHEDULE` |
| Closed windows: striped « Fermé · 16:00 – 17:00 » + « Rouvrir » (same confirm flow as CAL-2) | model + `REOPEN_EXCEPTION` |
| Now marker (red line + dot between rows, today only, `aria-label` « Maintenant, 10:20 ») | model (`NowRow`), refreshed once a minute |
| Closed day: « Journée fermée » + « Prolonger la journée » (existing exception form, pre-filled) | `DAY_EXTEND` → `openDayMenuCommand(day, 'EXTEND')` |
| Aside: « Patient suivant · dans N min » dark card `#0D473D`, « Voir le dossier » (practice patients only) and the « Résumé » card | `nextPatient`, `summaryLines` |
| CAL-4: search dims non-matching rows, filters hide rows and timeline bars, Mode discret initials everywhere (rows, aside, timeline aria), shortcuts | page + `calendar-day.ts` |
| States: skeleton rows, per-source errors with « Réessayer », « Aucun rendez-vous ce jour » | `calendar-day.html` |
| Accessibility: rows are real `<button>`s with `eventAriaLabel`, 2 px `#1FBF9A` focus ring, `prefers-reduced-motion` | `calendar-day.ts/.html/.scss` |

### Files

New: `calendar-day-slots.models.ts`, `calendar-day-slots.service.ts`, `calendar-day.model.ts`, `calendar-day.ts`, `calendar-day.html`, `calendar-day.scss`, `testing/day-slots.fixture.json`, `testing/day-slots.testing.ts`.
New specs: `calendar-day-slots.service.spec.ts` (4), `calendar-day.model.spec.ts` (35), `calendar-day.spec.ts` (48), `calendar-day-page.spec.ts` (41).
Changed: `calendar-page.ts`, `calendar-page.html`, `calendar-view.ts`, `calendar-view.html`, `calendar-view.models.ts`, `calendar-summary.service.ts` (a day-wording error helper), `app.icons.ts` (one icon).
Not touched: `shared/ui/appointment-status.ts`, QuickBookingDrawer, the Requests page, the command center, the secretary agenda, the static-demo files (the static demo does not pass the new `day` input, so it keeps FullCalendar's day grid). The known visual bugs of the final fix list are not fixed.

## 2. Data: three sources for one Tunis day D

| # | Call | Where it is made |
|---|---|---|
| 1 | `GET /api/v1/doctor/scheduled-care?from&to` for D | the page's existing range load (`from` = D 00:00 Tunis, `to` = D+1 00:00 Tunis, as instants) |
| 2 | `GET …/calendar-summary?from=D&to=D` | `CalendarSummaryService` (CAL-5), result read for day D |
| 3 | `GET …/day-slots?date=D` | new `CalendarDaySlotsService`, typed exactly as the contract |

Contract fixture: `testing/day-slots.fixture.json` (Monday 2026-11-16, 15 slots: 5 TAKEN, 3 PAST, 7 FREE, merging into 3 free rows). The break and the closed window are not listed, as the contract says.

- **Reloads.** Both new sources reload (without a skeleton) after a quick booking, a saved exception, « Rouvrir », and when the scheduled-care projection changes. « Réessayer » reloads only the source that failed. Leaving and re-entering the Jour view asks again.
- **While FullCalendar has not yet reported the Jour view**, every source shows as loading (the page never shows the previous period's first day).
- **Errors.** day-slots: 400 → « La date demandée n'est pas valide. », anything else → « Impossible de charger les créneaux libres. » shown **inline** as one banner with « Réessayer »; the appointments, the break, the closed windows and the header still render. Summary: 400 → « La période demandée n'est pas valide. », anything else → « Impossible de charger le résumé de la journée. » (CAL-5's wording says « mois », so a day-specific message was added). Appointments: « Impossible de charger les rendez-vous. » + « Réessayer », shown once, in the day view (the generic page banner is replaced there).
- **No recomputation.** The header numbers, level, pending count and the « Résumé » counts are shown as received (tests give the page numbers that disagree with the rows and check they are shown as sent). Slot states are never reconsidered (a slot the API calls FREE under an appointment is shown as free; TAKEN and PAST are never shown as free). The only arithmetic is the one CAL-5 already uses to split a status count into its follow-up and non-follow-up lines (`count − followUpCount`, clamped at 0), the minute count of « dans N min », and the 1 h 30 length of a break.

## 3. Row actions

| Action | What it does | Same as the CAL-3 panel? |
|---|---|---|
| Row click, « ⋯ » | opens the side panel on that appointment or request | yes (`openWith` / `openRequest`) |
| « Démarrer » | `ActiveConsultationStore.startScheduledAppointment(id, version)`, then opens the consultation | same command and same condition as the panel (no other consultation running); the item's `version` is used as the command center does |
| « Accepter » | opens the request in the facade, then calls `ScheduledCareFacade.acceptRequest()` once it is loaded, then closes it | same facade call; the facade only works on the request it has open, so one extra existing request-detail load comes first |
| « Refuser » | opens the panel on its two-step refusal (reason, then « Confirmer le refus »); nothing is refused by the row | yes |
| « + Ajouter » | opens the booking drawer preselected on the start of that free row | existing drawer |
| « Rouvrir » | confirmation (same wording as CAL-2), then the existing delete-exception flow | yes |
| « Modifier » (break) | `/doctor/settings?tab=schedule` | existing route |
| « Prolonger la journée » | existing exception form, pre-filled (exceptional opening, from the day's last end, +1 h) | CAL-5 flow |
| « Voir le dossier » (aside) | opens the panel on that appointment, whose footer has the record link | see section 6 |

**« Démarrer » rule (decision to confirm):** today only; the first CONFIRMED appointment in time order whose end is not yet past; only while no other consultation runs. It is never offered on a request, a proposed, in-progress or cancelled appointment, nor on another day.

**Keyboard.** ← → go to the previous / next day (CAL-4 rule, off with the switch). Rows are real buttons, so Entrée on a focused row opens it natively; the page adds nothing. No key accepts, refuses, starts, cancels, moves or marks anything (tested with A, R, C, X, Entrée, Espace, Suppr, Retour).

## 4. Tests

| Run | Result |
|---|---|
| Calendar + scheduled-care + routes + appointment-status specs **before** CAL-6 (same selection, today) | 23 files, 523 tests, all pass |
| Same selection after CAL-6 | **27 files, 651 tests, all pass** (+4 files, +128 tests: 4 service + 35 model + 48 component + 41 page) |
| Forced zones America/New_York, Asia/Tokyo, UTC (CAL-T method, probe spec asserting the zone offset, deleted afterwards) | **28 files, 652 tests (651 + probe), all pass in each** |
| `tsc --noEmit -p tsconfig.app.json` | clean |
| Production build (strict templates) | OK |
| Static-demo build | OK |
| `npm run check:ui-boundaries` | passes (all four checks) |

No existing assertion had to change.

Coverage highlights: the service over `HttpTestingController` (exact URL and `date` param, answer passed through untouched, 400 vs other); **the page over real HTTP: exactly one request each for scheduled-care (right `from`/`to` instants), calendar-summary (`from=D&to=D`) and day-slots (`date=D`), nothing else**, and a 404 day-slots answer showing the inline error with the rest of the day; free-slot merging (gaps, TAKEN/PAST never free, unordered input); no recomputation; row order; « Démarrer » only on the eligible appointment (and not while another consultation runs, not on another day); « Accepter » calls `acceptRequest` once and only after the request is loaded; « Refuser » opens the panel step and refuses nothing; break, closed window + « Rouvrir » (confirm first, then `deleteException`, then reload), closed day + « Prolonger la journée » pre-filled form; now marker only today; skeleton, per-source errors and retries; empty day; Mode discret (rows, aside, timeline aria); search dimming and result scrolling; filters; shortcuts including off with the switch; a 23:30 Tunis appointment on the right day and a next-Tunis-day item not shown.

### Budgets vs CAL-5

| Budget | CAL-5 | CAL-6 |
|---|---|---|
| Initial bundle (production) | 993.18 kB, over by 243.18 kB | 993.66 kB, over by 243.66 kB (+0.48 kB: one icon) |
| waiting-room static-demo scss | over by 955 bytes | over by 955 bytes (unchanged) |
| Calendar lazy chunk (production) | 514.52 kB | 550.47 kB (**+35.95 kB**) |
| Static-demo calendar chunk | 435.07 kB | 466.48 kB (+31.4 kB) |

No new warnings.

## 5. Things worth knowing

- **A missing icon fixed.** The « Rouvrir » popconfirm (CAL-2, and now the day view) draws `warning` with the `fill` theme, and only `WarningOutline` was registered, so opening it threw `IconNotFoundError: warning-fill` (seen in the tests). `WarningFill` is now registered in `app.icons.ts`. This is the one change outside the calendar folder the brief allowed.
- **Test bundler quirk** (CAL-5 note): texts and classes in `calendar-day.ts` are read through methods, not copied from module constants into fields.
- The old Jour summary strip (CAL-4's `daySummary`) is no longer shown in the production day view (the header line replaces it); it is still used by the static demo.
- The closed-day message does not hide appointments that exist on that day (they are still listed under it): an appointment must never disappear from the agenda.
- The aside « Résumé » and the header chips follow the API and are not affected by « Filtres » (the workload is objective); the rows and the timeline bars are.

## 6. Parked / not verified / open questions

- **Nothing seen in a browser.** In particular: the 64 px / 300 px layout at narrow widths, the popconfirm over the striped row, the red marker alignment between rows, FullCalendar re-measuring itself when the doctor goes back to the week, and the dark card contrast.
- **Until G4-3 is live** the free-time rows show « Impossible de charger les créneaux libres. » with « Réessayer » (expected). Until G4-2b is live the header shows its inline error.
- **« Voir le dossier » cannot link directly.** The agenda item carries no `practicePatientId` (only the appointment detail does), so the button opens the CAL-3 panel on that appointment, whose footer has the record link. A direct link needs that id in the agenda item (backend, parked).
- **« Démarrer » uses the agenda item's `version`** (as the command center does); the panel uses the version of the loaded detail. I assumed they are the same aggregate version.
- **« Accepter » costs one extra existing call** (the request detail the facade needs) before the accept; it is not one of the three day sources.
- **« Rouvrir » only shows when the closing exception is among the loaded exceptions** (matched by its Tunis start and end). Closed windows come from the summary, which has no exception id.
- A request without an exact time is not a row (it is only counted in the « demandes en attente » chip).
- The canvas create card with type and duration is **not built** (parked: no backend).
- The static demo still uses FullCalendar's day grid.
- Open questions: should « Démarrer » be offered earlier or later than « not yet ended »? Should the « Résumé » card follow the filters?

## 7. Browser checklist (once G4-2b and G4-3 are live)

1. Open `/doctor/calendar`, press **J** (or « Jour »). The network tab shows exactly one `scheduled-care?from&to` (D 00:00 to D+1 00:00 Tunis), one `calendar-summary?from=D&to=D` and one `day-slots?date=D`. Press → : three calls for the next day, again.
2. Header: « n / m créneaux réservés », the level chip and « n demandes en attente » match the summary response. Timeline: segments, grey break, booked bars coloured by state, hour labels, red marker only today.
3. List: one row per appointment/request, time column, status chips (À venir, Suivi à venir, Terminé, Demande…). Free rows merge neighbouring slots; no free row for past or taken time; the break row and a closed window row appear.
4. Row actions: « Démarrer » only on the next appointment (opens the consultation); « Accepter » on a request (check the request is accepted once); « Refuser » opens the panel on the reason step; « + Ajouter » opens the booking drawer on that slot; « Rouvrir » asks first.
5. Closed day (pick a Sunday): « Journée fermée » and « Prolonger la journée » opens the exception form pre-filled. Aside: « Patient suivant · dans N min », « Résumé » counts and « Créneaux libres » = number of FREE slots.
6. CAL-4 and states: Mode discret (initials in rows, aside, and the timeline reading), search dims the other rows, « Filtres » hides rows, ← → change day, the shortcuts switch off disables them; block each endpoint in turn: the inline error and « Réessayer » appear for that source only. Check with DevTools timezone `America/New_York`: same day, same « now ».

## 8. Path to deliver G-3 (calendar)

Done: CAL-1 presentation, CAL-2 week, CAL-3 requests, CAL-T time zone, CAL-4 toolbar, CAL-5 month, **CAL-6 day** (built and tested against the contract fixtures).

Remaining:
1. **Connect and verify against the real endpoints** (G4-2b calendar-summary and G4-3 day-slots): run the checklists of CAL-5 and CAL-6 in a browser; confirm the contracts on real answers (null `loadPercent`, `extraWindows`, `awaitingPatientRequestCount`, day-slots on a day with an extra window or an exception); confirm the `version` question and the « Démarrer » rule.
2. **Final fix pass**: the three known visual bugs (weekday shown twice in the week header, striped sliver beside the lunch break, permanent footer note), the budget warnings (initial bundle +243.66 kB, waiting-room scss +955 bytes), the open questions of CAL-5 and CAL-6, and a browser pass of the whole calendar.
3. Parked backend items that would improve the day view: `practicePatientId` in the agenda item (direct « Voir le dossier »), a create card with type and duration.
