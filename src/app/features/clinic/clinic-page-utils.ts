import { OcStatus } from '../../shared/ui';
import {
  ClinicAccessReason,
  ClinicFeatureFlagKey,
  ClinicLifecycleStatus,
  ClinicMembershipStatus,
} from './clinic-api.models';

export interface ClinicModuleDescriptor {
  readonly flag: ClinicFeatureFlagKey;
  readonly label: string;
  readonly description: string;
}

/** Phase 1 exposes module availability only. None of these are navigable yet. */
export const CLINIC_MODULES: readonly ClinicModuleDescriptor[] = [
  {
    flag: 'CLINIC_REQUESTS_ENABLED',
    label: 'Requests',
    description: 'Intake and triage of clinic requests.',
  },
  {
    flag: 'CLINIC_HOSPITALIZATION_ENABLED',
    label: 'Hospitalization',
    description: 'Admission, stay and discharge coordination.',
  },
  {
    flag: 'CLINIC_SURGERY_ENABLED',
    label: 'Surgery',
    description: 'Operating programme and surgical preparation.',
  },
  {
    flag: 'CLINIC_URGENT_ENABLED',
    label: 'Urgent workflows',
    description: 'Priority handling for time-critical clinic work.',
  },
  {
    flag: 'CLINIC_MOBILE_TASKS_ENABLED',
    label: 'Mobile tasks',
    description: 'Task assignment for staff working away from a desk.',
  },
  {
    flag: 'CLINIC_PARTNERSHIP_ENABLED',
    label: 'Partnerships',
    description: 'Shared care agreements with partner organisations.',
  },
];

const ROLE_LABELS: Readonly<Record<string, string>> = {
  CLINIC_ADMIN: 'Clinic administrator',
  CLINIC_ASSISTANT: 'Clinic assistant',
  CLINIC_DOCTOR: 'Clinic doctor',
  CLINIC_KINE: 'Physiotherapist',
  CLINIC_NURSE: 'Nurse',
  CLINIC_RECEPTIONIST: 'Receptionist',
};

const CAPABILITY_LABELS: Readonly<Record<string, string>> = {
  CLINIC_OVERVIEW_READ: 'Read the clinic overview',
  CLINIC_PROFILE_READ: 'Read the clinic profile',
  CLINIC_MEMBERSHIP_SELF_READ: 'Read your own clinic membership',
};

const UNAVAILABILITY_LABELS: Readonly<Record<string, string>> = {
  CLINIC_MEMBERSHIP_SUSPENDED: 'Membership suspended',
  CLINIC_MEMBERSHIP_ENDED: 'Membership ended',
  CLINIC_MEMBERSHIP_REQUIRED: 'Membership required',
  CLINIC_NOT_ACTIVE: 'Clinic not active',
  CLINIC_PROFESSIONAL_ROLE_INVALID: 'Role not supported',
  CLINIC_SCOPE_FORBIDDEN: 'Access not granted',
  CLINIC_CONTEXT_UNAVAILABLE: 'Temporarily unavailable',
};

/** Safe, user-facing copy. Backend detail, instance, requestId and codes stay hidden. */
const ACCESS_MESSAGES: Readonly<Record<ClinicAccessReason, string>> = {
  CLINIC_CONTEXT_UNAVAILABLE: 'Your clinic workspace is not available at the moment.',
  CLINIC_SCOPE_FORBIDDEN: 'You are not allowed to open this clinic workspace.',
  CLINIC_MEMBERSHIP_SUSPENDED: 'Your membership for this clinic is currently suspended.',
  CLINIC_MEMBERSHIP_ENDED: 'Your membership for this clinic has ended.',
  CLINIC_MEMBERSHIP_REQUIRED: 'An active clinic membership is required to open this workspace.',
  CLINIC_NOT_ACTIVE: 'This clinic is not active, so its workspace cannot be opened.',
  CLINIC_PROFESSIONAL_ROLE_INVALID: 'Your professional role cannot open this clinic workspace.',
  CLINIC_CAPABILITY_FORBIDDEN: 'You do not have permission for this part of the clinic workspace.',
  CLINIC_NO_ACTIVE_MEMBERSHIP: 'You do not have an active clinic membership yet.',
  CLINIC_ACCESS_FAMILY_UNSUPPORTED: 'This account cannot open a clinic workspace.',
  CLINIC_REQUEST_FAILED: 'We could not confirm your clinic access. Please try again.',
};

export function clinicRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? humanize(role.replace(/^CLINIC_/, ''), 'Clinic member');
}

export function clinicCapabilityLabel(capability: string): string {
  return CAPABILITY_LABELS[capability] ?? humanize(capability, 'Clinic capability');
}

export function clinicUnavailabilityLabel(code: string): string {
  return UNAVAILABILITY_LABELS[code] ?? 'Unavailable';
}

export function clinicAccessMessage(reason: ClinicAccessReason): string {
  return ACCESS_MESSAGES[reason];
}

export function clinicStatusTone(status: ClinicLifecycleStatus | ClinicMembershipStatus): OcStatus {
  if (status === 'ACTIVE') return 'confirmed';
  if (status === 'INVITED') return 'pending';
  if (status === 'SUSPENDED') return 'blocked';
  return 'cancelled';
}

export function clinicInitials(clinicName: string): string {
  const letters = clinicName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join('');
  return letters.length > 0 ? letters : 'CL';
}

function humanize(value: string, fallback: string): string {
  const words = value
    .toLocaleLowerCase()
    .split('_')
    .filter((part) => part.length > 0)
    .join(' ');
  return words.length === 0 ? fallback : words.charAt(0).toLocaleUpperCase() + words.slice(1);
}
