import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { prepareSyntheticDoctor } from './doctor-profile-e2e-fixture';

async function openProfileTab(page: Page): Promise<void> {
  await page.goto('/doctor/settings?tab=profile');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('#pp-specialty')).toBeVisible();
}

test('loads the professional profile section with editable and admin-readonly fields', async ({
  page,
}) => {
  await prepareSyntheticDoctor(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await openProfileTab(page);

  await expect(page.locator('#pp-specialty')).toHaveValue('Medecine generale');
  await expect(page.locator('#pp-price')).toHaveValue('80');
  await expect(page.locator('#pp-city')).toHaveValue('Tunis');
  await page.getByText('LIC-2020-001').waitFor();
  await page.getByText('clinic-9').waitFor();
  await page.getByText('2026-01-10').waitFor();
  await expect(
    page.locator('.professional-profile__readonly-row').filter({ hasText: 'Gouvernorat' }),
  ).toContainText('Tunis');
  await expect(page.locator('input#governorate')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test('saves edited fields through PATCH and reloads the refreshed profile', async ({
  page,
}, testInfo) => {
  const { patchBodies, profileGets } = await prepareSyntheticDoctor(page);
  await openProfileTab(page);
  await expect.poll(() => profileGets()).toBe(1);

  await page.locator('#pp-specialty').fill('Medecine generale e2e');
  await page.locator('#pp-list-languages').fill('Anglais');
  await page.locator('#pp-list-languages').press('Enter');
  await expect(page.locator('.oc-tag-input__chip', { hasText: 'Anglais' })).toBeVisible();

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profil mis à jour.' })).toBeVisible();

  await expect.poll(() => patchBodies.length).toBe(1);
  expect(patchBodies[0]).toEqual({
    specialty: 'Medecine generale e2e',
    languages: ['Francais', 'Anglais'],
    expectedRevision: 1,
  });
  await expect.poll(() => profileGets()).toBe(2);
  await expect(page.locator('#pp-specialty')).toHaveValue('Medecine generale e2e');

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Aucune modification a enregistrer.' }),
  ).toBeVisible();
  expect(patchBodies).toHaveLength(1);

  await page.screenshot({ path: testInfo.outputPath('doctor-profile-saved.png'), fullPage: true });
});

test('has no serious or critical AXE violations in the professional profile section', async ({
  page,
}) => {
  await prepareSyntheticDoctor(page);
  await openProfileTab(page);
  const results = await new AxeBuilder({ page })
    .include('.professional-profile')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter((item) =>
    ['critical', 'serious'].includes(item.impact ?? ''),
  );
  // Pre-existing design-system token issue (themes/_omnicare-light.scss documents
  // that the primary brand green is too light for inverse text at AA). Node-level
  // baseline; any unexpected serious/critical node still fails this test.
  const legacyBaseline = new Set(['color-contrast:.oc-button--default > .oc-button__label']);
  const violations = serious.flatMap((item) =>
    item.nodes
      .map((node) => `${item.id}:${node.target.join(' ').replace(/\[_ngcontent-[^\]]*\]/g, '')}`)
      .filter((node) => !legacyBaseline.has(node)),
  );
  expect(violations).toEqual([]);
});
