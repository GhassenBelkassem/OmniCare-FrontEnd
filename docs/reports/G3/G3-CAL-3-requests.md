# G3-CAL-3 — Requests, follow-ups and side-panel actions

UI only, all inside `src/app/features/doctor/calendar/` (no other file changed, not even `app.icons.ts`). No backend, no new API call, no service or facade edited. **No git command of any kind was run.** The app was **not run**: nothing below was checked by eye.

## 1. Plan findings (read-only, before coding)
| Question | Finding |
|---|---|
| Where requests were fetched then dropped | `calendar-page.ts` `loadVisibleRange`: `getDoctorScheduledCare(...)` returns appointments **and** pending requests, then `.filter(item => item.resourceType === 'APPOINTMENT')` (was ~`:710`) discarded the requests |
| What a request carries | `DoctorScheduledCareItem` (`scheduled-care.models.ts:118-137`): `resourceType`, `requestId`, `status` (`PENDING_DOCTOR` / `PENDING_PATIENT_TIME_CONFIRMATION`), `subject.displayName` and `subjectType`, `cabinet`, `start`/`end` (the requested slot, or the proposed one while waiting for the patient), `responseDeadline`, `availableActions`. **No phone, no reason.** The detail (`BookingRequest`) adds `originalRequestedSlot`, `proposedSlot`, `activeSlot`, `patientResponseDeadline` — still no phone |
| Facade used by the Requests page | `RequestsPage` → `BookingRequestDetailPanel` → `ScheduledCareFacade`: `openRequest`, `acceptRequest`, `loadProposalAvailability` + `proposeTime(slot)`, `declineRequest(reason)`, `closeRequest` (`scheduled-care.facade.ts:149-309`). Every one exists, so no action had to be hidden for lack of a method. A successful command bumps `projectionInvalidationEpoch` (`:363-369`), and the calendar page already refetches its visible range on that signal (`calendar-page.ts` constructor effect): that is the « reload the visible week » |
| `followUp` in the response | Backend G4-1 (Java + PostgreSQL integration test, G4-1-fix-2) returns `followUp` on every agenda item. The Angular HTTP layer passes the JSON through untouched (`scheduled-care-api.service.ts:23-29`), but `DoctorScheduledCareItem` has **no `followUp` field** and that file is outside `calendar/`. It is therefore read defensively (`isFollowUpItem`, below). **Not verified at runtime** against the local backend (no app run, no authenticated call) |

## 2. What was built
| File | Change |
|---|---|
| `calendar-detail-panel.ts` / `.scss` (**new**) | One calendar side panel (`app-calendar-detail-panel`, a drawer) for an appointment **or** a booking request, on the existing facade and stores |
| `calendar-event.adapter.ts` | `isFollowUpItem`; appointments now pass `isFollowUp` to the CAL-1 presentation; new `toRequestCalendarEvent`, `projectRequestEvents`, `hasExactTime`, `isUnplacedRequest` |
| `calendar-view.models.ts` | `CalendarRequestPresentationMetadata` (`kind: 'request'`), `CalendarCardMetadata`, optional `discreet` on the view model |
| `calendar-view.ts` / `.html` | request cards share the appointment card markup; names, tooltip and aria-label follow Mode discret (`displayName`, `eventAriaLabel(..., discreet)`) |
| `calendar-page.ts` / `.html` | separate `requests` signal, `requestEvents`, `unplacedRequestCount`; click on a request opens the request panel; the new panel replaces the old appointment panel in the page; view model passes `discreet`; requests count for the hidden-weekday rule |
| specs | see section 4 |

Unchanged on purpose: `calendar-presentation.ts`, `calendar-privacy.ts`, `calendar-preferences.store.ts`, `calendar-status-tokens.scss` (its values already equal the ones of this brief: « Demande » `#FFFAEB / 1.5px dashed #F5C26B / #F79009 / #B54708`, « En attente du patient » `#F5F9FF / 1.5px dashed #BFDBFE / #93C5FD / #1D4ED8`, « Suivi à venir » `#F4F3FF / #D9D6FE / #6941C6 / #5925DC`, « Suivi terminé » `#F9F8FF / #E4E0FD / #BDB4FE / #6941C6`), `calendar-week.scss`, `shared/ui/appointment-status.ts`, `QuickBookingDrawer`, the static-demo calendar, the secretary agenda, the Requests page and the `scheduled-care/` panels.

### 1. Requests on the week grid
- `PENDING_DOCTOR` → « Demande »; `PENDING_PATIENT_TIME_CONFIRMATION` and a `PROPOSED` appointment → « En attente du patient » (CAL-1 mapping, dashed). Requests are drawn at their `start`/`end` with the same card as the appointments, and keep the click → panel behaviour.
- Only the two pending statuses are drawn; a closed request (never returned by the agenda) is ignored.
- **Requests without an exact time are not placed.** A request is placed only if `start` and `end` parse and `start < end`. The others are counted in `unplacedRequestCount` (a signal, no UI). **By design the count is 0**: the agenda SQL takes the slot from `original_start_at`/`proposed_start_at`, which are `NOT NULL` with `CHECK (start < end)` (`doctor_booking_requests`, `chk_dbr_interval`). The real number on live data was **not measured** (UNVERIFIED), so « the list of unplaced requests » in this report is: none known; the code path exists and is tested.

### 2. Follow-ups
- `followUp === true` on the agenda item → `isFollowUp` into `presentCalendarItem`: CONFIRMED → « Suivi à venir », COMPLETED → « Suivi terminé ». IN_PROGRESS, NO_SHOW and CANCELLED are unchanged. Missing, `false` or a non-boolean value (`"true"`, `1`, `null`) means « not a follow-up », no crash.
- The panel shows the same follow-up chip for the clicked appointment.

### 3. Side panel
| Action | Appointment | Request | Source |
|---|---|---|---|
| Démarrer la consultation | yes (CONFIRMED, no other active consultation); « Continuer ce rendez-vous » when its own consultation is active | — | `ActiveConsultationStore.startScheduledAppointment`, same rules and route as the old panel |
| Voir le dossier | only when the appointment has a practice-patient record (`/doctor/patient/:id`) | — | existing route; no record link exists for other patients → **hidden** |
| Appeler | `tel:` link, **only when a usable phone number exists** (`practicePatient.phone`); digits kept, rest stripped | — (a request has no phone) | existing field |
| Annuler le rendez-vous | when `availableActions` has `CANCEL_APPOINTMENT`; reason required, then « Confirmer l'annulation » | — | `care.cancelAppointment` |
| Accepter | — | when `ACCEPT_REQUEST` | `care.acceptRequest` |
| Proposer un autre horaire | — | when `PROPOSE_NEW_TIME`: loads the free slots, pick one, « Envoyer la proposition » | `care.loadProposalAvailability`, `care.proposeTime` |
| Refuser | — | when `DECLINE_REQUEST`: reason required, then « Confirmer le refus » (two steps; text « Le patient sera prévenu du refus. ») | `care.declineRequest` |
| Déplacer, Message, Marquer absent | **not rendered** (a test checks the text never appears) | — | no backend yet |

After a successful command the facade bumps the invalidation epoch and the page reloads the visible week; on failure the panel stays open with the error.

### 4. Mode discret
The CAL-1 store drives it: cards (all, including requests) show initials, the tooltip shows initials, and the aria-label drops the name (`Rendez-vous à 09:30. Statut : …`). In the panel: initials in the header and avatar, « Motif de consultation » and « Téléphone » show « Masqué (mode discret) », the **phone digits are not in the page**, but « Appeler » stays. **There is no toggle in the interface yet** (CAL-5): to try it, see checklist item 5.

### 5. No keyboard shortcut
None was added. The drawer only closes with Escape (disabled while a command runs), as before. A test dispatches `a`, `r`, `c`, `d`, Enter, Space and Delete and checks that no accept / refuse / cancel / propose / start is triggered.

## 3. Decision to confirm: a calendar panel instead of editing the existing ones
The brief says « reuse the existing panel » and « UI files inside `calendar/` only ». The existing panels (`ScheduledAppointmentDetailPanel`, `BookingRequestDetailPanel`) live in `scheduled-care/`, are shared with the command center and the Requests page, and could not be given Mode discret, « Appeler » or the hidden actions without editing them. I therefore wrote one panel in `calendar/` that reuses what existed (the facade, `ActiveConsultationStore`, the time-formatting helpers, `OcAvatar` / `OcButton`) and left the old panels untouched. Consequences:
- Some logic (two-step cancel / refuse, slot selection) is duplicated from the old panels.
- The new appointment panel is shorter: it no longer shows the doctor, specialty, address, date of birth, e-mail, price, confirmation date or the request/version identifiers that the old one displayed; the design lists actions, so I kept date/time, cabinet, reason and phone.
- The old panels remain correct for the command center and Requests page.

## 4. Tests
**Existing assertions changed (2 tests + setup):**
| File | Change |
|---|---|
| `calendar-page.spec.ts` | import and type of the panel (`CalendarDetailPanel` instead of `ScheduledAppointmentDetailPanel`); the facade stub gained the request members; the test « keeps booking requests on Home/Demandes instead of rendering calendar blocks » is **replaced** by « draws pending booking requests on the grid next to the appointments » (the behaviour it asserted is the one this task changes) |
| `calendar-event.adapter.spec.ts` | « never marks an appointment as a follow-up (no data on the agenda item yet) » replaced by « treats an appointment as a normal one when the API sends no followUp » |
| unchanged and passing | the panel tests of the page (open by identity, start through the shared command and UUID route, conflicting consultation message, continue, unknown ids) pass **unchanged** against the new panel: same method names and French texts |

**New: 37 tests.** `calendar-detail-panel.spec.ts` (new file, 18 tests: action visibility for an appointment with / without phone, with / without a record, request with all / some / no actions; hidden actions never rendered; two-step cancel and refuse with required reason and rejected unknown reason; propose from the facade's slots; follow-up chip; Mode discret on an appointment and on a request; no keyboard command); `calendar-event.adapter.spec.ts` (+11: both pending statuses → states, dashed, class, metadata; PROPOSED; closed requests ignored; unplaced requests counted; follow-up → both violet states; IN_PROGRESS / NO_SHOW / CANCELLED unchanged; missing / false / non-boolean `followUp`); `calendar-page.spec.ts` (+8: click opens the request or appointment panel, unknown request by id, hook class, unplaced count, closed weekday kept visible when it has a request, follow-up states from the agenda, Mode discret reaching the cards and aria labels).

**Results**
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| Calendar specs (temporary tsconfig in the calendar folder, deleted afterwards; `team-page.spec.ts` of another chat not touched) | **15 files, 291 tests, 0 failed** (254 before) |
| `npx ng build --configuration production` | **exit 0**, 76 s. Warnings: initial bundle 993.18 kB over the 750 kB budget (by 243.18 kB) and `waiting-room-page.static-demo.scss` 955 bytes over 18 kB. **Same two warnings with identical numbers as in the CAL-2 build**, so they predate this task. The calendar lazy chunk grew from 426 kB to 448 kB |
| `npx ng build --configuration static-demo` (extra, because it shares `CalendarView`) | exit 0 |
| Full `npx ng test --watch=false` | not run: blocked by `secretary/team/team-page.spec.ts` (other chat) |

## 5. Hidden or parked
- **Hidden until the backend exists:** Déplacer, Message, Marquer absent.
- **Hidden, no existing method or data:** « Voir le dossier » for a patient without a practice-patient record; « Appeler » when no phone exists (OmniCare patients and requests: the model has no phone for them).
- **Parked:** the number of unplaced requests on live data (0 by design, not measured); showing the unplaced count in the interface (not requested).

## 6. Noticed but not touched (for the final fix pass)
- The weekday may be shown twice in the week header: `dayHeaderFormat` asks for « weekday + day » while the header template also prints the weekday and the day number (`calendar-page.ts` options vs `calendar-view.html` `#dayHeaderContent`). Hypothesis from the code, not seen.
- The striped sliver beside the lunch break probably comes from the hatched « non-business » gap of the weekly hours showing next to the new break block (`demo-calendar-non-business` vs `.oc-cal-break`). Hypothesis, not seen.
- FullCalendar still receives the full patient name as the event `title`; whether it ends up in the DOM is unverified, so Mode discret may leak it there.
- `compactPatientLabel` and `calendarEventClasses` / `eventAccessibleLabel` on `CalendarPage` are not used by the templates.
- Break blocks overlapping a card split the column width (CAL-2 note).
- The old static-demo `.fc-*` selectors match nothing in FullCalendar 7 (CAL-2 note).
- The week title and hidden-day logic still use browser-local dates (CAL-T).

## 7. Open questions
1. Accept the calendar-local panel (section 3), or do you want the shared panels edited instead (outside the « calendar/ only » rule)?
2. « Voir le dossier » exists only for practice patients. Is there a patient-record route for OmniCare patients to link to?
3. Is the inline two-step « Refuser » (reason, then « Confirmer le refus ») acceptable, or do you want a pop-up confirmation?
4. Should the unplaced-request count be shown to the doctor (e.g. a small notice) or stay a hidden counter?
5. Mode discret has no toggle until CAL-5: do you want a temporary one now?

## Chat summary
Pending requests now appear on the week grid (« Demande », « En attente du patient », dashed), follow-ups come out violet when the agenda says `followUp`, and clicking a card opens one calendar side panel: appointment (Démarrer, Voir le dossier, Appeler when a phone exists, Annuler) or request (Accepter, Proposer un autre horaire, Refuser with confirmation), all through the existing facade; Déplacer, Message and Marquer absent are not rendered. Mode discret reaches request cards and the panel. `tsc`, 291 calendar tests (37 new) and the production build pass; budget warnings are the same as before this task. Not checked in a browser. I wrote a new panel in `calendar/` rather than edit the shared ones (section 3).

**Browser checklist for the CTO (5 items)**
1. Open a week with a pending request: a dashed amber « Demande » card sits at the requested time; after « Proposer un autre horaire » it turns dashed blue « En attente du patient ». Click it: the panel shows Accepter / Proposer un autre horaire / Refuser.
2. « Refuser »: pick a motif, press « Confirmer le refus » (nothing happens before that); the week reloads and the card goes away. Same reload after « Accepter » or an annulation.
3. A follow-up appointment shows violet « Suivi à venir » (confirmed) or « Suivi terminé » (completed). Needs the backend with G4-1 running; if every appointment stays blue, the API is not sending `followUp`.
4. Click an appointment: Démarrer la consultation, Voir le dossier, Appeler (only if a phone is on file; the link starts with `tel:`), Annuler. There is no Déplacer, Message or Marquer absent, and pressing letters or Enter on the keyboard does nothing.
5. Mode discret: in the browser console run `localStorage.setItem('oc.calendar.discreet','true')` and reload. Cards and panel show initials (K. M.), the motif and phone digits read « Masqué (mode discret) », « Appeler » is still there. Run `localStorage.removeItem('oc.calendar.discreet')` to turn it off.

## Path to deliver G-3
| Step | Status | What it still needs |
|---|---|---|
| CAL-1 presentation layer | done | wired by CAL-2/3 |
| CAL-2 week view restyle | done, unseen | CTO review in a browser (see its report) |
| CAL-3 requests, follow-ups, panel | done, unseen | browser checklist above; answers to questions 1-5; backend G4-1 running for follow-ups |
| CAL-T time zone | **remaining** | pin FullCalendar to Africa/Tunis and replace the browser-local getters (list in the CAL-1 report); check FullCalendar's callback `Date` semantics; run the specs with `TZ=America/New_York` and `Asia/Tokyo`. Hidden weekdays, break blocks and period titles depend on it |
| CAL-4 month and day views | **remaining** | new month component (tiles, dots, hover preview, day menu) and compact day list; exact workload needs G4-2 / G4-3 (backend: per-day summary, free slots), otherwise a client approximation |
| CAL-5 chrome | **remaining** | « Mode discret » toggle, date picker, patient search, filters, keyboard shortcuts (none for Accepter / Refuser / Annuler / Démarrer) |
| CAL-6 | **scope not described in the briefs I received** | needs its brief before it can be planned |
| Backend-dependent actions | parked | Déplacer, Message, Marquer absent (no endpoints); per-day summary and doctor free slots (G4-2/3) |
| Final fix pass (CTO) | **remaining** | the visual items in section 6 (weekday twice in the header, sliver beside the lunch break, possible name in the event title), plus anything seen in the browser review |
| Close-out | **remaining** | unblock the full `ng test` (`team-page.spec.ts`, other chat); production build; a visual regression check of the calendar |
