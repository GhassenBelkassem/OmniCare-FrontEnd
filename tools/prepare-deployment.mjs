import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1';
const DEFAULT_BROWSER_OUTPUT = 'dist/omniCareDash/browser';

const browserOutput = path.resolve(
  process.env['RAILPACK_SPA_OUTPUT_DIR']?.trim() || DEFAULT_BROWSER_OUTPUT,
);
const apiBaseUrl = normalizeApiBaseUrl(
  process.env['OMNICARE_API_BASE_URL'] || DEFAULT_API_BASE_URL,
);

await access(browserOutput);
await ensureStaticIndex(browserOutput);
await writeRuntimeConfig(browserOutput, apiBaseUrl);

async function ensureStaticIndex(outputDirectory) {
  const csrIndex = path.join(outputDirectory, 'index.csr.html');
  const staticIndex = path.join(outputDirectory, 'index.html');

  try {
    await access(csrIndex);
  } catch {
    await access(staticIndex);
    return;
  }

  await copyFile(csrIndex, staticIndex);
}

async function writeRuntimeConfig(outputDirectory, configuredApiBaseUrl) {
  const configDirectory = path.join(outputDirectory, 'config');
  const configFile = path.join(configDirectory, 'runtime-config.js');
  const contents = [
    '// Generated during deployment. This file must contain public configuration only.',
    'globalThis.__OMNICARE_CONFIG__ = Object.freeze({',
    `  apiBaseUrl: ${JSON.stringify(configuredApiBaseUrl)},`,
    '});',
    '',
  ].join('\n');

  await mkdir(configDirectory, { recursive: true });
  await writeFile(configFile, contents, 'utf8');
}

function normalizeApiBaseUrl(value) {
  const normalized = value.trim().replace(/\/+$/, '');
  if (normalized.startsWith('/') && !normalized.startsWith('//')) {
    return normalized;
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('OMNICARE_API_BASE_URL must be an absolute HTTP(S) URL or a same-origin path');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('OMNICARE_API_BASE_URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('OMNICARE_API_BASE_URL must not contain credentials');
  }

  return normalized;
}
