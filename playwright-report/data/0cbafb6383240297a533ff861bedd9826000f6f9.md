# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: clinic-ui-isolation.spec.ts >> request dialogs and handover tabs retain their existing keyboard behaviour
- Location: e2e/clinic-ui-isolation.spec.ts:78:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('a[href="/clinic/handovers"]')
    - locator resolved to <a nz-tooltip="" href="/clinic/handovers" _ngcontent-ng-c83768959="" nztooltipplacement="right" class="oc-sidebar__standalone">…</a>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
      - waiting 100ms
    55 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - element is outside of the viewport
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - link "Skip to main content" [ref=f1e5] [cursor=pointer]:
    - /url: "#clinic-content"
  - generic [ref=f1e6]:
    - complementary "Primary navigation" [ref=f1e8]:
      - generic [ref=f1e9]:
        - generic [aria-hidden] [ref=f1e10]:
          - text: O
          - generic [ref=f1e11]: +
        - generic [ref=f1e12]:
          - text: OmniCare
          - generic [ref=f1e13]: Clinical workspace
      - generic [ref=f1e14]:
        - generic [ref=f1e15]: Search navigation
        - searchbox "Search navigation" [ref=f1e19]
      - navigation "Workspace" [ref=f1e20]:
        - list [ref=f1e21]:
          - listitem [ref=f1e22]:
            - link "Requests" [ref=f1e23] [cursor=pointer]:
              - /url: /clinic/requests
          - listitem [ref=f1e28]:
            - button "Tasks" [ref=f1e29] [cursor=pointer]
          - listitem [ref=f1e37]:
            - link "Handovers" [ref=f1e38] [cursor=pointer]:
              - /url: /clinic/handovers
          - listitem [ref=f1e43]:
            - link "Staff" [ref=f1e44] [cursor=pointer]:
              - /url: /clinic/staff
          - listitem [ref=f1e49]:
            - button "Configuration" [ref=f1e50] [cursor=pointer]
      - generic [ref=f1e58]:
        - generic [aria-hidden] [ref=f1e59]: EC
        - generic [ref=f1e60]:
          - strong [ref=f1e61]: E2E Clinic
          - generic [ref=f1e62]: Clinic administrator
        - button "Open user menu for E2E Clinic" [ref=f1e63] [cursor=pointer]
      - button "Collapse navigation" [ref=f1e67] [cursor=pointer]
    - generic [ref=f1e72]:
      - banner [ref=f1e73]:
        - button "Open clinic navigation" [ref=f1e74] [cursor=pointer]
        - generic [ref=f1e78]:
          - generic [ref=f1e79]: Clinic workspace
          - strong [ref=f1e80]: E2E Clinic
        - button "Sign out" [ref=f1e81] [cursor=pointer]
      - main [ref=f1e82]:
        - generic [ref=f1e84]:
          - generic "Requests" [ref=f1e85]:
            - generic [ref=f1e86]:
              - generic [ref=f1e87]:
                - navigation "Breadcrumb" [ref=f1e88]: Clinic workspace / Requests
                - heading "Requests" [level=1] [ref=f1e89]
                - paragraph [ref=f1e90]: Manage incoming OmniCare requests for this clinic.
              - generic "Page actions" [ref=f1e91]:
                - button "Refresh" [ref=f1e94] [cursor=pointer]
          - region "Request filters" [ref=f1e96]:
            - generic [ref=f1e97]:
              - generic [ref=f1e98]: Status
              - generic "Filter requests by status" [ref=f1e99] [cursor=pointer]:
                - generic [ref=f1e101]:
                  - textbox "Status Filter requests by status" [ref=f1e103]
                  - generic "All statuses" [ref=f1e104]
                - img "down" [ref=f1e105]
            - paragraph [ref=f1e108]: Filters are applied by the server.
          - region "Operational data table" [ref=f1e110]:
            - generic [ref=f1e111]:
              - generic [ref=f1e112]:
                - heading "Request queue" [level=2] [ref=f1e113]
                - paragraph [ref=f1e114]: Updated 14 Sept, 10:00
              - generic [ref=f1e116]:
                - generic [ref=f1e117]: Rows
                - generic "Rows per page" [ref=f1e118] [cursor=pointer]:
                  - generic [ref=f1e120]:
                    - textbox [ref=f1e122]
                    - generic "20" [ref=f1e123]
                  - img "down" [ref=f1e124]
            - generic "Scrollable table region" [ref=f1e127]:
              - table [ref=f1e128]:
                - caption [ref=f1e129]: Clinic requests. Open a row with its View request link.
                - rowgroup [ref=f1e130]:
                  - row [ref=f1e131]:
                    - columnheader "Request" [ref=f1e132]
                    - columnheader "Patient"
                    - columnheader "Status" [ref=f1e133]
                    - columnheader "Priority" [ref=f1e134]
                    - columnheader "Action" [ref=f1e135]
                - rowgroup [ref=f1e137]:
                  - row [ref=f1e138]:
                    - cell [ref=f1e139]:
                      - strong [ref=f1e140]: "#E2ECASE"
                    - cell "Sample intake record Self":
                      - generic: Sample intake record
                      - generic: Self
                    - cell "Under review" [ref=f1e141]
                    - cell "Normal" [ref=f1e145]
                    - cell [ref=f1e148]:
                      - 'link "View request #E2ECASE for Sample intake record" [ref=f1e149] [cursor=pointer]':
                        - /url: /clinic/requests/e2e-case
                        - text: View request View
            - generic [ref=f1e151]:
              - generic [ref=f1e152]: Page 1 · 1 shown
              - generic "Request pages" [ref=f1e153]:
                - button "Previous" [disabled] [ref=f1e155]
                - button "Next" [disabled] [ref=f1e157]
```

# Test source

```ts
  1  | import AxeBuilder from '@axe-core/playwright';
  2  | import { expect, test, type Page } from '@playwright/test';
  3  | import { prepareSyntheticClinic } from './clinic-e2e-fixture';
  4  | 
  5  | const routes = [
  6  |   ['/clinic/tasks/my', 'My Tasks'], ['/clinic/tasks/queue', 'Position Queue'],
  7  |   ['/clinic/tasks/e2e-task', 'Administrative review'], ['/clinic/requests', 'Requests'],
  8  |   ['/clinic/requests/e2e-case', 'Request'], ['/clinic/staff', 'Staff'], ['/clinic/handovers', 'Handovers'],
  9  | ] as const;
  10 | 
  11 | /**
  12 |  * Narrow, node-level legacy AXE baseline captured before P0A.  Do not replace
  13 |  * this with a rule-wide exclusion: any new serious/critical node still fails.
  14 |  */
  15 | const legacyAxeBaseline: Record<(typeof routes)[number][0], readonly string[]> = {
  16 |   '/clinic/tasks/my': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:th:nth-child(1)', 'color-contrast:th:nth-child(2)', 'color-contrast:th:nth-child(3)', 'color-contrast:th:nth-child(4)', 'color-contrast:th:nth-child(5)', 'color-contrast:th:nth-child(6)', 'color-contrast:a[href$="e2e-case"]', 'color-contrast:a[href$="e2e-task"]'],
  17 |   '/clinic/tasks/queue': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:th:nth-child(1)', 'color-contrast:th:nth-child(2)', 'color-contrast:th:nth-child(3)', 'color-contrast:th:nth-child(4)', 'color-contrast:th:nth-child(5)', 'color-contrast:th:nth-child(6)', 'color-contrast:a[href$="e2e-case"]', 'color-contrast:a[href$="e2e-task"]'],
  18 |   '/clinic/tasks/e2e-task': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:.task-detail-back', 'color-contrast:a[href$="e2e-case"]'],
  19 |   '/clinic/requests': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:th:nth-child(1)', 'color-contrast:th:nth-child(2)', 'color-contrast:thead > tr > .requests-table__situation', 'color-contrast:th:nth-child(4)', 'color-contrast:th:nth-child(5)', 'color-contrast:thead > tr > .requests-table__step', 'color-contrast:thead > tr > .requests-table__submitted', 'color-contrast:a[href$="e2e-case"]', 'label:#request-page-size > nz-select-top-control > .ant-select-selection-wrap > nz-select-search > .ant-select-selection-search-input[autocomplete="off"][readonly="readonly"]'],
  20 |   '/clinic/requests/e2e-case': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:.request-detail-back'],
  21 |   '/clinic/staff': ['aria-prohibited-attr:.oc-page-header__actions', 'color-contrast:.oc-sidebar__avatar', 'color-contrast:a[href$="e2e-staff"]'],
  22 |   '/clinic/handovers': ['color-contrast:.oc-sidebar__avatar'],
  23 | };
  24 | 
  25 | test.beforeEach(async ({ page }) => { await prepareSyntheticClinic(page); });
  26 | 
  27 | /**
  28 |  * Capability guards intentionally send an unresolved clinic context through
  29 |  * `/clinic` first.  Prime that production flow before visiting a protected
  30 |  * child route; the fixture never changes guards or application code.
  31 |  */
  32 | async function openClinicRoute(page: Page, path: string): Promise<void> {
  33 |   await page.goto('/clinic');
  34 |   await expect(page.getByRole('main')).toBeVisible();
  35 |   await expect(page.locator('.clinic-context-bar')).toContainText('E2E Clinic');
  36 |   await expect(page).toHaveURL(/\/clinic\/requests/);
  37 | 
  38 |   if (path === '/clinic/requests') return;
  39 |   if (path === '/clinic/requests/e2e-case') {
  40 |     await page.locator('a[href="/clinic/requests/e2e-case"]').click();
  41 |   } else if (path === '/clinic/tasks/my' || path === '/clinic/tasks/queue') {
  42 |     await page.getByRole('button', { name: 'Tasks', exact: true }).click();
  43 |     await page.locator(`a[href="${path}"]`).click();
  44 |   } else if (path === '/clinic/tasks/e2e-task') {
  45 |     await page.getByRole('button', { name: 'Tasks', exact: true }).click();
  46 |     await page.locator('a[href="/clinic/tasks/my"]').click();
  47 |     await page.getByRole('link', { name: 'View task' }).click();
  48 |   } else {
> 49 |     await page.locator(`a[href="${path}"]`).click();
     |                                             ^ Error: locator.click: Test timeout of 30000ms exceeded.
  50 |   }
  51 |   await expect(page).toHaveURL(path);
  52 | }
  53 | 
  54 | for (const [path, heading] of routes) {
  55 |   test(`${path} renders without page overflow`, async ({ page }, testInfo) => {
  56 |     const errors: string[] = [];
  57 |     page.on('pageerror', (error) => errors.push(error.message));
  58 |     await openClinicRoute(page, path);
  59 |     await expect(page.getByRole('main')).toBeVisible();
  60 |     await expect(page.getByRole('heading', { name: new RegExp(heading, 'i') }).first()).toBeVisible();
  61 |     await expect.poll(() => page.evaluate(() => {
  62 |       const main = document.querySelector<HTMLElement>('#clinic-content');
  63 |       return document.body.scrollWidth <= document.body.clientWidth
  64 |         && (main === null || main.scrollWidth <= main.clientWidth);
  65 |     })).toBe(true);
  66 |     const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  67 |     const serious = results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''));
  68 |     const expected = new Set(legacyAxeBaseline[path]);
  69 |     const unexpected = serious.flatMap((item) => item.nodes
  70 |       .map((node) => `${item.id}:${node.target.join(' ')}`)
  71 |       .filter((node) => !expected.has(node)));
  72 |     expect(unexpected).toEqual([]);
  73 |     await page.screenshot({ path: testInfo.outputPath(`clinic-${path.split('/').filter(Boolean).join('-')}.png`), fullPage: true });
  74 |     expect(errors).toEqual([]);
  75 |   });
  76 | }
  77 | 
  78 | test('request dialogs and handover tabs retain their existing keyboard behaviour', async ({ page }) => {
  79 |   await openClinicRoute(page, '/clinic/requests/e2e-case');
  80 |   await page.getByRole('button', { name: /request information/i }).click();
  81 |   await expect(page.getByRole('dialog')).toBeVisible();
  82 |   await page.keyboard.press('Escape');
  83 |   await openClinicRoute(page, '/clinic/handovers');
  84 |   const tabs = page.getByRole('tablist', { name: 'Handover direction' });
  85 |   await expect(tabs).toBeVisible();
  86 |   const incoming = tabs.getByRole('tab', { name: 'Incoming' });
  87 |   await incoming.press('ArrowRight');
  88 |   await expect(tabs.getByRole('tab', { name: 'Outgoing' })).toHaveAttribute('aria-selected', 'true');
  89 | });
  90 | 
```