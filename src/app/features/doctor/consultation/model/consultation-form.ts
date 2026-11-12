import type {
  ClinicalRecordPayload,
  FollowUpDecision,
  MedicalSummaryList,
  MedicalSummaryUpdate,
  SummaryStatus,
} from '../../clinical-record.models';
import type { MedicationDecision, PrescriptionContent, PrescriptionMedication } from '../../prescription.models';
import {
  DOSE_MAX,
  QUANTITY_MAX,
  TEXT_LIMITS,
  TIMES_PER_DAY_MAX,
  TIMES_PER_DAY_MIN,
  charCount,
  isDoseUnit,
  isDurationUnit,
  isRoute,
  normalizeDoseUnit,
  normalizeRoute,
  type AdministrationRoute,
  type ConsultationRules,
  type DoseUnit,
  type DurationUnit,
  type OrderCategory,
} from './consultation-rules';

/** Field errors keyed by the server's dotted path (or a row-scoped key for orders and documents). */
export type FieldErrors = Readonly<Record<string, string>>;

export type FollowUpChoice = 'NO_FOLLOW_UP' | 'FOLLOW_UP_AS_NEEDED' | 'FOLLOW_UP_IN_PERIOD';
export type DiagnosisStatus = 'PROVISIONAL' | 'CONFIRMED';

export interface SummaryListForm {
  readonly status: SummaryStatus;
  readonly items: readonly string[];
}

export interface MedicalSummaryForm {
  readonly allergies: SummaryListForm;
  readonly conditions: SummaryListForm;
  /** `UNKNOWN` = « Non renseigné ». */
  readonly bloodType: string;
}

/** What the single page edits in the note. Every other note field is carried over untouched. */
export interface NoteForm {
  readonly chiefComplaint: string;
  readonly presentIllness: string;
  readonly examination: string;
  readonly diagnosis: string;
  readonly diagnosisStatus: DiagnosisStatus;
  readonly medicationDecision: MedicationDecision | null;
  readonly followUp: FollowUpChoice | null;
  readonly followUpDate: string | null;
  readonly summary: MedicalSummaryForm;
}

export interface MedicationLineForm {
  readonly itemId: string;
  readonly replacesItemId: string | null;
  readonly medicationCode: string | null;
  readonly strength: string | null;
  readonly name: string;
  /** Kept as typed (decimal comma accepted). */
  readonly dose: string;
  readonly unit: DoseUnit | null;
  readonly route: AdministrationRoute | null;
  readonly timesPerDay: string;
  readonly frequencyText: string | null;
  readonly durationValue: string;
  readonly durationUnit: DurationUnit;
  readonly longTerm: boolean;
  readonly quantity: string;
  readonly instructions: string;
}

export interface OrderRowForm {
  readonly category: OrderCategory;
  readonly target: string;
}

export type CertificateType = 'MEDICAL_CERTIFICATE' | 'SICK_LEAVE_CERTIFICATE';

export interface CertificateForm {
  readonly statement: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

export const UNKNOWN_SUMMARY: MedicalSummaryForm = {
  allergies: { status: 'UNKNOWN', items: [] },
  conditions: { status: 'UNKNOWN', items: [] },
  bloodType: 'UNKNOWN',
};

export const EMPTY_NOTE_FORM: NoteForm = {
  chiefComplaint: '',
  presentIllness: '',
  examination: '',
  diagnosis: '',
  diagnosisStatus: 'PROVISIONAL',
  medicationDecision: null,
  followUp: null,
  followUpDate: null,
  summary: UNKNOWN_SUMMARY,
};

export const EMPTY_CERTIFICATE: CertificateForm = { statement: '', startDate: null, endDate: null };

const EXAMINATION = 'EXAMINATION';

// ---------------------------------------------------------------------------------------------
// Note ↔ payload
// ---------------------------------------------------------------------------------------------

export function noteFormFromPayload(record: ClinicalRecordPayload, summary: MedicalSummaryForm): NoteForm {
  const examination = record.clinicalFindings.find((finding) => finding.type === EXAMINATION);
  const diagnosis = record.diagnoses[0];
  const decision = record.followUp.decision;
  return {
    chiefComplaint: record.chiefComplaint ?? '',
    presentIllness: record.history.presentIllness ?? '',
    examination: examination?.description ?? '',
    diagnosis: diagnosis?.label ?? '',
    diagnosisStatus: diagnosis?.status === 'CONFIRMED' ? 'CONFIRMED' : 'PROVISIONAL',
    medicationDecision: record.medicationDecision,
    followUp: decision === 'NO_FOLLOW_UP' || decision === 'FOLLOW_UP_AS_NEEDED' || decision === 'FOLLOW_UP_IN_PERIOD'
      ? decision
      : null,
    followUpDate: decision === 'FOLLOW_UP_IN_PERIOD' ? record.followUp.recommendedAt : null,
    summary: summaryFormFromUpdate(record.medicalSummaryUpdate ?? null, summary),
  };
}

/** The saved draft's update (if any) wins over the patient's current summary, part by part. */
export function summaryFormFromUpdate(
  update: MedicalSummaryUpdate | null,
  current: MedicalSummaryForm,
): MedicalSummaryForm {
  if (update === null) return current;
  return {
    allergies: update.allergies ? listForm(update.allergies) : current.allergies,
    conditions: update.conditions ? listForm(update.conditions) : current.conditions,
    bloodType: update.bloodType ?? current.bloodType,
  };
}

function listForm(value: MedicalSummaryList): SummaryListForm {
  return { status: value.status, items: [...value.items] };
}

/**
 * Builds the note payload. `base` keeps every field the page does not edit. The summary update
 * carries only the parts that differ from the patient's current summary (null part = unchanged)
 * and is sent only for the custodian (`EXTERNAL_OWNER`).
 */
export function notePayload(
  form: NoteForm,
  base: ClinicalRecordPayload,
  summaryBaseline: MedicalSummaryForm | null,
): ClinicalRecordPayload {
  const examination = blankToNull(form.examination);
  const otherFindings = base.clinicalFindings.filter((finding) => finding.type !== EXAMINATION);
  const label = blankToNull(form.diagnosis);
  const otherDiagnoses = base.diagnoses.slice(1);
  const followUp = followUpPayload(form);
  const payload: ClinicalRecordPayload = {
    ...base,
    chiefComplaint: blankToNull(form.chiefComplaint),
    history: { ...base.history, presentIllness: blankToNull(form.presentIllness) },
    clinicalFindings: examination === null
      ? otherFindings
      : [{ type: EXAMINATION, description: examination }, ...otherFindings],
    diagnoses: label === null
      ? otherDiagnoses
      : [{ system: base.diagnoses[0]?.system || 'LOCAL', code: base.diagnoses[0]?.code ?? '', label, status: form.diagnosisStatus }, ...otherDiagnoses],
    followUp,
    medicationDecision: form.medicationDecision,
  };
  // Without the patient's current summary (not loaded, or not the custodian), the saved update
  // is carried over unchanged rather than wiped.
  const update = summaryBaseline === null
    ? (base.medicalSummaryUpdate ?? null)
    : summaryUpdate(form.summary, summaryBaseline);
  return { ...payload, medicalSummaryUpdate: update };
}

function followUpPayload(form: NoteForm): ClinicalRecordPayload['followUp'] {
  switch (form.followUp) {
    case 'NO_FOLLOW_UP':
      return { required: false, recommendedAt: null, decision: 'NO_FOLLOW_UP' };
    case 'FOLLOW_UP_AS_NEEDED':
      return { required: true, recommendedAt: null, decision: 'FOLLOW_UP_AS_NEEDED' };
    case 'FOLLOW_UP_IN_PERIOD':
      return { required: true, recommendedAt: form.followUpDate, decision: 'FOLLOW_UP_IN_PERIOD' };
    default:
      return { required: false, recommendedAt: null, decision: null };
  }
}

export function summaryUpdate(form: MedicalSummaryForm, baseline: MedicalSummaryForm): MedicalSummaryUpdate | null {
  const allergies = sameList(form.allergies, baseline.allergies) ? null : cleanList(form.allergies);
  const conditions = sameList(form.conditions, baseline.conditions) ? null : cleanList(form.conditions);
  const bloodType = form.bloodType === baseline.bloodType ? null : form.bloodType;
  if (allergies === null && conditions === null && bloodType === null) return null;
  return { bloodType, allergies, conditions };
}

function cleanList(value: SummaryListForm): MedicalSummaryList {
  return { status: value.status, items: value.status === 'LIST' ? value.items.map((item) => item.trim()) : [] };
}

function sameList(a: SummaryListForm, b: SummaryListForm): boolean {
  if (a.status !== b.status) return false;
  if (a.status !== 'LIST') return true;
  return a.items.length === b.items.length && a.items.every((item, index) => item.trim() === b.items[index]?.trim());
}

/** Mirrors the server's "content" rule: an empty note is never sent (400 NO_CONTENT). */
export function isEmptyNote(payload: ClinicalRecordPayload): boolean {
  return (
    payload.chiefComplaint === null &&
    payload.history.presentIllness === null &&
    payload.history.relevantMedicalHistory === null &&
    payload.history.relevantDentalHistory === null &&
    payload.clinicalFindings.length === 0 &&
    payload.diagnoses.length === 0 &&
    payload.assessment === null &&
    payload.treatmentPlan.length === 0 &&
    payload.notes === null &&
    payload.medicationDecision === null &&
    payload.followUp.decision === null &&
    (payload.medicalSummaryUpdate ?? null) === null
  );
}

// ---------------------------------------------------------------------------------------------
// Prescription ↔ payload
// ---------------------------------------------------------------------------------------------

export function newMedicationLine(itemId: string): MedicationLineForm {
  return {
    itemId,
    replacesItemId: null,
    medicationCode: null,
    strength: null,
    name: '',
    dose: '',
    unit: null,
    route: null,
    timesPerDay: '',
    frequencyText: null,
    durationValue: '',
    durationUnit: 'DAY',
    longTerm: false,
    quantity: '',
    instructions: '',
  };
}

export function medicationLinesFromContent(content: PrescriptionContent | null): MedicationLineForm[] {
  return (content?.medications ?? []).map((medication) => ({
    itemId: medication.itemId,
    replacesItemId: medication.replacesItemId,
    medicationCode: medication.medicationCode,
    strength: medication.strength,
    name: medication.name ?? '',
    dose: medication.dose?.amount === null || medication.dose?.amount === undefined
      ? ''
      : String(medication.dose.amount).replace('.', ','),
    unit: normalizeDoseUnit(medication.dose?.unit),
    route: normalizeRoute(medication.route),
    timesPerDay: medication.frequency?.timesPerDay ? String(medication.frequency.timesPerDay) : '',
    frequencyText: medication.frequency?.text ?? null,
    durationValue: medication.duration ? String(medication.duration.value) : '',
    durationUnit: isDurationUnit(medication.duration?.unit) ? medication.duration!.unit : 'DAY',
    longTerm: medication.longTerm === true,
    quantity: medication.quantity === null || medication.quantity === undefined ? '' : String(medication.quantity),
    instructions: medication.instructions ?? '',
  }));
}

export function prescriptionPayload(lines: readonly MedicationLineForm[], base: PrescriptionContent | null): PrescriptionContent {
  return {
    medications: lines.map((line): PrescriptionMedication => ({
      itemId: line.itemId,
      replacesItemId: line.replacesItemId,
      medicationCode: line.medicationCode,
      name: line.name.trim(),
      strength: line.strength,
      dose: { amount: parseDecimal(line.dose) ?? 0, unit: line.unit ?? '' },
      route: line.route ?? '',
      frequency: { timesPerDay: parseInteger(line.timesPerDay), text: line.frequencyText },
      duration: line.longTerm || line.durationValue.trim() === ''
        ? null
        : { value: parseInteger(line.durationValue) ?? 0, unit: line.durationUnit },
      quantity: parseInteger(line.quantity),
      instructions: blankToNull(line.instructions),
      longTerm: line.longTerm ? true : null,
    })),
    generalInstructions: base?.generalInstructions ?? null,
  };
}

/** A line nobody typed into: not sent, not blocking. */
export function isBlankLine(line: MedicationLineForm): boolean {
  return (
    line.name.trim() === '' && line.dose.trim() === '' && line.unit === null && line.route === null &&
    line.timesPerDay.trim() === '' && line.durationValue.trim() === '' && line.quantity.trim() === '' &&
    line.instructions.trim() === ''
  );
}

// ---------------------------------------------------------------------------------------------
// Validation (client mirror of the Hard rules). Messages are French; never server text.
// ---------------------------------------------------------------------------------------------

export const NOTE_PATHS = {
  chiefComplaint: 'clinicalRecord.chiefComplaint',
  presentIllness: 'clinicalRecord.history.presentIllness',
  examination: 'clinicalRecord.clinicalFindings.0.description',
  diagnosis: 'clinicalRecord.diagnoses.0.label',
  diagnosisStatus: 'clinicalRecord.diagnoses.0.status',
  medicationDecision: 'clinicalRecord.medicationDecision',
  followUp: 'clinicalRecord.followUp.decision',
  followUpDate: 'clinicalRecord.followUp.recommendedAt',
  allergies: 'clinicalRecord.medicalSummaryUpdate.allergies.items',
  conditions: 'clinicalRecord.medicalSummaryUpdate.conditions.items',
  bloodType: 'clinicalRecord.medicalSummaryUpdate.bloodType',
} as const;

export const MESSAGES = {
  chiefComplaintRequired: 'Indiquez le motif de consultation.',
  diagnosisRequired: 'Indiquez le diagnostic.',
  medicationDecisionRequired: 'Indiquez si un traitement est prescrit.',
  followUpRequired: 'Choisissez le suivi recommandé.',
  followUpDateRequired: 'Choisissez une date de suivi.',
  followUpDatePast: 'Choisissez une date de suivi à partir d’aujourd’hui.',
  followUpDateInvalid: 'Date de suivi non valide.',
  tooLong: (max: number) => `Texte trop long (${formatNumber(max)} caractères maximum).`,
  allergiesItems: 'Choisissez « Aucune connue » ou ajoutez au moins une allergie.',
  conditionsItems: 'Choisissez « Aucun connu » ou ajoutez au moins un antécédent.',
  summaryTooMany: (max: number) => `${max} éléments maximum.`,
  summaryItemTooLong: `Chaque élément doit faire au plus ${TEXT_LIMITS.summaryItem} caractères.`,
  bloodType: 'Choisissez un groupe sanguin valide.',
  medicationsRequired: 'Ajoutez au moins un médicament.',
  medicationsTooMany: (max: number) => `Une ordonnance peut contenir au plus ${max} médicaments.`,
  medicationName: 'Choisissez ou saisissez un médicament.',
  dose: 'Indiquez une dose supérieure à 0.',
  doseTooHigh: 'Dose trop élevée.',
  unit: 'Choisissez une unité.',
  route: 'Choisissez une voie d’administration.',
  frequency: 'Indiquez la fréquence des prises.',
  timesPerDay: `Entre ${TIMES_PER_DAY_MIN} et ${TIMES_PER_DAY_MAX} prises par jour.`,
  durationRequired: 'Indiquez la durée du traitement.',
  durationUnit: 'Choisissez une unité de durée.',
  quantity: 'Indiquez une quantité d’au moins 1.',
  orderTarget: 'Précisez l’examen, l’imagerie ou la spécialité demandée.',
  orderTargetShort: `Texte trop court (${TEXT_LIMITS.orderTargetMin} caractères minimum).`,
  statement: 'Rédigez le contenu du certificat.',
  startDate: 'Indiquez la date de début.',
  endDate: 'Indiquez la date de fin.',
  dateOrder: 'La date de fin doit suivre la date de début.',
  sickLeaveTooLong: (max: number) => `Un arrêt de travail ne peut pas dépasser ${max} jours.`,
  invalidDate: 'Date non valide.',
} as const;

export function durationMessage(unit: DurationUnit, rules: ConsultationRules): string {
  const max = rules.durationMax[unit];
  const label = unit === 'DAY' ? 'jours' : unit === 'WEEK' ? 'semaines' : 'mois';
  return `Durée entre 1 et ${max} ${label}.`;
}

/** Rules that block saving the note (lengths, dates, summary coherence). Never the finish fields. */
export function validateNoteForSave(form: NoteForm, today: string, includeSummary: boolean): FieldErrors {
  const errors: Record<string, string> = {};
  tooLong(errors, NOTE_PATHS.chiefComplaint, form.chiefComplaint, TEXT_LIMITS.chiefComplaint);
  tooLong(errors, NOTE_PATHS.presentIllness, form.presentIllness, TEXT_LIMITS.presentIllness);
  tooLong(errors, NOTE_PATHS.examination, form.examination, TEXT_LIMITS.examination);
  tooLong(errors, NOTE_PATHS.diagnosis, form.diagnosis, TEXT_LIMITS.diagnosis);
  if (form.followUp === 'FOLLOW_UP_IN_PERIOD' && form.followUpDate) {
    if (!isIsoDate(form.followUpDate)) errors[NOTE_PATHS.followUpDate] = MESSAGES.followUpDateInvalid;
    else if (form.followUpDate < today) errors[NOTE_PATHS.followUpDate] = MESSAGES.followUpDatePast;
  }
  if (includeSummary) {
    validateSummaryList(errors, NOTE_PATHS.allergies, form.summary.allergies, MESSAGES.allergiesItems);
    validateSummaryList(errors, NOTE_PATHS.conditions, form.summary.conditions, MESSAGES.conditionsItems);
    if (form.summary.bloodType !== 'UNKNOWN' && !/^(A|B|AB|O)[+-]$/.test(form.summary.bloodType)) {
      errors[NOTE_PATHS.bloodType] = MESSAGES.bloodType;
    }
  }
  return errors;
}

function validateSummaryList(
  errors: Record<string, string>,
  path: string,
  list: SummaryListForm,
  itemsRequired: string,
): void {
  if (list.status !== 'LIST') return;
  if (list.items.length === 0) {
    errors[path] = itemsRequired;
    return;
  }
  if (list.items.length > TEXT_LIMITS.summaryItems) errors[path] = MESSAGES.summaryTooMany(TEXT_LIMITS.summaryItems);
  list.items.forEach((item, index) => {
    if (charCount(item.trim()) > TEXT_LIMITS.summaryItem) errors[`${path}.${index}`] = MESSAGES.summaryItemTooLong;
  });
}

/** The four items required to finish (motif, diagnostic, traitement, suivi), on the note side. */
export function validateNoteForFinish(form: NoteForm): FieldErrors {
  const errors: Record<string, string> = {};
  if (form.chiefComplaint.trim() === '') errors[NOTE_PATHS.chiefComplaint] = MESSAGES.chiefComplaintRequired;
  if (form.diagnosis.trim() === '') errors[NOTE_PATHS.diagnosis] = MESSAGES.diagnosisRequired;
  if (form.medicationDecision === null) errors[NOTE_PATHS.medicationDecision] = MESSAGES.medicationDecisionRequired;
  if (form.followUp === null) errors[NOTE_PATHS.followUp] = MESSAGES.followUpRequired;
  else if (form.followUp === 'FOLLOW_UP_IN_PERIOD' && !form.followUpDate) {
    errors[NOTE_PATHS.followUpDate] = MESSAGES.followUpDateRequired;
  }
  return errors;
}

export function medicationPath(index: number, field = ''): string {
  return `prescription.medications.${index}${field ? `.${field}` : ''}`;
}

/** Every v3 Hard rule. A prescription is sent only when all its lines pass. */
export function validatePrescription(lines: readonly MedicationLineForm[], rules: ConsultationRules): FieldErrors {
  const errors: Record<string, string> = {};
  if (lines.length > rules.maxMedications) {
    errors['prescription.medications'] = MESSAGES.medicationsTooMany(rules.maxMedications);
  }
  lines.forEach((line, index) => Object.assign(errors, validateMedicationLine(line, index, rules)));
  return errors;
}

export function validateMedicationLine(line: MedicationLineForm, index: number, rules: ConsultationRules): FieldErrors {
  const errors: Record<string, string> = {};
  const name = line.name.trim();
  if (name === '' && !line.medicationCode) errors[medicationPath(index, 'name')] = MESSAGES.medicationName;
  else if (charCount(name) > TEXT_LIMITS.medicationName) errors[medicationPath(index, 'name')] = MESSAGES.tooLong(TEXT_LIMITS.medicationName);
  const dose = parseDecimal(line.dose);
  if (dose === null || dose <= 0) errors[medicationPath(index, 'dose.amount')] = MESSAGES.dose;
  else if (dose > DOSE_MAX) errors[medicationPath(index, 'dose.amount')] = MESSAGES.doseTooHigh;
  if (!isDoseUnit(line.unit)) errors[medicationPath(index, 'dose.unit')] = MESSAGES.unit;
  if (!isRoute(line.route)) errors[medicationPath(index, 'route')] = MESSAGES.route;
  if (line.timesPerDay.trim() === '' && !line.frequencyText) {
    errors[medicationPath(index, 'frequency')] = MESSAGES.frequency;
  } else if (line.timesPerDay.trim() !== '') {
    const times = parseInteger(line.timesPerDay);
    if (times === null || times < TIMES_PER_DAY_MIN || times > TIMES_PER_DAY_MAX) {
      errors[medicationPath(index, 'frequency.timesPerDay')] = MESSAGES.timesPerDay;
    }
  }
  if (!line.longTerm) {
    if (!isDurationUnit(line.durationUnit)) errors[medicationPath(index, 'duration.unit')] = MESSAGES.durationUnit;
    if (line.durationValue.trim() === '') {
      errors[medicationPath(index, 'duration')] = MESSAGES.durationRequired;
    } else if (isDurationUnit(line.durationUnit)) {
      const value = parseInteger(line.durationValue);
      if (value === null || value < 1 || value > rules.durationMax[line.durationUnit]) {
        errors[medicationPath(index, 'duration.value')] = durationMessage(line.durationUnit, rules);
      }
    }
  }
  if (line.quantity.trim() !== '') {
    const quantity = parseInteger(line.quantity);
    if (quantity === null || quantity < 1 || quantity > QUANTITY_MAX) errors[medicationPath(index, 'quantity')] = MESSAGES.quantity;
  }
  if (charCount(line.instructions.trim()) > TEXT_LIMITS.instructions) {
    errors[medicationPath(index, 'instructions')] = MESSAGES.tooLong(TEXT_LIMITS.instructions);
  }
  return errors;
}

/** Soft warning (never blocks): the same drug twice, compared case- and accent-insensitively. */
export function duplicateMedicationIndexes(lines: readonly MedicationLineForm[]): ReadonlySet<number> {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();
  lines.forEach((line, index) => {
    const key = normalizeName(line.name);
    if (key === '') return;
    if (seen.has(key)) duplicates.add(index);
    else seen.set(key, index);
  });
  return duplicates;
}

export function validateOrder(order: OrderRowForm): FieldErrors {
  const target = order.target.trim();
  if (target === '') return { target: MESSAGES.orderTarget };
  if (charCount(target) < TEXT_LIMITS.orderTargetMin) return { target: MESSAGES.orderTargetShort };
  if (charCount(target) > TEXT_LIMITS.orderTargetMax) return { target: MESSAGES.tooLong(TEXT_LIMITS.orderTargetMax) };
  return {};
}

export function validateCertificate(type: CertificateType, form: CertificateForm, rules: ConsultationRules): FieldErrors {
  const errors: Record<string, string> = {};
  const statement = form.statement.trim();
  if (statement === '') errors['statement'] = MESSAGES.statement;
  else if (charCount(statement) > TEXT_LIMITS.statement) errors['statement'] = MESSAGES.tooLong(TEXT_LIMITS.statement);
  if (type === 'SICK_LEAVE_CERTIFICATE') {
    if (!form.startDate) errors['startDate'] = MESSAGES.startDate;
    else if (!isIsoDate(form.startDate)) errors['startDate'] = MESSAGES.invalidDate;
    if (!form.endDate) errors['endDate'] = MESSAGES.endDate;
    else if (!isIsoDate(form.endDate)) errors['endDate'] = MESSAGES.invalidDate;
    const days = sickLeaveDays(form);
    if (days !== null && days < 1) errors['endDate'] = MESSAGES.dateOrder;
    else if (days !== null && days > rules.sickLeaveMaxDays) errors['endDate'] = MESSAGES.sickLeaveTooLong(rules.sickLeaveMaxDays);
  }
  return errors;
}

/** Inclusive number of days (start and end both count), or null while a date is missing. */
export function sickLeaveDays(form: Pick<CertificateForm, 'startDate' | 'endDate'>): number | null {
  if (!form.startDate || !form.endDate || !isIsoDate(form.startDate) || !isIsoDate(form.endDate)) return null;
  const start = Date.UTC(...ymd(form.startDate));
  const end = Date.UTC(...ymd(form.endDate));
  return Math.round((end - start) / 86_400_000) + 1;
}

export function certificatePayload(type: CertificateType, form: CertificateForm): Record<string, string> {
  return type === 'MEDICAL_CERTIFICATE'
    ? { statement: form.statement.trim() }
    : { statement: form.statement.trim(), startDate: form.startDate ?? '', endDate: form.endDate ?? '' };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

export function blankToNull(value: string | null | undefined): string | null {
  return value === null || value === undefined || value.trim() === '' ? null : value;
}

export function parseDecimal(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parseInteger(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,9}$/.test(text)) return null;
  return Number.parseInt(text, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** `yyyy-MM-dd` plus N days (calendar arithmetic, no time zone involved). */
export function addDays(value: string, days: number): string {
  const date = new Date(Date.UTC(...ymd(value)) + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function ymd(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month - 1, day];
}

function tooLong(errors: Record<string, string>, path: string, value: string, max: number): void {
  if (charCount(value.trim()) > max) errors[path] = MESSAGES.tooLong(max);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

/** Today in Tunisia, `yyyy-MM-dd`. */
export function todayInTunis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export type { FollowUpDecision };
