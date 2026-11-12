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

## 8. Clinical visual language (medical record and consultation, G-1 P2e)
Applies to « Dossier patient » (drawer and chart page) and the consultation page. Tokens are in
`tokens.scss` (« Clinical record visual language »); never write these hex values in a component.

1. **Grey is only the page background** (`--oc-bg` #F4F5F7) and hairline borders
   (`--oc-hairline` #E8EBF0). Cards are white, `--oc-shadow-soft`, radius `--oc-radius-card`
   (20px). Inner tiles: radius `--oc-radius-tile` (16px) on `--oc-tile` (#FAFBFC).
2. **Text:** strong `--oc-ink` (#16202A), secondary `--oc-ink-secondary` (#4A5562, ≥ 4.5:1).
   **No uppercase labels**: labels are sentence case, 13px / 600.
3. **Hierarchy:** page or drawer title 26 / 800; section title 18 / 700; key values 16–18 / 700;
   big facts (blood group) 32 / 800.
4. **One colour per kind of information**, as a tint background + dark text of the same hue:

   | Information | Tint | Text / icon | Tokens |
   |---|---|---|---|
   | Blood group | #FDECEC | #C0362C | `--oc-info-blood(-tint)` |
   | Allergies / warnings | #FFF4E5 | #7A2E0E / #B54708 | `--oc-info-allergy(-tint, -icon)` |
   | Antécédents | #F1EDFE | #5B3CC4 | `--oc-info-history(-tint)` |
   | Medication / positive / primary | #E6F8F2 | #0B4F52 / #0F6F73 | `--oc-info-care(-tint, -icon)` |
   | Current consultation | #F1EDFE | #3B2A86 | `--oc-info-current(-tint)` |

   Measured contrast (text on its tint): blood 4.83:1, allergy 8.69:1 (icon 4.99:1), antécédents
   6.33:1, care 8.46:1 (icon 5.39:1), current 9.82:1; secondary text on `--oc-tile` 7.33:1.
5. **Structured values are tags** (`oc-tag`, default tone `value`): white, 1px hairline,
   radius 8px, 13 / 600. Never a sentence joined by « · » for prescription data
   (dose + unité, voie, N× par jour, durée or « Au long cours » = one tag each).
6. **Not allowed:** left-border accent cards, gradients, emoji, grey pill chips, grey segmented
   tracks on white cards, grey empty-state illustrations. Segmented controls (global NG-ZORRO
   style): track #F4F5F7, selected item white with a soft shadow, weight 700. An empty state is one
   short sentence in secondary text.
7. **Icons:** the existing icon set, inside a 40–44px tinted square tile, radius 12
   (`--oc-radius-icon`).

Primitives: `oc-tag` (tones `value`, `neutral`, `care`, `allergy`, `history`, `blood`,
`current`), `oc-date-block` (day 26 / 800 + « NOV. », `care` for the most recent, `neutral`
otherwise, `small` for compact rows), `oc-file-card` (format tile, title, subtitle, action icon;
the whole card is one button), `oc-tabs` `variant="prominent"` (3px primary underline, count
badge). `npm run check:ui-boundaries` fails on `text-transform: uppercase` or a ≥ 3px left
border in the record, the consultation and these primitives.
