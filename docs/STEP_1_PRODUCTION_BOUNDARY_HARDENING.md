# STEP 1 — Production Boundary Hardening

## Scope

This record maps the Doctor workspace that is reachable from the production bootstrap. It does not
describe the isolated `static-demo` build, test fixtures, or development-only design-system route.

## Production route classification

| Route / feature                                        | Before                                                                                                                                       | Backend contract                                                                                                                                                                                                  | After                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/doctor/command`                                      | PARTIAL — real appointment/consultation/scheduled-care data, but the graph rendered a mock-dependent patient panel and a hard-coded greeting | Appointment, scheduled-care, active-consultation, urgent-cabinet and notification controllers                                                                                                                     | REAL                                                                                                 |
| `/doctor/secretary-agenda`                             | REAL                                                                                                                                         | `AppointmentController` / `AvailabilityController`; secretary permission checks remain authoritative                                                                                                              | REAL                                                                                                 |
| `/doctor/team`, `/doctor/team/:membershipId`           | REAL                                                                                                                                         | `MeSecretariesController`, `ROLE_DOCTOR`                                                                                                                                                                          | REAL                                                                                                 |
| `/doctor/patients`                                     | REAL                                                                                                                                         | `PracticePatientController`, `ROLE_DOCTOR`                                                                                                                                                                        | REAL                                                                                                 |
| `/doctor/patient/:id`                                  | PARTIAL — the administrative patient record is real; clinical history/documents are deliberately empty/protected                             | `GET /api/v1/patients/{id}`, doctor ownership enforced by `PracticePatientService`                                                                                                                                | PARTIAL; direct Doctor-created appointment action disabled because the backend denies that authority |
| `/doctor/calendar`                                     | REAL                                                                                                                                         | `AppointmentController`, `AvailabilityController`, scheduled-care projection and realtime invalidation                                                                                                            | REAL                                                                                                 |
| `/doctor/waiting-room`                                 | MOCK — fictional patients, timer and browser-only status mutations                                                                           | No queue/check-in/no-show lifecycle contract                                                                                                                                                                      | PLACEHOLDER                                                                                          |
| `/doctor/consultation/:id` and embedded Medical Record | REAL                                                                                                                                         | `DoctorConsultationController`, `DoctorMedicalRecordController`, `DoctorClinicalRecordController`, `DoctorPrescriptionController`, `DoctorClinicalOrderController`, `DoctorArtifactController`; all `ROLE_DOCTOR` | REAL                                                                                                 |
| `/doctor/prescriptions`                                | MOCK — fictional cross-patient prescriptions, requests and templates; handlers only logged                                                   | Only consultation-scoped prescription/order contracts exist; no cross-consultation aggregate/template contract                                                                                                    | PLACEHOLDER                                                                                          |
| `/doctor/results`                                      | MOCK — fictional results, recalls and tasks with browser-only mutations                                                                      | No Doctor results inbox, recall or follow-up-task contract                                                                                                                                                        | PLACEHOLDER                                                                                          |
| `/doctor/requests`                                     | PARTIAL — scheduled care was real but the route graph rendered the mock-dependent patient panel                                              | `DoctorScheduledCareController`, `DoctorBookingRequestController`, `ROLE_DOCTOR`                                                                                                                                  | REAL                                                                                                 |
| `/doctor/urgent-requests`                              | REAL                                                                                                                                         | Existing urgent Doctor APIs and server authorization; production API data source remains selected by the production route                                                                                         | REAL                                                                                                 |
| `/doctor/urgent-readiness`                             | PLACEHOLDER / redirector                                                                                                                     | Read-only settings authorities; operational urgent availability remains outside this web route                                                                                                                    | PLACEHOLDER                                                                                          |
| `/doctor/communication`                                | PLACEHOLDER                                                                                                                                  | No production messaging/calling contract                                                                                                                                                                          | PLACEHOLDER                                                                                          |
| `/doctor/history`, `/doctor/history/:consultationId`   | REAL                                                                                                                                         | Completed-consultation queries in `DoctorConsultationController`, `ROLE_DOCTOR`                                                                                                                                   | REAL                                                                                                 |
| `/doctor/billing`                                      | PLACEHOLDER                                                                                                                                  | No production billing contract                                                                                                                                                                                    | PLACEHOLDER                                                                                          |
| `/doctor/analytics`                                    | MOCK — hard-coded activity, demographics and revenue                                                                                         | No Doctor analytics/revenue aggregate contract                                                                                                                                                                    | PLACEHOLDER                                                                                          |
| `/doctor/settings`                                     | REAL                                                                                                                                         | Availability, professional profile, qualification, practice-location, capability, equipment, notification-preference and account-security controllers                                                             | REAL                                                                                                 |

## Verified contract changed by this step

### Doctor patient lookup

- Frontend: `PracticePatientApiService.listPatients({ query, page: 0, size: 8 })`.
- HTTP: `GET /api/v1/patients?query=...&page=0&size=8`.
- Controller: `PracticePatientController.search`.
- Application/service: `PracticePatientService.search` limits the query by authenticated Doctor ID.
- Authorization: controller-level `@PreAuthorize("hasRole('DOCTOR')")`; the HTTP security chain also
  requires authentication for `/api/v1/patients/**`.
- Response: Spring `Page<PracticePatientResponse>`; the Angular DTO consumes `content`, paging
  metadata and the administrative patient fields.
- Success: HTTP 200.
- Expected security/errors: unauthenticated and forbidden responses are produced by the existing
  security handlers. No permission was widened. The lookup presents a neutral error and never falls
  back to fixtures.
- Mutation/idempotency: not applicable; this is a read-only operation.

Selecting a result now opens `/doctor/patient/:id`. It no longer manufactures a consultation ID or
navigates to a fake consultation.

## Production/static-demo isolation

- Production `app.config.ts` imports only the production interceptor composition, which contains
  `authInterceptor`.
- The `static-demo` Angular configuration replaces that composition with the offline demo
  interceptor at build time.
- Production authentication imports a production `AUTH_MODE` implementation with no demo sessions
  or workspaces. The static-demo build replaces it with the demo implementation.
- Production Doctor routes import no demo pages, fixtures, demo data sources or `DoctorMockService`.
- Static-demo Doctor routes continue to select the approved static dashboard, patient directory,
  patient chart, calendar, waiting room, consultation, documents and urgent-request demo data
  source.
- Tests and demo-only source files retain fixtures where they are explicitly isolated.

`tools/check-production-boundaries.mjs` makes these composition rules executable and fails if the
known production composition files regain a demo/mock dependency or the unsafe routes cease to
resolve to the explicit unavailable state.

## Unsupported backend features

The following remain intentionally unavailable in production. No endpoint was invented:

- waiting-room queue, arrival, call, no-show and queue-status lifecycle;
- cross-consultation prescription/request/template listing and template CRUD;
- laboratory/imaging results inbox, result review acknowledgement, patient recalls and Doctor
  follow-up tasks;
- Doctor activity, demographic, utilization and revenue analytics;
- billing and receipts;
- patient messaging and calling;
- direct Doctor-created appointments from the patient administrative record. The security chain
  explicitly denies `POST /api/v1/appointments`; scheduled care remains patient-request driven.

Consultation-scoped prescriptions, clinical orders and official artifacts remain available inside a
verified active consultation through their existing real contracts.

## Security and runtime impact

- No Spring Security rule, controller authorization, session behavior or token handling changed.
- No backend source was modified.
- No polling was added.
- No WebSocket connection or subscription was added.
- No long-lived global state was introduced.
- Patient lookup uses a cancellable 250 ms debounce and at most eight server-owned results.
