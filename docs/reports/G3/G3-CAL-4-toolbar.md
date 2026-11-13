# G3-CAL-4 — Calendar toolbar

Scope: UI only, `src/app/features/doctor/calendar/`. No backend, no git.

## 1. Plan findings

- **Old toolbar**: a block inside `calendar-view.html` with the Jour/Semaine/Mois segmented control, prev/next, today, a period tag, and «Nouveau rendez-vous» in the page header. No search, filters, picker, switch or shortcuts.
- **Day-summary count bug (fixed)**: the «N rendez-vous» line counted cancelled appointments and, while a new period was loading, still counted the previous period's data. It now uses `countAppointmentsOfDay(items, dayKey)` (appointments only, status ≠ CANCELLED, Tunis day key equal to the visible day). It returns 0 for an unknown day.
- **`oc-date-field`** was read: its date ↔ calendar-date conversion helpers are safe for calendar dates, so the toolbar reuses `dateValueToUiDate` / `uiDateToDateValue`. The component itself renders an input-like field, so it is not used. The picker is `nz-date-picker nzInline` inside an own popover.

## 2. What was built

Toolbar order: Jour/Semaine/Mois · ‹ › · period button «Choisir une date» ▾ · Aujourd'hui · spacer · search (`/` hint) · Filtres · Mode discret switch · Nouveau rendez-vous (`N` hint) · «Raccourcis clavier» button.

- **Date picker**: picking a date calls `gotoDate` for the Tunis day, via `calendar-time.ts`. The week range is correct in any runner TZ.
- **Search** (loaded period only): ≥2 characters, case- and accent-insensitive. Results show time, day, name and status chip. Non-matching cards are dimmed (opacity .35). A chosen result scrolls to the card and opens the side panel. Empty state «Aucun résultat dans cette période». Esc clears. Mode discret shows initials only in results (the name is still matched).
- **Filtres**: 9 state checkboxes, all on by default. A badge shows the count of hidden states, with «Réinitialiser». Not persisted. Hidden states are hidden on the grid, not deleted.
- **Mode discret**: `role="switch"` with `aria-checked`, bound to the CAL-1 preferences store.
- **Shortcuts**: T J S M ← → N / G D Échap ? Entrée, as specified. No shortcut for Accepter/Refuser/Annuler/Démarrer/Déplacer/Marquer absent.
  - Ignored in input/textarea/select/contenteditable, with Ctrl/Meta/Alt, and while a dialog or drawer is open (except Échap).
  - The listener is added by the page and removed on destroy.
  - Entrée on a button/link/switch keeps its native meaning.
- **Shortcuts window**: `role="dialog"`, `aria-modal`, focus trapped, focus returns to the opener. It has a two-column list, the note about actions without a shortcut, and a «Raccourcis clavier activés» switch. The switch is stored in the CAL-1 store under `oc.calendar.shortcuts` (default on). When off, every single-key shortcut is disabled and `?` works only via the button.

## 3. Files changed (`calendar/`)

New: `calendar-search.ts`, `calendar-filters.ts`, `calendar-shortcuts.ts`, `calendar-toolbar.ts`, `calendar-toolbar.scss`, plus specs `calendar-search.spec.ts`, `calendar-filters.spec.ts`, `calendar-shortcuts.spec.ts`.
Changed: `calendar-preferences.store.ts`, `calendar-view.models.ts`, `calendar-view.ts`, `calendar-view.html`, `calendar-week.scss` (`.oc-event--dim`), `calendar-event.adapter.ts` (`countAppointmentsOfDay`), `calendar-page.ts`, and specs `calendar-page.spec.ts`, `calendar-preferences.store.spec.ts`, `calendar-event.adapter.spec.ts`.

## 4. Tests

- Calendar specs: 19 files, **441 tests** pass (330 before CAL-4). No pre-existing assertion had to change. The page spec's mock `calendarApi` gained `gotoDate`.
- New coverage: search, filters per state, every shortcut and the ignored cases, shortcuts disabled, no patient-impacting shortcut, listener removal on destroy, shortcuts window focus/trap/return, date picker (Tunis week), day-count regression (23:30 UTC boundary, cancelled, stale period), store persistence.
- **Forced time zones** (CAL-T method, zone verified by a temporary probe spec, since deleted): America/New_York, Asia/Tokyo, UTC → all pass (442 including the probe).
- `tsc --noEmit -p tsconfig.app.json`: clean.
- Production build: OK. Static-demo build: OK.

| Budget | CAL-T | CAL-4 |
|---|---|---|
| Initial bundle (production) | 993.18 kB, over by 243.18 kB | 993.18 kB, over by 243.18 kB (unchanged) |
| waiting-room static-demo scss | over by 955 bytes | over by 955 bytes (unchanged) |
| Calendar lazy chunk (production) | 449.38 kB | 472.98 kB (+23.6 kB) |
| Static-demo build | — | no budget warnings; calendar chunk 394.93 kB |

No new warnings.

## 5. Parked / not verified

- Nothing has been seen in a browser; the checklist below covers it.
- The popovers use own CSS. The Less theme has no popover or popconfirm styles and was not edited.
- `rows`, `note` and `minSearch` in the toolbar are getters because field initializers read `undefined` in the page-spec context. This is a workaround whose root cause was not found.
- The shortcuts preference is not cleared at logout (it holds no patient data). Mode discret is cleared.
- Esc closes the side panel through nz-drawer's own handling; the page only closes toolbar popovers and the dialog.
- The static-demo build shares `CalendarView`, so it gets the toolbar too.
- Known visual bugs, not fixed: the weekday is shown twice in the week header; a striped sliver sits beside the lunch break; the permanent footer note.

## 6. Open questions

- Should the shortcuts preference be cleared at logout, like Mode discret?
- Should search also cover the previous and next period? Today it covers only the loaded period, as briefed.

## 7. Path to deliver G-3 (calendar)

Done: CAL-1 presentation, CAL-2 week, CAL-3 requests, CAL-T time zone, CAL-4 toolbar.

Remaining:
1. **CAL-5 — month view**: the month grid with per-day density and chips, and the month shortcuts (arrows/Space), which were left out of CAL-4. It needs the CAL-1 presentation, the CAL-4 search/filter/dimming hooks (month cells must honour hidden states and dimming) and the Tunis day keys.
2. **CAL-6 — day view**: the day column with the day summary and the same card states. It reuses the week card template and `countAppointmentsOfDay`. Earlier briefs left the CAL-6 scope undefined, so the CTO should confirm it is the day view.
3. **Final fix pass**: the three visual bugs above, a decision on the budget warnings (initial bundle +243 kB, waiting-room scss +955 bytes), and a browser pass of the whole calendar.

Each step ends with all calendar specs, tsc, production and static-demo builds, and the three forced-zone runs.
