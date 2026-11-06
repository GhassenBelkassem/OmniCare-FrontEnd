# OmniCare Web Design System Foundation v1

## Purpose and principles

This foundation supports future OmniCare operational dashboards without implementing clinic business logic. It aims for calm, dense, predictable healthcare software: semantic hierarchy before decoration, borders before shadows, one clear primary action in a region, and accessible behavior as part of the component contract.

The `/design-system` route is development documentation. Its people, appointments, metrics, and locations are fictional.

## Technology and NG-ZORRO integration

The application uses Angular 21.2 standalone components, strict templates, SSR and Vitest. NG-ZORRO `21.3.3` matches Angular's major version. The library supplies mature interaction behavior for buttons, inputs, select and multi-select, range picker, checkbox, radio, drawer, tooltip, table, pagination, skeleton and alert.

`src/styles/vendor/ng-zorro-theme.less` is the only vendor theme bridge. It imports NG-ZORRO's Less source and maps a limited set of provisional OmniCare values at compile time. Those values intentionally duplicate the SCSS brand source because Less cannot consume runtime CSS custom properties. Vendor internals are not targeted from feature styles.

NG-ZORRO 21 does not expose the date-adapter provider introduced in NG-ZORRO 22. For this version, root configuration registers Angular `en-GB` locale data, provides NG-ZORRO `en_GB`, sets Angular `LOCALE_ID` to `en-GB`, and sets `NZ_DATE_CONFIG.firstDayOfWeek` to Monday. When Angular and NG-ZORRO move to 22 together, add the official native date adapter during that migration.

Use raw NG-ZORRO controls when OmniCare adds no stable semantic behavior. Create an OmniCare component when it standardizes a product pattern, repeated visual rules, accessibility, a composition of primitives, or a vendor boundary. Do not mirror every vendor input and output.

## Spartan coexistence foundation (P0)

The approved compatibility stack is pinned in `package.json`: `@spartan-ng/brain` `1.2.0`, `@angular/cdk` `21.2.14`, `clsx` `2.1.1`, `luxon` `3.7.2`, `tw-animate-css` `1.4.0`, `tailwindcss` `4.3.2`, and `@tailwindcss/postcss` `4.3.2`. Spartan Brain `1.2.0` declares Angular and CDK support from 21 through 22; its headless primitives are the only Spartan runtime dependency at this stage.

`@spartan-ng/cli` `1.2.0` was evaluated only as a development generator and then removed. Its published nested `zod@3.25.76` dependency declares an `index.cjs` export that is absent from that package, so the generator is unusable in this workspace. No dependency was patched in `node_modules`. The small private `HlmButton` and selected harness stylesheet are traceable adaptations of the 1.2.0 generated Helm templates; they remain development-only, have no public `shared/ui` export, and retain the upstream dependency licences in `package-lock.json`/package metadata (`@spartan-ng/brain` MIT, `class-variance-authority` Apache-2.0, and the remaining direct compatibility utilities MIT). Re-evaluate the CLI only after an upstream fixed release, regenerate in a clean workspace, and compare its generated button source/styles before replacing these private copies.

`angular.json` has a deterministic global style order:

1. `src/styles/vendor/ng-zorro-theme.less`
2. `src/styles/vendor/spartan-tailwind.css`
3. `src/styles.scss`

Tailwind imports its theme, Preflight, and utilities in named layers. NG-ZORRO and OmniCare SCSS remain unlayered, so they retain normal-cascade precedence over Preflight. Spartan's preset owns only the shared CDK overlay stylesheet/behaviour; it does not create another overlay container. The existing `--oc-z-*` CDK container rule remains the single overlay stack owner.

`themes/_omnicare-light.scss` maps Spartan's `--background`, `--primary`, `--border`, `--ring`, typography, radius, and related theme variables to existing `--oc-*` semantic variables. These aliases are a compatibility bridge, not a new color palette. Light mode and existing typography remain unchanged.

The development-only `/design-system` route contains `SpartanCoexistenceHarness`. It proves private Brain dialog and sheet primitives plus token-styled button, field, native select, alert, skeleton, badge, and presentational table states. It is not exported by `shared/ui`, is not in production navigation, and must never become a feature dependency.

P1 adds the focused production `OcDialog` abstraction under `shared/ui/dialog`. Its public API is vendor-neutral: controlled `open`, required `title`, optional `description`/`error`, `standard` or `destructive` intent, initial-focus selector, backdrop-dismiss option, submitting/disabled state, explicit `hasFooter`, and `dismissed` output. The component alone imports Spartan Brain's 1.2 dialog directives; it uses Brain's CDK focus trap, focus restoration, Escape/backdrop policy, and block-scroll strategy while OmniCare SCSS owns surfaces and layout. Dialogs use the normal `dialog` role even for destructive form collection, with visible destructive text rather than an `alertdialog` role or decorative warning bar. The global CDK backdrop class is the only modal backdrop rule, so it covers fixed application shell regions without feature z-index overrides.

P1-FIX adds vendor-neutral `OcButton`, `OcField`, `OcSelect`, and `OcTextarea` contracts under `shared/ui`. `OcButton` uses Brain's pinned button directive internally and preserves the established `primary`, `secondary`, `quiet`, and `destructive` API (`quiet` aliases `ghost`), while adding `outline`, `ghost`, `link`, `large`, full-width, and accessible icon-only support. `OcSelect` composes Brain's pinned select and popover directives into a focused static single-select CVA; `OcTextarea` is a focused CVA; and `OcField` provides deterministic label/hint/error identifiers for projected controls. Feature code imports only these `Oc*` components. No Helm source was copied for these controls: their structure follows the pinned Brain directive contracts, and their visual layer uses existing OmniCare semantic tokens.

P2 establishes the white clinic workspace treatment through the existing semantic token authority: white application and surface tokens, neutral separators, high-contrast neutral focus states, OmniCare-green active accents, and a coordination-violet semantic token. `OcIcon` is the vendor-neutral, inline outline-icon boundary used by the clinic shell; it is tree-shaken by explicit names and supports decorative or labelled meaningful use plus semantic intent. `OcSheet` is the vendor-neutral controlled sheet boundary backed by pinned Spartan Brain sheet directives. It owns CDK overlay placement, scroll containment, focus restoration, Escape/backdrop policy, and an optional action footer; feature code sees no Brain import. The clinic shell uses `OcSheet` for mobile navigation, while My Tasks uses a read-only right-side task preview at tablet and desktop widths and preserves the canonical detail route on mobile and for all mutations.

P2.1 defines the startup lifecycle for this browser-session application. `app.routes.server.ts` marks all routes as `RenderMode.Client`: the existing opaque session and refresh token exist only in browser `sessionStorage`, so rendering any route at build time would otherwise produce an anonymous Login tree for an authenticated URL. The root `App` therefore renders only a neutral white boot surface while `AuthTokenStore` is `unknown`. Browser startup invokes `AuthBootstrapService` through `provideAppInitializer`; it restores a structurally valid stored session, validates it once with the existing refresh endpoint, and settles the store as `authenticated` or `anonymous`. Blocking initial navigation then lets guards decide only after this resolution. `authenticatedGuard` and role guards return `UrlTree` redirects after resolution, while the Login route's `anonymousOnlyGuard` redirects authenticated users before its component is constructed. No token, role, clinic context, or capability is sent through SSR or transfer state.

Feature directories are prohibited from importing `@spartan-ng/*`. `npm run check:ui-boundaries` enforces that rule while allowing the development-only design-system harness. Future OmniCare primitives may internalize Brain/Helm implementation only after their stable `Oc*` contracts are approved.

## Authenticated clinic certification (P0A)

`e2e/clinic-ui-isolation.spec.ts` exercises the clinic shell and protected task, request, staff, and handover routes at 1440×900, 1024×768, and 390×844. It uses no account, real token, environment secret, API write, or production auth bypass. Instead, `e2e/clinic-e2e-fixture.ts` creates a fresh, browser-only `sessionStorage` session and intercepts only `/api/v1/**` with fictional values. This is UI isolation, not an authentication test or a representation of production authorization; the application guards and capability checks remain active and the fixture first follows the ordinary `/clinic` context-initialization route.

Every covered route checks its landmark/heading, client-side navigation, page-level horizontal containment, browser errors, AXE WCAG tags, and a full-page screenshot. Successful screenshots and transient Playwright reports are intentionally ignored (`test-results/`, `playwright-report/`, and `playwright/.auth/`) and must not be committed. The AXE assertion has a route-scoped, node-level legacy baseline rather than a rule-wide suppression: legacy colour-contrast issues in the sidebar/table/link styling, the legacy NG-ZORRO hidden-select label finding, and the legacy staff header ARIA attribute remain visible in the test source; a new critical or serious node fails. The handover control was corrected to real ARIA tabs with Arrow/Home/End behavior, which removes its prior critical required-children violation.

The responsive certification also makes the clinic shell/table composition constrain min-content width so wide tables scroll within their labelled table region instead of causing document-level horizontal overflow. This does not change any authorization, workflow, or data behavior.

Rollback: remove the P0 style entry, `.postcssrc.json`, Spartan token aliases, development harness, tests, and boundary script; then remove only the seven pinned P0 packages with npm and regenerate the lock file. Do this as one reviewed change. No production feature should require a rollback because none imports Spartan.

## Token architecture

Global SCSS is organized under `src/styles`:

- `settings`: brand source, color primitives, spacing, typography, radii, shadows, layout, motion and z-index.
- `tools`: Sass functions, mixins and breakpoints.
- `themes`: semantic light-theme custom properties.
- `generic` and `elements`: reset, global behavior, typography and forms.
- `utilities`: small layout, spacing and accessibility helpers.
- `vendor`: the isolated NG-ZORRO Less bridge.

Components consume `--oc-` semantic variables. Primitive color values stay in approved settings or vendor files.

### Brand and action values

OmniCare's approved primary action color is `#1FBF9A`. Primary actions use this exact background with the dark text token because white text does not meet WCAG AA contrast. Hover feedback keeps the same green and strengthens the neutral border/shadow instead of introducing another green shade. Destructive and neutral actions retain their semantic red and neutral treatments.

The legacy `primary-hover` and `primary-active` variables remain temporarily for non-button surfaces created before this decision. They are not approved action colors and must not be used by new button or link states. Secondary `#294b63` and accent `#d8923b` remain provisional pending a broader brand-asset decision.

### Typography, spacing, radius and elevation

The system font stack avoids remote dependencies. Semantic sizes range from 12/16 caption through 24/32 page title and 32/40 metrics. Dates, times, counts and values use tabular numerals.

Spacing uses the required 4px scale from `--oc-space-0` through `--oc-space-16`. Standard controls use the 10px medium radius, cards use 16px, the main workspace uses 24px, and badges/segments use a pill only where semantically appropriate. Cards use a border and shallow shadow; floating overlays use the stronger shadow tokens.

Motion is 120/180/240ms with restrained easing. Reduced-motion preferences collapse animation duration. The documented z-index tokens cover base, sticky tables, sidebar backdrop/sidebar, topbar, dropdown, popover, filter panel, drawer, modal backdrop/modal and toast.

## Icon rules

Use the vendor-neutral `OcIcon` boundary for new shared and clinic workspace icons; it exposes a deliberate outline-icon subset rather than an entire catalogue. Sizes are 16px for compact controls, 18px for ordinary controls, 20px for navigation and 24px only for larger empty-state/metric expression. Decorative icons are hidden from assistive technology; meaningful icons receive a label. Icon-only buttons require an accessible label and tooltip; status never relies on icons or color alone.

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
