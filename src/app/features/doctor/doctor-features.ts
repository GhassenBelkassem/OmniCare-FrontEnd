import { APP_MODE } from '../../core/config/app-mode';

/**
 * Doctor features that are not production-ready (they open the « non disponible » page).
 * Routes and code stay in place; only navigation entries are hidden while a flag is false.
 * The static demo always shows them.
 */
export const DOCTOR_FEATURES = {
  /** DOC-07 Salle d'attente */
  waitingRoom: false,
  /** DOC-09 Résultats et suivi */
  results: false,
  /** DOC-11 Analyses */
  analytics: false,
  /** DOC-14 Facturation */
  billing: false,
  /** Prescriptions & demandes (transversal list) */
  prescriptions: false,
  /** Préparation urgences: urgent care is out of V1 */
  urgentReadiness: false,
} as const;

export type DoctorFeature = keyof typeof DOCTOR_FEATURES;

/** Navigation item id → feature flag. Items without a flag are always shown. */
export const NAVIGATION_FEATURE: Readonly<Record<string, DoctorFeature>> = {
  'waiting-room': 'waitingRoom',
  results: 'results',
  analytics: 'analytics',
  billing: 'billing',
  prescriptions: 'prescriptions',
  'urgent-readiness': 'urgentReadiness',
};

export function isDoctorFeatureEnabled(
  feature: DoctorFeature,
  flags: Readonly<Record<DoctorFeature, boolean>> = DOCTOR_FEATURES,
  staticDemo: boolean = APP_MODE.staticDemo,
): boolean {
  return staticDemo || flags[feature];
}
