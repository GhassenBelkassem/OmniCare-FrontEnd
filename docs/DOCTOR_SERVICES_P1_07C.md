# Doctor Services — P1-07C

## Scope and responsibility boundary

The Doctor **Services** tab is the production configuration surface for:

- permanent care capabilities;
- Doctor-level mobile equipment;
- equipment available in each Cabinet;
- CNAM, private-insurance, and direct-payment declarations for each Cabinet.

The **Cabinets** tab remains responsible for practice-location identity, address, accessibility,
activation, and gallery management. P1-07C does not move or duplicate those controls and does not
change the P1-07B Cabinet card, form, or gallery components.

The previous Services demo list (local names, durations, prices, ECG entry, and Teleconsultation)
was removed. It had no persistence and represented a second, inaccurate source of truth. Templates,
Preferences, and Schedule remain outside this replacement.

## Semantic boundaries

```text
Care capability
!= current availability
!= weekly schedule
!= urgent online/runtime status

Cabinet equipment
!= Doctor mobile equipment
!= quantity, inventory, asset, or maintenance record

Coverage declaration
!= verification or CNAM convention status
!= Patient eligibility
!= reimbursement, claims, billing, or payment method
```

Enabling an urgent capability only configures the Doctor to participate in that mode. It does not
place the Doctor online or promise immediate availability. `CABINET` and `URGENT_CABINET` cannot be
added without an active Cabinet; the UI prevents that selection while the backend remains the
authority.

Mobile choices are limited to definitions returned by the backend with `portable: true`. Cabinet
equipment may use any active definition in the same backend-owned catalog. Equipment names and
codes are never invented in Angular.

CNAM, private insurance, and direct payment use only `NOT_DECLARED`, `ACCEPTED`, and
`NOT_ACCEPTED`. French labels hide the wire enum. The UI presents one concise declaration note and
never labels a Doctor-entered claim as verified. Private insurance remains a general declaration;
there is no insurer-name catalog.

## API contracts and revisions

Typed data access is isolated in `professional-services-api.service.ts`:

```text
GET /api/v1/me/care-capabilities
PUT /api/v1/me/care-capabilities

GET /api/v1/me/equipment
PUT /api/v1/me/equipment/mobile

GET /api/v1/me/practice-locations/{locationId}/equipment
PUT /api/v1/me/practice-locations/{locationId}/equipment

GET /api/v1/me/practice-locations/{locationId}/coverage
PUT /api/v1/me/practice-locations/{locationId}/coverage
```

Each PUT is a complete-set replacement and sends the last server-provided `expectedRevision`.
Success adopts the response revision; Angular never increments a revision. Capabilities, mobile
equipment, each Cabinet equipment aggregate, and each Cabinet coverage aggregate keep independent
revisions.

`RESOURCE_STATE_CONFLICT` and `COVERAGE_CONFIGURATION_CONFLICT` preserve the current draft and
offer an explicit reload. Reloading is the intentional action that discards the stale draft. No
automatic retry can overwrite a concurrent edit.

## Loading and multi-Cabinet strategy

Capabilities, equipment overview/mobile state, and the Cabinet list load independently. Each has
its own loading and error state. A save disables only its own action.

Cabinet summaries are read-only and collapsed initially. Expanding one summary creates its two
focused child components and issues exactly that Cabinet's equipment and coverage GETs. Therefore,
opening Services does not produce two requests for every Cabinet, and one Cabinet's loading,
revision, conflict, or save state cannot affect another Cabinet.

## Error and security behavior

The feature reuses the existing RFC 9457 parsing helpers and adds only domain-specific French
mapping. It handles authentication/authorization, network and server failures, validation,
profile/location absence, portability/catalog failures, active-Cabinet dependency, and both stale
revision codes. Backend `detail`, raw codes, revisions, and Cabinet IDs are not rendered as normal
UI.

All server text is rendered through Angular interpolation. The feature does not use direct DOM
HTML insertion, `DomSanitizer` bypasses, local storage, or a client-created identity/revision.

## Accessibility and responsive behavior

- Native checkboxes and radio groups provide keyboard behavior.
- Capability checkboxes use switch semantics with visible labels and descriptions.
- Coverage controls use `fieldset` and `legend` per declaration.
- Cabinet summaries are native buttons with `aria-expanded`.
- Loading, success, and errors use status/alert semantics.
- Visible focus uses OmniCare semantic tokens.
- Three-column coverage groups stack at tablet widths; all control groups stack on narrow screens.

No new dialog is introduced. No Spartan/CDK/NG-ZORRO disclosure or switch primitive is added;
native controls and the existing vendor-neutral `OcButton` boundary are sufficient for this slice.

## Resolved frontend baseline and official references

Resolved from `package-lock.json` during P1-07C:

- Angular core/common/forms `21.2.19`;
- Angular CDK `21.2.14`;
- TypeScript `5.9.3`;
- RxJS `7.8.2`;
- Spartan Brain `1.2.0` (no Helm runtime package installed);
- NG-ZORRO `21.3.3`.

References checked:

- [Angular 21 HTTP client](https://v21.angular.dev/guide/http)
- [Angular 21 making HTTP requests](https://v21.angular.dev/guide/http/making-requests)
- [Angular 21 forms](https://v21.angular.dev/guide/forms)
- [Angular 21 signals](https://v21.angular.dev/essentials/signals)
- [Angular 21 accessibility](https://v21.angular.dev/best-practices/a11y)
- [Angular 21 security](https://v21.angular.dev/best-practices/security)
- [Angular CDK accessibility](https://material.angular.dev/cdk/a11y/overview)
- [Spartan installation and architecture](https://www.spartan.ng/documentation/installation)
- [Spartan switch](https://www.spartan.ng/components/switch)
- [Spartan collapsible](https://www.spartan.ng/components/collapsible)
- [Spartan dialog](https://www.spartan.ng/components/dialog)
- [NG-ZORRO introduction](https://ng.ant.design/docs/introduce/en-US)

## Deferred

Scheduled availability, urgent online/runtime controls, named insurers, reimbursement and claims,
billing, inventory, clinical equipment recommendations, Flutter adoption, and all Clinic workflows
remain deferred.
