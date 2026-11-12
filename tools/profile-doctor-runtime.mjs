import { chromium } from '@playwright/test';

const baseUrl = process.env['OMNICARE_PROFILE_BASE_URL'] ?? 'http://127.0.0.1:4300';
const idleWindowMs = Number(process.env['OMNICARE_PROFILE_IDLE_MS'] ?? 2_000);
const fallbackWindowMs = process.argv.includes('--skip-fallback')
  ? 0
  : Number(process.env['OMNICARE_PROFILE_FALLBACK_MS'] ?? 125_000);

const now = '2026-11-08T09:00:00.000Z';
const completedConsultationId = '7b54cf2f-3cad-4fe4-b2a6-8a5b9fa8d9a1';

const patients = [
  {
    id: 'patient-amira',
    doctorId: 'e2e-doctor',
    firstName: 'Amira',
    lastName: 'Ben Salah',
    dateOfBirth: '1985-03-12',
    sex: 'F',
    phone: '+216 20 000 303',
    email: 'amira.bensalah@example.test',
    address: 'Tunis',
    source: 'OMNICARE',
    linkedOmniCareUserId: 'user-amira',
    mrsPatientId: 'synthetic-mrs-amira',
    mrsProvisioned: true,
    possibleOmniCareMatch: false,
    createdAt: '2024-02-12T09:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 'patient-leila',
    doctorId: 'e2e-doctor',
    firstName: 'Leila',
    lastName: 'Mansouri',
    dateOfBirth: '1991-06-23',
    sex: 'F',
    phone: '+216 55 802 114',
    email: null,
    address: 'Ariana',
    source: 'IMPORTED',
    linkedOmniCareUserId: null,
    mrsPatientId: null,
    mrsProvisioned: false,
    possibleOmniCareMatch: true,
    createdAt: '2025-01-12T09:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 'patient-sami',
    doctorId: 'e2e-doctor',
    firstName: 'Sami',
    lastName: 'Trabelsi',
    dateOfBirth: '1978-11-04',
    sex: 'M',
    phone: '+216 71 000 555',
    email: 'sami.trabelsi@example.test',
    address: 'Tunis',
    source: 'MANUAL',
    linkedOmniCareUserId: null,
    mrsPatientId: null,
    mrsProvisioned: false,
    possibleOmniCareMatch: false,
    createdAt: '2025-03-20T09:00:00.000Z',
    updatedAt: now,
  },
];

const scheduledItem = {
  resourceType: 'APPOINTMENT',
  requestId: null,
  appointmentId: 'appointment-runtime-1',
  sourceBookingRequestId: 'request-runtime-1',
  version: 1,
  status: 'CONFIRMED',
  doctor: { displayName: 'Dr Runtime Test', specialty: 'Médecine générale' },
  subject: { subjectType: 'SELF', displayName: 'Amira Ben Salah', relationship: 'Patiente' },
  cabinet: {
    name: 'Cabinet de test',
    address: 'Adresse synthétique',
    city: 'Tunis',
    governorate: 'Tunis',
    timezone: 'Africa/Tunis',
  },
  start: '2026-11-10T09:00:00.000Z',
  end: '2026-11-10T09:30:00.000Z',
  timezone: 'Africa/Tunis',
  responseDeadline: null,
  cancellation: null,
  intakeStatus: null,
  availableActions: ['CANCEL_APPOINTMENT'],
  sortAt: '2026-11-10T09:00:00.000Z',
  updatedAt: now,
};

const legacyAppointment = {
  id: 'appointment-runtime-1',
  doctorId: 'e2e-doctor',
  patientId: 'patient-amira',
  patientName: 'Amira Ben Salah',
  startTime: '2026-11-10T09:00:00.000Z',
  endTime: '2026-11-10T09:30:00.000Z',
  status: 'CONFIRMED',
  source: 'WEB',
  notes: 'Rendez-vous synthétique',
  quotedPriceTnd: 80,
  startedAt: null,
  completedAt: null,
  createdAt: now,
};

const completedConsultation = {
  consultationId: completedConsultationId,
  patient: { displayName: 'Patient historique synthétique', relationship: null },
  sourceType: 'SCHEDULED_APPOINTMENT',
  sourceId: 'appointment-history-1',
  status: 'COMPLETED',
  medicalAccessStatus: 'EXPIRED',
  startedAt: '2026-10-22T09:00:00.000Z',
  completedAt: '2026-10-22T09:30:00.000Z',
};

const profile = {
  userId: 'e2e-doctor',
  firstName: 'Runtime',
  lastName: 'Test',
  displayName: 'Dr Runtime Test',
  photoUrl: null,
  professionalLicenseNumber: 'SYNTHETIC-1',
  specialty: 'Médecine générale',
  governorate: 'Tunis',
  affiliatedClinicId: null,
  affiliatedClinicName: null,
  alsoIndependent: true,
  verifiedAt: '2026-01-01T00:00:00.000Z',
  mfaMethod: null,
  consultationPriceTnd: 80,
  experienceYears: 10,
  practiceLatitude: null,
  practiceLongitude: null,
  practiceCity: 'Tunis',
  acceptingNewPatients: true,
  subSpecialties: [],
  languages: ['Français'],
  areasOfCare: [],
  expertise: [],
  visitReasons: [],
  patientAgeGroups: ['Adultes'],
  consultationTypes: [],
  biography: 'Profil synthétique de mesure.',
  updatedAt: now,
  revision: 1,
};

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const context = await browser.newContext({
  baseURL: baseUrl,
  viewport: { width: 1440, height: 900 },
  locale: 'en-GB',
  timezoneId: 'Africa/Tunis',
  reducedMotion: 'reduce',
  colorScheme: 'light',
});

await context.addInitScript(() => {
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sessionStorage.setItem(
    'omnicare.dashboard.session',
    JSON.stringify({
      accessToken: 'synthetic-runtime-access-token',
      tokenType: 'Bearer',
      expiresAt: expiry,
      refreshToken: 'synthetic-runtime-refresh-token',
      refreshExpiresAt: expiry,
      user: { id: 'e2e-doctor', role: 'DOCTOR', mustChangePassword: false },
    }),
  );

  const intervals = new Set();
  const timeouts = new Set();
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);

  window.setInterval = (handler, timeout, ...args) => {
    const handle = nativeSetInterval(handler, timeout, ...args);
    intervals.add(handle);
    return handle;
  };
  window.clearInterval = (handle) => {
    intervals.delete(handle);
    nativeClearInterval(handle);
  };
  window.setTimeout = (handler, timeout, ...args) => {
    let handle;
    const wrapped = (...callbackArgs) => {
      timeouts.delete(handle);
      if (typeof handler === 'function') handler(...callbackArgs);
      else Function(handler)();
    };
    handle = nativeSetTimeout(wrapped, timeout, ...args);
    timeouts.add(handle);
    return handle;
  };
  window.clearTimeout = (handle) => {
    timeouts.delete(handle);
    nativeClearTimeout(handle);
  };
  Object.defineProperty(window, '__omnicareProfileTimers', {
    value: { intervals, timeouts },
    configurable: false,
  });

  const longTasks = [];
  if (typeof PerformanceObserver !== 'undefined') {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push({ startTime: entry.startTime, duration: entry.duration });
      }
    });
    try {
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Task API support is reported through the empty result below.
    }
  }
  Object.defineProperty(window, '__omnicareProfileLongTasks', {
    value: longTasks,
    configurable: false,
  });
});

const requestLog = [];
const unknownApiRequests = new Set();
const webSockets = [];
const pageErrors = [];

await context.route('**/api/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const { pathname } = url;
  const method = request.method();
  const fulfill = (status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  if (pathname.endsWith('/auth/refresh')) {
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return fulfill(200, {
      accessToken: 'synthetic-runtime-access-token',
      tokenType: 'Bearer',
      expiresAt: expiry,
      refreshToken: 'synthetic-runtime-refresh-token',
      refreshExpiresAt: expiry,
      user: { id: 'e2e-doctor', role: 'DOCTOR', mustChangePassword: false },
    });
  }
  if (pathname.startsWith('/api/v1/ws')) {
    return route.abort('connectionrefused');
  }
  if (pathname.endsWith('/notifications/unread-count')) return fulfill(200, { unreadCount: 0 });
  if (pathname.endsWith('/doctor/consultations/active')) return fulfill(200, null);
  if (pathname.endsWith('/me/urgent-cabinet/commitments')) return fulfill(200, []);
  if (pathname.endsWith('/me/professional-profile')) return fulfill(200, profile);
  if (
    pathname.endsWith('/me/professional-profile/education') ||
    pathname.endsWith('/me/professional-profile/certifications')
  ) {
    return fulfill(200, []);
  }
  if (pathname.endsWith('/appointments/stats/today')) {
    return fulfill(200, { consultations: 1, upcoming: 1, finished: 1, urgentRequests: 0 });
  }
  if (pathname.endsWith('/appointments/availability/rules')) {
    return fulfill(200, [
      {
        dayOfWeek: 'TUESDAY',
        active: true,
        startTime: '08:00',
        endTime: '17:00',
        pauseStart: null,
        pauseEnd: null,
        slotDurationMinutes: 30,
      },
    ]);
  }
  if (pathname.endsWith('/appointments/availability/exceptions')) return fulfill(200, []);
  if (pathname.endsWith('/appointments/appointment-runtime-1')) {
    return fulfill(200, legacyAppointment);
  }
  if (pathname.endsWith('/appointments') && method === 'GET')
    return fulfill(200, [legacyAppointment]);
  if (pathname.endsWith('/doctor/scheduled-care/home-summary')) {
    return fulfill(200, {
      generatedAt: now,
      pendingRequestCount: 0,
      nextPendingRequest: null,
      nextConfirmedAppointment: scheduledItem,
    });
  }
  if (pathname.endsWith('/doctor/scheduled-care')) {
    return fulfill(200, {
      generatedAt: now,
      from: url.searchParams.get('from') ?? now,
      to: url.searchParams.get('to') ?? now,
      items: [scheduledItem],
    });
  }
  if (pathname === '/api/v1/patients' && method === 'GET') {
    const query = (url.searchParams.get('query') ?? '').toLowerCase();
    const content = query
      ? patients.filter((patient) =>
          `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(query),
        )
      : patients;
    return fulfill(200, {
      content,
      totalElements: content.length,
      totalPages: 1,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: content.length === 0,
    });
  }
  if (pathname.startsWith('/api/v1/patients/') && method === 'GET') {
    const id = decodeURIComponent(pathname.slice('/api/v1/patients/'.length));
    return fulfill(200, patients.find((patient) => patient.id === id) ?? patients[0]);
  }
  if (pathname === '/api/v1/doctor/consultations/completed') {
    return fulfill(200, [completedConsultation]);
  }
  if (pathname === `/api/v1/doctor/consultations/completed/${completedConsultationId}`) {
    return fulfill(200, {
      consultation: completedConsultation,
      historicalMedicalAccessStatus: 'NOT_AUTHORIZED',
      artifactStatusAvailable: true,
      artifacts: [],
    });
  }

  unknownApiRequests.add(`${method} ${pathname}`);
  return fulfill(200, {});
});

const page = await context.newPage();
page.on('request', (request) => {
  requestLog.push({ at: performance.now(), method: request.method(), url: request.url() });
});
page.on('websocket', (socket) => {
  const record = { url: socket.url(), framesSent: 0, framesReceived: 0, closed: false };
  webSockets.push(record);
  socket.on('framesent', () => record.framesSent++);
  socket.on('framereceived', () => record.framesReceived++);
  socket.on('close', () => (record.closed = true));
});
page.on('pageerror', (error) => pageErrors.push(error.message));

const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');

function metricMap(response) {
  return Object.fromEntries(response.metrics.map((metric) => [metric.name, metric.value]));
}

async function performanceMetrics() {
  return metricMap(await cdp.send('Performance.getMetrics'));
}

async function snapshot(label) {
  const [metrics, dom, browserMemory, timers] = await Promise.all([
    performanceMetrics(),
    cdp.send('Memory.getDOMCounters'),
    page.evaluate(() => ({
      used: performance.memory?.usedJSHeapSize ?? null,
      total: performance.memory?.totalJSHeapSize ?? null,
      limit: performance.memory?.jsHeapSizeLimit ?? null,
    })),
    page.evaluate(() => ({
      intervals: window.__omnicareProfileTimers?.intervals.size ?? null,
      timeouts: window.__omnicareProfileTimers?.timeouts.size ?? null,
    })),
  ]);
  return {
    label,
    route: new URL(page.url()).pathname + new URL(page.url()).search,
    heapUsedBytes: Math.round(metrics.JSHeapUsedSize ?? browserMemory.used ?? 0),
    heapTotalBytes: Math.round(metrics.JSHeapTotalSize ?? browserMemory.total ?? 0),
    domNodes: dom.nodes,
    documents: dom.documents,
    listeners: dom.jsEventListeners,
    intervals: timers.intervals,
    timeouts: timers.timeouts,
    layoutCount: metrics.LayoutCount ?? null,
    taskDurationSeconds: metrics.TaskDuration ?? null,
  };
}

async function cpuWindow(windowMs, action) {
  const before = await performanceMetrics();
  const started = performance.now();
  if (action) await action();
  else await page.waitForTimeout(windowMs);
  const elapsedSeconds = (performance.now() - started) / 1_000;
  const after = await performanceMetrics();
  return {
    elapsedMs: Math.round(elapsedSeconds * 1_000),
    taskMs: Math.round(((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1_000),
    scriptMs: Math.round(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1_000),
    layoutMs: Math.round(((after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0)) * 1_000),
    recalcStyleMs: Math.round(
      ((after.RecalcStyleDuration ?? 0) - (before.RecalcStyleDuration ?? 0)) * 1_000,
    ),
    taskPercent: Number(
      ((((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) / elapsedSeconds) * 100).toFixed(
        2,
      ),
    ),
  };
}

async function settle() {
  // The local runtime intentionally has no realtime server. Waiting for global network-idle would
  // turn SockJS reconnect attempts into route latency, so API activity is logged separately and
  // the fixture-backed routes receive a fixed render/settle opportunity instead.
  await page.waitForTimeout(500);
}

async function navigate(path) {
  if (page.url() === 'about:blank') {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  } else {
    await page.evaluate((target) => {
      history.pushState({}, '', target);
      dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await page.waitForURL((url) => `${url.pathname}${url.search}` === path, { timeout: 5_000 });
  }
  await settle();
}

async function measureScreen(name, path) {
  const navigationRequestStart = requestLog.length;
  await navigate(path);
  const navigationRequests = summarizeRequests(requestLog.slice(navigationRequestStart));
  const requestStart = requestLog.length;
  const idleCpu = await cpuWindow(idleWindowMs);
  const state = await snapshot(name);
  const idleRequests = summarizeRequests(requestLog.slice(requestStart));
  return { name, path, ...state, navigationRequests, idleCpu, idleRequests };
}

function summarizeRequests(requests) {
  const counts = new Map();
  for (const { method, url } of requests) {
    const parsed = new URL(url);
    const key = `${method} ${parsed.pathname}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([request, count]) => ({ request, count }));
}

const screens = [];
screens.push(await measureScreen('Command center', '/doctor/command'));
screens.push(await measureScreen('Calendar', '/doctor/calendar'));

const calendarInteraction = await cpuWindow(0, async () => {
  await page.getByRole('button', { name: 'Période suivante' }).click();
  await settle();
});

screens.push(await measureScreen('Patients', '/doctor/patients'));
const patientSearchInteraction = await cpuWindow(0, async () => {
  const search = page.getByRole('searchbox', { name: 'Rechercher un patient' });
  await search.fill('Leila');
  await page.waitForTimeout(400);
  await settle();
});

screens.push(await measureScreen('Patient detail', '/doctor/patient/patient-amira'));
screens.push(await measureScreen('Consultation history', '/doctor/history'));
screens.push(await measureScreen('Settings', '/doctor/settings?tab=profile'));

const routeCycle = [
  '/doctor/command',
  '/doctor/calendar',
  '/doctor/patients',
  '/doctor/patient/patient-amira',
  '/doctor/history',
  '/doctor/settings?tab=profile',
  '/doctor/command',
];
const enduranceRequestStart = requestLog.length;
const endurance = [await snapshot('before cycle 1')];
await cdp.send('HeapProfiler.collectGarbage');
await page.waitForTimeout(500);
endurance.push(await snapshot('before cycle 1 after forced diagnostic GC'));
for (let cycle = 1; cycle <= 10; cycle++) {
  for (const path of routeCycle) await navigate(path);
  if (cycle === 5) {
    endurance.push(await snapshot('after cycle 5'));
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(500);
    endurance.push(await snapshot('after cycle 5 after forced diagnostic GC'));
  }
  if (cycle === 10) endurance.push(await snapshot('after cycle 10'));
}
await page.waitForTimeout(5_000);
endurance.push(await snapshot('after 5 second idle opportunity'));
await cdp.send('HeapProfiler.collectGarbage');
await page.waitForTimeout(500);
endurance.push(await snapshot('after forced diagnostic GC'));
const enduranceRequests = summarizeRequests(requestLog.slice(enduranceRequestStart));

await navigate('/doctor/calendar');
const overlayBefore = await snapshot('overlay before');
for (let iteration = 0; iteration < 10; iteration++) {
  await page.getByRole('button', { name: 'Exception', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}
const overlayAfter = await snapshot('overlay after 10 open/close operations');
await cdp.send('HeapProfiler.collectGarbage');
await page.waitForTimeout(500);
const overlayAfterGc = await snapshot('overlay after forced diagnostic GC');

const patientSwitching = [];
for (const id of ['patient-amira', 'patient-leila', 'patient-sami', 'patient-amira']) {
  await navigate(`/doctor/patient/${id}`);
  patientSwitching.push({
    id,
    state: await snapshot(`patient ${id}`),
    visibleHeadings: await page.getByRole('heading').allTextContents(),
  });
}
await cdp.send('HeapProfiler.collectGarbage');
await page.waitForTimeout(500);
const patientSwitchingAfterGc = await snapshot('patient switching after forced diagnostic GC');

let fallback = null;
if (fallbackWindowMs > 0) {
  await navigate('/doctor/calendar');
  const requestStart = requestLog.length;
  const before = await snapshot('calendar fallback window before');
  const cpu = await cpuWindow(fallbackWindowMs);
  const after = await snapshot('calendar fallback window after');
  fallback = {
    windowMs: fallbackWindowMs,
    before,
    after,
    cpu,
    requests: summarizeRequests(requestLog.slice(requestStart)),
  };
}

const result = {
  environment: {
    browser: await browser.version(),
    headless: true,
    baseUrl,
    viewport: '1440x900',
    mode: 'Angular production configuration served by ng serve',
    data: 'fictional browser-intercepted API responses; no production credentials or PHI',
    idleWindowMs,
    fallbackWindowMs,
  },
  screens,
  interactions: {
    calendarNextPeriod: calendarInteraction,
    patientSearch: patientSearchInteraction,
  },
  endurance,
  enduranceRequests,
  overlay: { before: overlayBefore, after: overlayAfter, afterForcedGc: overlayAfterGc },
  patientSwitching,
  patientSwitchingAfterForcedGc: patientSwitchingAfterGc,
  fallback,
  webSockets,
  unknownApiRequests: [...unknownApiRequests].sort(),
  pageErrors,
  longTasks: await page.evaluate(() => {
    const values = window.__omnicareProfileLongTasks ?? [];
    return {
      count: values.length,
      totalDurationMs: Math.round(values.reduce((sum, value) => sum + value.duration, 0)),
      maximumDurationMs: Math.round(
        values.reduce((maximum, value) => Math.max(maximum, value.duration), 0),
      ),
    };
  }),
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
