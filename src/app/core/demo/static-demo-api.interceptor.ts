import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of } from 'rxjs';

import { AuthTokenStore } from '../auth/auth-token.store';
import { DemoWorkspaceRole } from '../auth/demo-auth';
import { APP_MODE } from '../config/app-mode';

const CLINIC_ID = 'demo-clinic';
const CLINIC_MEMBERSHIP_ID = 'demo-membership';
const CASE_ID = 'demo-case';
const TASK_ID = 'demo-task';

interface StaticPracticePatient {
  readonly id: string;
  readonly doctorId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string | null;
  readonly sex: 'M' | 'F' | 'autre' | null;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly source: 'MANUAL' | 'IMPORTED' | 'OMNICARE';
  readonly linkedOmniCareUserId: string | null;
  readonly mrsPatientId: string | null;
  readonly mrsProvisioned: boolean;
  readonly possibleOmniCareMatch: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Browser-local API used only by the compile-time static-demo build.
 * It deliberately terminates every `/api/v1` request so the demo never reaches a backend.
 */
export const staticDemoApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!APP_MODE.staticDemo || !apiPath(request.url).startsWith('/api/v1/')) return next(request);

  const role = inject(AuthTokenStore).user()?.role;
  return of(
    new HttpResponse({
      status: 200,
      url: request.url,
      body: demoResponse(request, isDemoRole(role) ? role : 'DOCTOR'),
    }),
  );
};

function demoResponse(request: HttpRequest<unknown>, role: DemoWorkspaceRole): unknown {
  const path = apiPath(request.url);
  const now = new Date().toISOString();

  if (path === '/api/v1/me/access') {
    return {
      contractVersion: '1',
      accessFamily: role.startsWith('CLINIC_') ? 'CLINIC' : role,
      resolvedAt: now,
    };
  }
  if (path === '/api/v1/me/professional-profile') {
    return {
      userId: 'demo-doctor',
      firstName: 'Ben',
      lastName: 'Salah',
      displayName: 'Dr Ben Salah',
      photoUrl: null,
      professionalLicenseNumber: 'DEMO',
      specialty: 'Médecine générale',
      governorate: 'Tunis',
      affiliatedClinicId: null,
      affiliatedClinicName: null,
      alsoIndependent: true,
      verifiedAt: now,
      mfaMethod: null,
      revision: 1,
    };
  }
  if (path === '/api/v1/me/professional-readiness') {
    return professionalReadiness(now);
  }
  if (path === '/api/v1/me/clinics') return clinicMemberships(role, now);
  if (path === `/api/v1/clinics/${CLINIC_ID}/bootstrap`) return clinicBootstrap(role, now);

  if (path === `/api/v1/clinics/${CLINIC_ID}/cases/${CASE_ID}`) {
    return { ...clinicCase(now), timeline: [], informationRequest: null, openRoutingIncidents: [] };
  }
  if (path === `/api/v1/clinics/${CLINIC_ID}/cases`) return page([clinicCase(now)], now);
  if (path === `/api/v1/clinics/${CLINIC_ID}/tasks/${TASK_ID}`) {
    return {
      ...clinicTask(now),
      blockedReasonCode: null,
      acknowledgedAt: now,
      startedAt: now,
      completedAt: null,
    };
  }
  if (
    path === `/api/v1/clinics/${CLINIC_ID}/tasks/my` ||
    path === `/api/v1/clinics/${CLINIC_ID}/tasks/position-queue`
  ) {
    return page([clinicTask(now)], now);
  }
  if (path === `/api/v1/clinics/${CLINIC_ID}/staff`) return page([clinicStaff(role, now)], now);
  if (path === `/api/v1/clinics/${CLINIC_ID}/positions`)
    return page([clinicPosition(now)], now, 100);
  if (path === `/api/v1/clinics/${CLINIC_ID}/responsibilities`) return page([], now, 100);
  if (path.includes('/task-handovers') || path.endsWith('/routing-incidents')) return page([], now);

  if (path === '/api/v1/admin/professionals' || path === '/api/v1/admin/professionals/search') {
    return adminPage(adminProfessionals(now));
  }
  if (path === '/api/v1/admin/patients') return adminPage(adminPatients(now));
  if (path === '/api/v1/admin/clinics') return adminPage([adminClinic(now)]);
  if (/^\/api\/v1\/admin\/clinics\/[^/]+\/memberships$/.test(path)) {
    return [adminClinicMembership(now)];
  }
  if (/^\/api\/v1\/admin\/clinics\/[^/]+$/.test(path)) return adminClinic(now);
  if (/^\/api\/v1\/admin\/professionals\/[^/]+\/sessions$/.test(path)) return [];
  if (/^\/api\/v1\/admin\/professionals\/[^/]+$/.test(path)) return adminProfessionals(now)[0];

  if (path === '/api/v1/patients') {
    if (request.method === 'POST') return createdPracticePatient(request.body, now);
    return practicePatientPage(request, now);
  }
  if (/^\/api\/v1\/patients\/[^/]+\/link$/.test(path)) {
    return linkedPracticePatient(path, request.body, now);
  }
  if (/^\/api\/v1\/patients\/[^/]+$/.test(path)) return practicePatient(path, now);

  if (path === '/api/v1/appointments/stats/today') {
    return { consultations: 6, upcoming: 3, finished: 3, urgentRequests: 1 };
  }
  if (path === '/api/v1/appointments/availability/rules') return availabilityRules();
  if (path === '/api/v1/appointments/availability/exceptions') return [];
  if (path === '/api/v1/appointments/availability/slots') {
    return {
      doctorId: 'demo-doctor',
      practiceLocationId: 'demo-cabinet',
      timezone: 'Africa/Tunis',
      generatedAt: now,
      slots: [],
    };
  }
  if (path === '/api/v1/appointments') return appointments(now);
  if (/^\/api\/v1\/appointments\/[^/]+$/.test(path)) return appointments(now)[0];
  if (path === '/api/v1/doctor/scheduled-care/home-summary') {
    return {
      generatedAt: now,
      pendingRequestCount: 0,
      nextPendingRequest: null,
      nextConfirmedAppointment: scheduledAppointment(now),
    };
  }
  if (path === '/api/v1/doctor/scheduled-care') {
    return { generatedAt: now, from: now, to: now, items: [scheduledAppointment(now)] };
  }
  if (path === '/api/v1/doctor/consultations/active') return null;
  if (path === '/api/v1/doctor/consultations/completed') return [];
  if (path === '/api/v1/me/urgent-cabinet/commitments') return [];
  if (path === '/api/v1/notifications/unread-count') return { unreadCount: 1 };
  if (path === '/api/v1/notifications') return notifications(now);

  return safeFallback(request, now);
}

function safeFallback(request: HttpRequest<unknown>, now: string): unknown {
  const path = apiPath(request.url);
  if (request.method === 'DELETE') return null;
  if (path.includes('/notifications')) return notifications(now);
  if (path.includes('/sessions') || path.includes('/appointments') || path.includes('/completed'))
    return [];
  if (path.endsWith('/staff') || path.endsWith('/cases') || path.endsWith('/positions'))
    return page([], now);
  if (request.method !== 'GET' && isRecord(request.body)) return request.body;
  return {};
}

function apiPath(url: string): string {
  try {
    return new URL(url, 'https://demo.omnicare.local').pathname;
  } catch {
    return url.split(/[?#]/, 1)[0] ?? url;
  }
}

function clinicMemberships(role: DemoWorkspaceRole, now: string): unknown {
  return {
    contractVersion: '1',
    activeMemberships: [
      {
        clinicId: CLINIC_ID,
        clinicName: 'OmniCare Demo Clinic',
        membershipId: CLINIC_MEMBERSHIP_ID,
        professionalRole: role,
        membershipStatus: 'ACTIVE',
        clinicStatus: 'ACTIVE',
        version: 1,
      },
    ],
    unavailableMemberships: [],
    resolvedAt: now,
  };
}

function professionalReadiness(now: string): unknown {
  return {
    publicDirectory: {
      discoverable: true,
      blockingReasons: [],
    },
    cabinet: {
      discoverable: true,
      capabilityEnabled: true,
      activeCabinetCount: 1,
      blockingReasons: [],
    },
    acceptingNewPatients: true,
    professionalVerification: {
      verified: true,
      verifiedAt: now,
    },
    evaluatedAt: now,
  };
}

function clinicBootstrap(role: DemoWorkspaceRole, now: string): unknown {
  return {
    contractVersion: '1',
    clinic: { clinicId: CLINIC_ID, clinicName: 'OmniCare Demo Clinic', clinicStatus: 'ACTIVE' },
    membership: {
      membershipId: CLINIC_MEMBERSHIP_ID,
      membershipStatus: 'ACTIVE',
      professionalRole: role,
      version: 1,
    },
    capabilities: [
      'CLINIC_CASE_INTAKE_READ',
      'CLINIC_CASE_INTAKE_REVIEW',
      'CLINIC_TASK_READ',
      'CLINIC_TASK_HANDOVER',
      'CLINIC_TASK_REASSIGN',
      'CLINIC_STAFF_READ',
      'CLINIC_POSITION_READ',
      'CLINIC_RESPONSIBILITY_READ',
      'CLINIC_ROUTING_INCIDENT_READ',
    ],
    featureFlags: {},
    resolvedAt: now,
  };
}

function clinicCase(now: string): Readonly<Record<string, unknown>> {
  return {
    clinicCaseId: CASE_ID,
    patientDisplayName: 'Amira Ben Salah',
    patientSummary: { displayName: 'Amira Ben Salah', subjectType: 'SELF', relationship: null },
    subjectType: 'SELF',
    relationship: null,
    situation: 'APPOINTMENT',
    administrativeStatus: 'UNDER_ADMIN_REVIEW',
    submittedAt: now,
    version: 1,
    priority: 'NORMAL',
    currentStepKey: 'ADMINISTRATIVE_REVIEW',
    availableActions: ['START_REVIEW', 'REQUEST_INFORMATION', 'READY_FOR_PLANNING', 'DECLINE'],
    hasOpenRoutingIncident: false,
  };
}

function clinicTask(now: string): Readonly<Record<string, unknown>> {
  return {
    taskId: TASK_ID,
    caseId: CASE_ID,
    taskType: 'ADMINISTRATIVE_REVIEW',
    responsibilityType: 'ADMISSIONS',
    status: 'IN_PROGRESS',
    priority: 'NORMAL',
    blocking: false,
    acknowledgementRequired: false,
    acknowledgementDueAt: null,
    dueAt: null,
    assignedPositionId: 'demo-position',
    assignedMembershipId: CLINIC_MEMBERSHIP_ID,
    createdAt: now,
    updatedAt: now,
    version: 1,
    caseContext: {
      caseId: CASE_ID,
      sourceRequestId: 'demo-request',
      intakeStatus: 'UNDER_ADMIN_REVIEW',
      situation: 'APPOINTMENT',
      priority: 'NORMAL',
      currentStepKey: 'ADMINISTRATIVE_REVIEW',
      submittedAt: now,
      hasOpenRoutingIncident: false,
    },
  };
}

function clinicStaff(role: DemoWorkspaceRole, now: string): unknown {
  return {
    membershipId: CLINIC_MEMBERSHIP_ID,
    displayName: 'Demo workspace member',
    professionalRole: role,
    membershipStatus: 'ACTIVE',
    joinedAt: now,
    suspendedAt: null,
    endedAt: null,
    version: 1,
  };
}

function clinicPosition(now: string): unknown {
  return {
    id: 'demo-position',
    displayName: 'Admissions coordination',
    requiredProfessionalRole: 'CLINIC_ADMIN',
    scopeType: 'CLINIC',
    active: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function adminProfessionals(now: string): readonly unknown[] {
  return [
    {
      userId: 'demo-doctor',
      email: 'doctor@demo.omnicare.local',
      phone: '+216 20 000 101',
      role: 'DOCTOR',
      status: 'ACTIVE',
      specialty: 'General medicine',
      governorate: 'Tunis',
      professionalLicenseNumber: 'DEMO-101',
      licenseVerifiedAt: now,
      affiliatedClinicId: null,
      alsoIndependent: true,
      invitationStatus: 'ACCEPTED',
      invitationExpiresAt: null,
      firstLoginAt: now,
      lastActiveAt: now,
    },
    {
      userId: 'demo-clinic-admin',
      email: 'clinic-admin@demo.omnicare.local',
      phone: '+216 20 000 202',
      role: 'CLINIC_ADMIN',
      status: 'ACTIVE',
      specialty: null,
      governorate: 'Tunis',
      professionalLicenseNumber: null,
      licenseVerifiedAt: null,
      affiliatedClinicId: CLINIC_ID,
      alsoIndependent: false,
      invitationStatus: 'ACCEPTED',
      invitationExpiresAt: null,
      firstLoginAt: now,
      lastActiveAt: now,
    },
  ];
}

function adminPatients(now: string): readonly unknown[] {
  return [
    {
      userId: 'demo-patient',
      email: 'patient@demo.omnicare.local',
      phone: '+216 20 000 303',
      role: 'PATIENT',
      status: 'ACTIVE',
      firstName: 'Amira',
      lastName: 'Ben Salah',
      lastActiveAt: now,
    },
  ];
}

function practicePatientPage(request: HttpRequest<unknown>, now: string): unknown {
  const query = request.params.get('query')?.trim().toLocaleLowerCase('fr') ?? '';
  const filter = request.params.get('filter') ?? 'ALL';
  const pageNumber = nonNegativeNumber(request.params.get('page'), 0);
  const pageSize = Math.max(1, nonNegativeNumber(request.params.get('size'), 20));

  const filtered = practicePatients(now).filter((patient) => {
    const matchesQuery =
      query.length === 0 ||
      `${patient.firstName} ${patient.lastName}`.toLocaleLowerCase('fr').includes(query) ||
      patient.phone.includes(query);
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'LINKED' && patient.linkedOmniCareUserId !== null) ||
      (filter === 'EXTERNAL' && patient.linkedOmniCareUserId === null);
    return matchesQuery && matchesFilter;
  });

  const start = pageNumber * pageSize;
  const content = filtered.slice(start, start + pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);
  return {
    content,
    totalElements: filtered.length,
    totalPages,
    size: pageSize,
    number: pageNumber,
    first: pageNumber === 0,
    last: totalPages === 0 || pageNumber >= totalPages - 1,
    empty: content.length === 0,
  };
}

function practicePatient(path: string, now: string): StaticPracticePatient {
  const id = decodeURIComponent(path.split('/').at(-1) ?? '');
  return practicePatients(now).find((patient) => patient.id === id) ?? practicePatients(now)[0];
}

function createdPracticePatient(body: unknown, now: string): Readonly<Record<string, unknown>> {
  return {
    ...practicePatients(now)[0],
    ...(isRecord(body) ? body : {}),
    id: 'demo-patient-created',
    doctorId: 'demo-doctor',
    source: 'MANUAL',
    linkedOmniCareUserId: null,
    mrsPatientId: null,
    mrsProvisioned: false,
    possibleOmniCareMatch: false,
    createdAt: now,
    updatedAt: now,
  };
}

function linkedPracticePatient(
  path: string,
  body: unknown,
  now: string,
): Readonly<Record<string, unknown>> {
  const patientPath = path.slice(0, -'/link'.length);
  const patient = practicePatient(patientPath, now);
  const omniCareUserId =
    isRecord(body) && typeof body['omniCareUserId'] === 'string'
      ? body['omniCareUserId']
      : 'demo-omnicare-user';
  return {
    ...patient,
    linkedOmniCareUserId: omniCareUserId,
    mrsPatientId: 'demo-mrs-patient',
    mrsProvisioned: true,
    possibleOmniCareMatch: false,
    updatedAt: now,
  };
}

function practicePatients(now: string): readonly StaticPracticePatient[] {
  return [
    {
      id: 'demo-practice-patient-amira',
      doctorId: 'demo-doctor',
      firstName: 'Amira',
      lastName: 'Ben Salah',
      dateOfBirth: '1988-04-16',
      sex: 'F',
      phone: '+216 20 000 303',
      email: 'amira@demo.omnicare.local',
      address: 'Les Berges du Lac, Tunis',
      source: 'OMNICARE',
      linkedOmniCareUserId: 'demo-patient',
      mrsPatientId: 'demo-mrs-amira',
      mrsProvisioned: true,
      possibleOmniCareMatch: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-practice-patient-ahmed',
      doctorId: 'demo-doctor',
      firstName: 'Ahmed',
      lastName: 'Trabelsi',
      dateOfBirth: '1976-09-02',
      sex: 'M',
      phone: '+216 22 410 520',
      email: 'ahmed.trabelsi@example.test',
      address: 'La Marsa, Tunis',
      source: 'MANUAL',
      linkedOmniCareUserId: null,
      mrsPatientId: null,
      mrsProvisioned: false,
      possibleOmniCareMatch: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-practice-patient-leila',
      doctorId: 'demo-doctor',
      firstName: 'Leila',
      lastName: 'Mansouri',
      dateOfBirth: '1992-12-11',
      sex: 'F',
      phone: '+216 55 802 114',
      email: null,
      address: 'Ariana',
      source: 'IMPORTED',
      linkedOmniCareUserId: null,
      mrsPatientId: null,
      mrsProvisioned: false,
      possibleOmniCareMatch: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function nonNegativeNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function adminClinic(now: string): unknown {
  return {
    id: CLINIC_ID,
    name: 'OmniCare Demo Clinic',
    contactEmail: 'clinic@demo.omnicare.local',
    contactPhone: '+216 70 000 100',
    governorate: 'Tunis',
    address: 'Demo healthcare district, Tunis',
    inpdpNumber: 'DEMO-INPDP-001',
    status: 'ACTIVE',
    administratorCount: 1,
    createdAt: now,
  };
}

function adminClinicMembership(now: string): unknown {
  return {
    id: CLINIC_MEMBERSHIP_ID,
    clinicId: CLINIC_ID,
    userId: 'demo-clinic-admin',
    email: 'clinic-admin@demo.omnicare.local',
    role: 'CLINIC_ADMIN',
    status: 'ACTIVE',
    invitedAt: now,
    activatedAt: now,
  };
}

function appointments(now: string): readonly unknown[] {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return [
    {
      id: 'demo-appointment',
      doctorId: 'demo-doctor',
      patientId: 'demo-patient',
      patientName: 'Amira Ben Salah',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: 'CONFIRMED',
      source: 'WEB',
      notes: 'Routine follow-up',
      quotedPriceTnd: 70,
      startedAt: null,
      completedAt: null,
      createdAt: now,
    },
  ];
}

function scheduledAppointment(now: string): unknown {
  const appointment = appointments(now)[0] as Readonly<Record<string, unknown>>;
  return {
    resourceType: 'APPOINTMENT',
    requestId: null,
    appointmentId: appointment['id'],
    sourceBookingRequestId: 'demo-booking-request',
    version: 1,
    status: 'CONFIRMED',
    doctor: { doctorId: 'demo-doctor', displayName: 'Dr Ben Salah', specialty: 'General medicine' },
    subject: { subjectType: 'SELF', displayName: appointment['patientName'], relationship: null },
    cabinet: {
      practiceLocationId: 'demo-cabinet',
      name: 'Cabinet Les Berges',
      address: 'Demo medical centre',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    start: appointment['startTime'],
    end: appointment['endTime'],
    timezone: 'Africa/Tunis',
    responseDeadline: null,
    cancellation: null,
    intakeStatus: 'READY',
    availableActions: ['CANCEL_APPOINTMENT'],
    sortAt: appointment['startTime'],
    updatedAt: now,
  };
}

function availabilityRules(): readonly unknown[] {
  return [
    {
      id: 'demo-rule',
      doctorId: 'demo-doctor',
      dayOfWeek: 'THURSDAY',
      active: true,
      startTime: '09:00',
      endTime: '17:00',
      pauseStart: '12:30',
      pauseEnd: '13:30',
      slotDurationMinutes: 30,
    },
  ];
}

function notifications(now: string): unknown {
  return {
    items: [
      {
        id: 'demo-notification',
        type: 'APPOINTMENT_CONFIRMED',
        priority: 'NORMAL',
        category: 'SCHEDULED_CARE',
        titleFr: 'Rendez-vous confirmé',
        bodyFr: 'Une consultation de démonstration est planifiée.',
        titleAr: '',
        bodyAr: '',
        deepLinkPayload: { appointment_id: 'demo-appointment' },
        read: false,
        createdAt: now,
      },
    ],
    page: 0,
    pageSize: 20,
    totalElements: 1,
    unreadCount: 1,
  };
}

function page(items: readonly unknown[], now: string, pageSize = 20): unknown {
  return { contractVersion: '1', items, page: 0, pageSize, hasNext: false, generatedAt: now };
}

function adminPage(items: readonly unknown[]): unknown {
  return { items, page: 0, pageSize: 20, totalElements: items.length, totalPages: 1 };
}

function isDemoRole(role: string | undefined): role is DemoWorkspaceRole {
  return (
    role === 'ADMIN' ||
    role === 'DOCTOR' ||
    role === 'SECRETARY' ||
    role === 'CLINIC_ADMIN' ||
    role === 'CLINIC_MEDECIN' ||
    role === 'CLINIC_INFIRMIERE' ||
    role === 'CLINIC_KINE' ||
    role === 'CLINIC_ASSISTANT'
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function staticDemoRequestIsOffline(url: string): boolean {
  return apiPath(url).startsWith('/api/v1/');
}
