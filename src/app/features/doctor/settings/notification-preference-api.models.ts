export const NOTIFICATION_CATEGORIES = [
  'CONSULTATION',
  'APPOINTMENT',
  'KINE',
  'NURSE',
  'MEDICATION',
  'PASSPORT',
  'MESSAGE',
  'CLINIC_OPS',
  'ADMIN',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPreferenceResponse {
  readonly category: string;
  readonly pushEnabled: boolean;
  readonly smsEnabled: boolean;
  readonly dndEnabled: boolean;
  readonly dndStart: string | null;
  readonly dndEnd: string | null;
}

export interface NotificationPreferenceUpdateRequest {
  readonly pushEnabled: boolean;
  readonly smsEnabled: boolean;
  readonly dndEnabled: boolean;
  readonly dndStart: string | null;
  readonly dndEnd: string | null;
}

export interface NotificationCategoryPresentation {
  readonly label: string;
  readonly description: string;
  readonly pushRequired: boolean;
}

const CATEGORY_PRESENTATION: Record<NotificationCategory, NotificationCategoryPresentation> = {
  CONSULTATION: {
    label: 'Consultations',
    description: 'Demandes urgentes et suivi des consultations.',
    pushRequired: true,
  },
  APPOINTMENT: {
    label: 'Rendez-vous',
    description: 'Confirmations, rappels et changements de rendez-vous.',
    pushRequired: false,
  },
  KINE: {
    label: 'Kinésithérapie',
    description: 'Séances, propositions et suivi des programmes.',
    pushRequired: false,
  },
  NURSE: {
    label: 'Soins infirmiers',
    description: 'Visites et nouvelles demandes de soins infirmiers.',
    pushRequired: false,
  },
  MEDICATION: {
    label: 'Médicaments',
    description: 'Rappels et suivi des traitements.',
    pushRequired: false,
  },
  PASSPORT: {
    label: 'Passeport médical',
    description: "Demandes et changements d'accès au passeport médical.",
    pushRequired: false,
  },
  MESSAGE: {
    label: 'Messages et appels',
    description: 'Nouveaux messages et appels.',
    pushRequired: true,
  },
  CLINIC_OPS: {
    label: 'Activité des cliniques',
    description: 'Urgences, affectations et arrivées de patients en clinique.',
    pushRequired: false,
  },
  ADMIN: {
    label: 'Administration',
    description: 'Informations administratives liées à la plateforme.',
    pushRequired: false,
  },
};

export function notificationCategoryPresentation(
  category: string,
): NotificationCategoryPresentation {
  if (isNotificationCategory(category)) {
    return CATEGORY_PRESENTATION[category];
  }
  return {
    label: 'Autres notifications',
    description: 'Préférences pour une catégorie de notification supplémentaire.',
    pushRequired: false,
  };
}

export function isNotificationCategory(category: string): category is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(category);
}

export function notificationCategoryOrder(category: string): number {
  const index = (NOTIFICATION_CATEGORIES as readonly string[]).indexOf(category);
  return index === -1 ? NOTIFICATION_CATEGORIES.length : index;
}
