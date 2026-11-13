import type { ConsultationPatient } from '../../active-consultation.models';

/**
 * G-1 D5: patient data the doctor's sick-leave template prints but that is not known. A soft
 * warning at « Terminer », never a block: the zone simply stays empty on the arrêt de travail.
 * An approximate age fills the « Âge » zone (« environ {n} ans ») but never the birth-date zone.
 */
export type MissingIdentityItem = 'dateOfBirth' | 'age' | 'address';

/** Template field keys (catalog) that print patient identity. */
export const IDENTITY_FIELD_KEYS: Readonly<Record<MissingIdentityItem, string>> = {
  dateOfBirth: 'patientDateOfBirth',
  age: 'patientAge',
  address: 'patientAddress',
};

export interface IdentityWarning {
  readonly missing: readonly MissingIdentityItem[];
  readonly message: string;
  /** External patient: the doctor completes the « Coordonnées » on the spot. */
  readonly editable: boolean;
}

type IdentityFacts = Pick<ConsultationPatient, 'patientType' | 'dateOfBirth' | 'ageYears' | 'addressKnown'>;

export function missingIdentity(fieldKeys: ReadonlySet<string>, patient: IdentityFacts): MissingIdentityItem[] {
  const missing: MissingIdentityItem[] = [];
  if (fieldKeys.has(IDENTITY_FIELD_KEYS.dateOfBirth) && !patient.dateOfBirth) missing.push('dateOfBirth');
  if (fieldKeys.has(IDENTITY_FIELD_KEYS.age) && patient.ageYears === null) missing.push('age');
  if (fieldKeys.has(IDENTITY_FIELD_KEYS.address) && patient.addressKnown !== true) missing.push('address');
  return missing;
}

const NOUNS: Readonly<Record<MissingIdentityItem, { readonly text: string; readonly feminine: boolean }>> = {
  dateOfBirth: { text: 'la date de naissance', feminine: true },
  age: { text: 'l’âge', feminine: false },
  address: { text: 'l’adresse', feminine: true },
};

/**
 * « La date de naissance et l’adresse du patient ne sont pas renseignées : elles resteront vides
 * sur l’arrêt de travail. », agreed in number and gender with what is missing.
 */
export function identityWarningMessage(missing: readonly MissingIdentityItem[]): string {
  const nouns = missing.map((item) => NOUNS[item]);
  const list = nouns.length === 1
    ? nouns[0].text
    : `${nouns.slice(0, -1).map((noun) => noun.text).join(', ')} et ${nouns[nouns.length - 1].text}`;
  const subject = `${list.charAt(0).toUpperCase()}${list.slice(1)} du patient`;
  const feminine = nouns.every((noun) => noun.feminine);
  if (nouns.length === 1) {
    return `${subject} n’est pas renseigné${feminine ? 'e' : ''} : ${feminine ? 'elle' : 'il'} restera vide sur l’arrêt de travail.`;
  }
  return `${subject} ne sont pas renseigné${feminine ? 'es' : 's'} : ${feminine ? 'elles' : 'ils'} resteront vides sur l’arrêt de travail.`;
}

export function identityWarning(fieldKeys: ReadonlySet<string>, patient: IdentityFacts | null | undefined): IdentityWarning | null {
  if (!patient || fieldKeys.size === 0) return null;
  const missing = missingIdentity(fieldKeys, patient);
  if (missing.length === 0) return null;
  return { missing, message: identityWarningMessage(missing), editable: patient.patientType === 'EXTERNAL' };
}
