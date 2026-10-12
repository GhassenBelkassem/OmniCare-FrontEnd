import { OcIconName } from '../../../shared/ui';
import {
  DoctorEligibilityReason,
  KnownDoctorEligibilityReason,
} from './professional-readiness-api.models';

export type ReadinessTone = 'warning' | 'critical' | 'information';
export type ReadinessSettingsTab = 'profile' | 'cabinets' | 'services';

export interface ReadinessReasonPresentation {
  readonly title: string;
  readonly description: string;
  readonly icon: OcIconName;
  readonly tone: ReadinessTone;
  readonly action?: {
    readonly label: string;
    readonly tab: ReadinessSettingsTab;
  };
}

const REASON_PRESENTATIONS = {
  ACCOUNT_INACTIVE: {
    title: 'Compte professionnel inactif',
    description: 'Votre compte doit être actif pour que votre profil puisse être publié.',
    icon: 'warning',
    tone: 'critical',
  },
  ACCOUNT_UNAVAILABLE: {
    title: 'Profil momentanément indisponible',
    description: 'OmniCare ne peut pas publier votre profil pour le moment.',
    icon: 'warning',
    tone: 'critical',
  },
  ADMIN_SUSPENDED: {
    title: 'Publication suspendue',
    description: 'La publication de votre profil est suspendue. Contactez l’assistance OmniCare.',
    icon: 'warning',
    tone: 'critical',
  },
  PROFESSIONAL_PROFILE_MISSING: {
    title: 'Profil professionnel incomplet',
    description: 'Votre profil professionnel n’est pas encore disponible.',
    icon: 'staff',
    tone: 'warning',
    action: { label: 'Modifier mon profil', tab: 'profile' },
  },
  PROFESSIONAL_NOT_VERIFIED: {
    title: 'Profil professionnel non vérifié',
    description: 'Votre profil doit être vérifié par OmniCare avant sa publication.',
    icon: 'coverage',
    tone: 'warning',
  },
  NOT_ACCEPTING_NEW_PATIENTS: {
    title: 'Nouveaux patients désactivés',
    description:
      'Activez l’accueil de nouveaux patients pour apparaître dans la recherche Cabinet.',
    icon: 'staff',
    tone: 'warning',
    action: { label: 'Modifier mon profil', tab: 'profile' },
  },
  CABINET_CAPABILITY_DISABLED: {
    title: 'Consultation au cabinet désactivée',
    description:
      'Activez ce service pour être proposé aux patients recherchant une consultation au cabinet.',
    icon: 'home',
    tone: 'warning',
    action: { label: 'Configurer mes services', tab: 'services' },
  },
  NO_ACTIVE_CABINET: {
    title: 'Aucun cabinet actif',
    description: 'Ajoutez ou activez un cabinet pour être visible dans la recherche Cabinet.',
    icon: 'building',
    tone: 'warning',
    action: { label: 'Gérer mes cabinets', tab: 'cabinets' },
  },
} satisfies Readonly<Record<KnownDoctorEligibilityReason, ReadinessReasonPresentation>>;

const UNKNOWN_REASON: ReadinessReasonPresentation = {
  title: 'Configuration à vérifier',
  description:
    'Une étape supplémentaire est nécessaire avant la publication. Réessayez ou contactez l’assistance OmniCare.',
  icon: 'info',
  tone: 'information',
};

export function readinessReasonPresentation(
  reason: DoctorEligibilityReason,
): ReadinessReasonPresentation {
  const presentations: Readonly<Record<string, ReadinessReasonPresentation>> = REASON_PRESENTATIONS;
  return presentations[reason] ?? UNKNOWN_REASON;
}
