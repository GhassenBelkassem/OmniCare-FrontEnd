# G3-CAL-P0 — Inspection of the current doctor calendar

Read-only inspection. Nothing was modified except this file. No git command and no app run. Only `npx tsc --noEmit -p tsconfig.app.json` was run (exit 0, no errors).

Conventions
- Front-end paths are relative to `omniCareDash/src/app/features/doctor/` unless prefixed. The task named the repo `OmniCare-FrontEnd`; on disk it is `omniCareDash`, so this file lives at `omniCareDash/docs/reports/G3/`.
- Back-end paths are relative to `OmniCare-BackEnd/src/main/java/com/omnicare/app/`.
- REAL = served by the Spring API. MOCK = fixtures. STATIC = hard-coded.
- Back-end facts marked **(agent)** come from a read-only sub-agent. I re-verified: controller routes and roles of `AvailabilityController`, the `/api/v1` prefix, the agenda SQL (`ScheduledCareReadRepository`), the `Africa/Tunis` constant, and the `AppointmentController` routes. Everything else from the agent stays UNVERIFIED unless noted.
- `apiBaseUrl` defaults to `/api/v1` (`core/config/runtime-config.spec.ts:5`), so front-end paths below map 1:1 to the `/api/v1/...` controller paths.

## 1. Plan (as executed)
- Entry: `doctor.routes.ts:64-68` (`calendar`) → `calendar/calendar-page.ts`. Static-demo build: `doctor.routes.static-demo.ts:70-73`.
- Followed imports from `calendar-page.ts:1-84` only: `calendar/*`, `scheduled-care/*` (facade, API, models, detail panel), `appointment-api.*`, `availability-exception.adapter.ts`, `shared/ui/appointment-status.ts`, `core/realtime/realtime.service.ts`, the booking drawer's services, plus `settings/bulk-schedule-editor` (weekly hours) and `styles/`.
- Back-end: only the controllers those calls hit, plus availability/schedule endpoints. Consultation screens ignored except the link target.

---

## a) Map

### Routes → components
| Route | Component | Source | Data |
|---|---|---|---|
| `/doctor/calendar` (DOCTOR only) | `CalendarPage` (`oc-calendar-page`) | `doctor.routes.ts:64-68`, class `calendar/calendar-page.ts:121` | REAL |
| `/doctor/calendar?appointmentId=…` (deep link; used by notifications) | same; opens the drawer after first render | `calendar-page.ts:323-326`, link built at `doctor-shell.ts:363-365` | REAL |
| `/doctor/calendar` in `static-demo` build only | `calendar-page.static-demo.ts` (525 lines) with `calendar-demo.fixtures.ts` (605 lines) | `doctor.routes.static-demo.ts:70-73`, `angular.json` config `static-demo` (line 94+) | MOCK |
| `/doctor/secretary-agenda` (secretary landing) | `SecretaryAgendaPage` — a separate list-style agenda, no FullCalendar found in it | `doctor.routes.ts:36-41`, `secretary/agenda/secretary-agenda-page.ts` (257 lines) | REAL |
| `/doctor/requests` | `RequestsPage` — where pending booking requests are handled today | `doctor.routes.ts:120-124` | REAL |
| `/doctor/settings?tab=schedule` | `SettingsPage` → `BulkScheduleEditor` (weekly hours, lunch break, slot duration) | `calendar-page.ts:448-450`, `settings/bulk-schedule-editor.ts` | REAL |
| Sidebar entry « Calendrier » | `doctor-shell.ts:142` | | |

### Views that exist today
- Day / Week / Month only, all FullCalendar: `timeGridDay`, `timeGridWeek`, `dayGridMonth` (`calendar-view.ts:34-38`, `calendar-page.ts:86`). Default is **week** (`calendar-page.ts:139`, `:243`).
- **No list view.** The list plugin is not imported (`calendar-page.ts:29-32`: daygrid, interaction, monarch theme, timegrid).
- `navLinks: false` (`calendar-page.ts:265`): clicking a day number does not open the day view.

### Components, dialogs and drawers
| Element | File:line | Type |
|---|---|---|
| `CalendarPage` (container: state, loading, FullCalendar options) | `calendar/calendar-page.ts:103-121` | OnPush, signals |
| `CalendarView` (presentational: header, toolbar, states, FullCalendar templates) | `calendar/calendar-view.ts:40-61`, `calendar-view.html` | OnPush, `ViewEncapsulation.None` |
| Appointment detail drawer | `scheduled-care/scheduled-appointment-detail-panel.ts:21-66` (`nz-drawer`, width `min(390px,100vw)`) mounted at `calendar-page.html:7-11` | NG-ZORRO drawer |
| Quick booking drawer | `calendar/quick-booking-drawer.ts` (1136 lines) mounted at `calendar-page.html:14-19` | custom sheet |
| Exception detail modal | `calendar-page.html:21-68` | `nz-modal` |
| Exception form modal (type, date, scope, times, motif) | `calendar-page.html:70-156` | `nz-modal` |
| Booking request panel (accept / propose / decline) | `scheduled-care/booking-request-detail-panel.ts` — **not** mounted in the calendar; used by `requests/requests-page.ts` and `command/command-center-page.ts` | |

### Services / stores
- `AppointmentApiService` (rules, exceptions, list, stats) — `appointment-api.service.ts:14-54`.
- `ScheduledCareApiService` (agenda, requests, appointment, cancel, slots) — `scheduled-care/scheduled-care-api.service.ts:19-121`.
- `ScheduledCareFacade` (root singleton; signals; idempotency keys; realtime-driven `projectionInvalidationEpoch`) — `scheduled-care/scheduled-care.facade.ts:26-509`.
- `RealtimeService.health()` → `'live'|'stale'|'down'` — `core/realtime/realtime.service.ts:46,160`.
- `ActiveConsultationStore` (start/continue consultation) — injected at `scheduled-appointment-detail-panel.ts:348`.
- Booking drawer: `PracticePatientApiService`, `PracticeLocationApiService`, `ActiveConsultationApiService` — `quick-booking-drawer.ts:148-150`.
- State lives in `CalendarPage` signals (`calendar-page.ts:139-187`); no NgRx.

### Models / DTOs
- `appointment-api.models.ts` (rules, exceptions, `AppointmentDto`, enums).
- `scheduled-care/scheduled-care.models.ts` (`DoctorScheduledCareItem`, `Appointment`, `BookingRequest`).
- `calendar/calendar-view.models.ts` (view model, FullCalendar metadata).
- `practice-patient-api.models.ts:63-81` (create-appointment DTOs).

### Every HTTP call → Spring controller
| # | Front call (file:line) | Spring handler | Source |
|---|---|---|---|
| 1 | `GET /appointments/availability/rules` (`appointment-api.service.ts:21`) | `appointment/controller/AvailabilityController.java:48`, DOCTOR | REAL (verified) |
| 2 | `PUT /appointments/availability/rules` (`:25`; used by settings editor) | `AvailabilityController.java:55`, DOCTOR | REAL (verified) |
| 3 | `GET /appointments/availability/exceptions?from&to` (`:29`) `from/to` = date only | `AvailabilityController.java:63`, DOCTOR | REAL (verified) |
| 4 | `POST /appointments/availability/exceptions` (`:34`) | `AvailabilityController.java:72`, DOCTOR | REAL (verified) |
| 5 | `DELETE /appointments/availability/exceptions/{id}` (`:38`) | `AvailabilityController.java:80`, DOCTOR | REAL (verified) |
| 6 | `GET /doctor/scheduled-care?from&to` (ISO instants) (`scheduled-care-api.service.ts:23`) — **the calendar's main data source** (`calendar-page.ts:630-631`) | `scheduledcare/api/DoctorScheduledCareController.java:28` (agent) | REAL |
| 7 | `GET /doctor/scheduled-care/home-summary` (`:31`, via facade `loadHome`) | `DoctorScheduledCareController.java:36` (agent) | REAL |
| 8 | `GET /appointments/{id}` (`:80`, drawer) | `AppointmentController.java:102` (verified route) | REAL |
| 9 | `POST /appointments/{id}/cancel` + `Idempotency-Key` (`:89`) | `scheduledcare/api/ScheduledAppointmentCancellationController.java:35` (agent) | REAL |
| 10 | `GET /appointments/availability/slots?doctorId&practiceLocationId&from&to` (`:105`; used for « propose new time ») | `AvailabilityController.java:89` (verified; `:108` is the retired variant without location) | REAL |
| 11 | `GET /doctor/booking-requests/{id}`, `POST …/accept`, `…/proposals`, `…/decline` (`:37-78`) — **not reachable from the calendar UI** | `DoctorBookingRequestController.java:45,52,61,70` (agent) | REAL |
| 12 | `POST /doctor/consultations/start` (`active-consultation-api.service.ts:66`) | `consultation/api/DoctorConsultationController.java:119` (agent) | REAL |
| 13 | `GET /patients?query…` (patient search in drawer, `practice-patient-api.service.ts:53`) | UNVERIFIED (controller not read) | REAL |
| 14 | `POST /patients` + `POST /patients/duplicate-candidates` (`:71,:77`) | UNVERIFIED | REAL |
| 15 | `GET /patients/{id}/appointments/availability` (`:106`) | `patient/controller/PracticePatientAppointmentController.java:57` (agent) | REAL |
| 16 | `POST /patients/{id}/appointments` + `Idempotency-Key` (`:89`) | `PracticePatientAppointmentController.java:41` (agent) | REAL |
| 17 | `GET /me/practice-locations` (cabinet picker, `settings/practice-location-api.service.ts:17,20`) | UNVERIFIED | REAL |
| 18 | `GET /doctor/consultations/{id}/follow-up/availability` (follow-up mode of the drawer, `active-consultation-api.service.ts:105`) | `followup/api/DoctorFollowUpController.java:45` (agent) | REAL |
| — | `GET /appointments?from&to` (`appointment-api.service.ts:42`) exists in the service but **the calendar does not call it** (page uses #6) | `AppointmentController.java:75` (verified) | REAL |
| — | Realtime: `scheduledCareEvents$` (STOMP/SockJS) triggers refetch — `scheduled-care.facade.ts:66-83` | | REAL |

No call is MISSING on the back-end. Demo fixtures (MOCK) are used only by the `static-demo` build.

---

## b) Data available, field by field

### Appointment (what the calendar actually receives)
The calendar maps `DoctorScheduledCareItem` (`scheduled-care.models.ts:118-137`) ↔ Spring `ScheduledCareItemResponse` (agent, `scheduledcare/api/dto/ScheduledCareItemResponse.java`). No field mismatch found between the two.

| Field | Angular | Spring (agent) | Notes |
|---|---|---|---|
| id | `appointmentId` (`:121`) | `appointmentId` | request rows use `requestId` |
| patient name | `subject.displayName` (`:126`), fallback « Patient » (`calendar-event.adapter.ts:324`) | `SubjectSummary.displayName` | |
| patient id | **not in the item** (`subject` has `subjectType`, `relationship`, `displayName`) | same | the profile link only exists after `GET /appointments/{id}` (`practicePatient.practicePatientId`, `scheduled-appointment-detail-panel.ts:111`) |
| start / end | `start`, `end` ISO instants | `Instant` | |
| duration | not on the item; derived (`end − start`); `slot.durationMinutes` after the detail call (`scheduled-care.models.ts:51`) | no column; derived (`Appointment.java:42-46`, agent) | |
| TYPE | **only** `subjectType === 'PRACTICE_PATIENT'` → « Patient externe » (icon `user-add`), else → « Cabinet » (icon `home`) (`calendar-event.adapter.ts:301-305,325-326`). `'urgent'` is declared (`calendar-view.models.ts:48`) but never produced. **No visio / domicile value exists** | `CareSubjectType`: SELF, FAMILY_MEMBER, PRACTICE_PATIENT | **cabinet / téléconsultation / domicile is NOT in any DTO** |
| STATUS (appointment) | `PROPOSED, CONFIRMED, IN_PROGRESS, CANCELLED, COMPLETED, NO_SHOW` (`scheduled-care.models.ts:9`) | `AppointmentStatus` same 6 values (agent) | « absent » = `NO_SHOW` |
| STATUS (request) | `PENDING_DOCTOR, PENDING_PATIENT_TIME_CONFIRMATION, FULFILLED, CANCELLED_BY_PATIENT, CANCELLED_BY_DOCTOR, EXPIRED` (`:1-7`) | same (agent) | agenda only returns the two PENDING_* (see below) |
| Status → label/colour | single shared mapping `shared/ui/appointment-status.ts:38-110`; PENDING/PROPOSED amber, CONFIRMED primary, IN_PROGRESS violet, COMPLETED grey+muted, CANCELLED red+struck, NO_SHOW dark red | | already in French |
| reason / motif | **not on the calendar item.** Only after `GET /appointments/{id}`: `consultationReason` (`scheduled-care.models.ts:115`), filled from legacy `notes` (`scheduled-care-api.service.ts:202`), shown at `scheduled-appointment-detail-panel.ts:216-219` | `AppointmentResponse.notes` exists; **no motif column** on `appointments`; chief complaint lives in the medical-record service (`chief_complaint`, `medicalrecord/api/DoctorMedicalRecordResponse.java:131,146`) (agent) | not in main DB; MRS holds the clinical motif. Doctor/patient/practice booking paths have no notes field (agent) |
| FOLLOW-UP flag | **not exposed.** `AppointmentSourceDto` has `DOCTOR_FOLLOWUP` (`appointment-api.models.ts:11-16`) but `DoctorScheduledCareItem` has no `source`. The legacy `toAppointmentCalendarEvent` used `source` (`calendar-event.adapter.ts:139-144`) but the page uses `projectScheduledAppointmentEvents` (`calendar-page.ts:60,178-180`) | `AppointmentSource.DOCTOR_FOLLOWUP`, `source_consultation_id`, status `PROPOSED`; the agenda SQL does **not** select `source` (agent; my grep of `ScheduledCareReadRepository.java` finds no `source` column) | `GET /appointments` returns `source` (`AppointmentDto.source`) — a possible front-side join by id (UNVERIFIED which statuses `listForDoctor` returns) |
| cabinet / location | `item.cabinet.name` (`calendar-event.adapter.ts:363`), fallback « Cabinet non renseigné »; no `practiceLocationId` on the agenda item (`CabinetSnapshot.practiceLocationId?` optional, `:32`) | `CabinetSummary{name,address,city,governorate,timezone}` | |
| price | after detail call: `quotedPrice` | `quoted_price_tnd` | not shown on the calendar |
| `availableActions` | `readonly ScheduledCareAction[]` = `ACCEPT_REQUEST, PROPOSE_NEW_TIME, DECLINE_REQUEST, CANCEL_APPOINTMENT` (`:13-14`) | `CANCEL_APPOINTMENT` only for CONFIRMED/PROPOSED and future start; request actions only for PENDING_DOCTOR before deadline (agent, `ScheduledCareActionPolicy`) | mismatch: Angular type is one union; Spring has two enums (`DoctorBookingRequestAction`, `ScheduledAppointmentAction`) — values identical |

Which rows the agenda returns (agent; the SQL lines I re-read agree): **all appointment statuses** for the doctor (not deleted), plus booking requests only when `PENDING_DOCTOR` / `PENDING_PATIENT_TIME_CONFIRMATION` and `response_deadline_at > now` (`ScheduledCareReadRepository.java:78-79,138-150`); ordered by start, `LIMIT 5000` (`:70`); range cap 62 days (agent, `DoctorScheduledCareQueryService.java:16,36-39`).

**Important finding:** the calendar fetches both types but keeps only `resourceType === 'APPOINTMENT'` (`calendar-page.ts:636-640`). Pending requests are received and silently dropped. Showing them is a front-end filter change, not a data change.

### Schedule
| Item | Source | Detail |
|---|---|---|
| Weekly working hours | `AvailabilityRuleDto{dayOfWeek, active, startTime, endTime}` (`appointment-api.models.ts:18-28`) | one row per weekday; `active=false` = closed day |
| Lunch break | `pauseStart/pauseEnd` on the same row (one break per day); validated by `hasValidPause` (`calendar-time.adapter.ts:218-228`); split into two business-hour segments (`:76-106`) | **no break event is produced for the grid** — the template for `kind: 'break'` exists (`calendar-view.html:120-122`) but no code in `calendar-event.adapter.ts` or `calendar-page.ts` emits it (grep: no match); today the break is only the gap in `businessHours` shown with `nonBusinessHoursClass` (`calendar-page.ts:270,302`) |
| Closed slots / exceptions | `AvailabilityExceptionDto{id, exceptionDate, type BLOCK|EXTRA, startTime, endTime, reason}` (`:30-38`) | BLOCK = unavailable window, rendered as background + annotation event (`calendar-event.adapter.ts:164-222`); month view shows none (`:168`) |
| Extensions | `EXTRA` exceptions. The page's own notice warns an EXTRA « ne garantit pas à elle seule la génération de créneaux » (`calendar-page.ts:229-230`); back-end ignores EXTRA if the weekday has no rule row (agent, `SlotGenerationService`) | |
| Slot duration | `slotDurationMinutes` per rule; the calendar uses the **shortest active** one, default 20 (`calendar-time.adapter.ts:253-258`) | backend min 5 (agent) |
| Days off / holidays | no dedicated model. A day off = inactive weekday rule, or full-day BLOCK; `fullyBlockedDateKeys` computes full-day blocks (`calendar-time.adapter.ts:114-162`) | UNVERIFIED: no public-holiday calendar in the back-end (not searched) |
| Per cabinet | **No.** Rules and exceptions have no location column (agent, `AvailabilityRule.java:29`, `AvailabilityException.java:31`); the same weekly schedule applies to every cabinet; occupancy is per doctor across cabinets | multi-cabinet schedule not supported |

### Capacity (month colours)
- **No endpoint** returns booked or bookable slots per day (agent: MISSING).
- `GET /appointments/availability/slots` cannot be used: it returns only **free** slots, drops slots < 4 h ahead and past ones for the patient workflow (agent, `BookableSlotPolicy.java:19-22`), max 31-day range. It cannot give the "total" needed for booked ÷ bookable.
- Client-side approximation is possible from data already loaded: **booked** = appointments of the day (excluding CANCELLED; whether NO_SHOW/COMPLETED count is a product decision); **bookable** = Σ over active rule segments (`startTime→pauseStart`, `pauseEnd→endTime`) ÷ slot duration, minus BLOCK windows, plus EXTRA windows (`projectBusinessHours`, `fullyBlockedDateKeys` already exist). Exact parity with the server grid is **UNVERIFIED**: the server uses an anchored grid per weekday duration (agent, `SlotGenerationService.appendAnchoredGrid`, ~`:208-232`) and appointments have no stored duration. Treat as NEEDS DATA for exactness.
- Pending requests also hold time on the server (agent: `DoctorTimeReservation`) — whether they count as "booked" is an open question.

### Pending requests (Module 04 doctor request flow)
- Listed: `GET /doctor/scheduled-care` (BOOKING_REQUEST rows) and `home-summary.pendingRequestCount / nextPendingRequest` (`scheduled-care.models.ts:146-151`); page `RequestsPage`; calendar drops them (see above).
- Accept: `facade.acceptRequest()` → `POST /doctor/booking-requests/{id}/accept` with `expectedVersion` (`scheduled-care.facade.ts:221-240`).
- Counter-propose: `facade.loadProposalAvailability()` loads slots for a 21-day window starting 7 days before the requested time (`:184-219`), then `proposeTime(slot)` → `POST …/proposals` (`:242-279`).
- Refuse: `declineRequest(reason)` with `CABINET_UNAVAILABLE | DOCTOR_UNAVAILABLE | SCHEDULE_CONFLICT` (`scheduled-care.models.ts:16`, `facade:281-309`).
- All three use `Idempotency-Key` (UUID per command identity, `facade:501-508`) and optimistic `expectedVersion`; unknown-outcome handling re-reads the resource (`facade:371-387`).
- Request rows already map to the shared status key `PENDING` (amber) (`appointment-status.ts:39-48,112-122`).

### Time zone
- Back-end scheduling zone is **Africa/Tunis** (`appointment/service/BookableSlotPolicy.java:18`, verified). Rules and exceptions are zone-less `LocalTime`/`LocalDate` interpreted in Tunis; appointments and slots are `Instant` (UTC ISO); each agenda item carries `timezone` (agent). Tunisia has no DST.
- Front-end: constants `SCHEDULING_TIMEZONE = 'Africa/Tunis'` (`quick-booking-drawer.ts:72`, `scheduled-care/scheduled-care-time.ts:1`); the detail panel formats with the appointment's zone (`scheduled-appointment-detail-panel.ts:131-137`).
- **The FullCalendar options set no `timeZone`** (`calendar-page.ts:239-309`), so the grid renders in the **browser's** zone. Appointment instants are passed through unchanged (`calendar-time.adapter.ts:56-59`); exception times are built as zone-less wall-clock strings (`:164-167`); the visible range converts to exception dates with browser-local getters (`:40-54,179-184`). A doctor whose browser is not on Tunis time would see the grid shifted relative to the weekly rules. UNVERIFIED in practice (not run); flagged as a risk.
- Secretary agenda queries one UTC day (`secretary-agenda-api.service.ts:23-27,58-60`) — a Tunis day (UTC+1) is not a UTC day; out of scope but notable.

---

## c) Interactions today

### Header and toolbar (`calendar-view.html`)
| Element | Line | Does |
|---|---|---|
| Title (period) | `:6` | text from `calendarPeriodTitle` (`calendar-time.adapter.ts:298-330`) |
| « Nouveau rendez-vous » (+) | `:8` | opens booking drawer, no preselection (`calendar-page.ts:357-360`) |
| « Modifier les horaires » | `:10` | navigates `/doctor/settings?tab=schedule` |
| « Exception » | `:11` | opens exception form modal (date = today, BLOCK, full day) (`calendar-page.ts:452-468`) |
| ‹ (Période précédente) / « Aujourd'hui » / › | `:16-18` | FullCalendar `prev/today/next`, clears selection |
| Segmented « Jour / Semaine / Mois » | `:26-32`, options `calendar-view.ts:69-73` | `changeView` |
| Realtime warning tag « Mise à jour en temps réel indisponible — actualisation automatique » | `:19-23` | shown when `health()==='down'` |
| State banners (loading, error + « Réessayer », rules warning, exceptions warning, « Aucun horaire habituel configuré » + « Configurer mes horaires », slot hint, mutation error) | `:35-55` | status/alert roles |
| Day summary strip (day view only: count, availability, working hours) | `:59-65` | static text from `calendar-page.ts:218-228`; **counts all loaded appointments, not only that day** (`:221` uses `appointments().length`) |
| Permanent notice paragraph | `:138-140`, text `calendar-page.ts:229-230` | always visible |

### Calendar surface
| Element | Behaviour | Source |
|---|---|---|
| Appointment card click | opens detail drawer; sets selected state | `calendar-page.ts:413-423` |
| Exception annotation click | opens exception detail modal | `:424-432` |
| Empty slot click (day/week) | past → hint « Ce créneau est déjà passé. »; outside working time → hint « …en dehors de vos horaires de consultation. »; else opens booking drawer on that start | `:388-402` |
| Month day cell click | ignored | `:389` |
| « +n » link | FullCalendar default popover (`dayMaxEvents: 3`, text `+${count}`) | `:259-261` |
| Hover tooltip (name, time range, status, cabinet) | `nz-tooltip`, 0.3 s delay | `calendar-view.html:92-96,125-132` |
| Now indicator | red line + dot (`nowIndicator: true`) | `calendar-page.ts:262-264` |
| Drag & drop / resize / select | **none** (`editable`, `selectable`, `eventStartEditable`, `eventDurationEditable` = false) | `:266-269` |
| Keyboard shortcuts | **none** in calendar files (grep `keydown|HostListener|shortcut` → only `quick-booking-drawer.html:118` `keydown.enter` to pick first search result). Only drawers/modals close on Esc via NG-ZORRO (`nzKeyboard`). No global key listener in the doctor workspace except unrelated Esc handlers and a static-demo consultation page | |
| Patient search / filters / « Mode discret » / date picker in header | **none** (patient search exists only inside the booking drawer) | |

### Event card content
- Week/day: time, optional ⚠ warning icon when an `IN_PROGRESS` consultation started on a past day (« Consultation non clôturée »), patient name, type icon + label (hidden on short cards) (`calendar-view.html:103-115`).
- Month: dot, start time, patient name per event, max 3 then « +n » (`:98-101`).
- Cancelled/no-show stay visible (muted/struck) (`calendar-event.adapter.ts:292-299,344-345`). Colour via CSS vars from the shared status map (`:355-357`, `calendar-view.html:88-90`).
- Exception background + annotation card « Indisponible » / « Ouverture exceptionnelle » (`calendar-event.adapter.ts:164-222`).
- Full patient name is shown everywhere (`compactPatientLabel` in `calendar-page.ts:573-580` exists but is **not referenced** by any template I read).

### Appointment detail drawer (`scheduled-appointment-detail-panel.ts`)
| Element | Line | Does |
|---|---|---|
| Header « Détails du rendez-vous » | `:37` | |
| « Voir le profil patient » (two places) | `:109-116,172-178` | router link `/doctor/patient/:practicePatientId`, only for practice patients (`appointment.practicePatient`) |
| Date/heure, durée · fuseau | `:120-138` | |
| Informations (professionnel, spécialité, cabinet, adresse) | `:140-163` | |
| À propos du patient (téléphone, e-mail, sexe, naissance, adresse) | `:165-210` | text only, **no tel:/mail: links**; for non-practice patients shows « Les informations administratives ne sont pas reliées… » |
| Motif de consultation | `:212-220` | « Non renseigné » when empty |
| Confirmation et tarif | `:222-253` | |
| « Démarrer la consultation » | `:301-309`, `:419-431` | only if `status==='CONFIRMED'`, version known, no active consultation (`:360-367`); calls `startScheduledAppointment` then navigates to **`/doctor/consultation/:consultationId`** |
| « Continuer ce rendez-vous » | `:293-300`, `:432-436` | navigates to `/doctor/consultation/:id` |
| « Annuler le rendez-vous » → select « Motif obligatoire » (3 doctor reasons) → « Confirmer l'annulation » | `:311-330`, `:255-270`, reasons `:354-358` | `POST /appointments/{id}/cancel`; only when `availableActions` contains `CANCEL_APPOINTMENT` |
| « Fermer » | `:331-337` | |
| Errors | `:271-284` | e.g. « Une autre consultation est déjà en cours. Ce rendez-vous n'a pas été démarré. » |
| **Not present** | | Déplacer, Message, Appeler, Marquer absent, request accept/propose/refuse |

### Booking drawer (`quick-booking-drawer.html`)
Patient search (« Rechercher par nom ou téléphone… », `:108-115`; Enter selects first result `:118`), recents, « Aucun patient trouvé / récent » (`:177-182`), create-patient form, medical-record readiness badges (`:54-90`), cabinet picker (`:197-244`), date choices « Aujourd'hui / … / Autre date » (`:261-286`), slot grid with loading/empty/error states (`:313-330`), summary (`:354-363`), submit. Follow-up mode driven by inputs `followUp`, `preselectedPatientId` (`quick-booking-drawer.ts:165-176`). It creates appointments **only for practice patients** (`createAppointment` → `POST /patients/{id}/appointments`, DTO `source: 'PRACTICE_PATIENT'`, `practice-patient-api.models.ts:63-81`).

### Exception modals
- Detail: date, horaire, type (« Blocage » / « Ouverture exceptionnelle »), motif, « Fermer », « Supprimer l'exception » (direct delete, no extra confirmation) (`calendar-page.html:21-68`, `calendar-page.ts:518-539`).
- Form: type radio (« Bloquer (indisponible) » / « Ouverture exceptionnelle »), date, scope (« Toute la journée de travail » / « Plage horaire »), start/end with order validation, motif « Optionnel », « Annuler » / « Enregistrer » (`:70-156`, `calendar-page.ts:475-511`). Full-day = the day's configured hours (`fullWorkingDayWindow`); error « Aucun horaire actif n'est configuré pour cette journée. » (`:485`).

### States
Loading (« Chargement des rendez-vous… »), load error, rules error, exceptions error, no-schedule empty state, slot hint, mutation error — all in French (`calendar-view.html:35-55`). No skeletons; no empty state for « no appointments this period » found.

### Language
All strings read in the calendar files are French. **No English UI string found** in `calendar/*` (non-spec), `scheduled-appointment-detail-panel.ts`, `calendar-view.html`. UNVERIFIED: strings emitted by FullCalendar (fr locale is loaded, `calendar-page.ts:33,244`) and NG-ZORRO built-ins (no `NZ_I18N` locale checked).

---

## d) Actions vs backend
| Design action | Endpoint today | Status |
|---|---|---|
| Create appointment (practice patient) | `POST /patients/{id}/appointments` — `PracticePatientAppointmentController.java:41` (agent) | **exists** (UI: booking drawer) |
| Create appointment for an OmniCare (app) patient | none found for doctor-initiated; `/doctor-booking-requests` create is on the patient side (`PatientBookingRequestController.java:33`, agent) | **MISSING** (UNVERIFIED beyond agent) |
| Accept request | `POST /doctor/booking-requests/{id}/accept` — `DoctorBookingRequestController.java:52` | **exists** (UI not in calendar) |
| Counter-propose | `POST …/proposals` `:61` (+ slots `AvailabilityController.java:89`) | **exists** (UI not in calendar) |
| Refuse | `POST …/decline` `:70` | **exists** (UI not in calendar) |
| Reschedule / « Déplacer » | doctor: none. Only `PATCH /appointments/{id}/secretary-reschedule` (`AppointmentController.java:124`, SECRETARY) | **MISSING** for doctor |
| Cancel | `POST /appointments/{id}/cancel` `ScheduledAppointmentCancellationController.java:35`; reason codes for doctor in UI: 3 (`scheduled-appointment-detail-panel.ts:354-358`) | **exists** (UI in drawer; 2-step confirm with mandatory reason) |
| Mark absent | no direct endpoint; `NO_SHOW` only via `POST /doctor/consultations/{id}/abort` with `PATIENT_ABSENT` (`DoctorConsultationController.java:85`), which needs an already **IN_PROGRESS** consultation (agent) | **partial / MISSING** for a CONFIRMED appointment |
| Start consultation | `POST /doctor/consultations/start` `:119`; old `PATCH /appointments/{id}/start` returns 410 (`AppointmentController.java:165`) | **exists** (UI in drawer) |
| Extend the day (« Prolonger la journée ») | no dedicated endpoint; `POST /appointments/availability/exceptions` type `EXTRA` (`AvailabilityController.java:72`) | **partial** (EXTRA ignored if no rule that weekday; no guarantee of slots — see `calendar-page.ts:229-230`) |
| Close day / close slot (« Fermer ») / Pause | `POST …/exceptions` type `BLOCK` (full-day or window) — UI exists (« Exception ») | **exists** (generic; no « pause » concept — a pause would be a BLOCK window) |
| « Rouvrir » a closed slot | `DELETE …/exceptions/{id}` `AvailabilityController.java:80` | **exists** (UI: « Supprimer l'exception ») |
| Edit lunch break / weekly hours | `PUT /appointments/availability/rules` `:55`; UI in Settings `BulkScheduleEditor` (pause default 13:00–14:00, `bulk-schedule-editor.ts:175`) | **exists** (outside the calendar) |
| Message patient / Call patient | no endpoint found; `tel:` link pattern exists elsewhere (`patient-chart/chart-contact-card.ts:151`) | **MISSING** (messaging UNVERIFIED: chat controllers not searched) |
| « Patients à prévenir » | nothing found | **MISSING** |
| Per-day capacity | none | **MISSING** |

Confirmations and notifications today
- Cancel: reason is mandatory, then a second « Confirmer l'annulation » click (`scheduled-appointment-detail-panel.ts:311-330`). Delete exception: one click in a modal (no extra confirm).
- Patient notifications are server-side and automatic (types `APPOINTMENT_CANCELLED_BY_PROFESSIONAL`, `DOCTOR_BOOKING_TIME_PROPOSED`, `DOCTOR_BOOKING_REQUEST_DECLINED`, …; `notification/service/NotificationService.java:34-35,160-162`, `NotificationType.java:35-59`, agent). UNVERIFIED which service call emits each one. The front-end sends no notification itself; no UI warns the doctor that the patient will be notified.

---

## e) Look today
- **Not Angular Material.** UI kit = **NG-ZORRO `^21.3.3`** (compile-time Less theme `src/styles/vendor/ng-zorro-theme.less`, controlled duplicate of brand values, lines 1-2) + **Spartan/Tailwind** (`spartan-tailwind*.css`, `@spartan-ng/brain 1.2.0`) + in-house `oc-*` primitives (`shared/ui/*`: button, page-header, segmented-control, sheet, status-tag, etc.). No M3 theme.
- Tokens: `src/styles/tokens.scss` (palette: primary `#1fbf9a`, violet `#8b5cf6`, amber `#f59e0b`, error `#ef4444`, greys, tints; radii `--oc-radius-sm 6 / md 10 / lg 16 / pill`; spacing `--oc-space-1…12`), plus `styles/settings/*`, `styles/themes/_omnicare-light.scss` (light only; no dark theme file).
- Font: **Plus Jakarta Sans Variable** (`package.json`, `tokens.scss:82`, `ng-zorro-theme.less:71`).
- Icons: NG-ZORRO `nz-icon` (`calendar-view.html`) and `OcIcon`.
- Hard-coded colours in the calendar styles: **0 hex / 0 rgb** in `calendar-page.scss`, `calendar-view.states.scss`, `calendar-page.static-demo.scss`, `calendar-page.static-demo.responsive.scss`, `quick-booking-drawer.scss`, `scheduled-care-detail.scss`. They use `var(--oc-…)` (counts of `var(--`: 91, 104, 195, 6, 159, 98). Only `shared/appointment-detail-panel.scss:66-70` has 4 hex (`#e9c9be #b4472f #f7e7e2`); whether the calendar uses that file is UNVERIFIED (my import grep also matched `scheduled-appointment-detail-panel`).
- Heights are fixed: 760 px (week/day), 798 px (month) (`calendar-page.ts:247`).
- Global styles that affect a restyle:
  - `src/styles/vendor/_fullcalendar.scss` (211 lines): imports FullCalendar skeleton + **monarch** theme (`:1-3`) and remaps `--fc-monarch-*` to `--oc-color-*` under `.omnicare-calendar` (`:5-`). That class is referenced only in `calendar-page.scss` (grep).
  - `CalendarView` uses `ViewEncapsulation.None` and loads **`calendar-page.static-demo.scss`, `calendar-page.static-demo.responsive.scss`, `calendar-view.states.scss`** (`calendar-view.ts:53-57`). The production calendar's main look therefore lives in files named « static-demo » (naming trap).
  - NG-ZORRO tooltip/drawer/modal/segmented/tag styles are global.
- Responsive: breakpoints at 1480 px and 767 px (`calendar-page.static-demo.responsive.scss:1,51`); drawer `min(390px,100vw)`. Real behaviour on phone UNVERIFIED (not run).
- Spacing/radius use tokens throughout (`border-radius: var(--oc-radius-*)`, 15+ occurrences in `calendar-page.static-demo.scss`).

---

## f) Libraries
| Lib | Version | Use |
|---|---|---|
| `fullcalendar` + `@fullcalendar/angular` | 7.1.1 / 7.1.1 | the grid (`calendar-page.ts:22-33`); plugins `daygrid`, `timegrid`, `interaction`, theme `monarch`; locale `fr` |
| `luxon` 3.7.2, `temporal-polyfill` 1.0.1 | declared in `package.json` | **no import found** in the app sources I grepped (`from 'luxon'`, `temporal-polyfill`: none) — date handling uses native `Date` + `Intl.DateTimeFormat('fr-FR')` (`calendar-time.adapter.ts:33-37,293-295`) |
| `@angular/*` | `^21.2.0` (CDK 21.2.14) | |
| `ng-zorro-antd` | `^21.3.3` | drawer, modal, segmented, tag, tooltip, radio, input |
| `rxjs` | `~7.8.0` | |
| `@stomp/stompjs`, `sockjs-client` | | realtime |

Can FullCalendar render the approved designs?
- **Week**: largely yes — `eventContent` template (`calendar-view.html:78-123`), `eventClass`, `slotLaneClass`, `nowIndicator*` classes, background events, `businessHours`, `dateClick`. Status colours and type icons already flow through CSS vars. Hiding closed days needs the `hiddenDays` option (UNVERIFIED in v7 docs; not used today).
- **Day** (compact list with free slots, breaks, now marker, summary): not a FullCalendar time-grid; needs a **new component**. The list plugin is not installed and would not render free slots/breaks.
- **Month** (text-less workload tiles, fill bar, dots, hover preview): FullCalendar's `dayGridMonth` would need heavy cell-content overrides (`dayCellClass` already used, `calendar-page.ts:285-293`); a custom month grid is the realistic path. Decision for the team — see open questions.

---

## g) Quality
| File | LOC |
|---|---|
| `calendar/calendar-page.ts` | 694 |
| `calendar/calendar-view.ts` / `.html` | 170 / 141 |
| `calendar/calendar-page.html` / `.scss` | 156 / 380 |
| `calendar/calendar-event.adapter.ts` | 386 |
| `calendar/calendar-time.adapter.ts` | 338 |
| `calendar/quick-booking-drawer.ts` / `.html` / `.scss` | **1136** / 410 / 678 |
| `scheduled-care/scheduled-appointment-detail-panel.ts` (template inline) | 488 |
| `scheduled-care/scheduled-care.facade.ts` | 509 |
| `calendar/calendar-page.static-demo.*` (ts/html/scss/responsive) | 525 / 234 / 820 / 102 |
| `calendar/calendar-demo.fixtures.ts` | 605 |
| `calendar/calendar-view.states.scss` | 346 |

- Logic split: good separation page (container) / view (presentational, `input`/`output`) / pure adapters. But `CalendarPage` also holds the exception form, validators and direct `AppointmentApiService` calls (`calendar-page.ts:96-101,189-199,475-539`) while appointments go through facade/API — two data-access styles.
- Change detection: `OnPush` on page, view and panel (`calendar-page.ts:119`, `calendar-view.ts:58`, panel `:342`); signals/computed throughout.
- Performance risks:
  - `calendarOptions` is a `computed` that rebuilds the whole FullCalendar options object when view mode, rules, exceptions or slot bounds change (`calendar-page.ts:239-309`).
  - Every realtime scheduled-care event bumps `projectionInvalidationEpoch` → full visible-range refetch + `loadHome` (`scheduled-care.facade.ts:66-83`, `calendar-page.ts:313-319`); bursts of events = bursts of refetches (no debounce seen). A 120 s fallback refetch runs only when realtime is not `live` (`calendar-page.ts:89,320-322,442-447`).
  - Agenda is capped at 5000 rows / 62 days by the back-end; month view (~6 weeks) fits. Per-day capacity maths for month tiles would add client work on every refresh.
  - `CalendarView.resetScroll` queries every `div` (`calendar-view.ts:94-101`) — unused in the page I read (UNVERIFIED if called).
- Accessibility: event `aria-label` with time/patient/status/type (`calendar-view.html:91`, `calendar-view.ts:157-169`), `aria-busy` (`:66`), `role=status/alert` banners, `aria-label` on nav and segmented control, French labels on icon buttons. Gaps: no shortcuts; tooltips are hover-based (`nz-tooltip`, keyboard focus behaviour UNVERIFIED); FullCalendar keyboard focus on events UNVERIFIED; colour is the main status cue in month dots (status text only in tooltip/aria).
- Tests (counted `it(` per file): `calendar-page.spec.ts` 43 (923 lines), `calendar-event.adapter.spec.ts` 34, `calendar-time.adapter.spec.ts` 19, `quick-booking-drawer.spec.ts` 21, `calendar-demo.fixtures.spec.ts` 2, `scheduled-care.facade.spec.ts` 18, `scheduled-care-api.service.spec.ts` 8, `scheduled-care.models.spec.ts` 3, `scheduled-care-errors.spec.ts` 2, `appointment-api.service.spec.ts`, `shared/ui/appointment-status.spec.ts`, `doctor.routes.spec.ts:64-70` (asserts a single production `calendar` route, no `calendar-preview`). E2E: `e2e/doctor-calendar-static-demo.spec.ts` (static demo only); `e2e/urgent-readiness.spec.ts:212-221` only loads the page and screenshots. `package.json` has a `test:step4` script that includes the calendar specs.
- Type-check: `npx tsc --noEmit -p tsconfig.app.json` → **exit 0, no output**. `npx ng lint`: **not run — no `lint` script and no lint target found** (`grep '"lint"' package.json` empty).

---

## h) Fit check vs the APPROVED DESIGN
Legend: REUSE / EXTEND / NEW (UI-only) / NEEDS DATA (backend). "Would live in" = proposed file; nothing was created.

| # | Design item | Verdict | Notes | Would live in |
|---|---|---|---|---|
| **Month** | | | | |
| 1 | Day boxes with no text | NEW (UI-only) | FC month cells show events + day number today | new `calendar/calendar-month-view.ts` (or FC `dayCellContent`) |
| 2 | Colour by workload booked ÷ bookable (green < 50, orange 50-85, red ≥ 85) | **NEEDS DATA** for exactness; NEW (UI-only) approximation | no per-day capacity endpoint; client approximation from `rules` + `exceptions` + appointments is possible but unverified vs server grid (section b) | `calendar-capacity.adapter.ts` (new, pure) |
| 3 | Grey striped = closed / day off | EXTEND | `fullyBlockedDateKeys` (`calendar-time.adapter.ts:114`) + inactive weekday from `projectBusinessHours`; existing `demo-calendar-day-cell--exception` class (`calendar-page.ts:290`) | `calendar-time.adapter.ts` + scss |
| 4 | Fill bar | NEW (UI-only) | needs #2 | month view |
| 5 | Dots per appointment; blue upcoming / violet upcoming follow-up / light green finished / light violet finished follow-up / orange pending; « +n » after 5 | EXTEND (blue, light green, orange) + **NEEDS DATA** (follow-up) | status map exists (`appointment-status.ts`); today COMPLETED=grey, IN_PROGRESS=violet — palette to change (violet is « en cours » now). Follow-up flag not in the agenda item (section b); `source` available on `GET /appointments` (join by id, UI-only but UNVERIFIED completeness). Pending requests are fetched but filtered out (`calendar-page.ts:638`) → UI-only to include | `calendar-event.adapter.ts`, `appointment-status.ts` (shared — blast radius, section i) |
| 6 | Past days faded; today highlighted | EXTEND | `dayCellClass` has `--today`, `--other` (`calendar-page.ts:285-293`); add past class | scss |
| 7 | Hover preview (date, level, « 6 / 8 créneaux », mini timeline, first appointments, pending count, « Ouvrir la journée », « + Rendez-vous ») | NEW (UI-only) + NEEDS DATA for « x / y créneaux » exactness | appointment list, pending count (`home-summary` or filtered rows) and « + Rendez-vous » (drawer with `preselectedStart`, `calendar-page.ts:140-141`) exist | new preview component |
| 8 | Click → day view | EXTEND | `navLinks: false` today (`:265`); `changeView(mode, date)` already supports a date (`calendar-view.ts:75-79`) | `calendar-page.ts` |
| 9 | Day menu: Prolonger / Fermer / Pause / Patients à prévenir | Fermer: REUSE (BLOCK full-day, `saveException`); Pause: EXTEND (BLOCK window); Prolonger: EXTEND (EXTRA, with the caveat in `calendar-page.ts:229-230`); **Patients à prévenir: NEEDS DATA** | exception form/API exist | `calendar-page.ts` |
| **Week** | | | | |
| 10 | Only days with working hours or appointments | NEW (UI-only) | compute hidden days from `rules` + loaded appointments; `hiddenDays` option UNVERIFIED | `calendar-page.ts` options |
| 11 | Hour grid | REUSE | timeGrid, padded bounds (`paddedSlotBounds`, `calendar-time.adapter.ts:231-250`) | — |
| 12 | Cards coloured by STATUS (blue à venir, violet suivi à venir, solid green en cours, light green terminé, light violet suivi terminé, orange dashed demande, red absent) | EXTEND + NEEDS DATA (follow-up) | status colours via `--oc-event-color/tint/text` already per status (`calendar-view.html:88-90`); palette differs (see #5); « demande » rows currently dropped; absent = `NO_SHOW` exists | `appointment-status.ts`, adapter, scss |
| 13 | Type icon (cabinet / téléconsultation / domicile) | **NEEDS DATA** | only external vs cabinet today (`calendar-event.adapter.ts:301-305`); no visio/home field on any DTO | — |
| 14 | Lunch break grey block with cup icon | NEW (UI-only) | break data exists (rule `pauseStart/pauseEnd`); `kind:'break'` template exists (`calendar-view.html:120-122`) but no producer; icon = cup (icon set to choose) | adapter + view |
| 15 | Closed slots striped with « Rouvrir » | EXTEND | BLOCK background events exist (`calendar-event.adapter.ts:196-201`), annotation card opens a modal with « Supprimer l'exception » → relabel/inline « Rouvrir » | adapter + scss + page |
| 16 | Red « now » line | REUSE | `nowIndicator` + `demo-calendar-now-line` class (`calendar-page.ts:262-264`) | scss |
| 17 | Click empty slot → quick create (patient search, type, duration) | EXTEND | drawer already opens on empty slot with `preselectedStart` and has patient search; **« type » and « duration » are not choices today** (slots come from the server grid; no type field) → type NEEDS DATA, duration UI-only only within server slot grid | `quick-booking-drawer.ts` (shared with consultation & patient chart) |
| 18 | Click card → side panel | REUSE (panel exists) + EXTEND | present: Démarrer la consultation, Voir le dossier (« Voir le profil patient », practice patients only), cancel. Missing: Déplacer (**NEEDS DATA**), Message (**NEEDS DATA**), Appeler (UI-only `tel:` link if phone present, but legacy response normalises phone to null, `scheduled-care-api.service.ts:192-200`), Marquer absent (**NEEDS DATA**), request Accepter/Proposer/Refuser (backend exists; REUSE `BookingRequestDetailPanel` + facade) | `scheduled-appointment-detail-panel.ts` |
| **Day** | | | | |
| 19 | Compact list: row per appointment / free slot / break / now marker | NEW (UI-only) | free slots: from rules minus appointments client-side (approximate); no free-slot endpoint for the doctor's own view (`/slots` hides near-term/occupied) | new `calendar-day-list.ts` |
| 20 | Day summary, next patient, pending requests | EXTEND | summary strip exists but is partly wrong (all-range count, `calendar-page.ts:221`); `home-summary` has `nextConfirmedAppointment` and `pendingRequestCount` (`scheduled-care.models.ts:146-151`) | `calendar-page.ts`, facade |
| **Everywhere** | | | | |
| 21 | Jour/Semaine/Mois tabs, prev/next, Aujourd'hui | REUSE | `calendar-view.html:14-33` | — |
| 22 | Date picker | NEW (UI-only) | `oc-date-field` exists (`shared/ui/date-field`) and is already used in the exception form; `changeView(mode, date)` supports jumps | `calendar-view.html` |
| 23 | Patient search | NEW (UI-only) over loaded range; or EXTEND `PracticePatientApiService.listPatients` for cross-range | filtering the visible appointments by name needs no API | `calendar-page.ts` |
| 24 | Filters | NEW (UI-only) (status/type/cabinet over loaded data; `oc-filter-chip`, `oc-filter-toolbar` primitives exist in `shared/ui`) | | |
| 25 | « Mode discret » (initials; reasons hidden) | NEW (UI-only) | today full names in titles, tooltip, aria-label, drawer. Initials helper partly exists (`compactPatientLabel`, unused). Must also cover FC `title` (set to full name, `calendar-event.adapter.ts:340`), tooltip, aria, drawer. Persist in `localStorage` is UI-only | adapter + view + panel |
| 26 | Keyboard shortcuts T, J, S, M, ← →, arrows, Space, Enter, N, /, G, D, Esc, ? ; none for patient-impacting actions | NEW (UI-only) | none today; Esc handled by NG-ZORRO overlays only. Must be scoped so they do not fire inside inputs/drawers | `calendar-page.ts` host listener |
| 27 | Realtime refresh, loading/error states | REUSE | | |

### Items marked NEEDS DATA (listed, not solved)
1. Per-day capacity (booked, bookable) — exact values.
2. Appointment **type** (cabinet / téléconsultation / domicile).
3. **Follow-up flag** on the doctor agenda item (`source`).
4. Doctor **reschedule** (« Déplacer »).
5. **Mark absent** without an in-progress consultation.
6. **Message / Call** patient endpoints.
7. **Patients à prévenir** list.
8. Appointment **motif** on the list/detail projection (today only free `notes`).
9. Per-cabinet schedule (design shows « cabinet » filters; schedule is per doctor).
10. Doctor-initiated booking for OmniCare (non-practice) patients.

---

## i) Risks
- **Overlap with consultation files (owned by another chat):**
  - `QuickBookingDrawer` is also used by `consultation/consultation-page.{ts,html}` (follow-up booking) and `patient-chart/patient-chart-page.{ts,html}` (grep). Restyling or changing its inputs hits those.
  - « Démarrer la consultation » navigates to `/doctor/consultation/:id` via `ActiveConsultationStore` (`scheduled-appointment-detail-panel.ts:419-436`); that store and `consultation-page` are out of scope.
- **Overlap with schedule-change files:** weekly hours / lunch break are edited in `settings/bulk-schedule-editor.*` (used by `settings-page`), and `availability-exception.adapter.ts` serves the exception form. The calendar reads the same rules, so any change to hour semantics (e.g. per-cabinet) lands there.
- **Blast radius of a restyle:**
  - `CalendarView` is used only by `calendar-page` and the static-demo page (grep: `app-calendar-view` in `calendar-page.html`, `calendar-page.static-demo.html`/`.ts`).
  - `ScheduledAppointmentDetailPanel` is also used by `command/command-center-page.ts`; `BookingRequestDetailPanel` by `requests-page` and command center.
  - `shared/ui/appointment-status.ts` is the single status mapping « Calendar, home, lists and drawers » (`:1-4`) — changing colours/labels changes every status chip in the workspace (`oc-status-tag`).
  - Global: `styles/vendor/_fullcalendar.scss`, `styles/tokens.scss`, NG-ZORRO Less theme. `CalendarView` is `ViewEncapsulation.None`, so its CSS is global.
  - The `static-demo` build has its own parallel calendar (~1.7k lines + e2e). Decide whether it is updated or frozen; production `CalendarView` already imports its scss.
- **Behavioural risks:** browser-zone rendering (section b); month view currently shows no exceptions (`calendar-event.adapter.ts:168`) so « closed » month styling needs its own source; the pending-request drop at `calendar-page.ts:638` is intentional-looking but undocumented — enabling it changes counts (e.g. `appointments().length`, `calendar-page.ts:221`, which is in fact an overcount today).
- **Security / privacy notes:**
  - Patient full names are on screen in cards, tooltips, aria-labels and FC `title` (`calendar-event.adapter.ts:340`); drawer shows phone, e-mail, address, date of birth for practice patients (`scheduled-appointment-detail-panel.ts:181-203`). There is no discreet mode.
  - The exception « Motif » is free text shown in the grid (`calendar-event.adapter.ts:181`).
  - No `console.*` in `calendar/` or `scheduled-care/` non-spec files (grep empty). Logging elsewhere not audited.
  - Idempotency keys use `crypto.randomUUID` (`facade:504`), fine; no tokens or secrets seen in the calendar files. State is cleared on logout via `SensitiveStateRegistry` (`facade:65,104-126`).
  - Test data only was read; no real patient data was printed.

---

## Open questions (not decided)
1. **Month: FullCalendar or custom grid?** The approved month tiles (no text, fill bar, hover preview) are far from `dayGridMonth`. Replace for month only, or for all views?
2. **Day view**: new custom list component replacing the `timeGridDay` — confirmed? Should it show free slots computed client-side (approximate) given no doctor-side free-slot endpoint?
3. **Workload formula**: which statuses count as « booked » (CONFIRMED, PROPOSED, IN_PROGRESS, COMPLETED, NO_SHOW; CANCELLED excluded?) and do **pending requests** count (the server holds time for them)? Is an approximate client computation acceptable, or is a back-end endpoint to be requested and parked?
4. **Pending requests in the calendar**: orange dashed « demande » cards need `BOOKING_REQUEST` rows (currently filtered, `calendar-page.ts:638`). Are they to be accepted/refused/proposed inside the new side panel (reusing the existing facade) or still on `/doctor/requests`?
5. **Follow-up marker**: acceptable to derive it by joining `GET /appointments` (`source=DOCTOR_FOLLOWUP`) on the front, or park it until the agenda projection exposes it?
6. **Type icons (téléconsultation / domicile)**: not in any DTO — park the visio/home icons and show only cabinet / patient externe for now?
7. **Palette conflict**: the shared status mapping uses violet for « en cours » and grey for « terminé » (`appointment-status.ts:70-89`); the design uses violet for « suivi » and green for « en cours/terminé ». Change the shared mapping (affects home, lists, drawers) or add a calendar-only presentation layer?
8. **Quick create « type + duration »**: slots come from the server grid; duration/type are not selectable today. Park or reinterpret?
9. **Static-demo variant**: update, freeze or delete? Its e2e (`doctor-calendar-static-demo.spec.ts`) and 1.7k lines of parallel code exist.
10. **Time zone**: should the calendar be pinned to `Africa/Tunis` (set FullCalendar `timeZone`) regardless of the browser? Not verified at runtime.
11. **Secretary agenda** (`/doctor/secretary-agenda`): in scope for the redesign or left as is?
12. **« Mode discret »** scope: also the drawer, the tooltip, the page `<title>`/aria text, and the notification deep link?
13. **Keyboard shortcuts**: confirm the map (note: `G`, `D`, `Space`, arrows and `/` conflict with typing, FullCalendar focus handling and drawers) and which key does what — the list in the brief names keys but not all actions (e.g. G, D).
14. Unverified back-end facts to confirm if the redesign depends on them: statuses returned by `GET /appointments` (`AppointmentQueryService`), exact notification emission on doctor cancel, `ConfirmedAppointmentResponse` fields, controllers for `GET /patients` and `GET /me/practice-locations`, holidays model.

---

## Path to deliver G-3 (calendar)
1. **Freeze the data contract (no back-end change).** Decide questions 3, 4, 5, 6 and park the NEEDS DATA list above. Produce a one-page « calendar UI data contract » that lists, per design element, the field used today vs. the parked one.
2. **Pure, tested adapters first (UI-only, safe).** Add `calendar-capacity.adapter.ts` (booked ÷ bookable per day from rules + exceptions + appointments), a « calendar presentation » mapper (status → design colour/dash/icon, type, follow-up if available) and « discreet » label helpers. Unit-test like `calendar-time.adapter.spec.ts`. Reuse `projectBusinessHours`, `fullyBlockedDateKeys`, `isWorkingTime`.
3. **Stop dropping pending requests** (one-line filter change at `calendar-page.ts:636-640`) behind the presentation mapper; wire « Accepter / Proposer / Refuser » to the existing `ScheduledCareFacade` and `BookingRequestDetailPanel`.
4. **Week view restyle** on FullCalendar: status cards, break block, striped closed slots + « Rouvrir », hidden empty days, now line; keep `CalendarView` presentational and keep the status mapping decision from Q7 isolated to the calendar layer if the team does not want the workspace-wide change.
5. **Month view**: new component (tiles, fill bar, dots, +n, hover preview, click → day via `changeView(mode, date)`); day menu using the existing exception form logic (Fermer / Pause / Prolonger).
6. **Day view**: compact list component (appointments, free slots, breaks, now, summary, next patient from `home-summary`, pending requests).
7. **Global chrome**: date picker (`oc-date-field`), patient search and filters over loaded data, « Mode discret », keyboard shortcuts (scoped, none on patient-impacting actions), French copy; fix the day-summary count (`calendar-page.ts:221`).
8. **Side panel**: add Appeler (`tel:`), keep Démarrer la consultation / profile / Annuler; add buttons for Déplacer, Message, Marquer absent as **parked / disabled-hidden** until the back-end contract exists.
9. **Hardening**: set an explicit time zone policy (Q10), add specs for the new adapters and components, extend e2e beyond the screenshot smoke (`urgent-readiness.spec.ts:212-221`), update or freeze the static-demo variant (Q9), run `npx ng test --watch=false` and `npx ng build --configuration production` (per `omniCareDash/CLAUDE.md`).
10. **Parked back-end requests (to hand to the back-end team, not built here):** per-day capacity, appointment type, follow-up flag + motif on the agenda item, doctor reschedule, direct mark-absent, message/call, « patients à prévenir », per-cabinet schedule.
