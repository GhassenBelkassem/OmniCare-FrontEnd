# G3-CAL-1 — Calendar presentation layer (pure, not wired)

No existing file was modified. Nothing is imported by any screen. No git command, no app run, no package added.

## 1. Files created (all under `src/app/features/doctor/calendar/`)
| File | Purpose |
|---|---|
| `calendar-presentation.ts` / `.spec.ts` | `presentCalendarItem(item, opts)` → `{ state, labelFr, dashed, struck, typeIcon, cssClass }`; also exports `CalendarState`, `CALENDAR_STATES` |
| `calendar-status-tokens.scss` | `--oc-cal-bg/border/bar/fg/chip` per state, scoped under `.omnicare-calendar .oc-cal-state--<state>`; break block `.oc-cal-break`. Not imported anywhere |
| `calendar-privacy.ts` / `.spec.ts` | `patientLabel(name, discreet)`, `eventAriaLabel(time, name, stateLabel, discreet)` |
| `calendar-preferences.store.ts` / `.spec.ts` | root signal store `CalendarPreferencesStore` (`discreet`, `toggle()`), localStorage key `oc.calendar.discreet` |

## 2. Mapping (as decided by the CTO)
| resourceType | status | state | labelFr | dashed | struck |
|---|---|---|---|---|---|
| BOOKING_REQUEST | PENDING_DOCTOR | request | Demande | yes | no |
| BOOKING_REQUEST | PENDING_PATIENT_TIME_CONFIRMATION | waitingPatient | En attente du patient | yes | no |
| APPOINTMENT | PROPOSED | waitingPatient | En attente du patient | yes | no |
| APPOINTMENT | CONFIRMED | upcoming (followUpUpcoming if `isFollowUp`) | À venir / Suivi à venir | no | no |
| APPOINTMENT | IN_PROGRESS | inProgress | En cours | no | no |
| APPOINTMENT | COMPLETED | done (followUpDone if `isFollowUp`) | Terminé / Suivi terminé | no | no |
| APPOINTMENT | NO_SHOW | absent | Absent | no | no |
| APPOINTMENT | CANCELLED | cancelled | Annulé | no | yes |
| anything else | — | neutral | Rendez-vous | no | no |

- `typeIcon`: `subject.subjectType === 'PRACTICE_PATIENT'` → `external`, else `cabinet`. `cssClass` = `oc-cal-state--<state>`.
- `isFollowUp` defaults to false, is never derived, and is ignored for states without a follow-up variant.
- Decided fallbacks (not in the brief, flagged below): closed request statuses (FULFILLED, CANCELLED_*, EXPIRED), a request status on an APPOINTMENT (or the reverse), and unknown resource types all map to `neutral`. The agenda SQL never returns closed request statuses (`ScheduledCareReadRepository.java:149-150`), so this is defensive.
- Privacy: initials = first letter (`\p{L}\p{N}`) of the first two words, upper-cased, e.g. « K. M. »; empty/null → « Patient ». Aria label: « Rendez-vous à 09:30 avec Test Patient. Statut : À venir. » and, discreet, « Rendez-vous à 09:30. Statut : À venir. » (no name, no initials).
- Store: default false; only `'true'` restores as on; every storage access wrapped in try/catch; works with storage blocked or undefined.
- **Sensitive-state cleanup:** registered with `SensitiveStateRegistry` (`core/auth/sensitive-state.registry.ts`) from inside the store, which needed no change outside the folder. On logout the preference resets to off and the key is removed (see open question 3).

## 3. Test results
- `npx tsc --noEmit -p tsconfig.app.json` → exit 0.
- SCSS compiled with `npx sass` → exit 0 (all 10 states + break block emit correctly).
- `npx ng test --watch=false` (full suite) → **does not build**, for a reason unrelated to this task: `src/app/features/doctor/secretary/team/team-page.spec.ts` (11 errors, `Property 'submitInvite' does not exist on type 'TeamPage'`, lines 358-531). That is another chat's in-flight work; I did not touch it.
- Scoped run (temporary tsconfig placed in the calendar folder, deleted afterwards; `--include` for `calendar/*.spec.ts`, `scheduled-care/*.spec.ts`, `doctor.routes.spec.ts`, `shared/ui/appointment-status.spec.ts`): **14 test files passed, 219 tests passed, 0 failed.** This includes the existing calendar, facade and status specs and the 3 new spec files.
- No `console.*`; test names use « Test Patient » only.

## 4. Time zone investigation (nothing implemented)
**Goal:** grid shows Africa/Tunis whatever the browser zone.

**Does a named `timeZone` need a plugin in FullCalendar 7.1.1? No.**
- The option exists as a string, default `'local'` (`node_modules/fullcalendar/chunks/6b921645.js:541,816`) and is passed to `DateEnv` (`chunks/e1b02ccd.js:984,1115-1119`).
- `DateEnv` resolves named IANA zones with `temporal-polyfill` (`node_modules/@full-ui/headless-calendar/index.js:1,836,847,857`: `InstantFns.toZonedDateTimeISO(…, this.timeZone)`, `PlainDateTimeFns.toZonedDateTime(…, this.timeZone)`).
- `temporal-polyfill` is a **peer dependency** of `fullcalendar` (`node_modules/fullcalendar/package.json`, `^1.0.1`) and is **already declared** in our `package.json:52` at `1.0.1`. So: no plugin (unlike v6's luxon/moment plugins), **no new dependency**.
- UNVERIFIED (not run): what `Date` objects the callbacks (`dateClick.date`, `datesSet.start/end`, `dayCellClass.date`) carry when a named zone is set. FC 7 uses « markers » internally (`DateEnv.timestampToMarker`, `…`). Must be checked by a test before changing the helpers below. I did not find official docs offline; the conclusion above is from the installed source.

**Browser-local date getters that would need to change** (all in files I was told not to modify):
| File:line | Code | Used for |
|---|---|---|
| `calendar-time.adapter.ts:33-37` | `Intl.DateTimeFormat('fr-FR', {hour,minute})` without `timeZone` | `formatCalendarTime/Range` (card times, tooltips, aria) |
| `:49-50` | `toLocalDateOnly(start)` / `(end-1ms)` | `exceptionFrom/exceptionToInclusive` sent to `GET …/exceptions` |
| `:179-184` | `getFullYear/getMonth/getDate` | `toLocalDateOnly` itself (also used at `calendar-page.ts:290,295,461`, `calendar-event.adapter.ts:333`) |
| `:133` | `date.getDay()` on `new Date(y,m,d)` | `fullyBlockedDateKeys` weekday (this one is consistent with `localDateFromKey`, `:186-191`; safe as pure calendar-date maths) |
| `:273-274,:287` | `getHours/getMinutes/getDay` | `isWorkingTime` (empty-slot click validation) |
| `:293-295,:305-310,:317-319,:321-322` | `Intl` formatters without `timeZone`, `getFullYear/getMonth` | `calendarPeriodTitle` (period titles) |
| `calendar-page.ts:453-461` | `new Date()`, `getHours/getMinutes`, `toLocalDateOnly(now)` | default values of the exception form |
| `calendar-page.ts:290,295` | `toLocalDateOnly(info.date)` | day-cell / lane exception classes |
| `calendar-event.adapter.ts:331-333` | `toLocalDateOnly(start)` vs `(now)` | « Consultation non clôturée » |
| `calendar-time.adapter.ts:164-167` | wall-clock `${date}T${time}:00` strings (no zone) | exception background events — correct once FC runs in Tunis zone |
| `calendar-page.ts:391` | `start.getTime() < Date.now()` | instant comparison, zone-independent |

Already correct: `quick-booking-drawer.ts:1086-1087` pins dates to `Africa/Tunis` (`instantDateKey(…, SCHEDULING_TIMEZONE)`); the detail panel formats with the appointment's zone.

**Smallest fix proposed:**
1. `calendar-page.ts` `calendarOptions`: add `timeZone: 'Africa/Tunis'` (import the constant from `scheduled-care/scheduled-care-time.ts:1`).
2. `calendar-time.adapter.ts`: add `timeZone: 'Africa/Tunis'` to the four `Intl.DateTimeFormat`s; reimplement `toLocalDateOnly` (rename to a Tunis-date helper), `isWorkingTime` and the title getters with `Intl.DateTimeFormat(…, { timeZone }).formatToParts` (no Temporal needed, or use `temporal-polyfill` already present).
3. `calendar-page.ts:453-461` and `calendar-event.adapter.ts:331-333`: use the same Tunis helpers.
4. Specs: run the calendar specs with `TZ=America/New_York` and `TZ=Asia/Tokyo` to prove zone independence.
- Files: 3 (`calendar-page.ts`, `calendar-time.adapter.ts`, `calendar-event.adapter.ts`) + specs. New dependency: **no**.
- Depends on the FC callback-`Date` semantics (UNVERIFIED above); do that check first in CAL-2.

## 5. Open questions (not decided)
1. Closed request statuses and cross-family combinations map to `neutral « Rendez-vous »`. Confirm, or should they be hidden?
2. `PROPOSED` (follow-up offered to an OmniCare patient) and `PENDING_PATIENT_TIME_CONFIRMATION` share « En attente du patient ». Confirmed as intended?
3. Should « Mode discret » reset on logout (current behaviour, because the store is registered in the sensitive-state cleanup) or persist per browser? Resetting to off is the less privacy-protective direction.
4. Aria label wording (« Rendez-vous à HH:MM avec … Statut : … ») — accept, or give the exact sentence?
5. Hex values in the SCSS are lowercase; the brief gave uppercase. Same colours; say if you want uppercase.
6. When CAL-2 changes the calendar to `timeZone: 'Africa/Tunis'`, who owns the FC callback-`Date` check and the `TZ=` test runs?
7. The full `ng test` is red because of `team-page.spec.ts` (another chat). CAL-2 verification will need that fixed or the same scoped command.

## Chat summary
Four pure modules + SCSS created, none wired. `tsc` clean; scoped tests 219/219 green (full suite blocked by someone else's `team-page.spec.ts`). Time zone: FullCalendar 7.1.1 supports `timeZone: 'Africa/Tunis'` natively via `temporal-polyfill` (already installed), no plugin, no new dependency; ~10 browser-local getters in 3 files must move to Tunis helpers.

## Path to deliver G-3
1. **CAL-2:** import `calendar-status-tokens.scss` into the calendar styles; use `presentCalendarItem` and the privacy helpers in `calendar-event.adapter.ts` / `calendar-view`; stop filtering `BOOKING_REQUEST` rows (`calendar-page.ts:636-640`); add a discreet toggle bound to `CalendarPreferencesStore`.
2. **CAL-3:** time zone fix (section 4) with `TZ=` tests, after the FC callback check.
3. **CAL-4:** week view restyle (status cards, break block, striped closed slots + « Rouvrir »), month and day components.
4. **G-4 (backend, parked):** follow-up flag, per-day summary, doctor free slots; CAL screens switch from client approximations to those fields.
5. Re-run `npx tsc --noEmit -p tsconfig.app.json`, the scoped specs, then `npx ng test --watch=false` and `npx ng build --configuration production` once `team-page.spec.ts` compiles.
