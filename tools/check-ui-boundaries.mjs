import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const featuresRoot = fileURLToPath(new URL('../src/app/features/', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const violations = [];

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'design-system') await inspect(path);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if ((await readFile(path, 'utf8')).includes("@spartan-ng/")) {
      violations.push(relative(repoRoot, path));
    }
  }
}

await inspect(featuresRoot);

if (violations.length > 0) {
  console.error('Spartan imports are only allowed in the development-only design-system harness:');
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('UI boundary check passed: production feature directories do not import Spartan.');
}

// NG-ZORRO theme: a component's `index.less` without its `patch.less` leaves raw ant-design
// rules in place (e.g. select / date-picker dropdowns stay at `top: -9999px`: they open
// off-screen). Every imported component that ships a patch must import it.
import { access } from 'node:fs/promises';

const themePath = fileURLToPath(new URL('../src/styles/vendor/ng-zorro-theme.less', import.meta.url));
const theme = await readFile(themePath, 'utf8');
const missingPatches = [];
for (const [, component] of theme.matchAll(/ng-zorro-antd\/([a-z-]+)\/style\/index\.less/g)) {
  const patch = join(repoRoot, 'node_modules', 'ng-zorro-antd', component, 'style', 'patch.less');
  const exists = await access(patch).then(() => true, () => false);
  if (exists && !theme.includes(`ng-zorro-antd/${component}/style/patch.less`)) missingPatches.push(component);
}
if (missingPatches.length > 0) {
  console.error(`NG-ZORRO theme imports these components without their patch.less: ${missingPatches.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('NG-ZORRO theme check passed: every imported component includes its patch.less.');
}

// Clinical visual language (docs/ui-guidelines.md §8): no uppercase labels and no left-border
// accent cards in the medical record, the consultation page and their shared primitives.
const clinicalRoots = [
  'src/app/features/doctor/patient-chart',
  'src/app/features/doctor/consultation',
  'src/app/shared/ui/tag',
  'src/app/shared/ui/date-block',
  'src/app/shared/ui/file-card',
];
const clinicalRules = [
  [/text-transform\s*:\s*uppercase/i, 'text-transform: uppercase'],
  [/border-(?:left|inline-start)\s*:\s*[3-9]px/i, 'left-border accent'],
];
const clinicalViolations = [];
async function inspectClinical(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspectClinical(path);
      continue;
    }
    if (!/\.(ts|scss|html)$/.test(entry.name) || entry.name.endsWith('.spec.ts')) continue;
    const content = await readFile(path, 'utf8');
    for (const [pattern, label] of clinicalRules) {
      if (pattern.test(content)) clinicalViolations.push(`${relative(repoRoot, path)}: ${label}`);
    }
  }
}
for (const root of clinicalRoots) await inspectClinical(join(repoRoot, root));
if (clinicalViolations.length > 0) {
  console.error('Clinical visual language violations:');
  console.error(clinicalViolations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Clinical visual language check passed: no uppercase labels, no left-border accents.');
}

// G-1 P3a: `PATCH /appointments/{id}/start|complete` are retired (410 ENDPOINT_RETIRED). Starting
// and finishing go only through the consultation lifecycle; no Angular caller may come back.
// G-1 P3b: `PATCH /appointments/{id}/cancel` is retired too; every cancellation uses the versioned
// `POST …/cancel` (expectedVersion + Idempotency-Key). `PATCH …/secretary-cancel` is a separate route.
const legacyCallers = [];
async function inspectLegacy(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspectLegacy(path);
      continue;
    }
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;
    const content = await readFile(path, 'utf8');
    const retiredLifecycle = /\.patch\s*(?:<[^>]*>)?\(\s*`[^`]*\/(?:start|complete)`/;
    const retiredCancel = /\.patch\s*(?:<[^>]*>)?\(\s*`[^`]*\/appointments\/[^`]*\/cancel`/;
    if (retiredLifecycle.test(content) || retiredCancel.test(content)) legacyCallers.push(relative(repoRoot, path));
  }
}
await inspectLegacy(join(repoRoot, 'src/app'));
if (legacyCallers.length > 0) {
  console.error('Retired appointment routes are still called (PATCH …/start, …/complete or …/cancel):');
  console.error(legacyCallers.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Legacy route check passed: no PATCH …/start, …/complete or …/cancel caller.');
}
