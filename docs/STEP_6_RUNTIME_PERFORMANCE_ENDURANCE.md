# STEP 6 — Runtime Performance & Endurance

## 1. Profiling Environment

**MEASURED.** Chromium headless shell 153.0.8010.12 ran at 1440 × 900 with precise-memory
information and exposed diagnostic garbage collection. The Angular production configuration was
served locally from `http://127.0.0.1:4300`; its optimized, hashed application chunks and CSS were
the same outputs measured by the production build. Angular's local server also injected one Vite
live-reload WebSocket, which is identified separately and is not counted as application realtime.

The real production Doctor route graph was exercised with fictional browser-intercepted API
responses. No production credentials, patient data, backend mutation, or PHI were used. The
intercepts preserved the application's real HTTP request shapes and route behavior but did not
measure backend latency or server resource use.

The reproducible `tools/profile-doctor-runtime.mjs` harness uses the already-installed Playwright
Chromium and Chrome DevTools Protocol. It measured JS heap, DOM nodes, documents, listeners,
instrumented timers, task/script/layout/style duration, HTTP requests, WebSockets, page errors, and
browser long tasks. Route-idle windows were two seconds; the Calendar degraded-mode window was 125
seconds. Consultation was skipped because the active-consultation contract safely returned no
active workspace; no fake clinical state was created.

**NOT MEASURABLE IN THE CURRENT ENVIRONMENT.** A healthy authenticated STOMP connection, its
frames, reconnect, and visibility restore could not be measured without a local realtime server.
Angular DevTools component-level change-detection attribution was not automatable in the headless
session. Development-mode absolute CPU figures were therefore not collected.

## 2. Baseline Runtime Measurements

Each screen settled before its idle window. Heap is used / total JS heap. CPU is browser task time
as a percentage of the two-second no-input window.

| Screen               |              Heap |   DOM | Listeners | Idle network                |   CPU |
| -------------------- | ----------------: | ----: | --------: | --------------------------- | ----: |
| Command center       | 13.71 / 18.20 MiB | 2,776 |        79 | 0 requests                  | 0.05% |
| Calendar             | 18.60 / 24.91 MiB | 3,407 |       133 | 0 requests                  | 0.02% |
| Patients             | 21.82 / 29.00 MiB | 4,194 |       204 | 0 requests                  | 0.03% |
| Patient detail       | 21.32 / 30.17 MiB | 5,459 |       254 | 1 degraded `/ws/info` probe | 0.06% |
| Consultation history | 22.14 / 30.17 MiB | 5,518 |       282 | 0 requests                  | 0.02% |
| Settings             | 28.06 / 33.44 MiB | 7,037 |       490 | 1 degraded `/ws/info` probe | 0.12% |

**MEASURED.** One Calendar next-period interaction took 633 ms wall time and 99 ms aggregate main
thread task time (15.70%), including 17 ms script, 3 ms layout, and 6 ms style recalculation. One
debounced patient search took 924 ms wall time and 32 ms task time (3.47%), including 7 ms script,
3 ms layout, and 4 ms style recalculation. There were two long tasks over the complete profiling
journey, totaling 132 ms with a 75 ms maximum. There were no page errors.

## 3. Route Transition Endurance

The automated journey ran ten full SPA cycles:

`Command → Calendar → Patients → Patient detail → History → Settings → Command`.

| Checkpoint                                 | Route    | Heap used |   DOM | Listeners | Intervals / timeouts |
| ------------------------------------------ | -------- | --------: | ----: | --------: | -------------------: |
| Before cycle 1                             | Settings | 28.07 MiB | 7,037 |       490 |                2 / 1 |
| Before cycle 1, forced diagnostic GC       | Settings | 20.92 MiB | 3,374 |       280 |                2 / 1 |
| After cycle 5                              | Command  | 22.54 MiB | 2,787 |        92 |                2 / 1 |
| After cycle 5, forced diagnostic GC        | Command  | 22.31 MiB | 2,778 |        94 |                2 / 1 |
| After cycle 10                             | Command  | 25.32 MiB | 4,281 |       494 |                2 / 1 |
| After five-second natural idle opportunity | Command  | 25.36 MiB | 4,281 |       496 |                2 / 1 |
| After forced diagnostic GC                 | Command  | 23.09 MiB | 2,778 |        92 |                2 / 1 |

The natural five-second window did not trigger a full browser GC, so both natural and explicitly
forced results are shown. The comparable forced-GC Command plateau increased by 0.79 MiB from cycle
5 to cycle 10 while DOM returned to exactly 2,778 nodes and listeners returned from 94 to 92. That
small heap delta is consistent with already-loaded lazy code and bounded browser/application
caches, not retained route instances.

## 4. Memory Findings

**Classification: stable in the measured journey; no confirmed leak.** Heap rose as lazy routes
were first loaded and route views awaited collection. After diagnostic GC, the cycle-10 Command
view returned to the same DOM and listener baseline as cycle 5, with stable timers and only 0.79
MiB additional used heap. Patient switching and overlays also released their transient nodes and
listeners after GC.

The overlay sequence increased the CDP `Documents` metric from one to three and the count remained
three after forced GC. It did not increase per open/close operation and remained bounded throughout
subsequent patient switching. This is not enough evidence to classify a detached-document leak,
but a multi-hour heap-snapshot comparison should revisit it.

**STATICALLY VERIFIED.** Realtime and active-consultation deduplication sets remain capped at 256;
idempotency state has explicit clearing rules; artifact object URLs are revoked; route streams use
lifecycle cleanup or finite HTTP completion.

## 5. CPU / Change Detection Findings

**MEASURED.** Settled-route task activity was 0.02%–0.12% over the sampled two-second windows.
Calendar degraded mode consumed 111 ms of task time over 125 seconds (0.09%), including 35 ms
script, 2 ms layout, and 4 ms style recalculation. Interaction task time was bounded, and only two
browser long tasks were observed across the entire run. No repeated layout or continuous idle
main-thread work was found.

**STATICALLY VERIFIED.** The Step 5 inventory still finds `OnPush` on every production-scoped
component. The runtime changes in this step do not alter change detection, signals, component
lifecycle hooks, or render structure.

**NOT MEASURABLE IN THE CURRENT ENVIRONMENT.** Without an interactive Angular DevTools development
session, the two long tasks and aggregate CDP task durations cannot be attributed reliably to
individual Angular components or change-detection cycles. No change-detection optimization was
therefore justified.

## 6. Realtime Connection & Subscription Stability

**MEASURED in degraded mode.** The application realtime endpoint did not upgrade to a physical
WebSocket. SockJS issued one `/api/v1/ws/info` probe about every five seconds. Route cycling did not
create additional timer instances or simultaneous upgraded application sockets. The one observed
physical WebSocket was the Angular/Vite live-reload connection and is excluded from application
realtime conclusions.

**STATICALLY VERIFIED.** `RealtimeService` creates one STOMP client for the authenticated workspace,
deactivates the old client before token-context replacement and on logout, and establishes four
Doctor subscriptions after connect: urgent requests, appointments, scheduled care, and
notifications. Existing tests cover activation, subscription registration, token replacement,
logout, and cleanup.

**NOT MEASURABLE IN THE CURRENT ENVIRONMENT.** Healthy connection frame counts, no-fallback behavior
while healthy, one real reconnect, and visibility hide/restore require a functioning local/test
realtime server. Those results are intentionally deferred rather than simulated as production
evidence.

## 7. Timer / Polling Stability

**MEASURED.** Non-Calendar routes consistently exposed two active intervals and one timeout.
Calendar consistently exposed three intervals and three timeouts. Leaving Calendar returned to two
intervals; ten revisits never stacked another interval. Opening and closing the Calendar exception
dialog ten times kept the count at three intervals and three timeouts.

During 125 seconds of degraded Calendar idle, interval counts stayed at three and exactly one
scheduled reconciliation occurred: one scheduled-care GET and one availability-exceptions GET at
the existing 120-second boundary. No cadence was shortened and no polling was added.

**STATICALLY VERIFIED.** The additional Calendar interval is route-scoped and destroyed with the
page. The root realtime health tick is singular. The clinic task refresh remains route-scoped; its
route was outside this Doctor journey and was not claimed as runtime-measured here.

## 8. Network Idle Analysis

| Route                                      | Requests during idle window | Cause                                                            | Expected?                         |
| ------------------------------------------ | --------------------------: | ---------------------------------------------------------------- | --------------------------------- |
| Command                                    |                           0 | None                                                             | Yes                               |
| Calendar, short healthy-independent window |                           0 | None                                                             | Yes                               |
| Patients                                   |                           0 | None                                                             | Yes                               |
| Patient detail                             |                           1 | Degraded SockJS `/ws/info` reconnect probe                       | Yes while realtime is unavailable |
| History                                    |                           0 | None                                                             | Yes                               |
| Settings                                   |                           1 | Degraded SockJS `/ws/info` reconnect probe                       | Yes while realtime is unavailable |
| Calendar, 125-second degraded window       | 25 probes + 2 business GETs | Five-second SockJS retry; one 120-second fallback reconciliation | Yes for degraded mode             |

**MEASURED.** Each first route initialization issued each expected business request once. Across
ten cycles, Calendar scheduled-care and exception requests each ran ten times; patient list,
patient detail, history, profile education, and certification requests each ran ten times. The
availability-rules request ran 31 times because it is legitimately consumed by 11 Command entries,
10 Calendar entries, and 10 Settings entries. No duplicate identical request within a single
route initialization was confirmed. WebSocket frames, token refresh, user-triggered HTTP, and
fallback HTTP are kept distinct in the harness output.

## 9. Overlay / Modal Leak Analysis

The real Calendar availability-exception dialog was opened and closed ten times without submitting
a mutation.

| State                       | Heap used |   DOM | Listeners | Intervals / timeouts |
| --------------------------- | --------: | ----: | --------: | -------------------: |
| Before                      | 24.55 MiB | 3,378 |       144 |                3 / 3 |
| After ten closes, before GC | 25.00 MiB | 2,677 |       186 |                3 / 3 |
| After forced diagnostic GC  | 24.34 MiB | 2,572 |       118 |                3 / 3 |

**MEASURED.** Heap, nodes, and listeners did not grow in proportion to the ten operations and
settled below the pre-test values after GC. No overlay retention fix was justified. The bounded
one-to-three `Documents` change noted in section 4 remains a follow-up observation.

## 10. Patient/Clinical State Retention

Fictional patient A → B → C → A switching rendered only the current patient's identity at every
step. Transient DOM rose during rapid route changes, then returned to 3,062 nodes, 118 listeners,
two intervals, and one timeout after diagnostic GC; used heap settled at 24.27 MiB. No prior patient
identity remained in visible headings or retained route DOM evidence.

No active consultation existed in the safe test state, so clinical workspace switching was not
performed. No root-store or Step 2 sensitive-state architecture was changed.

## 11. Large Chunk Analysis

The production `stats.json` was inspected without installing a bundle analyzer.

| Chunk               | Major contributors                                                                                                                                                                                             | Classification                                                        | Decision                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Unnamed, 529.42 kB  | Angular forms (~50.1 kB), CDK overlay (~46.3 kB), CDK drag/drop (~35.4 kB), Zorro modal (~29.9 kB), time picker (~29.5 kB), input (~27.8 kB), scrolling (~21.5 kB), menu (~18.4 kB), plus shared Oc/Spartan UI | Shared, dependency-driven, used across lazy routes                    | Keep; no safe runtime or ownership boundary justified a split                          |
| Calendar, 353.80 kB | FullCalendar packages and adapters, Calendar page/view, temporal helpers, Preact bridge                                                                                                                        | Route-local and dependency-driven                                     | Keep lazy; do not replace FullCalendar or defer primary content                        |
| Settings, 308.56 kB | Profile (~31.2 kB), Settings shell (~22.5 kB), urgent configuration (~21.6 kB), security (~21.5 kB), qualifications (~17.5 kB), readiness (~16.7 kB), cabinet/bulk/gallery/notification/capability sections    | Route-local, feature-driven; current route composes all settings tabs | Keep; no measured route CPU or memory problem justified new tab-level loading behavior |

## 12. Global CSS Analysis

Before this step, the 356,097-byte optimized stylesheet comprised approximately 306,177 bytes of
NG-ZORRO (86.0%), 29,753 bytes of OmniCare global SCSS (8.4%), and 20,166 bytes of the Spartan
Tailwind entry (5.7%). The Spartan entry imported `spartan-helm-harness.css` and private
`.oc-spartan-compat-*` overlay rules. Repository usage showed those selectors and the harness are
used only by the development design-system route, which Step 5 already excludes from optimized
route graphs.

After isolating that development-only CSS, the optimized stylesheet is 350,830 bytes: NG-ZORRO
306,177 bytes (87.27%), OmniCare SCSS 29,753 bytes (8.48%), and the production Spartan Brain/theme
entry 14,901 bytes (4.25%). Development builds retain the full harness. No frozen feature SCSS,
font, reset, NG-ZORRO theme, or visual component rule was rewritten.

## 13. Confirmed Issues Fixed

### Development-only Spartan harness in optimized global CSS

**Before:** production and static-demo loaded the 20,166-byte Spartan entry containing the
development-only Helm harness and compatibility overlay rules.

**Root cause:** route replacement removed the design-system route, but all configurations still
shared one global style entry, so route tree-shaking could not remove its global development CSS.

**Fix:** added `spartan-tailwind.production.css` containing only Tailwind theme/preflight/utilities
and the shared Spartan Brain preset. Production and static-demo style composition select it;
development retains the full harness entry. The production-boundary checker now enforces that
separation. No dependency, runtime behavior, DOM, or visual feature code changed.

**After:** optimized CSS is 350,830 bytes, down 5,267 bytes raw and 0.64 kB estimated transfer.
Production initial total fell from 962.49 kB to 957.22 kB. Runtime profiling found no confirmed
subscription, listener, timer, request, overlay, or retained-route leak requiring a runtime fix.

## 14. Backend Impact

No backend changes required.

No backend source, API, authorization, persistence, polling cadence, or realtime contract changed.
The browser test intercepted fictional responses locally and did not change backend state.

## 15. Build Comparison

| Metric                             |                 Step 5 |                 Step 6 |                        Change |
| ---------------------------------- | ---------------------: | ---------------------: | ----------------------------: |
| Production initial JavaScript raw  |              606.39 kB |              606.39 kB |          No meaningful change |
| Production initial CSS raw         |              356.10 kB |              350.83 kB |             -5.27 kB (-1.48%) |
| Production initial CSS transfer    |               37.82 kB |               37.18 kB |                      -0.64 kB |
| Production initial total raw       |              962.49 kB |              957.22 kB |             -5.27 kB (-0.55%) |
| Production initial total transfer  |              200.98 kB |              200.41 kB |             -0.57 kB (-0.28%) |
| Production initial budget overage  |              212.49 kB |              207.22 kB |                      -5.27 kB |
| Production emitted browser JS      | 2,941,929 B / 90 files | 2,941,934 B / 90 files | +5 B hash/reference variation |
| Static-demo initial total raw      |              973.35 kB |              968.08 kB |                      -5.27 kB |
| Static-demo initial total transfer |              204.14 kB |              203.45 kB |                      -0.69 kB |

The existing 750 kB warning and 1 MB error budgets were not raised. The initial warning and the two
known static-demo component-style warnings remain visible.

## 16. One-Doctor Endurance Verdict

**MOSTLY HEALTHY.** The ten-cycle production-optimized journey, overlay repetitions, patient
switching, route idle windows, and 125-second degraded Calendar interval found a bounded heap
plateau, collectable transient DOM/listeners, stable timer counts, no duplicate route-init HTTP,
low idle CPU, and no page error. There is no measured evidence of abnormal per-cycle RAM, DOM,
listener, timer, or business-network growth.

The verdict is not `HEALTHY` because this environment did not supply a multi-hour run, a healthy
authenticated realtime server, a real reconnect/visibility sequence, an active consultation, or
Angular DevTools component attribution. Those gaps are material to the primary hours-long question
and should be closed before making the strongest claim.

## 17. 100-Doctor Projection

These are arithmetic projections from one browser, not backend load-test evidence.

### Client RAM/CPU

Each Doctor's own browser bears its own RAM and CPU. Measured used heap ranged from 13.71 MiB on a
cold Command screen to 28.06 MiB on Settings; the warm Command plateau after cycle 10 and forced GC
was 23.09 MiB. Settled-route CPU was 0.02%–0.12% in short windows and degraded Calendar was 0.09%
over 125 seconds. These client values must not be multiplied and reported as server resources.

### HTTP requests

Settled business routes produced zero idle business HTTP requests. If 100 Doctors all remain on a
degraded Calendar, its two-call 120-second fallback projects to 100 business requests/minute. The
observed five-second degraded SockJS probe projects to approximately 1,200 `/ws/info` requests/minute
for 100 continuously disconnected clients. Normal route-entry and user-action requests scale with
actual navigation and activity, not elapsed idle time.

### WebSocket connections

**STATIC PROJECTION:** the intended architecture is one physical application connection per
authenticated workspace, so 100 Doctors imply approximately 100 physical connections and 400
Doctor STOMP subscriptions. This was not demonstrated against a working server in Step 6.

### Expected backend traffic

Healthy realtime should eliminate Calendar fallback reconciliation and disconnected SockJS probes;
business traffic then consists of login/token lifecycle, route initialization, user actions, and
realtime frames. The degraded projections identify reconnect and fallback capacity scenarios for
Step 7, not measured backend throughput or latency.

## 18. Tests / Validation

| Validation                                              | Result                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run test:step1`                                    | 23 tests passed                                                                 |
| `npm run test:step2`                                    | 49 tests passed                                                                 |
| `npm run test:step3`                                    | 93 tests passed                                                                 |
| `npm run test:step4`                                    | 158 tests passed                                                                |
| `npm run test:step5`                                    | 35 tests passed                                                                 |
| `npm run test:ci`                                       | 1,110 tests in 167 files passed                                                 |
| `npx tsc -p tsconfig.app.json --noEmit`                 | Passed                                                                          |
| `npm run check:ui-boundaries`                           | Passed                                                                          |
| `npm run check:production-boundary`                     | Passed, including optimized CSS separation                                      |
| `npx ng build --configuration production --stats-json`  | Passed; three known budget warnings                                             |
| `npx ng build --configuration static-demo`              | Passed                                                                          |
| `node tools/profile-doctor-runtime.mjs --skip-fallback` | Passed; 10 cycles, 10 overlay repetitions, patient switching, long-task capture |
| `node tools/profile-doctor-runtime.mjs`                 | Passed; includes 125-second degraded Calendar fallback                          |
| `git diff --check` (frontend/backend)                   | Passed                                                                          |

The CSS fix is guarded by the executable production-boundary checker rather than a visual-behavior
unit test. No meaningless performance timing unit test was added.

## 19. Remaining Risks

- A real multi-hour foreground/background session and natural-GC plateau have not yet been measured.
- Healthy realtime, server-driven frames, reconnect, token replacement, and visibility restore
  remain unmeasured in a browser connected to a real local/test STOMP endpoint.
- The disconnected client retries `/ws/info` every five seconds; this can become material during a
  broad realtime outage and belongs in Step 7 degradation testing.
- The first overlay sequence left the CDP `Documents` metric at three rather than one. It was
  bounded, but comparative heap snapshots should confirm the owners during a longer run.
- Active consultation, document/artifact work, Clinic task polling, and destructive confirmation
  paths were not safely reachable in this Doctor journey.
- Angular DevTools was unavailable, so component-level change-detection attribution is absent.
- Global CSS remains 350.83 kB, overwhelmingly NG-ZORRO; broad framework or frozen-style changes
  remain unjustified.
- The shared, Calendar, and Settings chunks remain large but have clear dependency/feature
  ownership and no measured runtime fault.
- Profiling used Node 25.6.0, which Angular reports as an odd-numbered, non-LTS release.

## 20. Recommended STEP 7 Load-Test Scenarios

Do not execute these as part of Step 6.

- **25 Doctors:** authenticated steady-state command/calendar mix with healthy realtime; validate
  connection/subscription counts, route-init API latency, no Calendar fallback, and token refresh.
- **100 Doctors:** realistic navigation and appointment/patient-read mix with one WebSocket per
  Doctor; measure p50/p95/p99 HTTP latency, errors, database pool use, frame delivery, and reconnect
  recovery.
- **400 Professionals:** mixed Doctor, secretary, clinic, and administration workspaces with staged
  ramp-up; measure authorization paths, connection limits, pool saturation, CPU, memory, and
  fairness between roles.
- **Realtime degradation:** disconnect/recover the test realtime service, including simultaneous
  reconnect, visibility restore, five-second SockJS probes, and Calendar's 120-second fallback;
  verify jitter/backoff and reconciliation do not create a thundering herd.
- **API burst:** coordinated morning login, command bootstrap, Calendar navigation, patient search,
  settings reads, token refresh, and scheduled-care refresh bursts; verify idempotency and error
  behavior without changing production contracts.

## 21. Git Status

The frontend already contained the uncommitted Step 1–5 work. Step 6 changed or added only:

- `angular.json` optimized style composition;
- `package.json` runtime profiling command;
- `src/styles/vendor/spartan-tailwind.production.css`;
- `tools/check-production-boundaries.mjs` CSS boundary assertions;
- `tools/profile-doctor-runtime.mjs`;
- this record.

Final inspection showed 100 changed/untracked frontend paths in total and 111 concurrent
changed/untracked backend paths. The backend worktree was not edited by Step 6. No commit, push,
branch change, reset, stash, merge, or rebase was performed.

STEP_6_COMPLETE
