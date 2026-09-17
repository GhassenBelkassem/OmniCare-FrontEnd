import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { prepareSyntheticClinic } from './clinic-e2e-fixture';

const routes = [
  ['/clinic/tasks/my', 'My Tasks'], ['/clinic/tasks/queue', 'Position Queue'],
  ['/clinic/tasks/e2e-task', 'Administrative review'], ['/clinic/requests', 'Requests'],
  ['/clinic/requests/e2e-case', 'Request'], ['/clinic/staff', 'Staff'], ['/clinic/handovers', 'Handovers'],
] as const;

/**
 * Narrow, node-level legacy AXE baseline captured before P0A.  Do not replace
 * this with a rule-wide exclusion: any new serious/critical node still fails.
 */
const legacyAxeBaseline: Record<(typeof routes)[number][0], readonly string[]> = {
  '/clinic/tasks/my': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:th:nth-child(1)', 'color-contrast:th:nth-child(2)', 'color-contrast:th:nth-child(3)', 'color-contrast:th:nth-child(4)', 'color-contrast:th:nth-child(5)', 'color-contrast:th:nth-child(6)', 'color-contrast:a[href$="e2e-case"]', 'color-contrast:a[href$="e2e-task"]'],
  '/clinic/tasks/queue': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:th:nth-child(1)', 'color-contrast:th:nth-child(2)', 'color-contrast:th:nth-child(3)', 'color-contrast:th:nth-child(4)', 'color-contrast:th:nth-child(5)', 'color-contrast:th:nth-child(6)', 'color-contrast:a[href$="e2e-case"]', 'color-contrast:a[href$="e2e-task"]'],
  '/clinic/tasks/e2e-task': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:.task-detail-back', 'color-contrast:a[href$="e2e-case"]'],
  '/clinic/requests': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:th:nth-child(1)', 'color-contrast:th:nth-child(2)', 'color-contrast:thead > tr > .requests-table__situation', 'color-contrast:th:nth-child(4)', 'color-contrast:th:nth-child(5)', 'color-contrast:thead > tr > .requests-table__step', 'color-contrast:thead > tr > .requests-table__submitted', 'color-contrast:a[href$="e2e-case"]', 'label:#request-page-size > nz-select-top-control > .ant-select-selection-wrap > nz-select-search > .ant-select-selection-search-input[autocomplete="off"][readonly="readonly"]'],
  '/clinic/requests/e2e-case': ['color-contrast:.oc-sidebar__avatar', 'color-contrast:.request-detail-back'],
  '/clinic/staff': ['aria-prohibited-attr:.oc-page-header__actions', 'color-contrast:.oc-sidebar__avatar', 'color-contrast:a[href$="e2e-staff"]'],
  '/clinic/handovers': ['color-contrast:.oc-sidebar__avatar'],
};

test.beforeEach(async ({ page }) => { await prepareSyntheticClinic(page); });

/**
 * Capability guards intentionally send an unresolved clinic context through
 * `/clinic` first.  Prime that production flow before visiting a protected
 * child route; the fixture never changes guards or application code.
 */
async function openClinicRoute(page: Page, path: string): Promise<void> {
  await page.goto('/clinic');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('.clinic-context-bar')).toContainText('E2E Clinic');
  await expect(page).toHaveURL(/\/clinic\/requests/);

  if (path === '/clinic/requests') return;
  if (path === '/clinic/requests/e2e-case') {
    await page.locator('a[href="/clinic/requests/e2e-case"]').click();
  } else if (path === '/clinic/tasks/my' || path === '/clinic/tasks/queue') {
    await page.getByRole('button', { name: 'Tasks', exact: true }).click();
    await page.locator(`a[href="${path}"]`).click();
  } else if (path === '/clinic/tasks/e2e-task') {
    await page.getByRole('button', { name: 'Tasks', exact: true }).click();
    await page.locator('a[href="/clinic/tasks/my"]').click();
    await page.getByRole('link', { name: 'View task' }).click();
  } else {
    await page.locator(`a[href="${path}"]`).click();
  }
  await expect(page).toHaveURL(path);
}

for (const [path, heading] of routes) {
  test(`${path} renders without page overflow`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openClinicRoute(page, path);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(heading, 'i') }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const main = document.querySelector<HTMLElement>('#clinic-content');
      return document.body.scrollWidth <= document.body.clientWidth
        && (main === null || main.scrollWidth <= main.clientWidth);
    })).toBe(true);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? ''));
    const expected = new Set(legacyAxeBaseline[path]);
    const unexpected = serious.flatMap((item) => item.nodes
      .map((node) => `${item.id}:${node.target.join(' ')}`)
      .filter((node) => !expected.has(node)));
    expect(unexpected).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`clinic-${path.split('/').filter(Boolean).join('-')}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('request dialogs and handover tabs retain their existing keyboard behaviour', async ({ page }) => {
  await openClinicRoute(page, '/clinic/requests/e2e-case');
  await page.getByRole('button', { name: /request information/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await openClinicRoute(page, '/clinic/handovers');
  const tabs = page.getByRole('tablist', { name: 'Handover direction' });
  await expect(tabs).toBeVisible();
  const incoming = tabs.getByRole('tab', { name: 'Incoming' });
  await incoming.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Outgoing' })).toHaveAttribute('aria-selected', 'true');
});
