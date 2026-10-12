# Doctor Cabinet and Gallery Management — P1-07B

## Scope

The Doctor Settings **Cabinets** tab is the authoritative Angular surface for managing independent Doctor-owned `CABINET` practice locations. A Doctor can own multiple cabinets. This feature does not represent or modify Clinic membership.

Care capabilities, Cabinet equipment, mobile equipment, CNAM, and private-insurance coverage remain deferred to P1-07C. Scheduling remains in the separate **Emploi du temps** tab.

## Cabinet lifecycle

- The UI lists data returned by `GET /api/v1/me/practice-locations`; it contains no demo cabinet or gallery data.
- Create and edit use a typed reactive form. The backend owns the one-primary-cabinet invariant and returns the canonical resource.
- PATCH includes the location's `expectedRevision`. DELETE sends `expectedRevision` as a query parameter.
- A `RESOURCE_STATE_CONFLICT` preserves an edit draft and offers an intentional reload. A stale delete leaves the item visible and offers an intentional reload.
- Deactivation or deletion of the last active cabinet can return `CARE_CAPABILITY_REQUIRES_ACTIVE_CABINET`. The UI explains that Cabinet/Urgence au cabinet services must be disabled first; it never changes capabilities automatically.
- The maximum of 10 locations is mirrored once in the feature for early UX feedback. The backend remains authoritative.

## Gallery contract

- Each cabinet owns its ordered gallery. The first returned image is presented as its visual; there is no invented reorder or cover-selection action.
- Upload is `multipart/form-data` with binary part `file` and query parameter `displayOrder`.
- Client checks mirror the backend's simple envelope rules: JPEG or PNG, at most 8 MiB, and at most 10 images. Backend decode/re-encode validation remains authoritative.
- Media rendering uses only the response `url`. Storage keys are neither accepted nor rendered. Failed images use an accessible fallback.
- Media deletion requires confirmation and updates the gallery only after server success. Storage cleanup remains a backend concern.
- Safe mappings cover invalid media, media limit, unavailable object storage, authentication, network, and generic server failures without exposing backend detail.

## State and architecture

`PracticeLocationApiService` is the only feature HTTP boundary. Signals hold feature-local view state; no global store was added. Cabinet list, form, card, and gallery components keep loading and mutation states independent.

The form and destructive confirmation use existing OmniCare dialog boundaries, which provide focus containment/restoration and keyboard dismissal. Form fields have visible labels, errors use alert semantics, images have contextual alternatives, and all gallery actions have visible accessible names.

## Legacy profile location transition

The P1-07A `practiceCity`, `practiceLatitude`, and `practiceLongitude` professional-profile fields remain readable for Patient/backend compatibility, but Doctor Profile self-management no longer writes them. No fragile bidirectional synchronization was added. Structured `ProfessionalPracticeLocation` rows with `type = CABINET`, managed through the Cabinets tab, are the canonical patient-facing Doctor practice locations.
