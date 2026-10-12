# Doctor professional profile

The Doctor settings profile is backed by the authenticated self-service APIs under
`/api/v1/me/professional-profile`. It does not use dashboard demo identity or
qualification data.

## Profile ownership

The response supplies the authoritative identity, public professional fields,
managed account fields, and `revision`. Identity, licence, administrative
governorate, verification, and independent-practice status are presented as
read-only. MFA remains outside the professional profile surface.

The legacy `affiliatedClinicId`/`affiliatedClinicName` projection is not presented
in Doctor Settings. It is an admin/provisioning-era association, not operational
Clinic access. `clinic_memberships` remains the sole Clinic membership and access
authority; Doctor-facing Clinic membership management is deferred.

Editable profile values are sent as a partial PATCH. Every non-empty PATCH includes
the last server-provided `expectedRevision`; the response replaces local state and
provides the next revision. A `RESOURCE_STATE_CONFLICT` never retries automatically.
The Doctor must explicitly reload the current server state.

## Education and certifications

Education and certification lists use their dedicated GET, POST, PATCH, and DELETE
routes. Add/edit forms use the project Reactive Forms and dialog primitives. PATCH
includes each entry's `expectedRevision`, and the returned resource replaces the
local copy. DELETE sends the displayed entry's revision as the required
`expectedRevision` query parameter. A stale `RESOURCE_STATE_CONFLICT` leaves the
entry visible, never retries automatically, and offers an explicit reload action.
Only a successful response removes the local entry. Display order is preserved
deterministically; interactive drag-and-drop is not part of this release.

## Practice-location transition

Structured `ProfessionalPracticeLocation` rows with `type = CABINET` are the
canonical patient-facing practice locations. Legacy `practiceCity`,
`practiceLatitude`, and `practiceLongitude` values may still arrive in compatibility
reads, but they are absent from the Profile draft and PATCH contract. Existing
persisted values are not cleared or synchronized. Cabinet location and coordinates
are managed only in the **Cabinets** section.

## Consultation modalities

The wire field remains `consultationTypes` for compatibility, but the Profile UI
presents it as **Modalités de consultation**. It is descriptive metadata shown to
patients only. It never enables a service or changes availability, discovery,
routing, or request eligibility. `ProfessionalCareCapability` remains the
operational capability authority.

## Deferred domains

This feature intentionally excludes Cabinet management, Cabinet gallery,
capabilities, equipment, and CNAM/private-insurance coverage. It also does not add
schedule, urgent-care, ratings, billing, or avatar-upload workflows.
