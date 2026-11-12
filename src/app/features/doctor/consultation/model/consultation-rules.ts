import { InjectionToken } from '@angular/core';

/**
 * Consultation limits shared with Spring and MRS (G-1 P2a contract + P2b decisions).
 *
 * `maxMedications`, `sickLeaveMaxDays` and the duration caps are configuration in the backend
 * (`omnicare.clinical.*` in Spring, `MRS_*` in MRS). Keep the defaults here equal to theirs.
 */
export interface ConsultationRules {
  readonly maxMedications: number;
  readonly sickLeaveMaxDays: number;
  readonly durationMax: Readonly<Record<DurationUnit, number>>;
}

export const DEFAULT_CONSULTATION_RULES: ConsultationRules = {
  maxMedications: 15,
  sickLeaveMaxDays: 365,
  durationMax: { DAY: 365, WEEK: 52, MONTH: 12 },
};

export const CONSULTATION_RULES = new InjectionToken<ConsultationRules>('CONSULTATION_RULES', {
  providedIn: 'root',
  factory: () => DEFAULT_CONSULTATION_RULES,
});

/** Character limits (counted in characters, like MRS). */
export const TEXT_LIMITS = {
  chiefComplaint: 1000,
  presentIllness: 4000,
  examination: 2000,
  diagnosis: 500,
  summaryItem: 160,
  summaryItems: 50,
  medicationName: 200,
  instructions: 1000,
  orderTargetMin: 2,
  orderTargetMax: 500,
  statement: 500,
} as const;

export const DOSE_MAX = 1_000_000;
export const QUANTITY_MAX = 1_000_000;
export const TIMES_PER_DAY_MIN = 1;
export const TIMES_PER_DAY_MAX = 24;

export type DoseUnit =
  | 'TABLET' | 'CAPSULE' | 'MG' | 'G' | 'ML' | 'DROP' | 'SACHET' | 'IU' | 'PUFF' | 'APPLICATION';
export type AdministrationRoute =
  | 'ORAL' | 'SUBLINGUAL' | 'CUTANEOUS' | 'IM' | 'IV' | 'SC' | 'INHALED' | 'RECTAL' | 'OPHTHALMIC'
  | 'AURICULAR' | 'NASAL' | 'VAGINAL';
export type DurationUnit = 'DAY' | 'WEEK' | 'MONTH';

export const DOSE_UNIT_LABELS: Readonly<Record<DoseUnit, string>> = {
  TABLET: 'comprimé',
  CAPSULE: 'gélule',
  MG: 'mg',
  G: 'g',
  ML: 'mL',
  DROP: 'goutte',
  SACHET: 'sachet',
  IU: 'UI',
  PUFF: 'bouffée',
  APPLICATION: 'application',
};

export const ROUTE_LABELS: Readonly<Record<AdministrationRoute, string>> = {
  ORAL: 'orale',
  SUBLINGUAL: 'sublinguale',
  CUTANEOUS: 'cutanée',
  IM: 'intramusculaire',
  IV: 'intraveineuse',
  SC: 'sous-cutanée',
  INHALED: 'inhalée',
  RECTAL: 'rectale',
  OPHTHALMIC: 'ophtalmique',
  AURICULAR: 'auriculaire',
  NASAL: 'nasale',
  VAGINAL: 'vaginale',
};

export const DURATION_UNIT_LABELS: Readonly<Record<DurationUnit, string>> = {
  DAY: 'jours',
  WEEK: 'semaines',
  MONTH: 'mois',
};

export const DOSE_UNITS = Object.keys(DOSE_UNIT_LABELS) as DoseUnit[];
export const ROUTES = Object.keys(ROUTE_LABELS) as AdministrationRoute[];
export const DURATION_UNITS = Object.keys(DURATION_UNIT_LABELS) as DurationUnit[];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export type OrderCategory = 'LAB' | 'IMAGING' | 'REFERRAL';
export const ORDER_CATEGORY_LABELS: Readonly<Record<OrderCategory, string>> = {
  LAB: 'Analyse',
  IMAGING: 'Imagerie',
  REFERRAL: 'Orientation',
};
export const ORDER_TARGET_PLACEHOLDERS: Readonly<Record<OrderCategory, string>> = {
  LAB: 'Ex. : NFS, CRP',
  IMAGING: 'Ex. : radiographie du thorax',
  REFERRAL: 'Ex. : cardiologie',
};

export function isDoseUnit(value: unknown): value is DoseUnit {
  return typeof value === 'string' && (DOSE_UNITS as string[]).includes(value);
}

export function isRoute(value: unknown): value is AdministrationRoute {
  return typeof value === 'string' && (ROUTES as string[]).includes(value);
}

export function isDurationUnit(value: unknown): value is DurationUnit {
  return typeof value === 'string' && (DURATION_UNITS as string[]).includes(value);
}

/**
 * A v2 draft may carry a lower-case or French unit (`mg`, `comprimé`). Converted on edit; an
 * unknown value becomes null so the doctor picks it from the list.
 */
export function normalizeDoseUnit(value: string | null | undefined): DoseUnit | null {
  if (value === null || value === undefined) return null;
  const upper = value.trim().toUpperCase();
  if (isDoseUnit(upper)) return upper;
  const french = Object.entries(DOSE_UNIT_LABELS)
    .find(([, label]) => label.toLocaleLowerCase('fr-FR') === value.trim().toLocaleLowerCase('fr-FR'));
  return french ? (french[0] as DoseUnit) : null;
}

export function normalizeRoute(value: string | null | undefined): AdministrationRoute | null {
  if (value === null || value === undefined) return null;
  const upper = value.trim().toUpperCase();
  return isRoute(upper) ? upper : null;
}

/** Number of characters as MRS counts them (code points, not UTF-16 units). */
export function charCount(value: string | null | undefined): number {
  return value ? Array.from(value).length : 0;
}
