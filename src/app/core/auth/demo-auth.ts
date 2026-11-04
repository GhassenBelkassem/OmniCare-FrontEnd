import { DashboardRole, LoginSession } from './auth.models';

export type DemoWorkspaceRole =
  | 'ADMIN'
  | 'DOCTOR'
  | 'SECRETARY'
  | 'CLINIC_ADMIN'
  | 'CLINIC_MEDECIN'
  | 'CLINIC_INFIRMIERE'
  | 'CLINIC_KINE'
  | 'CLINIC_ASSISTANT';

export interface DemoWorkspace {
  readonly role: DemoWorkspaceRole;
  readonly label: string;
  readonly description: string;
  readonly group: 'Platform' | 'Independent practice' | 'Clinic';
}

export const DEMO_WORKSPACES: readonly DemoWorkspace[] = [
  {
    role: 'ADMIN',
    label: 'Platform administrator',
    description: 'Manage professionals, patients, clinics, and platform monitoring.',
    group: 'Platform',
  },
  {
    role: 'DOCTOR',
    label: 'Doctor',
    description: 'Open the clinical command centre and doctor workspace.',
    group: 'Independent practice',
  },
  {
    role: 'SECRETARY',
    label: 'Secretary',
    description: 'Review and coordinate the practice appointment agenda.',
    group: 'Independent practice',
  },
  {
    role: 'CLINIC_ADMIN',
    label: 'Clinic administrator',
    description: 'Coordinate intake, staffing, tasks, and clinic configuration.',
    group: 'Clinic',
  },
  {
    role: 'CLINIC_MEDECIN',
    label: 'Clinic doctor',
    description: 'Enter the clinic workspace with a physician membership.',
    group: 'Clinic',
  },
  {
    role: 'CLINIC_INFIRMIERE',
    label: 'Clinic nurse',
    description: 'Enter the clinic workspace with a nursing membership.',
    group: 'Clinic',
  },
  {
    role: 'CLINIC_KINE',
    label: 'Clinic physiotherapist',
    description: 'Enter the clinic workspace with a physiotherapy membership.',
    group: 'Clinic',
  },
  {
    role: 'CLINIC_ASSISTANT',
    label: 'Clinic assistant',
    description: 'Enter the clinic workspace with an assistant membership.',
    group: 'Clinic',
  },
];

const DEMO_ROLE_SET: ReadonlySet<DashboardRole> = new Set(
  DEMO_WORKSPACES.map((workspace) => workspace.role),
);

export function isDemoWorkspaceRole(role: DashboardRole): role is DemoWorkspaceRole {
  return DEMO_ROLE_SET.has(role);
}

export function createDemoSession(role: DemoWorkspaceRole): LoginSession {
  const now = Date.now();
  return {
    accessToken: `demo-access-${role.toLowerCase()}`,
    tokenType: 'Bearer',
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
    refreshToken: `demo-refresh-${role.toLowerCase()}`,
    refreshExpiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    user: {
      id: `demo-${role.toLowerCase().replaceAll('_', '-')}`,
      role,
      mustChangePassword: false,
    },
  };
}
