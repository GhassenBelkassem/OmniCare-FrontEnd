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
