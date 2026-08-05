# OmniCare dashboard authentication and role roadmap

**Prepared:** 2026-08-05  
**Primary surface:** `omniCareDash` (Angular web)  
**Supporting systems:** `OmniCare-BackEnd`, PostgreSQL, Redis, notification email/SMS, MRS only where clinical workflows require it

## 1. Target outcome

Deliver one web login entry that authenticates a user and then routes them into a strictly authorized workspace. For the MVP, `ADMIN` uses email and password with the existing opaque session model; stronger admin factors are deferred.

| Authenticated role | Initial route | Initial product scope |
|---|---|---|
| `ADMIN` | `/admin` | Create and manage independent professionals, clinics, clinic admins, account status, and sessions |
| `DOCTOR` | `/doctor` | Complete first-login setup and reach the doctor workspace; add operational doctor features after the auth/admin slice |
| `CLINIC_ADMIN` | `/clinic` | Reach the active clinic membership, manage team membership and clinic configuration without changing medical qualifications |
| Other clinic roles | `/clinic` | Reach only the capabilities returned by clinic bootstrap and granted by membership/responsibility scope |

`PATIENT`, independent `NURSE`, and independent `KINE` are not part of the first Angular delivery unless product explicitly adds them. Their backend roles remain supported.

## 2. Source-of-truth decisions

The reviewed specifications agree on the role set and security goals, but these points must be frozen before implementation:

1. **Doctor web is an explicit scope extension.** Module 07 describes most doctor screens as Flutter work, while the requested product and Clinic V1 require doctor access through the Angular portal for long documentation. The Angular `/doctor` workspace is therefore a deliberate web implementation/extension, not an accidental substitution for the mobile app.
2. **Keep MVP login simple.** The shared login form accepts email and password. A successful login returns the existing opaque session and the authenticated role, which controls the redirect.
3. **Defer enhanced admin login security.** Admin TOTP, WebAuthn hardware keys, IP allowlisting, special authentication transactions, and idle-timeout hardening remain required by the long-term specification but are not MVP blockers.
4. **Use the existing bearer session for the MVP.** Angular sends the opaque access token in the `Authorization` header and keeps both tokens in memory only. Cookies, CSRF protection, and stronger admin browser controls remain a later, versioned hardening change.
5. **Platform admin owns identity and qualification.** `ADMIN` creates/verifies doctors and clinic professional identities. A `CLINIC_ADMIN` manages memberships, positions, schedules, and responsibilities but cannot create a medical identity or turn an assistant into a clinician.
6. **A global role is not enough for clinic authorization.** Clinic access requires an active `ClinicMembership` plus position/responsibility and clinic/unit/service scope checks.
7. **Clinical data stays out of dashboard tables.** The admin and clinic dashboards use projections and references. Medical content is read/written through the MRS and access-grant contracts only in authorized clinical flows.

## 3. Current implementation baseline

### Backend already present

- All ten locked roles exist, with useful role predicates.
- Opaque Redis-backed access sessions, rotating refresh tokens, PostgreSQL mirrors, role-based TTLs, logout, device/session revocation, and `/api/v1/auth/me` exist.
- Email/password login, patient phone/Google paths, audit infrastructure, notifications, profile work, and MRS integration foundations exist.
- A local `ADMIN` bootstrap exists.
- `POST /api/v1/admin/professionals` is protected by the `ADMIN` role and can create a professional record.

### Backend gaps blocking the requested flow

- Password login already creates the full opaque session required for the simplified MVP flow.
- Professional provisioning currently accepts an admin-supplied plaintext password. The MVP should still replace this with a one-time invitation so admins never know user passwords; MFA enrollment can be added later.
- No magic-link/invitation lifecycle, first-login tracking, specialties/governorate/admin notes, or professional list/detail/status APIs are implemented.
- No clinic aggregate, clinic membership, position/responsibility, or clinic bootstrap implementation is present.
- No dedicated admin MFA flow, IP allowlist, idle timeout, admin activity journal, or two-person approval service is present. The login hardening items are deferred; activity auditing remains part of account-management work.
- No doctor dashboard/consultation APIs from Module 07 are present.
- Security configuration denies all non-enumerated routes, so every new API must be explicitly authorized.

### Angular dashboard already present

- Angular 21 standalone foundation, semantic `--oc-` tokens, NG-ZORRO integration, accessible shared UI components, lazy feature boundaries, and a design-system showcase exist.
- `/login`, `/admin`, `/doctor`, and `/clinic` feature route boundaries exist but are intentionally empty. `/platform-admin` is a temporary redirect to `/admin`.

### Angular gaps blocking the requested flow

- No HTTP client configuration, environment API contract, auth service/store, interceptor, refresh coordination, login screen, role guards, or authenticated shells exist.
- No production feature screens exist yet.
- Auth services, interceptors, refresh coordination, login screens, role guards, and authenticated shells are Phase 1/2 work.

## 4. Delivery strategy

Build vertical slices that are usable end-to-end. Do not start with all admin charts or the full Clinic V1 workflow engine. The first release is complete when an admin can securely create a doctor and a clinic admin, and both users can complete onboarding, log in through the same entry, and land in the correct authorized workspace.

## 5. Phased roadmap

### Phase 0 — Contract freeze and green baseline

**Goal:** Make the repository safe to extend and freeze the web auth contract.

Backend:

- Freeze the existing email/password login, refresh, `/auth/me`, and logout response contracts.
- Choose cookie names, CSRF strategy, web/mobile client signaling, CORS origins, timeout behavior, and error codes.
- Freeze canonical routes: `/login`, `/first-login`, `/admin`, `/doctor`, `/clinic`.
- Separate Docker-required integration tests from unit/web-slice tests and restore the existing non-Docker auth/audit failures to green.

Dashboard:

- Add typed runtime configuration for the backend base URL.
- Reduce the initial production bundle below its configured error budget; keep the design-system route development-only and lazy.
- Add CI commands for unit tests, production build, backend unit tests, integration tests, and migration validation.

**Exit criteria:** frozen API examples; non-Docker test suite green; Angular tests and production build green; no secrets in browser storage.

Frozen contract: `OmniCare-BackEnd/docs/api/dashboard-web-auth-v1.md`.

**Completed baseline (2026-08-05):** The contract above is frozen; runtime API configuration is typed and public-only; canonical role routes are established; Angular unit tests and the production build pass; the initial production bundle is 743.88 kB against a 1 MB error budget; and the backend non-Docker suite passes 314 tests. Docker-backed tests are isolated behind the Maven `integration` profile.

### Phase 1 — Basic web authentication spine

**Goal:** Reuse the current email/password and opaque-session backend safely from Angular.

Data/migrations:

- Professional invitation/magic-link records storing only token hashes, with 48-hour expiry and one-time use.
- `first_login_at`, `last_active_at`, and invite status.

API/application work:

- Keep `POST /api/v1/auth/login` as the shared email/password endpoint for admin, doctor, and clinic-admin accounts.
- Add first-login magic-link validation and password setup.
- Continue issuing opaque Redis-backed access and refresh sessions through the existing session services.
- Preserve generic invalid-credential errors, rate limiting, account-status checks, immediate revocation, and login audit telemetry.
- Expose a stable `/api/v1/auth/me` response for Angular startup and role redirect.

**Exit criteria:** valid credentials create a session; invalid, suspended, or revoked accounts cannot authenticate; role-protected APIs reject the wrong role; revoked sessions fail immediately.

**Backend completed (2026-08-05):** Added the `professional_invitations` lifecycle with hashed 256-bit tokens, 48-hour expiry, one-time acceptance, audited creation/activation, and public validate/accept contracts. Admin professional creation no longer accepts a password: it creates an inactive account with an unverified email, and acceptance verifies the email, creates the user-selected password, and activates the account before normal login. `first_login_at` and `last_active_at` are recorded on successful login. The complete non-Docker backend suite passes 320 tests. The Angular `/first-login` experience remains Phase 2 UI work.

### Phase 2 — Angular login and authorization spine

**Goal:** One login experience safely routes every supported web role.

Core implementation:

- `provideHttpClient`, typed API error model, credentials/CSRF configuration, and a single auth interceptor.
- Signal-based `AuthStore` with `unknown`, `anonymous`, and `authenticated` states.
- Startup session restoration through `/api/v1/auth/me`; never trust a role from local storage.
- Serialized refresh behavior so concurrent `401` responses cause one refresh attempt.
- Guest guard, authenticated guard, role guard, first-login guard, and capability/membership guard.
- Shared login, expired-invite, forced-password-change, forbidden, and session-expired screens.
- Role redirect map:
  - `ADMIN` → `/admin`
  - `DOCTOR` → `/doctor`
  - `CLINIC_*` with active membership → `/clinic`
  - unsupported web role → safe “web access unavailable” page plus logout
- Authenticated application shell with accessible skip link, user identity, notification entry, and logout.

Testing:

- Unit tests for every guard and redirect.
- Interceptor tests for refresh success, refresh failure, and concurrent `401`s.
- Browser tests for direct URL access, back-button behavior, expired sessions, and cross-role URL attempts.

**Exit criteria:** role redirects are deterministic; a hidden navigation item never substitutes for backend authorization; SSR/hydration does not access browser-only APIs unsafely.

### Phase 3 — Super-admin professional and clinic onboarding MVP

**Goal:** The super admin can create and manage the two account types requested: doctor and clinic admin.

Backend minimum:

- Professional list/detail projections with status, role, specialty, governorate, first login, and last activity.
- Replace admin-supplied passwords with invitation creation and background email delivery.
- Create independent `DOCTOR` with verified license workflow and magic-link password setup.
- Create clinic aggregate with contact/INPDP fields.
- Create `CLINIC_ADMIN` identity plus `INVITED` membership for that clinic; activate membership only after onboarding/verification rules pass.
- Activate, suspend, deactivate, resend invitation with cooldown, list/revoke sessions, and append admin activity records.
- Idempotency keys for create/invite operations and uniqueness handling for email, phone, license, and clinic INPDP number.

Recommended API slice:

```text
GET    /api/v1/admin/professionals
POST   /api/v1/admin/professionals
GET    /api/v1/admin/professionals/{id}
PATCH  /api/v1/admin/professionals/{id}/status
POST   /api/v1/admin/professionals/{id}/resend-invitation
GET    /api/v1/admin/professionals/{id}/sessions
DELETE /api/v1/admin/professionals/{id}/sessions/{sessionId}

GET    /api/v1/admin/clinics
POST   /api/v1/admin/clinics
GET    /api/v1/admin/clinics/{id}
POST   /api/v1/admin/clinics/{id}/administrators/invitations
GET    /api/v1/admin/clinics/{id}/memberships
```

Angular minimum:

- Admin shell and navigation.
- Professional list with server pagination/filtering, create-doctor form, detail page, status actions, invitation resend, and session revocation.
- Clinic list, create-clinic form, clinic detail, and invite-clinic-admin form.
- Confirmation and error states for duplicate identities, active-work blockers, expired invitations, and email-delivery retry.

**Exit criteria:** an admin can create a doctor and clinic admin without choosing their passwords; both receive one-time invitations; all mutations are audited; suspension immediately revokes sessions.

**Implemented locally (2026-08-05):** Added the clinic aggregate, clinic-admin memberships, specialty/governorate directory fields, admin idempotency records, duplicate email/phone/license/INPDP checks, five-minute invitation resend cooldown, account lifecycle actions, access and refresh session revocation, and Tier 2 admin audit events. Invitation acceptance activates an invited clinic membership atomically. The Angular dashboard now has the shared login and first-login screens required to reach the Phase 3 flow, an admin shell, professional and clinic list/create/detail pages, invitation resend, status confirmations, membership visibility, and session revocation. The complete non-Docker backend suite passes 341 tests; Angular passes 21 tests and its production build remains below the 1 MB initial bundle budget. Real email delivery requires deployment SMTP configuration; local development intentionally uses the non-delivering provider.

### Phase 4 — Doctor first usable web slice

**Goal:** An invited doctor can onboard, log in, and use a small real workspace.

- Complete invitation → password setup → login → `/doctor` journey.
- Doctor profile read/update with qualification fields read-only.
- Add availability, weekly/day appointments, and today stats backend endpoints.
- Build the doctor command center from real APIs with loading, empty, error, offline, and permission states.
- Defer consultation close, e-prescription, follow-up booking, and AI scribe until their appointment/access/MRS dependencies are ready.

**Exit criteria:** no mock role selector or localStorage identity; doctor sees only owned data; direct admin/clinic URLs return `403` server-side and a safe UI.

### Phase 5 — Clinic-admin first usable slice

**Goal:** A clinic admin can operate within one or more authorized clinic memberships.

Backend:

- Clinic membership schema/states and authoritative clinic-scoped repositories.
- `GET /api/v1/clinics/{clinicId}/bootstrap` returning membership, positions, responsibilities, capabilities, structure version, and notification summary.
- Team list and membership invitation/request flow. Invitations may link an already verified identity or enter a platform-admin verification queue; they do not create a medical qualification directly.
- Suspend/activate/end membership with blocker checks and session/capability invalidation.
- Multi-clinic isolation and authorization policy at HTTP, service, repository, and aggregate levels.

Angular:

- Clinic selector when multiple active memberships exist.
- Clinic shell generated from bootstrap capabilities.
- Team list, membership status, invite/request workflow, and removal request.
- Initial configuration screens: Structure, Team, Responsibilities, Schedules, Workflows, Test, Activate.

**Exit criteria:** Clinic A cannot infer or access Clinic B data; clinic admin has no automatic medical access; changing membership or responsibilities takes effect without relying on stale navigation state.

### Phase 6 — Operational expansion

After the identity/onboarding vertical slice is stable, expand in dependency order:

1. Doctor consultation start/close, MRS write contract, e-prescription, follow-up, history, and later AI assistance.
2. Clinic intake/case lifecycle and Module 05 atomic handoff.
3. Clinic task engine, acknowledgement, escalation, reassignment, and handover.
4. Staff scheduling, absences, replacement coverage, and external blocks.
5. Rooms/beds/resources, then operating-room planning.
6. Workflow configuration/versioning and partnership finance.
7. Remaining admin sections: patients, fraud/flags, support, compliance, operations, settings, two-person approval, and break-glass.

Each expansion must preserve clinic isolation, MRS boundaries, idempotency, audit tiers, outbox delivery, and no-medical-content notification/WebSocket rules.

## 6. First three implementation increments

### Increment A — Basic login skeleton

- Existing backend email/password login plus stable `/auth/me`, refresh, and logout contracts.
- Angular login screen, auth store, interceptor, guards, and role redirects.
- Temporary authenticated landing pages for `/admin`, `/doctor`, and `/clinic` backed by `/auth/me`.

### Increment B — Admin creates doctor

- Magic-link invitation and first-login setup.
- Admin professional list/create/detail.
- Doctor completes onboarding and reaches `/doctor`.

### Increment C — Admin creates clinic and clinic admin

- Clinic and membership foundation.
- Admin clinic create/detail and clinic-admin invitation.
- Clinic admin completes onboarding, bootstrap resolves active clinic, and `/clinic` renders the authorized team workspace.

This order produces a demonstrable end-to-end result after every increment. Enhanced admin authentication can be added later without changing the dashboard role boundaries.

## 7. Definition of done for the requested MVP

- One `/login` entry supports admin, doctor, and clinic admin without a demo role selector.
- Email/password authentication uses opaque, revocable backend sessions.
- Admin can create a doctor, create a clinic, invite a clinic admin, view status, suspend/reactivate where allowed, resend an invitation, and revoke sessions.
- Doctor and clinic admin choose their own passwords from one-time, hashed, expiring invitations.
- Every role lands on the correct lazy Angular workspace and cannot open another role's APIs or pages.
- Clinic authorization requires active membership and scope, not only `CLINIC_*` role.
- No access or refresh token is stored in localStorage.
- Security-sensitive mutations are auditable and session revocation is immediate.
- Angular unit/browser accessibility tests, backend unit/integration/security tests, migrations, and production build are green.
- No clinical plaintext is introduced into dashboard/backend operational tables.

## 8. Work intentionally deferred from the MVP

- Full Admin Module 14 analytics, fraud, support, compliance, platform operations, and settings.
- Full Doctor Module 07 consultation/e-prescription/AI workflow.
- Full Clinic V1 case/task/resource/OR/workflow/finance scope.
- Patient web workspace.

These remain on the program roadmap, but they should not delay the secure identity, onboarding, role redirect, and account-management foundation requested here.

## 9. Deferred admin-login hardening

Return to these controls after the MVP account and role flows are working:

- Admin TOTP.
- WebAuthn hardware-key registration and assertion.
- Admin IP allowlist and VPN policy.
- Thirty-minute server-side idle timeout and fixed working-day session expiry.
- Break-glass re-authentication and two-person approvals.
- Dedicated security tests for challenge expiry, replay prevention, recovery, and factor reset.

The future hardening phase must preserve the same `/login` entry and `/admin` route. It should extend the backend login response into a challenge flow without requiring the admin dashboard features to be rebuilt.
