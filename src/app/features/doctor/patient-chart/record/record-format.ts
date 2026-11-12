import { DOSE_UNIT_LABELS, ROUTE_LABELS } from '../../consultation/model/consultation-rules';
import type {
  RecordConsultationDocument,
  RecordDose,
  RecordDuration,
  RecordMedication,
  RecordPrescriptionLine,
} from './patient-record.models';

/** Today in Tunisia, `yyyy-MM-dd`. */
export function tunisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Actuels = no end date, or an end date today or later (Africa/Tunis). Anciens = ended. */
export function medicationState(endsAt: string | null, today: string): 'current' | 'past' {
  return endsAt === null || endsAt >= today ? 'current' : 'past';
}

const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  return (DOSE_UNIT_LABELS as Record<string, string>)[unit.toUpperCase()] ?? unit;
}

/** « Voie orale » (tag, sentence case); an unknown v2 route stays as written. */
export function routeLabel(route: string | null | undefined): string {
  if (!route) return '';
  const label = (ROUTE_LABELS as Record<string, string>)[route.toUpperCase()];
  return label ? `Voie ${label}` : route;
}

/** « 500 mg », « 2 comprimés » (French plural for the countable units). */
export function doseLabel(dose: RecordDose | null): string {
  if (!dose) return '';
  const unit = unitLabel(dose.unit);
  const countable = ['comprimé', 'gélule', 'goutte', 'sachet', 'bouffée', 'application'];
  const plural = dose.amount >= 2 && countable.includes(unit) ? `${unit}s` : unit;
  return `${NUMBER.format(dose.amount)} ${plural}`.trim();
}

const DURATION_UNITS: Readonly<Record<string, readonly [string, string]>> = {
  DAY: ['jour', 'jours'],
  WEEK: ['semaine', 'semaines'],
  MONTH: ['mois', 'mois'],
};

/** « 7 jours », « 1 semaine », or « Au long cours ». */
export function durationLabel(duration: RecordDuration | null, longTerm: boolean): string {
  if (longTerm) return 'Au long cours';
  if (!duration) return '';
  const [one, many] = DURATION_UNITS[duration.unit] ?? ['', ''];
  return `${duration.value} ${duration.value > 1 ? many : one}`.trim();
}

function frequency(timesPerDay: number | null, text: string | null): string {
  if (timesPerDay) return `${timesPerDay}× par jour`;
  return text ?? '';
}

type MedicationFacts = Pick<RecordPrescriptionLine, 'dose' | 'route' | 'timesPerDay' | 'frequencyText' | 'duration' | 'longTerm'>;

/**
 * One tag per structured value (rule 5: never a « · »-joined sentence):
 * dose + unité, voie, N× par jour, durée or « Au long cours ».
 */
export function medicationTags(medication: MedicationFacts): readonly string[] {
  return [
    doseLabel(medication.dose),
    routeLabel(medication.route),
    frequency(medication.timesPerDay, medication.frequencyText),
    durationLabel(medication.duration, medication.longTerm),
  ].filter((value) => value !== '');
}

const TUNIS = 'Africa/Tunis';

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tunisFormat(value: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('fr-FR', { timeZone: TUNIS, ...options }).format(date) : '';
}

/** « 16 nov. » (the year is added when it is not the current one: « 16 nov. 2025 »). */
export function shortDay(value: string | null | undefined, today: string = tunisToday()): string {
  const year = tunisFormat(value, { year: 'numeric' });
  return year === today.slice(0, 4)
    ? tunisFormat(value, { day: 'numeric', month: 'short' })
    : tunisFormat(value, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** « jusqu’au 16 nov. » for a medication with an end date. */
export function untilLabel(endsAt: string | null, today: string = tunisToday()): string {
  return endsAt ? `jusqu’au ${shortDay(endsAt, today)}` : '';
}

/** « jeu. 13 nov. 2026 » */
export function weekdayDate(value: string | null | undefined): string {
  return tunisFormat(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** « 13 nov. 2026 » */
export function mediumDate(value: string | null | undefined): string {
  return tunisFormat(value, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** « 09:05 » in Tunis time. */
export function tunisTime(value: string | null | undefined): string {
  return tunisFormat(value, { hour: '2-digit', minute: '2-digit' });
}

/** Current consultation strip: « Aujourd’hui · commencée à 09:05 » (or the date when not today). */
export function currentConsultationLine(start: string | null, now: Date = new Date()): string {
  const date = toDate(start);
  if (!date) return 'Aujourd’hui';
  const day = tunisToday(date) === tunisToday(now) ? 'Aujourd’hui' : mediumDate(start);
  const time = tunisTime(start);
  return time ? `${day} · commencée à ${time}` : day;
}

export function diagnosisStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED': return 'Confirmé';
    case 'PROVISIONAL': return 'Provisoire';
    case 'RULED_OUT': return 'Écarté';
    default: return '';
  }
}

export function orderCategoryLabel(category: string): string {
  switch (category) {
    case 'LAB': return 'Analyse';
    case 'IMAGING': return 'Imagerie';
    case 'REFERRAL': return 'Orientation';
    default: return 'Demande';
  }
}

export function followUpLabel(followUp: { decision: string | null; date: string | null } | null | undefined): string {
  switch (followUp?.decision) {
    case 'NO_FOLLOW_UP': return 'Aucun suivi';
    case 'FOLLOW_UP_AS_NEEDED': return 'Si besoin';
    case 'FOLLOW_UP_AFTER_RESULTS': return 'Après les résultats';
    case 'FOLLOW_UP_IN_PERIOD': return followUp.date ? `Contrôle le ${weekdayDate(followUp.date)}` : 'Contrôle prévu';
    default: return 'Non renseigné';
  }
}

function documentTitle(type: string): string {
  switch (type) {
    case 'PRESCRIPTION': return 'Ordonnance';
    case 'SICK_LEAVE_CERTIFICATE': return 'Arrêt de travail';
    case 'MEDICAL_CERTIFICATE': return 'Certificat médical';
    case 'LAB_ORDER': return 'Demande d’analyses';
    case 'IMAGING_ORDER': return 'Demande d’imagerie';
    default: return 'Document';
  }
}

/** Inclusive number of days between two `yyyy-MM-dd` dates. */
export function inclusiveDays(start: string, end: string): number {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
}

/** « 11 → 12 nov. 2026 · 2 jours » (month and year written once when shared). */
export function periodLabel(start: string | null, end: string | null): string {
  if (!start || !end) return start ? mediumDate(start) : '';
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth
    ? tunisFormat(start, { day: 'numeric' })
    : sameYear ? tunisFormat(start, { day: 'numeric', month: 'short' }) : mediumDate(start);
  const days = inclusiveDays(start, end);
  return `${from} → ${mediumDate(end)} · ${days} jour${days > 1 ? 's' : ''}`;
}

export type DocumentTone = 'care' | 'history' | 'allergy';

export interface DocumentCard {
  readonly document: RecordConsultationDocument;
  readonly title: string;
  readonly subtitle: string;
  readonly tone: DocumentTone;
}

/**
 * The « Documents générés » file cards: ordonnance (primary, « 2 médicaments »), arrêt de travail
 * (violet, the period), certificat (amber, the consultation date). Never two identical titles
 * (« (2) » on a repeat).
 */
export function documentCards(
  documents: readonly RecordConsultationDocument[],
  context: { readonly date: string | null; readonly medicationCount: number },
): readonly DocumentCard[] {
  const seen = new Map<string, number>();
  return documents.map((document) => {
    const base = documentTitle(document.type);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const title = count === 1 ? base : `${base} (${count})`;
    switch (document.type) {
      case 'PRESCRIPTION':
        return {
          document, title, tone: 'care',
          subtitle: context.medicationCount > 0
            ? `${context.medicationCount} médicament${context.medicationCount > 1 ? 's' : ''}`
            : mediumDate(context.date),
        };
      case 'SICK_LEAVE_CERTIFICATE':
        return { document, title, tone: 'history', subtitle: periodLabel(document.startDate, document.endDate) || mediumDate(context.date) };
      case 'MEDICAL_CERTIFICATE':
        return { document, title, tone: 'allergy', subtitle: mediumDate(context.date) };
      default:
        return { document, title, tone: 'care', subtitle: mediumDate(context.date) };
    }
  });
}

/** G-1 D5: shown with the download when the chosen template could not be used. */
export const TEMPLATE_FALLBACK_NOTICE = 'Document généré sur le modèle standard.';

export function templateFallbackNotice(document: RecordConsultationDocument): string | null {
  return document.templateFallback === true && document.downloadable ? TEMPLATE_FALLBACK_NOTICE : null;
}

/** IMC from cm and kg, one decimal; null without both. */
export function bodyMassIndex(heightCm: number | null, weightKg: number | null): string | null {
  if (!heightCm || !weightKg) return null;
  const meters = heightCm / 100;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(weightKg / (meters * meters));
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** Lower-case, accent-free text for the history search. */
export function searchKey(value: string | null | undefined): string {
  return (value ?? '').toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Saves a downloaded file (blob URL revoked right after). */
export function saveBlob(blob: Blob, filename: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
