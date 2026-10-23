import { OcIconName } from '../../../shared/ui';
import {
  KnownUrgentReadinessBlockingReason,
  UrgentReadinessBlockingReason,
} from './urgent-care-configuration-api.models';

export interface UrgentReadinessReasonPresentation {
  readonly title: string;
  readonly description: string;
  readonly icon: OcIconName;
  readonly tone: 'warning' | 'critical' | 'information';
}

const PRESENTATIONS = {
  CAPABILITY_DISABLED: {
    title: 'Capacité permanente désactivée',
    description: 'Activez ce mode dans les modes de prise en charge pour pouvoir le préparer.',
    icon: 'warning',
    tone: 'warning',
  },
  HOME_FEE_NOT_CONFIGURED: {
    title: 'Tarif HOME non configuré',
    description: 'Renseignez le tarif de l’urgence à domicile dans la configuration permanente.',
    icon: 'info',
    tone: 'warning',
  },
  HOME_TRAVEL_DISTANCE_NOT_CONFIGURED: {
    title: 'Distance HOME non configurée',
    description: 'Renseignez la distance routière maximale de l’urgence à domicile.',
    icon: 'info',
    tone: 'warning',
  },
  CABINET_FEE_NOT_CONFIGURED: {
    title: 'Tarif CABINET non configuré',
    description: 'Renseignez le tarif de l’urgence au cabinet dans la configuration permanente.',
    icon: 'info',
    tone: 'warning',
  },
  NO_ACTIVE_CABINET: {
    title: 'Aucun cabinet actif',
    description: 'Ajoutez ou activez un cabinet autorisé avant d’utiliser l’urgence au cabinet.',
    icon: 'building',
    tone: 'warning',
  },
  PROFESSIONAL_NOT_ELIGIBLE: {
    title: 'Profil professionnel non éligible',
    description:
      'Votre profil professionnel ne satisfait pas actuellement les conditions requises.',
    icon: 'coverage',
    tone: 'critical',
  },
  RUNTIME_HOME_INTENT_DISABLED: {
    title: 'Disponibilité HOME inactive',
    description:
      'Votre intention de disponibilité à domicile est désactivée dans l’application Doctor.',
    icon: 'home',
    tone: 'information',
  },
  RUNTIME_CABINET_INTENT_DISABLED: {
    title: 'Disponibilité CABINET inactive',
    description:
      'Votre intention de disponibilité au cabinet est désactivée dans l’application Doctor.',
    icon: 'building',
    tone: 'information',
  },
  CLINICAL_BUSY: {
    title: 'Activité clinique en cours',
    description:
      'Une activité clinique en cours empêche temporairement une nouvelle prise en charge urgente.',
    icon: 'warning',
    tone: 'warning',
  },
  ACTIVE_URGENT_CAPACITY_CLAIM: {
    title: 'Capacité urgente déjà engagée',
    description:
      'Une prise en charge urgente active utilise actuellement votre capacité opérationnelle.',
    icon: 'warning',
    tone: 'warning',
  },
  POST_HANDOFF_UNAVAILABLE: {
    title: 'Indisponibilité après transmission',
    description:
      'Votre capacité reste indisponible pendant la convergence de la prise en charge précédente.',
    icon: 'warning',
    tone: 'warning',
  },
  LOCATION_MISSING: {
    title: 'Position récente manquante',
    description:
      'Aucune position exploitable n’est disponible pour évaluer une urgence à domicile.',
    icon: 'location',
    tone: 'warning',
  },
  LOCATION_STALE: {
    title: 'Position trop ancienne',
    description:
      'La dernière position connue est trop ancienne pour une évaluation opérationnelle.',
    icon: 'location',
    tone: 'warning',
  },
  LOCATION_ACCURACY_INSUFFICIENT: {
    title: 'Précision de position insuffisante',
    description: 'La précision de la position ne permet pas une évaluation fiable.',
    icon: 'location',
    tone: 'warning',
  },
  LOCATION_PRESENCE_UNAVAILABLE: {
    title: 'Présence de localisation indisponible',
    description: 'Le service de présence ne permet pas de vérifier la localisation actuellement.',
    icon: 'location',
    tone: 'critical',
  },
  REQUEST_SPECIFIC_ELIGIBILITY_NOT_EVALUATED: {
    title: 'Éligibilité liée à la demande non évaluée',
    description:
      'La distance routière et les conditions propres à une demande Patient ne sont pas évaluées ici.',
    icon: 'info',
    tone: 'information',
  },
} satisfies Readonly<Record<KnownUrgentReadinessBlockingReason, UrgentReadinessReasonPresentation>>;

const UNKNOWN_PRESENTATION: UrgentReadinessReasonPresentation = {
  title: 'Condition supplémentaire à vérifier',
  description:
    'Le serveur signale une condition non reconnue par cette version du tableau de bord. Actualisez ou contactez l’assistance OmniCare.',
  icon: 'info',
  tone: 'information',
};

export function urgentReadinessReasonPresentation(
  reason: UrgentReadinessBlockingReason,
): UrgentReadinessReasonPresentation {
  const presentations: Readonly<Record<string, UrgentReadinessReasonPresentation>> = PRESENTATIONS;
  return presentations[reason] ?? UNKNOWN_PRESENTATION;
}
