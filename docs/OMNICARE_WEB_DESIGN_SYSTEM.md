# OmniCare Web Design System Foundation v1

## Purpose and principles

This foundation supports future OmniCare operational dashboards without implementing clinic business logic. It aims for calm, dense, predictable healthcare software: semantic hierarchy before decoration, borders before shadows, one clear primary action in a region, and accessible behavior as part of the component contract.

The `/design-system` route is development documentation. Its people, appointments, metrics, and locations are fictional.

## Technology and NG-ZORRO integration

The application uses Angular 21.2 standalone components, strict templates, SSR and Vitest. NG-ZORRO `21.3.3` matches Angular's major version. The library supplies mature interaction behavior for buttons, inputs, select and multi-select, range picker, checkbox, radio, drawer, tooltip, table, pagination, skeleton and alert.

`src/styles/vendor/ng-zorro-theme.less` is the only vendor theme bridge. It imports NG-ZORRO's Less source and maps a limited set of provisional OmniCare values at compile time. Those values intentionally duplicate the SCSS brand source because Less cannot consume runtime CSS custom properties. Vendor internals are not targeted from feature styles.

NG-ZORRO 21 does not expose the date-adapter provider introduced in NG-ZORRO 22. For this version, root configuration registers Angular `en-GB` locale data, provides NG-ZORRO `en_GB`, sets Angular `LOCALE_ID` to `en-GB`, and sets `NZ_DATE_CONFIG.firstDayOfWeek` to Monday. When Angular and NG-ZORRO move to 22 together, add the official native date adapter during that migration.

Use raw NG-ZORRO controls when OmniCare adds no stable semantic behavior. Create an OmniCare component when it standardizes a product pattern, repeated visual rules, accessibility, a composition of primitives, or a vendor boundary. Do not mirror every vendor input and output.

## Token architecture

Global SCSS is organized under `src/styles`:

- `settings`: brand source, color primitives, spacing, typography, radii, shadows, layout, motion and z-index.
- `tools`: Sass functions, mixins and breakpoints.
- `themes`: semantic light-theme custom properties.
- `generic` and `elements`: reset, global behavior, typography and forms.
- `utilities`: small layout, spacing and accessibility helpers.
- `vendor`: the isolated NG-ZORRO Less bridge.

Components consume `--oc-` semantic variables. Primitive color values stay in approved settings or vendor files.

### Provisional brand values

No official OmniCare logo, font, palette or design-reference image was present in this project. `_brand-source.scss` therefore marks these provisional values with a TODO:

- Primary: `#176b5b`
- Primary hover: `#12594c`
- Primary active: `#0d473d`
- Secondary: `#294b63`
- Accent: `#d8923b`

These values require brand-owner confirmation and must not be presented as final identity assets.

### Typography, spacing, radius and elevation

The system font stack avoids remote dependencies. Semantic sizes range from 12/16 caption through 24/32 page title and 32/40 metrics. Dates, times, counts and values use tabular numerals.

Spacing uses the required 4px scale from `--oc-space-0` through `--oc-space-16`. Standard controls use the 10px medium radius, cards use 16px, the main workspace uses 24px, and badges/segments use a pill only where semantically appropriate. Cards use a border and shallow shadow; floating overlays use the stronger shadow tokens.

Motion is 120/180/240ms with restrained easing. Reduced-motion preferences collapse animation duration. The documented z-index tokens cover base, sticky tables, sidebar backdrop/sidebar, topbar, dropdown, popover, filter panel, drawer, modal backdrop/modal and toast.

## Icon rules

Only registered NG-ZORRO / Ant Design outline icons are used. Sizes are 16px for compact controls, 18px for ordinary controls, 20px for navigation and 24px only for larger empty-state/metric expression. Icon-only buttons require an accessible label and tooltip; status never relies on icons or color alone.

## Application shell and sidebar

`OcSidebar` accepts the typed `SidebarNavigationItem` model. It supports standalone items, two-level expandable groups, active child and parent representation, optional badges, search that preserves hierarchy, collapse/expand signals, collapsed tooltips and an optional profile block supplied by the consuming feature. Expanders are native buttons with `aria-expanded`; current destinations use `aria-current="page"`. The active child also has weight and a visible marker, so color is not the only signal.

At 1280px the shell uses an expanded sidebar. From 1024–1279px it may collapse. Below 768px it becomes an overlay navigation drawer with a backdrop. Navigation visibility is presentation only and is never backend authorization.

## Advanced filters

`OcFilterToolbar` composes scoped search, advanced-filter count, chips, clear-all, view mode and column customization. `OcFilterChip` always exposes visible label/value and an accessible remove action. `OcAdvancedFilterDrawer` owns the close/reset/apply structure, scrollable content and sticky action footer while feature forms are projected into its content.

Reset changes the draft fields but does not apply them. Apply is the only primary drawer action. Escape, backdrop and close affordances close the NG-ZORRO drawer. The consuming page restores focus to the filter trigger after close. A future wide-workspace integration may host the same projected form in an anchored side panel; tablet and narrow layouts use the overlay drawer.

## Tables

`OcDataTableShell` is a composition boundary rather than a grid engine. It supplies a title/tools region, horizontal keyboard-scroll region, density, empty/loading/error states and footer. Feature code owns columns and backend-aware data behavior. Use tables only when column comparison helps; use focused responsive lists for essential workflows below tablet widths.

## Components

- `OcButton`: primary, secondary, quiet and destructive variants; size, icon, disabled and loading semantics.
- `OcIconButton`: required label, tooltip, loading/disabled and practical target size.
- `OcStatusBadge`: ten visible-text semantic statuses.
- `OcPageHeader`: breadcrumbs, title, description, secondary actions and one primary slot.
- `OcMetricCard`: icon, label, value, supporting text, trend and skeleton.
- `OcSegmentedControl`: pressed-state buttons and arrow-key selection.
- `OcEmptyState`: icon, title, description and projected actions.
- `OcFilterToolbar`, `OcFilterChip`, `OcAdvancedFilterDrawer`: advanced-filter composition.
- `OcDataTableShell`: operational table states and regions.
- `OcSidebar`: accessible hierarchical navigation shell.

Example:

```html
<oc-page-header title="Appointments" description="Review the operational schedule">
  <oc-button ocPrimaryAction variant="primary">Create appointment</oc-button>
</oc-page-header>

<oc-status-badge status="requires-attention" />
```

## Accessibility and SSR

WCAG 2.2 AA is the baseline: semantic headings and landmarks, visible focus, labels, native buttons and links, visible status text, practical targets, logical order, reduced motion and the `oc-sr-only`/skip-link utilities. Expanders expose state and segmented buttons expose selection. Do not remove outlines without an equal or stronger focus indicator.

Components do not read `window`, storage, media queries or browser globals. Responsive behavior lives in CSS. The only direct element focus calls happen after user-driven keyboard or drawer events, never during server rendering. SSR and hydration remain configured.

## Non-negotiable rules

1. No raw colors outside approved token or vendor-theme files.
2. No arbitrary spacing when a token exists.
3. Do not wrap every NG-ZORRO component blindly.
4. Do not use default NG-ZORRO appearance unchanged.
5. Do not override vendor internals with brittle selectors.
6. Do not use `::ng-deep`.
7. One clear primary action per page region.
8. Tables are for column comparison, not every dataset.
9. Cards are not the default for every page.
10. Status must contain visible text.
11. Navigation visibility is not backend authorization.
12. Feature modules must consume shared tokens and product patterns.
13. Healthcare urgency must be communicated through semantic hierarchy, not aggressive decoration.
14. New UI dependencies require architectural justification.

## Deferred intentionally

Authentication, role guards, authorization, backend APIs, patient records, real appointments, medical workflows, CRUD pages, charts, state-management libraries, dark mode, full RTL and multilingual behavior remain outside Foundation v1.

## Feature-development boundary

The root route defaults to `/login` and loads an intentionally empty application shell. Lazy route boundaries exist for `login`, `platform-admin`, `doctor` and `clinic`; their route arrays stay empty until the corresponding features are implemented. They must consume the shared components under `src/app/shared/ui` and the semantic `--oc-` tokens rather than copying the showcase.

Feature components may import the approved component API from `src/app/shared/ui/index.ts`; global semantic tokens remain available through `src/styles.scss` in every route, including lazy feature routes.

`/design-system` is added to the router only while Angular is in development mode. It is not part of the production route set or production navigation. The following files are showcase-only and remain development-only:

- `src/app/features/design-system/design-system.ts`
- `src/app/features/design-system/design-system.html`
- `src/app/features/design-system/design-system.scss`

Fictional navigation, profiles, filters, metrics and table rows must remain inside those showcase files.
