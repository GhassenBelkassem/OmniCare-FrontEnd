import { type Page, type Route } from '@playwright/test';

const clinicId = 'e2e-clinic';
const caseId = 'e2e-case';
const taskId = 'e2e-task';
const now = '2026-09-14T09:00:00.000Z';

const caseItem = {
  clinicCaseId: caseId, patientDisplayName: 'Sample intake record', subjectType: 'SELF', relationship: null,
  situation: 'APPOINTMENT', administrativeStatus: 'UNDER_ADMIN_REVIEW', submittedAt: now, version: 1,
  priority: 'NORMAL', currentStepKey: 'ADMINISTRATIVE_REVIEW',
  availableActions: ['START_REVIEW', 'REQUEST_INFORMATION', 'READY_FOR_PLANNING', 'DECLINE'], hasOpenRoutingIncident: false,
};

const task = {
  taskId, caseId, taskType: 'ADMINISTRATIVE_REVIEW', responsibilityType: 'ADMISSIONS', status: 'IN_PROGRESS',
  priority: 'NORMAL', blocking: false, acknowledgementRequired: false, acknowledgementDueAt: null, dueAt: null,
  assignedPositionId: 'e2e-position', assignedMembershipId: 'e2e-membership', createdAt: now, updatedAt: now, version: 1,
  caseContext: { caseId, sourceRequestId: 'e2e-request', intakeStatus: 'UNDER_ADMIN_REVIEW', situation: 'APPOINTMENT', priority: 'NORMAL', currentStepKey: 'ADMINISTRATIVE_REVIEW', submittedAt: now, hasOpenRoutingIncident: false },
};

const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** Browser-only UI-isolation fixture: no real authentication, people, or API data. */
export async function prepareSyntheticClinic(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    sessionStorage.setItem('omnicare.dashboard.session', JSON.stringify({
      accessToken: crypto.randomUUID(), tokenType: 'Bearer', expiresAt: expiry,
      refreshToken: crypto.randomUUID(), refreshExpiresAt: expiry,
      user: { id: 'e2e-synthetic-user', role: 'CLINIC_ADMIN', mustChangePassword: false },
    }));
    sessionStorage.setItem('omnicare.clinic.selectedClinicId', 'e2e-clinic');
  });
  await page.route('**/api/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/me/access')) return json(route, { contractVersion: '1', accessFamily: 'CLINIC', resolvedAt: now });
    if (pathname.endsWith('/me/clinics')) return json(route, { contractVersion: '1', activeMemberships: [{ clinicId, clinicName: 'E2E Clinic', membershipId: 'e2e-membership', professionalRole: 'CLINIC_ADMIN', membershipStatus: 'ACTIVE', clinicStatus: 'ACTIVE', version: 1 }], unavailableMemberships: [], resolvedAt: now });
    if (pathname.endsWith(`/clinics/${clinicId}/bootstrap`)) return json(route, { contractVersion: '1', clinic: { clinicId, clinicName: 'E2E Clinic', clinicStatus: 'ACTIVE' }, membership: { membershipId: 'e2e-membership', membershipStatus: 'ACTIVE', professionalRole: 'CLINIC_ADMIN', version: 1 }, capabilities: ['CLINIC_CASE_INTAKE_READ', 'CLINIC_CASE_INTAKE_REVIEW', 'CLINIC_TASK_READ', 'CLINIC_TASK_HANDOVER', 'CLINIC_TASK_REASSIGN', 'CLINIC_STAFF_READ', 'CLINIC_POSITION_READ'], featureFlags: {}, resolvedAt: now });
    if (pathname.endsWith(`/clinics/${clinicId}/cases/${caseId}`)) return json(route, { ...caseItem, timeline: [], informationRequest: null, patientSummary: { displayName: 'Sample intake record', subjectType: 'SELF', relationship: null }, openRoutingIncidents: [] });
    if (pathname.endsWith(`/clinics/${clinicId}/cases`)) return json(route, { contractVersion: '1', items: [caseItem], page: 0, pageSize: 20, hasNext: false, generatedAt: now });
    if (pathname.endsWith(`/clinics/${clinicId}/tasks/${taskId}`)) return json(route, { ...task, blockedReasonCode: null, acknowledgedAt: now, startedAt: now, completedAt: null });
    if (pathname.endsWith(`/clinics/${clinicId}/tasks/my`) || pathname.endsWith(`/clinics/${clinicId}/tasks/position-queue`)) return json(route, { contractVersion: '1', items: [task], page: 0, pageSize: 20, hasNext: false, generatedAt: now });
    if (pathname.endsWith(`/clinics/${clinicId}/staff`)) return json(route, { contractVersion: '1', items: [{ membershipId: 'e2e-staff', displayName: 'Sample colleague', professionalRole: 'CLINIC_ASSISTANT', membershipStatus: 'ACTIVE', joinedAt: now, suspendedAt: null, endedAt: null, version: 1 }], page: 0, pageSize: 20, hasNext: false, generatedAt: now });
    if (pathname.includes('/task-handovers/')) return json(route, { contractVersion: '1', items: [], page: 0, pageSize: 20, hasNext: false, generatedAt: now });
    if (pathname.endsWith(`/clinics/${clinicId}/positions`)) return json(route, { contractVersion: '1', items: [{ id: 'e2e-position', displayName: 'Sample intake position', requiredProfessionalRole: 'CLINIC_ADMIN', scopeType: 'CLINIC', active: true, version: 1, createdAt: now, updatedAt: now }], page: 0, pageSize: 100, hasNext: false, generatedAt: now });
    return json(route, {});
  });
}
