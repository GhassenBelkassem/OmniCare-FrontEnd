# OmniCare UI guidelines (doctor workspace)

Read this before any UI change. Longer background: `docs/OMNICARE_WEB_DESIGN_SYSTEM.md`.

## 1. Tokens: `src/styles/tokens.scss`
The single source for colour, type, spacing, radius and elevation. The semantic tokens
(`--oc-color-*` in `src/styles/themes/_omnicare-light.scss`) alias these values. Prefer the
semantic token; use a primitive only when no semantic token fits. **Never hard-code a hex value
in feature SCSS.**

| Group | Tokens |
|---|---|
| Brand | `--oc-primary` #1FBF9A · `--oc-primary-dark` #0F6F73 · `--oc-accent` #6BE3B2 |
| Surfaces | `--oc-bg` #F4F5F7 (page) · `--oc-surface` #FFF (cards) · `--oc-border` |
| Text | `--oc-text-strong` · `--oc-text` · `--oc-text-muted` |
| Feedback | `--oc-error` (+ `-dark`) · `--oc-amber` (+ `-dark`) · `--oc-violet` (+ `-dark`) · `--oc-grey-50…700` |
| Tints | `--oc-{primary,accent,error,violet,amber,grey}-tint` for tag/card backgrounds |
| Type | Plus Jakarta Sans, `--oc-text-{display,h1,h2,h3,body,small,caption}-{size,weight,line-height}` |
| Spacing | `--oc-space-{1,2,3,4,6,8,12}` = 4/8/12/16/24/32/48 px |
| Radius / shadow | `--oc-radius-{sm,md,lg,pill}` · `--oc-shadow-{sm,md}` |

Bright feedback colours (#EF4444, #F59E0B, #8B5CF6) are for dots, borders and left rules. Use
their `-dark` variants for text so it stays WCAG AA.

`src/styles/vendor/ng-zorro-theme.less` duplicates the values NG-ZORRO needs at compile time
(primary, focus ring, font, radius, control height). Keep it in sync with `tokens.scss`.

## 2. NG-ZORRO first
- If NG-ZORRO has the component, use it: date picker, select, radio, checkbox, switch, segmented,
  tag, tooltip, modal, drawer, skeleton, empty.
- **Never** use a native `<input type="date">`, native radio/select/checkbox, or a hand-rolled
  modal or drawer.
- Dates go through `oc-date-field` (an `nz-date-picker` with `yyyy-MM-dd` values, shown as
  « jj/mm/aaaa »). Times go through `oc-time-field`.
- Don't add another UI library.

## 3. Shared primitives (`src/app/shared/ui`)
| Primitive | Use for |
|---|---|
| `oc-page-header` | Every page title: `title`, optional `subtitle`, `[ocPrimaryAction]` / `[ocSecondaryActions]` slots, optional decorative `[ocPageHeaderAside]` |
| `oc-section-card` | Card with icon + title, optional `[ocSectionAction]`, content |
| `oc-status-tag` | Any appointment status |
| `oc-empty-state` | Empty lists and panels |
| `oc-patient-chip` | A selected patient: initials, name, optional phone and remove button |

Check these before writing new CSS.

## 4. Appointment status: one mapping
`src/app/shared/ui/appointment-status.ts` is the only place that maps a status to a label or
colour. The calendar, home, lists and drawers all use it (directly or via `oc-status-tag`).

| Status | Label | Colour |
|---|---|---|
| pending booking request | En attente | amber |
| CONFIRMED | Confirmé | primary |
| IN_PROGRESS | En cours | violet |
| COMPLETED | Terminé | neutral grey (muted) |
| CANCELLED | Annulé | error (struck through in the calendar) |
| NO_SHOW | Absent | error-dark |

## 5. French only
- All user-facing text is French: templates, `aria-label`s, tooltips, toasts and errors.
- Locale is `fr` (`LOCALE_ID`, NG-ZORRO `fr_FR`, FullCalendar `fr`, `<html lang="fr">`). Format
  with `fr-FR`.
- Never show technical identifiers to doctors: UUIDs, "projection", "episode", backend enum
  codes. Unknown statuses read « Statut inconnu ».

## 6. Feature flags
Unfinished doctor features are hidden from navigation by `DOCTOR_FEATURES` in
`src/app/features/doctor/doctor-features.ts`. Their routes and code stay in place.

## 7. Patient chart access
The server computes the chart access mode (`EXTERNAL_OWNER`, `OMNICARE_GRANTED`,
`OMNICARE_RESTRICTED`) and the `access.clinical` / `access.editable` flags. The UI renders those
flags and never infers access from the patient type. Medical sections without access show the
compact `app-chart-access-required` block, never a full-page padlock.
