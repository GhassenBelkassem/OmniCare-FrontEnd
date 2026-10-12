# P2-02 Scheduled Cabinet Care — Frontend Product Freeze

Status: frontend-only prototype for product review. This document does not
freeze transport DTOs, persistence, backend state machines, notification
delivery, or medical-record storage.

## 1. Final scheduled booking flow

The Patient selects who needs care, finds a Doctor, keeps the matching or
explicitly selected Cabinet, chooses one exact free slot, reviews the complete
request, and submits it. Submission creates `PENDING_DOCTOR`; it does not imply
confirmation. The slot is presented as held while the Doctor decides.

The Doctor can accept, choose a structured free replacement slot, or decline.
Acceptance produces `CONFIRMED`. A replacement produces
`PENDING_PATIENT_TIME_CONFIRMATION`; the Patient can accept it once or decline
it. V1 deliberately has no endless negotiation loop.

## 2. Doctor schedule semantics

Weekly working windows, an optional pause, exceptions, slot duration, and
occupied or held records conceptually generate future free slots. The Doctor
does not create slots individually. Supported prototype durations remain 15,
20, 30, 45, and 60 minutes. The minimum normal scheduled-booking notice is
four hours.

## 3. Cabinet scope

Availability is Cabinet-scoped in the P2 product. Angular Settings makes the
active Cabinet explicit and keeps separate local prototype rules for Cabinet
Lac 2 and Cabinet Ariana. The current real P1 schedule remains Doctor-wide and
continues to use its existing API without unsupported Cabinet fields.

Every P2 request or appointment carries a `CabinetPrototype` with ID, display
name, street address, and city. Patient review/status/appointments and Doctor
Requests/Home/Calendar/Agenda all display that context.

## 4. Subject continuity

`PatientSubjectPrototype` distinguishes `SELF` from `FAMILY_MEMBER`. A family
subject retains its family-member ID, display name, and relationship label from
Who Needs Care through Directory, Doctor Detail, Availability, Review, request
status, confirmation, and Mes rendez-vous. The prototype never silently
substitutes the account holder for a selected family member.

## 5. Booking-request states

The canonical prototype lifecycle states are:

- `PENDING_DOCTOR`
- `PENDING_PATIENT_TIME_CONFIRMATION`
- `EXPIRED`
- `CANCELLED_BY_PATIENT`
- `CANCELLED_BY_DOCTOR`

`PENDING`, `PROPOSED`, and `BOOKED` are not used as ambiguous canonical names.
A request displays its creation time and response deadline. The frontend shows
deadline urgency but does not claim to run an authoritative expiry worker.

## 6. Appointment states

An accepted request becomes an `AppointmentPrototype` with canonical state
`CONFIRMED`. Booking, appointment, and future clinical consultation are kept as
separate concepts. Existing operational states in real P1 surfaces may remain,
but arrival, QR, waiting-room, consultation, and no-show workflows are outside
this P2 core.

## 7. Counterproposal flow

The Doctor chooses a replacement only from Cabinet-bound free-slot UI. There is
no arbitrary time entry. The original held slot is presented as released, the
replacement as held, and the request becomes
`PENDING_PATIENT_TIME_CONFIRMATION` with a prototype Patient deadline. Patient
acceptance creates a confirmed appointment; refusal creates
`CANCELLED_BY_PATIENT` and a new request is required to try another time.

## 8. Cancellation

Patients may cancel pending, proposed, or confirmed records. Cancellation under
24 hours shows a neutral late-cancellation warning but remains allowed; no fee
or billing behavior exists. The prototype records `cancelledAt`, a reason when
provided, and `lateCancellation`.

Doctors are shown “Proposer un autre créneau” before cancellation on confirmed
appointments. Doctor decline/cancellation requires a reason and produces
`CANCELLED_BY_DOCTOR`.

## 9. Expiry

Both pending states can be projected as `EXPIRED`. The UI explains that the
request is inactive, the held slot is released, and the Patient may select a
new slot. There is no background timer or server authority in P2-02.

The Doctor response deadline is modeled as the earlier of 24 hours after
creation and four hours before the requested slot. A two-hour soft-response
target is presented as guidance. The exact counterproposal TTL remains for the
backend/DTO phase; the prototype uses six hours only to exercise the UX.

## 10. Optional intake

After confirmation, the Patient can optionally prepare the visit with the
existing body map, symptom description, and pain-intensity components. Intake
has an independent `NOT_SUBMITTED` or `SUBMITTED` state and never gates
appointment confirmation. The Doctor sees submitted content only after
submission; otherwise the UI states that no preparation was sent.

All intake data is in-memory prototype state. Future persistence requires an
approved health-data/MRS boundary. It must not be serialized into ordinary
appointment or request fields.

## 11. Schedule editing with existing appointments

Schedule rules govern future free-slot generation. Existing commitments retain
their exact start and end if a weekly window or slot duration changes. Angular
warns when a proposed rule would place existing commitments outside future
availability and explicitly states they will not be automatically cancelled.

## 12. Angular ownership

Angular Doctor owns the full workstation experience:

- Settings schedule editing, Cabinet context, validation, and conflict warning;
- scheduled request inbox with accept/propose/decline actions;
- structured replacement-slot selection;
- day/week/month Calendar projections with distinct record identity;
- lightweight Command Center projections.

Urgent requests remain a separate real domain.

## 13. Flutter Patient ownership

Flutter Patient owns subject selection, Doctor/Cabinet continuity, exact-slot
selection, booking review, pending/proposed/confirmed status, cancellation,
optional intake, and the Mes rendez-vous lifecycle presentation. The modern P2
request branch uses local prototype submission; the existing generic P1 direct
booking branch remains available and real.

## 14. Flutter Doctor ownership

Flutter Doctor is a compact companion. Home and Agenda are projections over the
same local scheduled-care controller. Agenda retains month/day navigation and
adds incoming-request actions, structured Cabinet free slots, canonical state
markers, cancellation/expiry presentation, and confirmed-only intake display.
It does not reactivate the legacy reservation route or add clinical actions.

## 15. Real data versus static prototype

Real P1 behavior retained:

- Angular Doctor-wide schedule and exception APIs;
- Angular real appointments and realtime appointment events;
- Flutter Who Needs Care and family data;
- Flutter Doctor directory/detail/availability reads;
- Flutter generic direct-booking POST when no P2 scheduled draft is active.

Explicit P2 prototype behavior:

- Cabinet-scoped schedule variants;
- scheduled request/appointment negotiation state;
- held/free-slot projections and deadlines;
- Patient Mes rendez-vous P2 records;
- Flutter Doctor Home/Agenda scheduled records;
- optional visit-preparation intake.

The prototype controllers/stores have no repository, HTTP, WebSocket, database,
or MRS dependency. No fake endpoint is called.

## 16. Remaining DTO/backend phase

P2-03 may now evaluate static DTO candidates for Patient subject references,
Cabinet identity, exact requested/proposed slots, canonical status, response
deadlines, cancellation metadata, optimistic concurrency/idempotency, and
notification events. It must separately approve the health-data/MRS boundary
before any intake persistence.

Still intentionally unresolved for backend freeze: the authoritative Patient
counterproposal TTL, hold implementation, expiry worker/clock authority,
notification transport, timezone serialization, and concurrency behavior when
a held/free slot changes. These are transport/runtime decisions, not product UX
ambiguities.
