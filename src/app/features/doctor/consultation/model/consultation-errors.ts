import type { AppHttpError } from '../../../../core/http/app-http-error';
import { MESSAGES, type CertificateType, type FieldErrors } from './consultation-form';
import { DEFAULT_CONSULTATION_RULES, TEXT_LIMITS, type ConsultationRules } from './consultation-rules';

/**
 * Where a validation error lands in the page. Note and prescription errors keep the server's
 * dotted path; an order or a document is one request per resource, so its `order.*` /
 * `artifact.*` paths are re-keyed to that row (`order:<rowKey>.target`, `artifact:<type>.statement`).
 */
export type ErrorScope =
  | { readonly kind: 'note' }
  | { readonly kind: 'prescription' }
  | { readonly kind: 'order'; readonly rowKey: string }
  | { readonly kind: 'artifact'; readonly type: CertificateType };

const SAFE_PATH = /^[A-Za-z][A-Za-z0-9_.]{0,99}$/;

/**
 * Maps a 400 `VALIDATION_ERROR` body (`fieldErrors` + `fieldErrorCodes`) onto the page's field
 * keys. The message always comes from the client catalog, chosen by path and code: server text is
 * never displayed. A path without a code falls back to « Valeur non valide. ».
 */
export function mapServerFieldErrors(
  error: Pick<AppHttpError, 'fieldErrors' | 'fieldErrorCodes'>,
  scope: ErrorScope,
  rules: ConsultationRules = DEFAULT_CONSULTATION_RULES,
): FieldErrors {
  const paths = new Set([...Object.keys(error.fieldErrorCodes), ...Object.keys(error.fieldErrors)]);
  const result: Record<string, string> = {};
  for (const path of paths) {
    if (!SAFE_PATH.test(path)) continue;
    const key = fieldKey(path, scope);
    if (key === null) continue;
    const code = error.fieldErrorCodes[path] ?? 'INVALID_VALUE';
    if (result[key] === undefined) result[key] = fieldMessage(key, code, rules);
  }
  return result;
}

export function fieldKey(serverPath: string, scope: ErrorScope): string | null {
  switch (scope.kind) {
    case 'note':
      return serverPath.startsWith('clinicalRecord') ? serverPath : null;
    case 'prescription':
      return serverPath.startsWith('prescription') ? serverPath : null;
    case 'order': {
      if (!serverPath.startsWith('order')) return null;
      const field = serverPath.startsWith('order.category') ? 'category' : 'target';
      return `order:${scope.rowKey}.${field}`;
    }
    case 'artifact': {
      if (!serverPath.startsWith('artifact')) return null;
      const field = serverPath.split('.')[1];
      const known = field === 'statement' || field === 'startDate' || field === 'endDate';
      return `artifact:${scope.type}.${known ? field : 'statement'}`;
    }
  }
}

type Rule = readonly [pattern: RegExp, codes: readonly string[] | null, message: (rules: ConsultationRules) => string];

const ANY = null;
const rule = (path: string, codes: readonly string[] | null, message: string | ((rules: ConsultationRules) => string)): Rule => [
  new RegExp(`^${path.replace(/\./g, '\\.').replace(/\*/g, '[^.]+')}$`),
  codes,
  typeof message === 'string' ? () => message : message,
];

const SUMMARY = 'clinicalRecord.medicalSummaryUpdate';
const MED = 'prescription.medications.*';

/** Field rules, most specific first. Mirrors the server catalog (2a §5.4) in client words. */
const FIELD_RULES: readonly Rule[] = [
  rule('clinicalRecord.chiefComplaint', ['REQUIRED'], MESSAGES.chiefComplaintRequired),
  rule('clinicalRecord.chiefComplaint', ANY, MESSAGES.tooLong(TEXT_LIMITS.chiefComplaint)),
  rule('clinicalRecord.history.presentIllness', ANY, MESSAGES.tooLong(TEXT_LIMITS.presentIllness)),
  rule('clinicalRecord.clinicalFindings.*.description', ['REQUIRED'], 'Décrivez l’examen clinique.'),
  rule('clinicalRecord.clinicalFindings.*.description', ANY, MESSAGES.tooLong(TEXT_LIMITS.examination)),
  rule('clinicalRecord.diagnoses.*.label', ['TOO_LONG'], MESSAGES.tooLong(TEXT_LIMITS.diagnosis)),
  rule('clinicalRecord.diagnoses.*.label', ANY, MESSAGES.diagnosisRequired),
  rule('clinicalRecord.diagnoses.*.status', ANY, 'Choisissez un statut pour le diagnostic.'),
  rule('clinicalRecord.followUp.recommendedAt', ['INVALID_DATE'], MESSAGES.followUpDateInvalid),
  rule('clinicalRecord.followUp.recommendedAt', ['NOT_ALLOWED'], 'Ce type de suivi ne comporte pas de date.'),
  rule('clinicalRecord.followUp.recommendedAt', ANY, MESSAGES.followUpDateRequired),
  rule('clinicalRecord.followUp.decision', ANY, MESSAGES.followUpRequired),
  rule('clinicalRecord.followUp', ANY, MESSAGES.followUpRequired),
  rule('clinicalRecord.medicationDecision', ANY, MESSAGES.medicationDecisionRequired),
  rule(`${SUMMARY}.allergies.items`, ['TOO_MANY_ITEMS'], MESSAGES.summaryTooMany(TEXT_LIMITS.summaryItems)),
  rule(`${SUMMARY}.allergies.items`, ANY, MESSAGES.allergiesItems),
  rule(`${SUMMARY}.conditions.items`, ['TOO_MANY_ITEMS'], MESSAGES.summaryTooMany(TEXT_LIMITS.summaryItems)),
  rule(`${SUMMARY}.conditions.items`, ANY, MESSAGES.conditionsItems),
  rule(`${SUMMARY}.*.items.*`, ['TOO_LONG'], MESSAGES.summaryItemTooLong),
  rule(`${SUMMARY}.*.items.*`, ANY, 'Saisissez un libellé ou supprimez l’élément.'),
  rule(`${SUMMARY}.*.status`, ANY, 'Choisissez « Non renseigné », « Aucune connue » ou une liste.'),
  rule(`${SUMMARY}.bloodType`, ANY, MESSAGES.bloodType),
  rule('prescription.medications', ['TOO_MANY_ITEMS'], (rules) => MESSAGES.medicationsTooMany(rules.maxMedications)),
  rule('prescription.medications', ANY, MESSAGES.medicationsRequired),
  rule(`${MED}.name`, ['TOO_LONG'], MESSAGES.tooLong(TEXT_LIMITS.medicationName)),
  rule(`${MED}.name`, ANY, MESSAGES.medicationName),
  rule(`${MED}.medicationCode`, ANY, MESSAGES.medicationName),
  rule(`${MED}.dose`, ANY, MESSAGES.dose),
  rule(`${MED}.dose.amount`, ANY, MESSAGES.dose),
  rule(`${MED}.dose.unit`, ANY, MESSAGES.unit),
  rule(`${MED}.route`, ANY, MESSAGES.route),
  rule(`${MED}.frequency`, ANY, MESSAGES.frequency),
  rule(`${MED}.frequency.timesPerDay`, ANY, MESSAGES.timesPerDay),
  rule(`${MED}.frequency.text`, ANY, MESSAGES.frequency),
  rule(`${MED}.duration`, ANY, MESSAGES.durationRequired),
  rule(`${MED}.duration.value`, ['REQUIRED'], MESSAGES.durationRequired),
  rule(`${MED}.duration.value`, ANY, (rules) =>
    `Durée trop longue pour l’unité choisie (${rules.durationMax.DAY} jours, ${rules.durationMax.WEEK} semaines ou ${rules.durationMax.MONTH} mois maximum).`),
  rule(`${MED}.duration.unit`, ANY, MESSAGES.durationUnit),
  rule(`${MED}.quantity`, ANY, MESSAGES.quantity),
  rule(`${MED}.instructions`, ANY, MESSAGES.tooLong(TEXT_LIMITS.instructions)),
  rule(`${MED}.itemId`, ANY, 'Ligne d’ordonnance non valide : rechargez la page.'),
  rule('order:*.category', ANY, 'Choisissez le type de demande.'),
  rule('order:*.target', ['TOO_SHORT'], MESSAGES.orderTargetShort),
  rule('order:*.target', ['TOO_LONG'], MESSAGES.tooLong(TEXT_LIMITS.orderTargetMax)),
  rule('order:*.target', ANY, MESSAGES.orderTarget),
  rule('artifact:*.statement', ['TOO_LONG'], MESSAGES.tooLong(TEXT_LIMITS.statement)),
  rule('artifact:*.statement', ANY, MESSAGES.statement),
  rule('artifact:*.startDate', ['INVALID_DATE'], MESSAGES.invalidDate),
  rule('artifact:*.startDate', ANY, MESSAGES.startDate),
  rule('artifact:*.endDate', ['DATE_ORDER'], MESSAGES.dateOrder),
  rule('artifact:*.endDate', ['OUT_OF_RANGE'], (rules) => MESSAGES.sickLeaveTooLong(rules.sickLeaveMaxDays)),
  rule('artifact:*.endDate', ['INVALID_DATE'], MESSAGES.invalidDate),
  rule('artifact:*.endDate', ANY, MESSAGES.endDate),
];

/** Generic message per code (2a §5.3), without placeholders the client cannot fill. */
const GENERIC_FIELD_MESSAGES: Readonly<Record<string, string>> = {
  REQUIRED: 'Ce champ est obligatoire.',
  TOO_LONG: 'Texte trop long.',
  TOO_SHORT: 'Texte trop court.',
  TOO_MANY_ITEMS: 'Trop d’éléments.',
  OUT_OF_RANGE: 'Valeur hors des limites autorisées.',
  INVALID_VALUE: 'Valeur non valide.',
  INVALID_DATE: 'Date non valide.',
  DATE_ORDER: 'La date de fin doit suivre la date de début.',
  NOT_ALLOWED: 'Ce champ ne doit pas être renseigné ici.',
  ITEMS_REQUIRED: 'Ajoutez au moins un élément.',
  DUPLICATE: 'Élément en double.',
  INCONSISTENT: 'Valeurs incohérentes : vérifiez ce champ.',
  NO_CONTENT: 'Saisissez au moins un élément de la consultation avant d’enregistrer.',
  MALFORMED: 'La saisie n’a pas pu être lue. Rechargez la page et réessayez.',
};

export function fieldMessage(key: string, code: string, rules: ConsultationRules = DEFAULT_CONSULTATION_RULES): string {
  const normalized = key.replace(/(^|\.)\d+(?=\.|$)/g, '$1*').replace(/^(order|artifact):[^.]+/, '$1:*');
  for (const [pattern, codes, message] of FIELD_RULES) {
    if ((codes === null || codes.includes(code)) && pattern.test(normalized)) return message(rules);
  }
  return GENERIC_FIELD_MESSAGES[code] ?? GENERIC_FIELD_MESSAGES['INVALID_VALUE'];
}

export const GENERIC_ERROR_MESSAGE = 'L’opération n’a pas abouti. Réessayez dans un instant.';
export const CONFLICT_MESSAGE = 'Cette consultation a été modifiée ailleurs.';

/**
 * Non-field errors: code → French. Server `message`/`detail` are never shown; an unknown code
 * gets one generic message.
 */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  CLINICAL_RECORD_VERSION_CONFLICT: CONFLICT_MESSAGE,
  PRESCRIPTION_VERSION_CONFLICT: CONFLICT_MESSAGE,
  CLINICAL_ORDER_VERSION_CONFLICT: CONFLICT_MESSAGE,
  ARTIFACT_VERSION_CONFLICT: CONFLICT_MESSAGE,
  CONSULTATION_VERSION_CONFLICT: CONFLICT_MESSAGE,
  IDEMPOTENCY_KEY_REUSED: CONFLICT_MESSAGE,
  IDEMPOTENCY_CONFLICT: CONFLICT_MESSAGE,
  CONSULTATION_FINALIZED: 'La consultation est terminée : elle ne peut plus être modifiée.',
  CONSULTATION_ALREADY_COMPLETED: 'La consultation est terminée : elle ne peut plus être modifiée.',
  CONSULTATION_FINALIZING: 'La clôture de la consultation est en cours.',
  CONSULTATION_ABORTED: 'Cette consultation a été annulée.',
  CONSULTATION_HAS_SIGNED_ITEMS: 'Un élément est déjà signé : la consultation ne peut plus être annulée. Terminez-la.',
  CONSULTATION_NOT_IN_PROGRESS: 'Cette consultation n’est plus en cours : elle ne peut pas être annulée.',
  CONSULTATION_ABORT_NOT_SUPPORTED: 'Cette consultation ne peut pas être annulée depuis cette page.',
  CONSULTATION_FINISH_FAILED: 'La clôture n’a pas pu aboutir. Le support a été prévenu.',
  CONSULTATION_NOT_FOUND: 'Cette consultation est introuvable.',
  CONSULTATION_NOT_READY_TO_FINISH: 'La consultation n’est pas encore prête à être terminée.',
  FINISH_IN_PROGRESS: 'Clôture en cours…',
  FINISH_RECONCILIATION_REQUIRED: 'La clôture est en cours de vérification.',
  MRS_CONTEXT_PENDING: 'Le dossier médical est en cours de préparation. Réessayez dans un instant.',
  MRS_CONTEXT_FAILED: 'Le dossier médical n’a pas pu être préparé. Réessayez dans un instant.',
  MRS_UNAVAILABLE: 'Le dossier médical est momentanément indisponible. Réessayez dans un instant.',
  PATIENT_MEDICAL_RECORD_NOT_READY: 'Le dossier médical est en cours de préparation. Réessayez dans un instant.',
  MEDICAL_SUMMARY_UPDATE_NOT_ALLOWED: 'Vous ne pouvez plus modifier les informations médicales de ce patient.',
  PRESCRIPTION_ALREADY_FINALIZED: 'L’ordonnance est déjà signée.',
  PRESCRIPTION_NOT_FINALIZABLE: 'L’ordonnance ne peut pas encore être signée : vérifiez ses lignes.',
  PRESCRIPTION_SIGNING_UNAVAILABLE: 'La signature de l’ordonnance est momentanément indisponible. Réessayez dans un instant.',
  PRESCRIPTION_NOT_FOUND: 'Aucune ordonnance n’est enregistrée pour cette consultation.',
  MEDICATION_DECISION_REQUIRED: 'Indiquez si un traitement est prescrit.',
  MEDICATION_DECISION_CONFLICT: 'L’ordonnance ne correspond pas à la décision de traitement.',
  CLINICAL_ORDER_ALREADY_FINALIZED: 'Cette demande d’examen est déjà validée.',
  CLINICAL_ORDER_NOT_FOUND: 'Cette demande d’examen n’existe plus.',
  INVALID_CLINICAL_ORDER: 'Précisez l’examen, l’imagerie ou la spécialité demandée.',
  ARTIFACT_ALREADY_FINALIZED: 'Ce document est déjà signé.',
  ARTIFACT_NOT_FINALIZABLE: 'Ce document ne peut pas encore être signé.',
  ARTIFACT_NOT_FOUND: 'Ce document n’existe plus.',
  ARTIFACT_NOT_DISCARDABLE: 'Seuls les certificats en brouillon peuvent être supprimés.',
  ARTIFACT_SIGNING_UNAVAILABLE: 'La signature des documents est momentanément indisponible. Réessayez dans un instant.',
  TEMPLATE_NOT_FOUND: 'Ce modèle n’est plus disponible. Choisissez-en un autre.',
  INVALID_TEMPLATE_STATE: 'Ce modèle n’est plus disponible. Choisissez-en un autre.',
  UNPRINTABLE_TEXT: 'Le texte du document contient des caractères que l’impression ne prend pas encore en charge (par exemple des lettres arabes). Rien n’a été signé. Remplacez-les par des lettres latines, puis réessayez.',
  TEMPLATE_UNPRINTABLE_TEXT: 'Le document contient des caractères que l’impression ne prend pas encore en charge (par exemple des lettres arabes dans le nom du patient ou du cabinet). Rien n’a été signé. Remplacez-les par des lettres latines, ou choisissez « Modèle standard » dans la liste.',
  TEMPLATE_TEXT_OVERFLOW: 'Un texte est trop long pour sa zone sur votre modèle d’arrêt de travail. Rien n’a été signé. Raccourcissez le texte ou agrandissez la zone dans vos modèles.',
  ARTIFACT_SOURCE_NOT_FINALIZED: 'Ce document dépend d’un élément qui n’est pas encore signé.',
  CLINICAL_ACCESS_REQUIRED: 'Vous n’avez pas accès au dossier médical de ce patient.',
  CLINICAL_ACCESS_EXPIRED: 'Votre accès au dossier médical de ce patient a expiré.',
  CLINICAL_ACCESS_REVOKED: 'Votre accès au dossier médical de ce patient a été retiré.',
  PROFESSIONAL_NOT_ELIGIBLE: 'Votre compte ne permet pas cette action.',
  CLINICAL_SUBJECT_UNAVAILABLE: 'Le dossier de ce patient est momentanément indisponible.',
  FORBIDDEN: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
  ACCESS_DENIED: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
  RESOURCE_NOT_FOUND: 'Cet élément est introuvable.',
  TOO_MANY_REQUESTS: 'Trop de demandes. Patientez quelques secondes.',
  VALIDATION_ERROR: 'Certains champs sont à corriger.',
  VALIDATION_FAILED: 'Certains champs sont à corriger.',
  NETWORK: 'Connexion impossible. Vérifiez votre connexion internet.',
};

export function consultationErrorMessage(error: Pick<AppHttpError, 'code' | 'status'> | string | null): string {
  if (error === null) return GENERIC_ERROR_MESSAGE;
  if (typeof error === 'string') return CODE_MESSAGES[error] ?? GENERIC_ERROR_MESSAGE;
  if (error.code !== null && CODE_MESSAGES[error.code] !== undefined) return CODE_MESSAGES[error.code];
  if (error.status === 0) return CODE_MESSAGES['NETWORK'];
  return GENERIC_ERROR_MESSAGE;
}

export function isVersionConflict(code: string | null): boolean {
  return code === 'CLINICAL_RECORD_VERSION_CONFLICT' || code === 'PRESCRIPTION_VERSION_CONFLICT' ||
    code === 'CLINICAL_ORDER_VERSION_CONFLICT' || code === 'ARTIFACT_VERSION_CONFLICT' ||
    code === 'CONSULTATION_VERSION_CONFLICT';
}

/** Section of the page that fixes each readiness `missing[]` code. */
export type ChecklistTarget = 'motif' | 'diagnostic' | 'traitement' | 'suivi' | 'examens' | 'documents' | 'dossier';

export interface ReadinessItem {
  readonly label: string;
  readonly target: ChecklistTarget;
}

const READINESS: Readonly<Record<string, ReadinessItem>> = {
  CLINICAL_RECORD_MISSING: { label: 'Motif de consultation', target: 'motif' },
  CHIEF_COMPLAINT_MISSING: { label: 'Motif de consultation', target: 'motif' },
  DIAGNOSIS: { label: 'Diagnostic', target: 'diagnostic' },
  MEDICATION_DECISION: { label: 'Décision de traitement', target: 'traitement' },
  PRESCRIPTION_NOT_FINALIZED: { label: 'Ordonnance à signer', target: 'traitement' },
  PRESCRIPTION_CONTRADICTS_DECISION: { label: 'Ordonnance différente de la décision de traitement', target: 'traitement' },
  FOLLOW_UP_DECISION: { label: 'Suivi', target: 'suivi' },
  ORDER_NOT_FINALIZED: { label: 'Examens à valider', target: 'examens' },
  ARTIFACT_NOT_FINALIZED: { label: 'Documents à signer', target: 'documents' },
  MEDICAL_SUMMARY_UPDATE_NOT_ALLOWED: { label: 'Mise à jour du dossier médical non autorisée', target: 'dossier' },
};

export function readinessItem(code: string): ReadinessItem {
  return READINESS[code] ?? { label: 'Un élément est à vérifier', target: 'motif' };
}
