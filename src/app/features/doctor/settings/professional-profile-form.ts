import {
  MeProfessionalProfileResponse,
  UpdateProfessionalProfileRequest,
} from './professional-profile-api.models';

export type EditableTagListField =
  | 'subSpecialties'
  | 'languages'
  | 'areasOfCare'
  | 'expertise'
  | 'visitReasons'
  | 'patientAgeGroups'
  | 'consultationTypes';

export type EditableScalarField =
  'specialty' | 'consultationPriceTnd' | 'experienceYears' | 'biography';

export type EditableProfessionalProfileField =
  EditableScalarField | EditableTagListField | 'acceptingNewPatients';

export const EDITABLE_TAG_LIST_FIELDS: readonly EditableTagListField[] = [
  'subSpecialties',
  'languages',
  'areasOfCare',
  'expertise',
  'visitReasons',
  'patientAgeGroups',
  'consultationTypes',
];

export const EDITABLE_FIELDS: readonly EditableProfessionalProfileField[] = [
  'specialty',
  'consultationPriceTnd',
  'experienceYears',
  'acceptingNewPatients',
  ...EDITABLE_TAG_LIST_FIELDS,
  'biography',
];

export const PROFESSIONAL_PROFILE_LIMITS = {
  scalarMaxLength: 100,
  tagMaxLength: 100,
  maxTags: 50,
  biographyMaxLength: 5000,
  maxPriceIntegerDigits: 10,
  maxPriceFractionDigits: 2,
} as const;

/**
 * Editable fields surfaced by the Profil form. Number-backed fields are kept as
 * strings so the doctor can type freely; an empty string means "leave unchanged".
 */
export interface ProfessionalProfileDraft {
  readonly specialty: string;
  readonly consultationPriceTnd: string;
  readonly experienceYears: string;
  readonly acceptingNewPatients: boolean;
  readonly subSpecialties: readonly string[];
  readonly languages: readonly string[];
  readonly areasOfCare: readonly string[];
  readonly expertise: readonly string[];
  readonly visitReasons: readonly string[];
  readonly patientAgeGroups: readonly string[];
  readonly consultationTypes: readonly string[];
  readonly biography: string;
}

export type ProfessionalProfileFieldErrors = Partial<
  Record<EditableProfessionalProfileField, string>
>;

export function emptyProfessionalProfileDraft(): ProfessionalProfileDraft {
  return {
    specialty: '',
    consultationPriceTnd: '',
    experienceYears: '',
    acceptingNewPatients: true,
    subSpecialties: [],
    languages: [],
    areasOfCare: [],
    expertise: [],
    visitReasons: [],
    patientAgeGroups: [],
    consultationTypes: [],
    biography: '',
  };
}

export function draftFromProfile(profile: MeProfessionalProfileResponse): ProfessionalProfileDraft {
  return {
    specialty: profile.specialty ?? '',
    consultationPriceTnd: numberToDraft(profile.consultationPriceTnd),
    experienceYears: numberToDraft(profile.experienceYears),
    acceptingNewPatients: profile.acceptingNewPatients ?? true,
    subSpecialties: profile.subSpecialties ?? [],
    languages: profile.languages ?? [],
    areasOfCare: profile.areasOfCare ?? [],
    expertise: profile.expertise ?? [],
    visitReasons: profile.visitReasons ?? [],
    patientAgeGroups: profile.patientAgeGroups ?? [],
    consultationTypes: profile.consultationTypes ?? [],
    biography: profile.biography ?? '',
  };
}

/** Only changed fields are sent; untouched fields stay out of the PATCH body. */
export function buildProfessionalProfilePatch(
  draft: ProfessionalProfileDraft,
  baseline: MeProfessionalProfileResponse,
): UpdateProfessionalProfileRequest {
  const patch: UpdateProfessionalProfileRequest = {};

  if (normalizeScalar(draft.specialty) !== (baseline.specialty ?? '')) {
    patch.specialty = normalizeScalar(draft.specialty);
  }

  const price = optionalNumber(draft.consultationPriceTnd);
  if (price !== undefined && price !== (baseline.consultationPriceTnd ?? null)) {
    patch.consultationPriceTnd = price;
  }

  const experience = optionalNumber(draft.experienceYears);
  if (experience !== undefined && experience !== (baseline.experienceYears ?? null)) {
    patch.experienceYears = experience;
  }

  if (draft.acceptingNewPatients !== (baseline.acceptingNewPatients ?? true)) {
    patch.acceptingNewPatients = draft.acceptingNewPatients;
  }

  for (const field of EDITABLE_TAG_LIST_FIELDS) {
    const baselineTags = [...(baseline[field] ?? [])].sort();
    const draftTags = [...draft[field]].sort();
    if (!sameStringList(baselineTags, draftTags)) {
      patch[field] = [...draft[field]];
    }
  }

  if (normalizeScalar(draft.biography) !== (baseline.biography ?? '')) {
    patch.biography = normalizeScalar(draft.biography);
  }

  if (Object.keys(patch).length > 0) {
    patch.expectedRevision = baseline.revision;
  }

  return patch;
}

export function validateDraft(draft: ProfessionalProfileDraft): ProfessionalProfileFieldErrors {
  const errors: ProfessionalProfileFieldErrors = {};
  const { scalarMaxLength, tagMaxLength, maxTags, biographyMaxLength } =
    PROFESSIONAL_PROFILE_LIMITS;

  if (draft.specialty.length > scalarMaxLength) {
    errors.specialty = `${scalarMaxLength} caracteres max.`;
  }

  if (validateMoney(draft.consultationPriceTnd)) {
    errors.consultationPriceTnd = 'Tarif invalide. Format : 0 a 9999999999,99.';
  }

  if (validateNonNegativeInteger(draft.experienceYears)) {
    errors.experienceYears = "Annees d'experience invalide. Entier 0 ou plus.";
  }

  if (draft.biography.length > biographyMaxLength) {
    errors.biography = `${biographyMaxLength} caracteres max.`;
  }

  for (const field of EDITABLE_TAG_LIST_FIELDS) {
    const tags = draft[field];
    if (tags.length > maxTags) {
      errors[field] = `${maxTags} elements max.`;
    }
    if (tags.some((tag) => tag.length > tagMaxLength)) {
      errors[field] = `Element trop long (${tagMaxLength} caracteres max).`;
    }
  }

  return errors;
}

export function hasFieldErrors(errors: ProfessionalProfileFieldErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined && message !== '');
}

function optionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validateMoney(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') return false;
  return !/^\d{1,10}(\.\d{1,2})?$/.test(trimmed);
}

function validateNonNegativeInteger(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') return false;
  return !/^\d+$/.test(trimmed) || Number(trimmed) > 1000;
}

function normalizeScalar(value: string): string {
  return value.trim();
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function numberToDraft(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}
