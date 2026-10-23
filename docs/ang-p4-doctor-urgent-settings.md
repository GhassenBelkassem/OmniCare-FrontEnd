# ANG-P4 Doctor urgent settings

**Contract date:** 2026-10-15  
**Branch:** `feature/frozenp3`  
**Current milestone:** ANG-P4-05-R1 V1 capability-scope correction

## 1. Executive verdict

**ANG-P4-05-R1 is ready for review, subject to sections 28 and 29.** The Services tab exposes only
the three V1 Doctor capabilities: `CABINET`, `URGENT_HOME`, and `URGENT_CABINET`. The unsupported
planned `HOME_VISIT` option is no longer rendered, while a historical stored value remains in the
unfiltered canonical capability state and is preserved by every full-replacement save.

The conditional urgent configuration, fee/distance precision, shared-revision behavior,
backend-owned readiness, active-Cabinet prerequisites, and P3 scheduled CABINET surface remain
unchanged. Backend inspection found a separate Patient-directory exposure for historical
`HOME_VISIT`; ANG-P4-05-R1 records the required server-side containment but does not mutate backend
contracts or existing Doctor data.

The ANG-P4-04-R1 responsive, accessibility, contrast, and E2E corrections remain intact. The CTO
must still approve the rendered evidence before this narrow urgent-settings surface is called
visually frozen.

The existing Services tab at `/doctor/settings?tab=services` remains the sole permanent urgent
configuration editor and authoritative readiness presentation. Its independent HOME/CABINET
capabilities, exact fee/distance decimals, revision handling, Cabinet prerequisite, and backend
blockers were not changed by containment.

The presentation never derives eligibility from Angular form state. When
`completeLiveMatchingEligibilityEvaluated=false`, it explicitly states that a complete verification
was not performed and never calls the Doctor available for a real request. The former
`/doctor/urgent-readiness` experience no longer reads or displays its synthetic runtime fixtures; it
is a small read-only pointer to the single Services-tab source.

No runtime switch, GPS publication, offer action, navigation, arrival, consultation, Patient data,
legacy urgent request, or P3 scheduling behavior was added or changed.

## 2. Git and worktree preservation

The original and final branch is `feature/frozenp3`. Existing ANG-P4-01 work and pre-existing dirty
changes to `angular.json`, Doctor shell, shared sidebar, and untracked assets were preserved. No
commit, push, reset, checkout, stash, dependency installation, Docker operation, Flutter edit,
backend edit, MRS edit, or generated-baseline update was performed.

## 3. Installed implementation basis

The workspace resolves Angular core 21.2.19, Angular CLI/build 21.2.20, TypeScript 5.9.3, RxJS
7.8.2, and NG-ZORRO 21.3.3. The implementation follows Angular's official signals/OnPush,
templates/control flow, and HTTP testing guidance. Existing standalone components, semantic
`--oc-*` tokens, authenticated `HttpClient`, and shared OmniCare UI primitives are reused.

## 4. KEEP / REUSE / REPAIR / DEFER

| Decision | Result                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KEEP     | The exact Doctor-self readiness endpoint, Services placement, shared revision authority, three V1 capability switches, and permanent configuration editor. |
| REUSE    | The ANG-P4-01 typed API service, authenticated HTTP stack, status badges, loading patterns, save outputs, and Doctor route guard.                          |
| REPAIR   | The synthetic urgent-readiness route and missing save/re-entry/explicit refresh behavior for backend readiness.                                            |
| DEFER    | Runtime mutation, request-specific routing eligibility, GPS publication, offer commands, mobile synchronization, and all Flutter Doctor operations.        |

## 5. Exact P4-03A API mapping

Angular issues only:

```text
GET /api/v1/me/care-capabilities/urgent-configuration/readiness
```

The typed response maps `revision`, `professionalEligible`, HOME and CABINET
`capabilityEnabled`, `configurationReady`, `runtimeAvailabilityIntent`,
`effectiveCurrentEligibility`, and `blockingReasons`, followed by
`completeLiveMatchingEligibilityEvaluated` and `evaluatedAt`. No Doctor UUID or request body is
sent. The backend controller derives identity from `AuthenticatedUser`, requires `DOCTOR`, and
returns private `no-store` data varying by authorization.

The P4-03A service currently sets `effectiveCurrentEligibility=false` and
`completeLiveMatchingEligibilityEvaluated=false` because request-specific location/route matching
is not performed by this endpoint. The Angular UI preserves that limitation.

## 6. Location and presentation

The read-only card is inside `ServicesSettingsSection`, immediately after the permanent HOME/
CABINET editor and before equipment/cabinet details. It is not another editor and cannot write a
revision. Each mode presents four independent rows:

- permanent capability;
- configuration completeness;
- runtime availability intention; and
- current operational eligibility.

A separate server-evaluation boundary explains whether complete live matching was evaluated. The
layout uses semantic headings, field descriptions, status regions, visible refresh control, shared
cards/tokens, and a one-column responsive form below tablet width.

## 7. Capability, configuration, and runtime semantics

The UI deliberately treats these as distinct authorities:

```text
permanent capability
  != configuration complete
  != runtime intent
  != current operational eligibility
  != request-specific matching eligibility
```

A positive permanent configuration never becomes an availability claim. Runtime intent is
read-only and described as an intention. A complete eligibility badge is possible only when the
backend explicitly returns `completeLiveMatchingEligibilityEvaluated=true`; otherwise both modes
show `Vérification complète non effectuée`.

## 8. Backend blockers and French mapping

The exhaustive known catalog covers capability disabled; missing HOME fee/distance; missing
CABINET fee; no active Cabinet; professional ineligibility; HOME/CABINET runtime intent disabled;
clinical activity; active urgent capacity claim; post-handoff unavailability; missing, stale,
inaccurate, or unavailable location presence; and request-specific eligibility not evaluated.

Every mapping is privacy-minimized French guidance. Unknown future string values render
`Condition supplémentaire à vérifier` without exposing the raw backend reason. Angular does not
invent blockers or display capacity identities, coordinates, Patient details, or internal tokens.

## 9. Refresh, ordering, and stale data

Readiness loads on Services component entry and refreshes after a successful capability save, a
successful urgent fee/distance save, or the explicit Doctor refresh action. There is no polling.
Each request receives a monotonic local sequence; only the newest request may update state, so a
late older response cannot overwrite newer readiness.

Readiness is isolated from the configuration form. Refreshing, failing, or receiving a new
readiness revision never changes its fields, baseline, dirty flag, expected revision, or existing
409 reconciliation behavior. During refresh, the previous response is visibly stale. A network or
server failure retains it only as explicitly unverified data; an initial failure shows no fallback.

## 10. Error and authorization states

The component distinguishes initial loading, loaded authoritative data, stale refresh, backend
unavailability, HTTP 401 session expiry, HTTP 403 access denial, and unknown blockers. A 401 clears
the private response and offers the existing reauthentication path. A 403 also clears it. The
Doctor shell remains guarded by authenticated `DOCTOR`; Secretary, Patient, Admin, Clinic, and
other roles receive no new route or service access.

## 11. Existing urgent-readiness route disposition

`/doctor/urgent-readiness` remains routable inside the guarded Doctor shell for compatibility, but
its component no longer imports its capability reader, runtime fixtures, operation fixtures, or
synthetic presentation. It displays no operational value and contains no editor. Its sole action
navigates to `/doctor/settings?tab=services`.

The old fixture and presentation files were left unchanged as isolated legacy test material; they
are no longer referenced by the route component. Their later deletion belongs to the legacy
containment milestone, not this narrow integration.

## 12. Security, privacy, and accessibility

The browser supplies no Doctor identity and performs no runtime mutation. Readiness is never stored
in localStorage or treated as authorization. The UI contains no Patient identity, symptoms,
destination, precise GPS, HOME address, offer, claim token/fence, MRS value, or operational command.

The card has semantic headings and lists, labelled loading/status/alert regions, native keyboard-
accessible buttons, visible status text in addition to color, responsive stacking, and reduced-
motion-safe behavior. It uses the existing private authenticated HTTP convention.

## 13. Files changed

New production files:

- `settings/urgent-care-readiness-presentation.ts` — exhaustive known mapping plus safe fallback;
- `settings/urgent-care-readiness-settings.ts/html/scss` — authoritative read-only presentation.

Narrow production amendments:

- `settings/urgent-care-configuration-api.models.ts` — forward-compatible reason type;
- `settings/services-settings-section.ts/html` — composition and successful-save refresh;
- `urgent-readiness/urgent-readiness-page.ts/html/scss` — synthetic data removal and Services link.

Tests added/amended:

- `urgent-care-readiness-presentation.spec.ts`;
- `urgent-care-readiness-settings.spec.ts`;
- `urgent-care-configuration-api.service.spec.ts`;
- `services-settings-section.spec.ts`; and
- `urgent-readiness-page.spec.ts`.

This existing living document was updated. No shell, sidebar, global navigation, P3 schedule,
appointment, normal CABINET, Flutter, backend, MRS, Clinic, or Admin source was changed.

## 14. Verification evidence

Focused readiness/Services certification passed **27/27 tests** across five files. The complete
Doctor Settings, legacy readiness, and Doctor route set passed **284/284 tests** across 38 files.
The complete Angular result and production build are recorded after final verification.

Coverage includes full HOME, missing fee, missing distance, CABINET fee, active-Cabinet
prerequisite, disabled capability, professional ineligibility, runtime inactivity, clinical and
capacity blockers, incomplete live evaluation, unknown fallback, no-fallback failure, 401/403,
stale retention, overlap ordering, both save-triggered refreshes, dirty-draft preservation, exact
self GET, no runtime control, no legacy urgent call, route containment, and existing Settings/P3
tests.

## 15. Performance and clean-code review

The card issues one bounded GET on entry and on explicit or successful-save refresh. It adds no
polling, cache, local persistence, state library, unbounded subscription, scheduler, GPS call,
legacy urgent request, or write endpoint. Subscriptions are lifecycle-bound; state is local signals
and the request-order fence is constant-memory.

## 16. P3 and legacy containment after ANG-P4-02

At the ANG-P4-02 boundary, existing availability rules, exceptions, Calendar, appointment
configuration, Request/Command Center, consultation, normal Cabinet settings, and profile
consultation pricing remained untouched. Live urgent availability, GPS, offer acceptance/decline,
navigation, arrival, QR, and medical access remained outside the approved Angular ownership.

The ANG-P4-03 disposition of the route-level fixtures and wider legacy
`/api/v1/urgent-requests/**` code is recorded in sections 19 through 26.

## 17. Remaining work

At the ANG-P4-02 close, ANG-P4-03 still owned explicit legacy Angular urgent containment. That
containment is now complete in sections 19 through 26. Production activation still requires the
backend/mobile operational gates, real request-specific eligibility, location and routing policies,
monitoring, and production review.

## 18. ANG-P4-02 verification baseline

- focused readiness/Services: **27/27 tests** across five files;
- complete Settings/readiness/Doctor-route set: **284/284 tests** across 38 files;
- complete Angular suite: **842/842 tests** across 117 files;
- production browser/SSR build: **PASS**;
- UI-boundary check: **PASS**;
- Prettier check on every ANG-P4-02 file: **PASS**; and
- `git diff --check`: **clean (no output)**.

The build retains the repository's existing unused-import warnings, missing
`src/polyfills/global.ts` compilation warning, and initial-bundle budget warning. Node 25.6.0 also
reports its standard odd-numbered/non-LTS warning. No warning was hidden or represented as newly
introduced readiness failure. Existing unrelated dirty work remains preserved.

## 19. ANG-P4-03 legacy call-site inventory

The former active Doctor graph was:

```text
DoctorShell -> DoctorUrgentApiService -> availability/incoming/accept/decline
            -> DoctorLocationPushService -> browser geolocation -> request location
            -> UrgentAcceptedStore -> global localStorage -> matched-request hydration
Requests/Command Center -> incoming offers -> detail panel -> accept/decline/arrival/navigation
Calendar -> accepted/matched stores -> legacy request reads -> synthetic urgent estimates
RealtimeService -> /user/queue/urgent-requests -> shell/requests/calendar operational state
Consultation ?source=urgent -> mock c-14/urgent record -> clinical UI
```

P3 scheduled care uses separate `ScheduledCareApiService`, `ScheduledCareFacade`, booking and
appointment detail panels, `/user/queue/scheduled-care`, `/user/queue/appointments`, and normal
appointment APIs. General notifications use `/user/queue/notifications`. Those shared authorities
were retained.

## 20. Containment decision by surface

| Surface                                  | Decision | Result                                                                                                                                                                                                                                       |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doctor shell                             | REPAIR   | Removed combined availability control, hardcoded Tunis coordinates, incoming banner, polling, offer commands, matched hydration, and GPS-service construction.                                                                               |
| Requests                                 | REPAIR   | Removed the legacy urgent tab/actions/polling/detail panel; kept the P3 booking-request list and added one neutral mobile-ownership note.                                                                                                    |
| Command Center                           | REPAIR   | Removed legacy urgent count/card/polling/detail panel; kept daily appointments, P3 summaries, quick actions, and loading/error states.                                                                                                       |
| Calendar                                 | REPAIR   | Removed legacy request reads, accepted/matched-store projection, urgent synthetic estimates, and urgent event handling; kept scheduled appointments, rules, exceptions, invalidation, and degraded-realtime refresh.                         |
| Realtime                                 | ISOLATE  | Doctor sessions do not subscribe to `/user/queue/urgent-requests`; appointment, scheduled-care, notification, token-change, reconnect, and cleanup behavior remains. The old stream is retained only for out-of-scope Patient compatibility. |
| Consultation                             | REPAIR   | `source=urgent` renders a non-operational mobile-only state and loads no consultation, mock urgent record, QR, or medical record.                                                                                                            |
| Dedicated legacy service/panel/GPS files | ISOLATE  | No production Doctor component imports or instantiates them. They remain as clearly bounded legacy code pending a broader Patient/legacy removal decision.                                                                                   |

## 21. Sensitive storage handling

`UrgentAcceptedStore` is no longer an offer store or business authority. It exposes only
`purgeLegacyCache()`, which is called when the Doctor shell starts. The method checks the browser
platform, removes exactly `omnicare_accepted_offers`, reads no cached payload, writes no urgent
data, and catches hardened-storage failures. It never calls `localStorage.clear()` and does not
touch authentication, P3, Clinic, or other keys. Re-entry after logout/account switch repeats the
same exact-key cleanup, so an old offer cannot be restored into actionable Doctor state.

## 22. HTTP, GPS, consultation, and medical-access boundary

The active Doctor shell, Requests, Command Center, and Calendar have no import of
`DoctorUrgentApiService`; no automatic incoming/status/request read and no accept, decline, arrival,
location, or availability mutation remains. `DoctorLocationPushService` has no active production
consumer, so Angular Doctor construction cannot begin a geolocation watch or publish coordinates.
The previous hardcoded `36.8065, 10.1815` values were removed from the shell.

Legacy consultation deep links are treated as unsupported UI state. They cannot select `c-14`,
load an urgent mock record, expose a medical record, infer QR/MRS access, or create a P2
consultation. Legitimate nonurgent P2 consultation behavior is unchanged.

## 23. P3, Settings, readiness, and security preservation

P3 request loading, Doctor-home summary, confirmed appointments, Calendar range loading,
availability rules/exceptions, scheduled-care invalidation, appointment realtime, and notification
realtime remain on their existing services. The Doctor role guard and route tree are unchanged;
Secretary access was not broadened. No Clinic, Admin, Patient API, backend, Flutter, MRS, global
sidebar asset/style, or P3 API contract was edited.

ANG-P4-01/02 files were not changed by this milestone. Permanent urgent configuration and
backend-owned readiness remain under `/doctor/settings?tab=services`; `/doctor/urgent-readiness`
remains a read-only pointer and did not regain fixtures or editing.

## 24. UX and accessibility result

The shell retains its layout, patient lookup, private notifications, connection status, navigation,
and the pre-existing `Espace médecin` user wording. Removing the unsafe controls leaves no blank
shell region. Requests uses the existing page-header, state, card, badge, and empty-state language
and clearly assigns urgent operations to the mobile Doctor app without a fabricated deep link.
The blocked consultation state uses a heading, explanatory copy, and keyboard-accessible existing
button. No broad stylesheet or design-system change was made.

## 25. ANG-P4-03 files

Production amendments are limited to:

- `core/realtime/realtime.service.ts`;
- `features/doctor/doctor-shell.ts` and `.html`;
- `features/doctor/urgent-accepted.store.ts`;
- Doctor Requests, Command Center, Calendar, and Consultation page TypeScript/templates.

Tests amend the matching component/realtime specs and add
`features/doctor/urgent-accepted.store.spec.ts`. This existing living document is the only
documentation file amended. No dedicated legacy file was deleted because its remaining non-Doctor
consumers and wider retirement ownership are outside this surgical milestone.

## 26. Verification and remaining work

Focused containment/P3 verification passed **64/64 tests** across six files. It covers the Doctor
queue exclusion while preserving scheduled-care/appointment/notification queues, P3 Requests,
Command Center and Calendar behavior, safe consultation deep links, and exact-key browser/SSR
storage cleanup. The affected Doctor/P3 workspace passed **500/500 tests across 61 files**. The
complete Angular suite passed **837/837 tests across 118 files**. The production browser/SSR build,
Prettier check on every ANG-P4-03 file, UI-boundary check, and `git diff --check` all passed.

The existing Angular compiler warnings remain: unused imports in unrelated Clinic, Patient Chart,
Prescriptions, and shared detail-panel components; the missing `src/polyfills/global.ts` compilation
entry; and the production initial-bundle budget warning. Node 25.6.0 retains its odd-numbered/non-LTS
warning. No new warning was introduced by containment.

ANG-P4-04 should perform manual visual certification of the affected Doctor shell, Requests,
Command Center, Calendar, blocked consultation state, and the preserved Services/readiness UI at
desktop and responsive widths. Broader deletion of isolated legacy Patient/Doctor urgent artifacts
requires its own ownership review; they must not be reconnected as a P4 fallback.

ANG-P4-03 READY FOR ARCHITECTURE REVIEW

## 27. ANG-P4-04-R1 responsive, accessibility, and E2E correction

### Root causes and narrow repair

The Settings page combined a viewport-minus-sidebar maximum width with a parent workspace that
could resolve to an intrinsic width wider than the Doctor shell. At 390 CSS pixels this collapsed
the Settings container to approximately 94 pixels while the urgent form retained approximately
294 pixels. At 768 and the 720-pixel zoom-equivalent width, the horizontal tab strip did not reveal
the query-selected Services tab. The shared page-header actions wrapper also placed an
`aria-label` on a plain `div`, and several required labels used contrast combinations below WCAG AA.

The correction keeps the existing layout and design system. The Doctor shell and workspace grids
now use `minmax(0, 1fr)`, the centered workspace has an explicit available width, and Settings plus
its nested content use `max-width: 100%` and `min-width: 0`. No fixed mobile width, transform, or
content-hiding overflow rule was added. The existing `OcTabs` remains the sole tab system: it uses
one roving tab stop, Left/Right/Home/End keyboard movement, a visible focus indicator, and one
post-render horizontal reveal of the selected tab. The reveal changes only the tab strip's
`scrollLeft`, so it does not cause a vertical page jump.

The page-header actions wrapper is now a valid named `role="group"`; projected action order and
accessible names are unchanged. Required urgent-configuration, readiness, and equipment guidance
text now uses the existing secondary semantic foreground token. Measured contrast changed from
**2.34:1** for the active tab on white, **4.42:1** for muted text on the subtle surface, and
**4.32:1** for muted text on the green surface to:

- active tab: **10.58:1**;
- configuration status: **9.20:1**;
- readiness eyebrow: **9.20:1**;
- readiness metadata/timestamps: **9.20:1**;
- equipment guidance: **9.01:1**; and
- equipment description: **9.20:1**.

The current Services surface has no critical or serious Axe finding for the selected WCAG 2 A/AA,
2.1 A/AA, and 2.2 AA tags. Shared component tests cover page-header semantics/focus order and the
tab roving-focus, wrapping, disabled-tab, Home, and End behavior.

### Responsive and current-contract browser evidence

The replacement `e2e/urgent-readiness.spec.ts` uses isolated backend-shaped fixtures and certifies
the read-only bridge route; the three V1 capability switches; independent exact HOME/CABINET
decimals; null versus explicit `0.000`; HOME distance precision; active-Cabinet prerequisite;
backend-owned blockers and incomplete-matching disclosure; unavailable/stale readiness; shared-
revision conflict with draft preservation; keyboard navigation; computed contrast; and Axe. It
does not expect the retired standalone editor or the obsolete `Espace clinique` wording.

The exhaustive responsive case passed at **1440, 1024, 768, 720, and 390 CSS pixels**. At every
width, the Services tab intersects the visible tab strip, the page has no horizontal overflow, and
the urgent cards and fields remain within the Settings container. The full Playwright run across
desktop, tablet, and mobile projects passed **25 tests**, with **2 intentional skips** because the
single desktop-project case itself executes the complete five-width matrix. All projects still run
the bridge, functional, shell/P3, and Axe cases. The Doctor shell, Requests, and Calendar smoke
case also passed across all three projects.

Screenshot evidence uses synthetic non-sensitive fixtures:

- `/private/tmp/ang-p4-04-r1/services-1440.png`;
- `/private/tmp/ang-p4-04-r1/services-1024.png`;
- `/private/tmp/ang-p4-04-r1/services-768.png`;
- `/private/tmp/ang-p4-04-r1/services-720.png`;
- `/private/tmp/ang-p4-04-r1/services-390.png`;
- `/private/tmp/ang-p4-04-r1/services-validation-readiness.png`;
- `/private/tmp/ang-p4-04-r1/services-revision-conflict.png`;
- `/private/tmp/ang-p4-04-r1/services-readiness-stale.png`;
- `/private/tmp/ang-p4-04-r1/services-backend-unavailable.png`;
- `/private/tmp/ang-p4-04-r1/doctor-p3-requests.png`; and
- `/private/tmp/ang-p4-04-r1/doctor-p3-calendar.png`.

These images are evidence for manual review, not automatic visual approval.

### Regression and release gate

Focused Settings/shared accessibility verification passed **75/75 tests**. The ANG-P4-03 Doctor/
P3 containment set passed **64/64 tests**. The complete Angular suite passed **841/841 tests across
120 files**: the 837-test ANG-P4-03 baseline plus four new shared-component tests. The earlier
ANG-P4-02 842-to-ANG-P4-03 837 reduction remains reconciled as one removed legacy urgent-realtime
frame test, six removed legacy Calendar urgent tests, one consultation urgent test replaced
one-for-one, and two new storage-containment tests—a net five-test reduction with no P3, Doctor
authentication, realtime, or security coverage loss.

The production command generated both browser and SSR bundles successfully. UI-boundary and
Prettier checks passed. A representative `/clinic/staff` Playwright/Axe smoke also passed after the
shared page-header repair; no separate Admin feature consumer/test exists in this workspace. The
existing warnings remain: six unrelated unused imports, the production
initial-bundle budget excess, development-server sourcemap/hydration diagnostics, the missing
polyfill compilation entry during tests, and Node 25.6.0's odd/non-LTS warning. No R1 warning was
introduced.

Manual approval must still evaluate typography, spacing, field density, tab discoverability,
focus visibility, contrast, 200% zoom usability, French wording, and the preserved desktop Doctor
shell/P3 experience from the screenshots or an equivalent trusted local render. Approval freezes
only the Doctor urgent-settings scope; it does not freeze unrelated Doctor Dashboard features.

ANG-P4-04-R1 TECHNICALLY READY — AWAITING MANUAL UI APPROVAL

## 28. ANG-P4-05 conditional visibility and location clarity

### Canonical state and conditional editor

The capability endpoint remains the authority for the persisted `URGENT_HOME` and
`URGENT_CABINET` set. The Services coordinator now gives the urgent editor both the current switch
draft and the capability component's canonical baseline. HOME and CABINET cards render only when
their corresponding switch is selected. When neither is selected, the detailed form is absent and
one concise note explains how to expose it and confirms that saved values are retained.

A newly selected but unsaved urgent mode is labelled **À enregistrer**. Its inputs are read-only,
and the urgent configuration action is disabled while any capability selection differs from the
canonical set. The Doctor must first use the existing **Enregistrer les modes** action. The UI does
not call the mode active on the backend until the capability response confirms it.

Conditional rendering never removes a form control or changes persistence semantics. The editor
still loads HOME fee, CABINET fee, and HOME maximum road distance regardless of visibility, retains
their exact strings in memory, and sends all three fields in every authorized full-replacement
request. Hidden `null`, explicit `0.000`, three-decimal TND, six-decimal distance, dirty draft, and
three-way shared-revision reconciliation behavior is unchanged.

### Readiness and location wording

Readiness remains a separate Doctor-self backend response. Enabled modes continue to show every
server-provided fact and blocking reason. When the backend reports a mode's permanent capability as
disabled, its card instead shows one neutral **Mode inactif** summary; the response object and its
blocking-reason array are not filtered or rewritten. The request-specific eligibility disclaimer
appears only when at least one backend mode is enabled, and no Angular state claims eligibility.

The HOME card now explains that road distance is evaluated from live GPS supplied by the mobile
OmniCare Médecin application and that this dashboard does not read the Doctor's position. The
CABINET card states that its location comes from the active practice location in the existing
Cabinets tab and that the urgent editor creates no second Cabinet location authority. No browser
geolocation watcher, map, Cabinet editor, runtime control, or backend contract was added.

### Cabinets-tab audit

The existing `/doctor/settings?tab=cabinets` implementation persists latitude and longitude on the
canonical practice-location record. Both values are visible, editable, range-validated, and
prepopulated when the Doctor opens **Modifier**; the dialog also retains the existing
**Utiliser ma position actuelle** action. The normal cabinet card shows name, city, governorate,
address, status, accessibility, phone, instructions, and gallery, but not its saved coordinate pair.

There is no map, pin preview, reverse-geocoded comparison, or explicit visual confirmation that the
saved coordinate matches the displayed address. That is a separate map-position confirmation UX
gap. ANG-P4-05 does not modify the Cabinets tab or backend to address it.

### Files and verification

Production changes are limited to the Services coordinator TypeScript/template, urgent
configuration TypeScript/template/styles, and readiness template/styles. Focused amendments cover
the corresponding three specifications. No P3, Doctor shell, routing, authentication, Secretary,
legacy urgent, Cabinet, backend, Flutter, or MRS source was changed.

Focused capability/configuration/readiness verification passed **39/39 tests across four files**.
The complete Angular suite passed **845/845 tests across 120 files**, four more than ANG-P4-04-R1.
The production build generated both browser and SSR bundles successfully. Existing warnings remain
the six unrelated unused imports, the 960.36 kB initial bundle exceeding its 750 kB budget, the
test-only missing polyfill compilation entry, and Node 25.6.0's odd/non-LTS warning; ANG-P4-05
introduces no new warning.

ANG-P4-05 READY FOR REVIEW

## 29. ANG-P4-05-R1 V1 capability-scope correction

### Visible options and historical-value preservation

The Doctor Settings editor now renders only **Consultation au cabinet**, **Urgence à domicile**,
and **Urgence au cabinet**. The planned non-urgent `HOME_VISIT` capability remains in the shared
Angular API union because it is still part of the backend enum and may be present in historical
responses, but it has no visible switch and cannot be newly selected through this editor.

This is deliberately a presentation-catalog change, not response filtering. The capability
component continues to copy the complete backend response into both its canonical baseline and its
draft. Toggling a visible option changes only that option, and the existing full-replacement PUT
sends the complete draft. A regression test starts with stored `HOME_VISIT`, enables
`URGENT_HOME`, and proves that the request contains both values. Hiding the option therefore does
not silently delete historical state, and no Doctor setting was automatically changed.

`URGENT_HOME` remains independent of `HOME_VISIT` and of Cabinet availability. Both the backend
enum (`requiresActiveCabinet=false`) and a focused Angular integration test confirm that it can be
enabled alone while the active-Cabinet status is `none`. `CABINET` and `URGENT_CABINET` retain the
existing active-Cabinet prerequisite.

### Backend exposure audit and recommended containment

The backend retains `HOME_VISIT` in `CareCapability`, as required for schema and historical-data
compatibility. P4 urgent HOME discovery is not affected: it explicitly tests for `URGENT_HOME`, not
`HOME_VISIT`. The legacy `/api/v1/urgent-requests/**` surface also remains fail-closed under the
existing P4-03E containment.

Historical `HOME_VISIT` can nevertheless remain visible and searchable in the authenticated
Patient Doctor directory. `GET /api/v1/doctors/search` accepts `careCapability=HOME_VISIT`, filters
directly against `professional_care_capabilities`, and returns every stored capability on each
search card. `GET /api/v1/doctors/{doctorId}` likewise returns the unfiltered configured-capability
list for a verified Doctor. Removing the Angular switch alone does not contain those projections.

The safe follow-up is a separately reviewed backend compatibility change that rejects
`HOME_VISIT` as a new public-directory filter and omits it from public search/detail projections,
while retaining the enum, database constraint, applied migrations, Doctor-self canonical response,
and historical rows. It should add directory contract tests and must not bulk-delete or silently
rewrite existing Doctors' settings. A later owner-approved retirement policy can decide whether
and how historical rows are migrated.

### Files and verification

ANG-P4-05-R1 changes only the visible capability catalog, its focused tests, the existing
backend-shaped E2E expectation, and this living document. Urgent configuration/readiness source,
fees, distance, revision reconciliation, P3 business logic, Flutter, backend, and MRS are unchanged.

Focused Services/capability/configuration/readiness verification passed **40/40 tests across four
files**. The complete Angular suite passed **846/846 tests across 120 files**. The production build
generated both browser and SSR bundles successfully. Existing warnings remain the six unrelated
unused imports, the 960.36 kB initial bundle exceeding its 750 kB budget, the test-only missing
polyfill compilation entry, and Node 25.6.0's odd/non-LTS warning; ANG-P4-05-R1 introduces no new
warning.

ANG-P4-05-R1 READY FOR REVIEW
