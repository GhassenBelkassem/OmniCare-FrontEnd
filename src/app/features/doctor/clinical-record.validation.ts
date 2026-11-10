import type { ClinicalRecordPayload, FollowUpDecision } from './clinical-record.models';

const codedValue = /^[A-Za-z0-9._:-]{1,64}$/;
const diagnosisSystems = new Set(['ICD10', 'ICD-10', 'SNOMED', 'SNOMED-CT', 'SNOMED_CT', 'LOCAL']);
const diagnosisStatuses = new Set(['PROVISIONAL', 'CONFIRMED', 'RULED_OUT']);

export function validateClinicalRecord(
  value: ClinicalRecordPayload,
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};

  value.clinicalFindings.forEach((finding, index) => {
    if (!codedValue.test(finding.type.trim())) {
      errors[`clinicalRecord.clinicalFindings.${index}.type`] =
        'Utilisez uniquement des lettres, chiffres, points, tirets, deux-points ou tirets bas.';
    }
    if (finding.description.trim().length === 0) {
      errors[`clinicalRecord.clinicalFindings.${index}.description`] =
        'La description du constat est obligatoire.';
    }
  });

  value.diagnoses.forEach((diagnosis, index) => {
    const prefix = `clinicalRecord.diagnoses.${index}`;
    if (!diagnosisSystems.has(diagnosis.system.trim().toUpperCase())) {
      errors[`${prefix}.system`] = 'Sélectionnez ICD-10, SNOMED ou LOCAL.';
    }
    const localFreeText = diagnosis.system.trim().toUpperCase() === 'LOCAL'
      && diagnosis.code.trim().length === 0;
    if (!localFreeText && !codedValue.test(diagnosis.code.trim())) {
      errors[`${prefix}.code`] =
        'Utilisez un code composé de lettres, chiffres, points, tirets, deux-points ou tirets bas.';
    }
    if (diagnosis.label.trim().length === 0) {
      errors[`${prefix}.label`] = 'Le libellé du diagnostic est obligatoire.';
    }
    if (!diagnosisStatuses.has(diagnosis.status.trim().toUpperCase())) {
      errors[`${prefix}.status`] = 'Sélectionnez un statut de diagnostic valide.';
    }
  });

  validateFollowUp(value.followUp, errors);
  if (!hasClinicalContent(value)) {
    errors['clinicalRecord'] =
      'Ajoutez un contenu clinique ou sélectionnez une décision médicamenteuse.';
  }
  return errors;
}

function validateFollowUp(
  followUp: ClinicalRecordPayload['followUp'],
  errors: Record<string, string>,
): void {
  const hasDate = followUp.recommendedAt !== null && followUp.recommendedAt.trim().length > 0;
  if (hasDate && !isIsoDate(followUp.recommendedAt!)) {
    errors['clinicalRecord.followUp.recommendedAt'] = 'Saisissez une date de suivi valide.';
  }
  const decision: FollowUpDecision | null = followUp.decision;
  if (decision === null) {
    if (followUp.required && !hasDate) {
      errors['clinicalRecord.followUp.decision'] = 'Sélectionnez une décision de suivi.';
    }
    return;
  }
  if (decision === 'NO_FOLLOW_UP' && (followUp.required || hasDate)) {
    errors['clinicalRecord.followUp.decision'] = 'L’absence de suivi ne peut pas contenir de date.';
  } else if (decision === 'FOLLOW_UP_IN_PERIOD' && (!followUp.required || !hasDate)) {
    errors['clinicalRecord.followUp.recommendedAt'] = 'Sélectionnez la date de suivi recommandée.';
  } else if (
    (decision === 'FOLLOW_UP_AFTER_RESULTS' || decision === 'FOLLOW_UP_AS_NEEDED') &&
    (!followUp.required || hasDate)
  ) {
    errors['clinicalRecord.followUp.decision'] =
      'Cette décision de suivi ne doit pas contenir de date fixe.';
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasClinicalContent(value: ClinicalRecordPayload): boolean {
  return (
    present(value.chiefComplaint) ||
    present(value.history.presentIllness) ||
    value.clinicalFindings.length > 0 ||
    value.diagnoses.length > 0 ||
    present(value.assessment) ||
    value.treatmentPlan.length > 0 ||
    value.medicationDecision !== null
  );
}

function present(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}
