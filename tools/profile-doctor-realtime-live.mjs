import { chromium } from '@playwright/test';
import { chmod, writeFile } from 'node:fs/promises';

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl ?? 'http://127.0.0.1:4300';
const password = process.env.OMNICARE_LOAD_PASSWORD;
const output = args.out ?? '/tmp/omnicare-step10b-browser-realtime.json';
if (!password) throw new Error('OMNICARE_LOAD_PASSWORD is required');

const browser = await chromium.launch({ headless: args.headed !== true });
const context = await browser.newContext();
const page = await context.newPage();
const connections = [];
const requests = [];
const responses = [];
const browserMessages = [];
let loginRequestShape = null;
let loginRequestBody = null;
const loginAttempts = new Map();

page.on('requestfinished', (request) => {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/v1/')) {
    requests.push({ method: request.method(), path: url.pathname, at: Date.now() });
  }
});
page.on('response', async (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith('/api/v1/')) {
    const item = { method: response.request().method(), path: url.pathname, status: response.status() };
    if (url.pathname === '/api/v1/auth/login') {
      item.code = await response.json().then((body) => body?.code ?? body?.error?.code ?? null).catch(() => null);
    }
    responses.push(item);
  }
});
page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.pathname !== '/api/v1/auth/login' || request.method() !== 'POST') return;
  try {
    const body = request.postDataJSON();
    if (loginRequestBody !== null) return;
    loginRequestBody = body;
    loginRequestShape = {
      identifier: body.identifier,
      passwordLength: typeof body.password === 'string' ? body.password.length : null,
      passwordMatchesExpected: body.password === password,
      platform: body.platform,
      sharedDevice: body.sharedDevice,
      rememberDevice: body.rememberDevice,
    };
  } catch {
    loginRequestShape = { parseFailed: true };
  }
});
page.on('console', (message) => browserMessages.push(`${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));
page.on('websocket', (socket) => {
  if (!socket.url().includes('/api/v1/ws/')) return;
  const connection = { url: socket.url(), openedAt: Date.now(), closedAt: null, sent: [] };
  connections.push(connection);
  socket.on('framesent', (event) => connection.sent.push(String(event.payload)));
  socket.on('close', () => { connection.closedAt = Date.now(); });
});

const run = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  browser: 'playwright-chromium',
  steps: {},
};

try {
  const warmup = await context.request.post(`${baseUrl}/api/v1/auth/login`, {
    data: {
      identifier: 'step7-doctor-0100@load.test',
      password,
      deviceFingerprint: 'step10b-browser-warmup',
      platform: 'WEB',
      deviceLabel: 'Step 10B browser warmup',
      sharedDevice: false,
      rememberDevice: false,
    },
  });
  assert(warmup.status() === 200, `synthetic auth warmup failed: ${warmup.status()}`);
  const warmupBody = await warmup.json();
  await context.request.post(`${baseUrl}/api/v1/auth/logout`, {
    headers: { Authorization: `Bearer ${warmupBody.session.accessToken}` },
  });
  run.steps.authWarmup = { status: 200, loggedOut: true };

  await login('step7-doctor-0001@load.test');
  const doctorA = await storedUser();
  const first = await waitForConnection(0);
  await waitForSubscriptions(first, 4);
  run.steps.login = { userId: doctorA.id, connections: connections.length };

  for (const route of ['/doctor/calendar', '/doctor/patients', '/doctor/settings', '/doctor/command']) {
    await page.locator(`a[href="${route}"]`).first().click();
    await page.waitForURL((url) => url.pathname === route);
  }
  await page.waitForTimeout(1_000);
  assert(connections.length === 1, `route navigation opened ${connections.length} sockets`);
  assert(subscriptionDestinations(first).length === 4, 'route navigation duplicated subscriptions');
  run.steps.navigation = { routes: 4, connections: connections.length, subscriptions: 4 };

  await page.locator('a[href="/doctor/calendar"]').first().click();
  await page.waitForURL((url) => url.pathname === '/doctor/calendar');
  await page.waitForTimeout(3_000);
  const healthyStart = Date.now();
  await page.waitForTimeout(125_000);
  const healthyFallback = businessReconciliationSince(healthyStart);
  assert(healthyFallback.scheduledCare === 0 && healthyFallback.exceptions === 0,
    `healthy Calendar issued degraded fallback: ${JSON.stringify(healthyFallback)}`);
  run.steps.healthyCalendar = { seconds: 125, ...healthyFallback };

  const visibilityStart = Date.now();
  const cover = await context.newPage();
  await cover.goto('about:blank');
  await cover.bringToFront();
  await page.waitForTimeout(1_000);
  const hiddenState = await page.evaluate(() => document.visibilityState);
  await page.bringToFront();
  await page.waitForFunction(() => document.visibilityState === 'visible');
  await page.waitForTimeout(2_000);
  await cover.close();
  const visibilityRequests = requests.filter((request) => request.at >= visibilityStart);
  assert(hiddenState === 'hidden', `browser tab did not enter hidden state (${hiddenState})`);
  assert(connections.length === 1, 'visibility restore opened a duplicate socket');
  run.steps.visibility = {
    hiddenState,
    restoredState: await page.evaluate(() => document.visibilityState),
    connections: connections.length,
    reconciliation: summarizePaths(visibilityRequests),
  };

  const refreshStarted = Date.now();
  await page.evaluate(async () => {
    const key = 'omnicare.dashboard.session';
    const stored = JSON.parse(sessionStorage.getItem(key));
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    if (!response.ok) throw new Error(`refresh failed: ${response.status}`);
    sessionStorage.setItem(key, JSON.stringify(await response.json()));
  });
  await page.reload();
  await page.waitForURL((url) => url.pathname.startsWith('/doctor'));
  const replacement = await waitForConnection(1);
  await waitForSubscriptions(replacement, 4);
  await waitUntil(() => first.closedAt !== null, 10_000, 'old socket did not close after token replacement');
  run.steps.tokenReplacement = {
    connections: connections.length,
    oldClosed: first.closedAt !== null,
    subscriptions: subscriptionDestinations(replacement),
    reconciliation: summarizePaths(requests.filter((request) => request.at >= refreshStarted)),
  };

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/login');
  await waitUntil(() => replacement.closedAt !== null, 10_000, 'logout did not close realtime');
  assert(sessionStorageValue(await page.evaluate(() => sessionStorage.getItem('omnicare.dashboard.session'))) === null,
    'logout retained the browser session');
  run.steps.logoutA = { socketClosed: replacement.closedAt !== null };

  await login('step7-doctor-0002@load.test');
  const doctorB = await storedUser();
  const secondAccount = await waitForConnection(2);
  await waitForSubscriptions(secondAccount, 4);
  assert(doctorA.id !== doctorB.id, 'Doctor B reused Doctor A identity');
  assert(connections.filter((connection) => connection.closedAt === null).length === 1,
    'Doctor B inherited another active socket');
  run.steps.accountChange = {
    doctorA: doctorA.id,
    doctorB: doctorB.id,
    activeConnections: connections.filter((connection) => connection.closedAt === null).length,
    subscriptions: subscriptionDestinations(secondAccount),
  };

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/login');
  await waitUntil(() => secondAccount.closedAt !== null, 10_000, 'Doctor B logout did not close realtime');

  run.finishedAt = new Date().toISOString();
  run.connections = connections.map((connection) => ({
    urlPath: new URL(connection.url).pathname,
    openedAt: connection.openedAt,
    closedAt: connection.closedAt,
    subscriptions: subscriptionDestinations(connection),
  }));
  run.requestSummary = summarizePaths(requests);
  run.loginAttempts = Object.fromEntries(loginAttempts);
  run.passed = true;
} catch (error) {
  run.finishedAt = new Date().toISOString();
  run.passed = false;
  run.error = error instanceof Error ? error.message : String(error);
  run.diagnostics = {
    url: page.url(),
    alert: await page.locator('[role="alert"]').first().textContent().catch(() => null),
    responses,
    browserMessages,
    loginRequestShape,
    loginAttempts: Object.fromEntries(loginAttempts),
    rawCredentialStatus: await page.evaluate(async ({ identifier, password }) => {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password,
          deviceFingerprint: 'step10b-browser-diagnostic',
          platform: 'WEB',
          deviceLabel: 'Step 10B browser diagnostic',
          sharedDevice: false,
          rememberDevice: false,
        }),
      });
      return response.status;
    }, { identifier: 'step7-doctor-0001@load.test', password }).catch(() => null),
    variantStatuses: loginRequestBody === null ? null : await page.evaluate(async (body) => {
      const send = async (value) => (await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(value),
      })).status;
      return {
        exactFormBody: await send(body),
        actualFingerprintRememberFalse: await send({ ...body, rememberDevice: false }),
        staticFingerprintRememberTrue: await send({
          ...body,
          deviceFingerprint: 'step10b-browser-static',
          rememberDevice: true,
        }),
      };
    }, loginRequestBody).catch(() => null),
  };
  throw error;
} finally {
  await writeFile(output, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 });
  await chmod(output, 0o600);
  await browser.close();
}

console.log(JSON.stringify(run, null, 2));

async function login(identifier) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('#email').fill(identifier);
  await page.locator('#password').fill(password);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    loginAttempts.set(identifier, attempt);
    await page.getByRole('button', { name: 'Sign in' }).click();
    try {
      await page.waitForURL((url) => url.pathname.startsWith('/doctor'), { timeout: 8_000 });
      return;
    } catch (error) {
      if (attempt === 2 || !(await page.locator('[role="alert"]').isVisible())) throw error;
    }
  }
}

async function storedUser() {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('omnicare.dashboard.session')).user);
}

async function waitForConnection(index) {
  await waitUntil(() => connections[index] !== undefined, 15_000, `socket ${index + 1} did not open`);
  return connections[index];
}

async function waitForSubscriptions(connection, expected) {
  await waitUntil(() => subscriptionDestinations(connection).length === expected, 15_000,
    `expected ${expected} subscriptions`);
}

function subscriptionDestinations(connection) {
  const found = [];
  for (const frame of connection.sent) {
    for (const destination of [
      '/user/queue/urgent-requests',
      '/user/queue/appointments',
      '/user/queue/scheduled-care',
      '/user/queue/notifications',
    ]) {
      if (frame.includes(`destination:${destination}`) && !found.includes(destination)) found.push(destination);
    }
  }
  return found.sort();
}

function businessReconciliationSince(startedAt) {
  const recent = requests.filter((request) => request.at >= startedAt);
  return {
    scheduledCare: recent.filter((request) => request.path === '/api/v1/doctor/scheduled-care').length,
    exceptions: recent.filter((request) => request.path === '/api/v1/appointments/availability/exceptions').length,
  };
}

function summarizePaths(values) {
  return Object.fromEntries([...values.reduce((map, request) => {
    map.set(request.path, (map.get(request.path) ?? 0) + 1);
    return map;
  }, new Map()).entries()].sort());
}

async function waitUntil(predicate, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await page.waitForTimeout(100);
  }
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sessionStorageValue(value) {
  return value;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) continue;
    if (key === '--headed') parsed.headed = true;
    else parsed[key.slice(2)] = values[++index];
  }
  return parsed;
}
