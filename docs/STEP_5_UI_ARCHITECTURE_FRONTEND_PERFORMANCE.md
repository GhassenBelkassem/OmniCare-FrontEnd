# STEP 5 — UI Architecture & Frontend Performance

## 1. Baseline Build

The baseline was captured from the post-Step-4 worktree before Step 5 changes with the existing
production budgets unchanged.

| Baseline metric                                   |                                        Value |
| ------------------------------------------------- | -------------------------------------------: |
| Production initial JavaScript                     | 615.33 kB raw / 164.88 kB estimated transfer |
| Production initial CSS                            |  356.07 kB raw / 37.84 kB estimated transfer |
| Production initial total                          | 971.40 kB raw / 202.72 kB estimated transfer |
| Production browser JavaScript, all emitted chunks |                   3,348,262 bytes / 95 files |
| Production browser output on disk                 |                                   24,676 KiB |
| Static-demo JavaScript, all emitted chunks        |                              3,445,694 bytes |
| Static-demo output on disk                        |                                   24,816 KiB |

The production build exceeded the 750 kB initial warning budget by 221.40 kB but remained below
the 1 MB error budget. The two static-demo component-style warnings were 18.98 kB for calendar and
18.95 kB for waiting room against the unchanged 18 kB warning budget. Six unused standalone
imports across four components also produced compiler warnings.

The largest baseline lazy outputs were calendar (353.83 kB), an unnamed shared chunk (349.57 kB),
settings (308.57 kB), the development design-system showcase (284.26 kB), another unnamed chunk
(200.38 kB), monitoring (147.03 kB), consultation (120.81 kB), and the legacy patient development
workspace (75.46 kB).

## 2. Existing Shared UI Inventory

Counts below are feature TypeScript files that reference each primitive, not DOM instance counts.

| Shared UI family    | Existing implementation                                                       |   Feature-file usage | Decision                                                |
| ------------------- | ----------------------------------------------------------------------------- | -------------------: | ------------------------------------------------------- |
| Actions             | `OcButton`, `OcIconButton`, action menu                                       |               95 / 1 | Reuse; native structural and sort buttons remain native |
| Status              | `OcStatusBadge`, stat row, metric card                                        |         44 for badge | Reuse                                                   |
| Empty/loading       | `OcEmptyState`, `OcSkeleton`                                                  |              42 / 13 | Reuse                                                   |
| Dialog surfaces     | `OcConfirmDialog`, `OcDialog`, `OcSheet`, alert dialog                        |           7 / 10 / 6 | Complete family; no new modal abstraction               |
| Page structure      | `OcPageHeader`, `OcCard`, `OcTabs`, detail panel                              |          39 / 15 / 9 | Reuse                                                   |
| Data presentation   | `OcDataTableShell`, timeline                                                  |   15 for table shell | Reuse                                                   |
| Filtering           | `OcFilterToolbar`, advanced filter drawer, filter chip                        |        1 for toolbar | Keep specialized compositions                           |
| Forms               | `OcField`, `OcSelect`, `OcTextarea`, checkbox, radio, switch, tag/time fields |            8 / 3 / 3 | Reuse                                                   |
| Navigation/identity | sidebar, avatar, popover, icon                                                | Shared across shells | Reuse                                                   |

The inventory found a mature shared UI layer. Adding parallel card, badge, button, modal, skeleton,
empty-state, or table systems would increase architecture cost without removing meaningful
duplication.

## 3. Duplication Findings

| Finding                                                              | Evidence                                                                                                        | Resolution                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Development routes were still statically visible to optimized builds | Production emitted design-system and legacy-patient lazy chunks even though `isDevMode()` made them unreachable | Moved them behind a file-replacement boundary with empty optimized exports               |
| Button markup is repeated                                            | Native buttons occur in login semantics, sorting, tabs, shell toggles, demo tables, and development-only pages  | No blanket replacement; these are distinct accessible controls, not one visual component |
| Dialog markup is repeated by purpose                                 | Existing confirm, general dialog, sheet, and alert primitives already cover distinct interaction models         | No new abstraction                                                                       |
| Clinic position row rendering scanned the staff array per assignment | `staffName()` performed `Array.find()` from inside an `@for`                                                    | Replaced with a computed membership-name `Map`                                           |
| Repeated capability checks ran as template methods                   | Position management checks called the capability helper during checks                                           | Replaced with computed signals                                                           |
| Old Doctor detail-panel compositions have no route consumers         | Patient summary and urgent detail-panel sources are exported but not imported by production routes              | Preserved; deletion would be a separate dead-code decision                               |
| Large feature styles share visual ideas but are component-scoped     | Patient detail, command, documents, urgent requests, and static-demo pages have large independent SCSS files    | No speculative global mixin or selector merge; visual behavior is frozen                 |

## 4. Shared Components Added or Improved

No new visual primitive was added. The existing set already covers the recurring UI contracts.

`OcDetailPanel` was improved by removing unused `OcButton` and `OcIconButton` standalone imports.
This reduces its compile/dependency surface without changing its API, DOM, styles, or behavior.

The non-visual route composition boundary was added as `development.routes.ts` plus an empty
`development.routes.production.ts`. Production and static-demo builds replace the former with the
latter, while development and route tests retain the showcase and legacy patient workspace.

## 5. Components Refactored

| Component/module              | Refactor                                                                               | Behavior impact                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Application route composition | Development-only root/shell routes moved behind optimized file replacement             | No production route change; development routes remain available in development |
| Clinic position detail        | Capability values became computed signals; assignment labels use a computed lookup map | Same rendered labels and permissions; avoids repeated linear scans             |
| Clinic position detail source | Existing compressed source was mechanically formatted                                  | None                                                                           |
| Clinic responsibility detail  | Removed unused `RouterLink` standalone import                                          | None                                                                           |
| Prescriptions page            | Removed unused `OcFilterToolbar` standalone import                                     | None; production route remains unavailable                                     |
| `OcDetailPanel`               | Removed two unused standalone imports                                                  | None                                                                           |
| Production-boundary checker   | Added optimized development-route replacement assertions                               | Build-time regression detection only                                           |

## 6. CSS Duplication Reduction

No frozen presentation CSS was rewritten or globally merged. That would introduce a larger visual
regression surface than the duplicated declarations justify. The optimized route boundary instead
prevents development-only component templates and encapsulated styles from being emitted into the
production/static-demo artifact graph.

Initial global CSS remained effectively flat: 356.07 kB before and 356.10 kB after (a 0.03 kB
build-level variation). The two known static-demo component-style warnings remain visible; budgets
were not raised.

## 7. Change Detection Review

- 158 non-test component source files were inventoried.
- 146 production-scoped component files were reviewed after excluding design-system,
  legacy-patient, static-demo, and test-only sources.
- Zero production-scoped components lack `ChangeDetectionStrategy.OnPush`.
- The position-detail capability and lookup work now uses `computed()` so it recalculates only when
  its signal inputs change.
- No manual `detectChanges()` loop or global change-detection trigger was introduced.

## 8. Template CPU Review

The concrete hot-pattern fix is the position-assignment list. Before, every rendered assignment
called a method that scanned the staff array, producing O(assignments × staff) lookup work during a
template check. The component now builds one computed `Map` in O(staff) and performs O(1) lookup per
row, for O(staff + assignments) work when the inputs change.

No general method-to-pipe rewrite was performed. Existing formatting and status helpers are small,
route-scoped, and not demonstrated CPU problems.

## 9. List Rendering Review

Angular control-flow lists were reviewed across TypeScript inline templates and HTML templates.
There are 181 `@for` occurrences, and the successful Angular 21 compilation verifies their required
`track` expressions. Production lists use stable server IDs or stable primitive values where
available (appointment, consultation, membership, task, artifact, and configuration IDs).

Index tracking was not substituted for server identity. No virtual scrolling was added: current
large collections are paged or explicitly capped, and no measured list justified the interaction
and accessibility cost of virtualization.

## 10. Resource / Memory Safety

### Subscriptions

Route-scoped long-lived streams use `takeUntilDestroyed()` or `DestroyRef` cleanup. Finite HTTP
subscriptions complete naturally. Visibility/focus listeners in active consultation, scheduled
care, and urgent-cabinet stores are removed from their registered destroy callbacks.

### Timers

- Realtime health ticking clears its interval on root-service destruction.
- Calendar's existing 120-second refresh cadence remains route-scoped and destroyed with the page.
- The clinic task-list 30-second refresh remains route-scoped and destroyed with its page.
- Waiting-room production source is not routed in production; its interval still has cleanup.
- Static-demo clock timers are demo-scoped and destroyed.

No polling interval was added, shortened, or made global.

### Object URLs

Production artifact downloads and static-demo document downloads revoke every created object URL.
No `Blob` or object URL is retained in a root store.

### Retained collections

Realtime and active-consultation dedupe sets are bounded to 256 entries. Root idempotency maps are
cleared on success, account/context changes, and explicit clearing; intentionally ambiguous
requests retain their key to preserve safe replay semantics. Notification and feature collections
remain paged/capped rather than unbounded browser caches.

## 11. Dependency / Bundle Review

No dependency was added, removed, or upgraded.

- Angular/CDK, NG-ZORRO, and the existing OmniCare primitives remain the UI foundation.
- FullCalendar remains isolated behind the calendar lazy route; its production page chunk is
  353.80 kB.
- STOMP/SockJS remain the realtime transport and no second transport library was introduced.
- No chart, PDF viewer, spreadsheet, utility-CSS, or state-management package was added.
- The 284.26 kB design-system chunk and 75.46 kB legacy patient chunk are absent from both optimized
  outputs. Bundler regrouping changed unnamed chunks, so the authoritative result is the complete
  emitted-JavaScript total: production is down 406,333 bytes.

## 12. `@defer` Decisions

No `@defer` block was added. The large calendar, settings, monitoring, consultation, and other
workspaces are already lazy route boundaries. Deferring primary screen content after route entry
would add loading transitions without removing the route download. Unsupported analytics/charts
remain explicit unavailable states, so there is no chart implementation to defer.

## 13. Backend Impact

No backend changes required. No backend source, authorization rule, controller, DTO, persistence
contract, or realtime endpoint was changed.

## 14. Network Impact

- API request count and request shapes are unchanged.
- Existing calendar 120-second and clinic task-list 30-second refresh behavior is unchanged.
- No WebSocket connection or subscription was added or removed.
- No speculative prefetch was added.
- Cold production navigation downloads about 1.74 kB less estimated initial transfer.
- Development-only route chunks are no longer published in optimized artifacts; they were not
  legitimate production network targets.

## 15. Build Comparison

| Metric                                 |                 Baseline |                  Final |                          Change |
| -------------------------------------- | -----------------------: | ---------------------: | ------------------------------: |
| Production initial JavaScript raw      |                615.33 kB |              606.39 kB |               -8.94 kB (-1.45%) |
| Production initial JavaScript transfer |                164.88 kB |              163.16 kB |               -1.72 kB (-1.04%) |
| Production initial CSS raw             |                356.07 kB |              356.10 kB |               +0.03 kB (+0.01%) |
| Production initial CSS transfer        |                 37.84 kB |               37.82 kB |                        -0.02 kB |
| Production initial total raw           |                971.40 kB |              962.49 kB |               -8.91 kB (-0.92%) |
| Production initial total transfer      |                202.72 kB |              200.98 kB |               -1.74 kB (-0.86%) |
| Production emitted browser JS          |   3,348,262 B / 95 files | 2,941,929 B / 90 files | -406,333 B (-12.14%) / -5 files |
| Production browser output on disk      |               24,676 KiB |             24,252 KiB |               -424 KiB (-1.72%) |
| Production initial budget overage      |                221.40 kB |              212.49 kB |                        -8.91 kB |
| Static-demo emitted JS                 |              3,445,694 B | 3,039,346 B / 91 files |            -406,348 B (-11.79%) |
| Static-demo output on disk             |               24,816 KiB |             24,392 KiB |               -424 KiB (-1.71%) |
| Unused standalone-import warnings      | 6 symbols / 4 components |                      0 |                         Removed |

The initial bundle decreased, satisfying the requirement that it not increase by more than 2%.
The 750 kB warning and 1 MB error thresholds remain unchanged.

## 16. Expected 100-Doctor Impact

### Browser RAM

Each cold session parses about 8.94 kB less initial JavaScript. The larger 406 kB emitted-artifact
reduction mainly removes unreachable lazy code, so it improves artifact/deployment footprint more
than steady-state RAM. No new cache or root collection increases per-session memory.

### Browser CPU

Initial parse/evaluation work is modestly lower. Position assignment rendering changes from
O(assignments × staff) name lookup to O(assignments + staff) whenever the source signals change.
No extra change-detection or timer work was added.

### Backend traffic

Expected request, polling, and WebSocket traffic for 100 concurrent Doctors is unchanged. This step
does not shift frontend work to the backend.

### Bundle/download

At 100 uncached production starts, the measured initial transfer reduction is approximately
174 kB aggregate. Deployment/CDN artifact JavaScript is about 397 KiB smaller before transport
compression, and five JavaScript files are no longer published.

### Maintainability

Optimized route composition is now explicit and executable rather than relying on tree-shaking of
an `isDevMode()` branch. Existing UI primitives remain the single visual vocabulary, and the
production-boundary checker prevents development route graphs from silently returning.

## 17. Tests / Validation

| Validation                                 | Result                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `npm run test:step1`                       | 23 tests passed                                                |
| `npm run test:step2`                       | 49 tests passed                                                |
| `npm run test:step3`                       | 93 tests passed                                                |
| `npm run test:step4`                       | 158 tests passed                                               |
| `npm run test:step5`                       | 35 tests passed                                                |
| `npm run test:ci`                          | 1,110 tests in 167 files passed                                |
| `npm run check:ui-boundaries`              | Passed                                                         |
| `npm run check:production-boundary`        | Passed, including optimized development-route assertions       |
| `npx ng build --configuration production`  | Passed; three known budget warnings, no unused-import warnings |
| `npx ng build --configuration static-demo` | Passed                                                         |
| `git diff --check` (frontend)              | Passed                                                         |
| `git diff --check` (backend)               | Passed                                                         |

The focused Step 5 suite covers application route behavior, the empty optimized route replacement,
and the established button, status badge, confirm dialog, dialog, sheet, and page-header behavior.
The full suite grew from 1,109 to 1,110 tests because of the new optimized-route regression test.

## 18. Remaining Performance Risks

- The production initial total still exceeds the 750 kB warning budget by 212.49 kB.
- Global CSS remains 356.10 kB and is the largest initial optimization opportunity.
- The 529.42 kB unnamed lazy chunk, 353.80 kB calendar chunk, and 308.56 kB settings chunk merit a
  stats/metafile-led follow-up rather than speculative splitting.
- Static-demo calendar and waiting-room styles remain just below the 20 kB error budget and above
  the 18 kB warning budget.
- Several feature SCSS files remain large; consolidation needs screenshot-level regression evidence.
- Some older clinic pages still use nested finite HTTP subscriptions. They are not demonstrated
  leaks, but flattening/cancellation can be considered with workflow-specific tests.
- Validation used Node 25.6.0, which emits Angular's odd-numbered/non-LTS Node warning.

## 19. Things Intentionally NOT Refactored

- Approved layout, styling, copy, responsive behavior, and clinical workflows.
- Production/static-demo data-source separation or backend contracts.
- FullCalendar or NG-ZORRO replacement.
- Native structural, tab, sorting, resend, and back buttons with distinct semantics.
- Large feature components solely because of line count when a container/view boundary already
  exists or no independent responsibility was demonstrated.
- Static-demo warning styles without visual regression evidence.
- Existing polling intervals, realtime subscriptions, idempotency retention, or root store
  lifetimes.
- Legacy patient and old Doctor panel source deletion; the patient graph is isolated from optimized
  builds, while deletion is a separate product/source-ownership decision.
- `@defer` added for its own sake.

## 20. Git Status

The frontend worktree already contained the uncommitted Step 1–4 implementation. It currently has
97 changed/untracked paths in total. Step 5 changed or added only:

- `angular.json`;
- `package.json`;
- `src/app/app.routes.ts`;
- `src/app/development.routes.ts`;
- `src/app/development.routes.production.ts` and its spec;
- `src/app/features/clinic/clinic-position-detail-page.ts`;
- `src/app/features/clinic/clinic-responsibility-detail-page.ts`;
- `src/app/features/doctor/prescriptions/prescriptions-page.ts`;
- `src/app/shared/ui/detail-panel/oc-detail-panel.ts`;
- `tools/check-production-boundaries.mjs`;
- `tsconfig.step5.spec.json`;
- this record.

The backend worktree has concurrent pre-existing changes (110 changed/untracked paths at final
inspection). Step 5 made no backend edit. No commit was created.

STEP_5_COMPLETE
