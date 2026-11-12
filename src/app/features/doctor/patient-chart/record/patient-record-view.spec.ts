import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../../app.icons';
import type { PatientChartAccessDto, PatientChartDto, PatientChartMedicalSummaryDto } from '../patient-chart-api.models';
import { PatientChartApiService } from '../patient-chart-api.service';
import { PatientRecordView } from './patient-record-view';
import type { RecordConsultationDetail, RecordConsultationItem, RecordConsultationPage } from './patient-record.models';

const CHART_ID = 'c0000000-0000-4000-8000-000000000001';
const CURRENT_ID = 'cur00000-0000-4000-8000-000000000002';
const DONE_ID = 'done0000-0000-4000-8000-000000000003';

const OWNER: PatientChartAccessDto = { mode: 'EXTERNAL_OWNER', clinical: true, editable: true, grantExpiresAt: null, verificationUnavailable: false };
const RESTRICTED: PatientChartAccessDto = { mode: 'OMNICARE_RESTRICTED', clinical: false, editable: false, grantExpiresAt: null, verificationUnavailable: false };

const ENGLISH = /(?<!\p{L})(save|required|invalid|error|loading|submit|cancel|draft|pending|failed|unavailable|null|undefined|true|false|completed|in_progress|prescription|certificate)(?!\p{L})/iu;
const JARGON = /(?<!\p{L})(MRS|version|référence|projection|canonique|idempotence|artefact|épisode|contexte de soins)(?!\p{L})/iu;
const RAW_CODE = /\b[A-Z]{2,}(?:_[A-Z]{2,})+\b/;

function chart(access: PatientChartAccessDto = OWNER): PatientChartDto {
  return {
    id: CHART_ID, patientType: access.mode === 'EXTERNAL_OWNER' ? 'EXTERNAL' : 'OMNICARE',
    identity: { firstName: 'Marwa', lastName: 'Mechergui', fullName: 'Marwa Mechergui', ageYears: 34, ageApproximate: false, sex: 'F', dateOfBirth: '1992-03-12', phone: '+216 20 123 456', email: null, address: null, practiceIdentifier: null },
    access, medicalRecord: { status: 'READY' }, schedulable: true, nextAppointment: null, startableAppointment: null, lastConsultation: null,
    counts: { consultations: 2, documents: 0, history: null },
  };
}

function summary(patch: Partial<PatientChartMedicalSummaryDto> = {}): PatientChartMedicalSummaryDto {
  return {
    editable: false, version: 2, essentialInformationShared: true, treatmentsShared: true, bloodType: 'O+',
    allergies: [], conditions: ['Asthme'], treatments: [], allergiesStatus: 'NONE_KNOWN', conditionsStatus: 'LIST', bodyMeasurements: null, ...patch,
  };
}

const ITEMS: RecordConsultationItem[] = [
  { id: CURRENT_ID, date: '2026-11-11T09:05:00Z', status: 'IN_PROGRESS', ownConsultation: true, doctor: { name: 'Dr Sami Ben Ali', specialty: 'Médecine générale' }, clinicalAvailable: false, reason: null, diagnosisSummary: null },
  { id: DONE_ID, date: '2026-11-10T10:00:00Z', status: 'COMPLETED', ownConsultation: true, doctor: { name: 'Dr Sami Ben Ali', specialty: 'Médecine générale' }, clinicalAvailable: true, reason: 'Fièvre et toux', diagnosisSummary: 'Angine' },
  { id: 'old00000-0000-4000-8000-000000000004', date: '2026-10-01T10:00:00Z', status: 'COMPLETED', ownConsultation: true, doctor: { name: 'Dr Sami Ben Ali', specialty: null }, clinicalAvailable: true, reason: 'Douleur lombaire', diagnosisSummary: 'Lombalgie' },
];

const DETAIL: RecordConsultationDetail = {
  id: DONE_ID, date: '2026-11-10T10:00:00Z', status: 'COMPLETED', doctor: { name: 'Dr Sami Ben Ali', specialty: 'Médecine générale' }, clinicalAvailable: true,
  chiefComplaint: 'Fièvre et toux', presentIllness: 'Depuis trois jours.', examination: 'Gorge rouge.', assessment: null, notes: null,
  diagnoses: [{ label: 'Angine', status: 'CONFIRMED' }, { label: 'Grippe', status: 'PROVISIONAL' }],
  medicationDecision: 'MEDICATION_PRESCRIBED',
  prescription: { signedAt: '2026-11-10T10:30:00Z', medications: [
    { name: 'Amoxicilline', strength: null, dose: { amount: 1, unit: 'G' }, route: 'ORAL', timesPerDay: 2, frequencyText: null, duration: { value: 1, unit: 'WEEK' }, longTerm: false, quantity: null, instructions: 'Après les repas' },
    { name: 'Ventoline', strength: null, dose: { amount: 2, unit: 'PUFF' }, route: 'INHALED', timesPerDay: 2, frequencyText: null, duration: null, longTerm: true, quantity: null, instructions: null },
  ] },
  orders: [{ category: 'LAB', target: 'NFS' }],
  followUp: { decision: 'FOLLOW_UP_IN_PERIOD', date: '2026-11-24' },
  documents: [
    { id: 'a1', type: 'PRESCRIPTION', startDate: null, endDate: null, downloadable: true },
    { id: 'a2', type: 'SICK_LEAVE_CERTIFICATE', startDate: '2026-11-10', endDate: '2026-11-12', downloadable: true },
    { id: 'a3', type: 'MEDICAL_CERTIFICATE', startDate: null, endDate: null, downloadable: true },
  ],
};

function page(items: RecordConsultationItem[], nextCursor: string | null = null, view: 'CLINICAL' | 'ADMINISTRATIVE' = 'CLINICAL'): RecordConsultationPage {
  return { view, items, nextCursor, total: 3 };
}

interface Setup {
  readonly fixture: ComponentFixture<PatientRecordView>;
  readonly api: Readonly<Record<
    'getMedicalSummary' | 'getMedications' | 'getConsultationPage' | 'getConsultationDetail' | 'getDocuments' | 'getHistory' | 'downloadArtifact',
    ReturnType<typeof vi.fn>
  >>;
  text(): string;
}

async function setup(options: { access?: PatientChartAccessDto; summary?: PatientChartMedicalSummaryDto; current?: string | null; page?: RecordConsultationPage; initialTab?: 'summary' | 'history' | 'documents' } = {}): Promise<Setup> {
  const access = options.access ?? OWNER;
  const api = {
    getMedicalSummary: vi.fn(() => of(options.summary ?? summary())),
    getMedications: vi.fn((_id: string, state: 'current' | 'past') => of(state === 'current'
      ? { state, activeCount: 1, items: [{ id: 'm1', name: 'Ventoline', strength: null, dose: { amount: 2, unit: 'PUFF' }, route: 'INHALED', timesPerDay: 2, frequencyText: null, duration: null, longTerm: true, startedAt: '2026-11-10', endsAt: null, prescribedAt: '2026-11-10T10:30:00Z' }] }
      : { state, activeCount: 1, items: [{ id: 'm2', name: 'Paracétamol', strength: null, dose: { amount: 1, unit: 'G' }, route: 'ORAL', timesPerDay: 3, frequencyText: null, duration: { value: 5, unit: 'DAY' }, longTerm: false, startedAt: '2026-10-01', endsAt: '2026-10-05', prescribedAt: '2026-10-01T10:00:00Z' }] })),
    getConsultationPage: vi.fn((_id: string, cursor: string | null) => of(cursor === null
      ? (options.page ?? page(ITEMS, 'next-1', access.clinical ? 'CLINICAL' : 'ADMINISTRATIVE'))
      : page([{ id: 'older000-0000-4000-8000-000000000005', date: '2026-09-01T10:00:00Z', status: 'COMPLETED', ownConsultation: true, doctor: null, clinicalAvailable: true, reason: 'Contrôle', diagnosisSummary: null }]))),
    getConsultationDetail: vi.fn(() => of(DETAIL)),
    getDocuments: vi.fn(() => of({ canUpload: true, items: [], nextCursor: null })),
    getHistory: vi.fn(() => of({ clinicalIncluded: true, clinicalUnavailable: false, items: [] })),
    downloadArtifact: vi.fn(() => of(new Blob(['pdf']))),
  };
  TestBed.configureTestingModule({
    imports: [PatientRecordView],
    providers: [provideNoopAnimations(), provideRouter([]), provideNzIcons(OMNICARE_ICONS), provideNzI18n(fr_FR),
      { provide: PatientChartApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(PatientRecordView);
  fixture.componentRef.setInput('chart', chart(access));
  fixture.componentRef.setInput('currentConsultationId', options.current ?? null);
  if (options.initialTab) fixture.componentRef.setInput('initialTab', options.initialTab);
  await stable(fixture);
  return { fixture, api, text: () => fixture.nativeElement.textContent ?? '' };
}

async function stable(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
  }
}

function tab(fixture: ComponentFixture<unknown>, label: string): HTMLElement {
  const found = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]'))
    .find((element) => element.textContent?.trim().includes(label));
  if (!found) throw new Error(`tab ${label}`);
  return found;
}

function card(fixture: ComponentFixture<unknown>, id: string): HTMLElement {
  return (fixture.nativeElement as HTMLElement).querySelector(`#history-${id}`) as HTMLElement;
}

describe('PatientRecordView (« Dossier patient »)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('has the three tabs Résumé / Historique / Documents', async () => {
    const { fixture } = await setup();
    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).map((element) => element.querySelector('span')?.textContent?.trim());
    expect(labels).toEqual(['Résumé', 'Historique', 'Documents']);
    // Text tabs (no icon); Historique carries the consultation count.
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="tab"] nz-icon')).toBeNull();
    expect(tab(fixture, 'Historique').querySelector('.oc-tabs__badge')?.textContent?.trim()).toBe('3');
  });

  it('shows the header line and the patient type', async () => {
    const { text } = await setup();
    expect(text()).toContain('Marwa Mechergui');
    expect(text()).toContain('34 ans · Femme · +216 20 123 456');
    expect(text()).toContain('Patient externe');
  });

  it.each([
    [summary({ allergiesStatus: 'NONE_KNOWN', allergies: [] }), 'Aucune connue'],
    [summary({ allergiesStatus: 'UNKNOWN', allergies: [] }), 'Non renseigné'],
    [summary({ allergiesStatus: 'LIST', allergies: ['Pénicilline'] }), 'Pénicilline'],
  ])('shows the essentials in each state (%#)', async (value, expected) => {
    const { fixture } = await setup({ summary: value });
    const essentials = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="essentials"]')!.textContent!;
    expect(essentials).toContain('Allergies et réactions');
    expect(essentials).toContain(expected);
    expect(essentials).toContain('O+');
    expect(essentials).toContain('Asthme');
  });

  it('Médicaments: Actuels first (with « au long cours »), Anciens on demand, active count in the subtitle', async () => {
    const { fixture, api, text } = await setup();
    expect(api.getMedications).toHaveBeenCalledTimes(1);
    expect(api.getMedications).toHaveBeenCalledWith(CHART_ID, 'current');
    expect(text()).toContain('1 traitement actif');
    expect(text()).toContain('Ventoline');
    const tags = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="medication-tags"] oc-tag')).map((element) => element.textContent?.trim());
    expect(tags).toEqual(['2 bouffées', 'Voie inhalée', '2× par jour', 'Au long cours']);
    expect(text()).toContain('Actif');
    const past = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-testid="medications"] label'))
      .find((element) => element.textContent?.trim() === 'Anciens')!;
    past.click();
    await stable(fixture);
    expect(api.getMedications).toHaveBeenCalledWith(CHART_ID, 'past');
    expect(text()).toContain('Paracétamol');
    expect(text()).toContain('Terminé');
    expect(text()).toContain('jusqu’au 5 oct.');
  });

  it('hides « Mesures corporelles » without data and shows it (with IMC) when the patient entered some', async () => {
    const without = await setup();
    expect(without.text()).not.toContain('Mesures corporelles');
    TestBed.resetTestingModule();
    const withData = await setup({ summary: summary({ bodyMeasurements: { heightCm: 165, weightKg: 58.5, measuredAt: null } }) });
    expect(withData.text()).toContain('Mesures corporelles');
    expect(withData.text()).toContain('Données renseignées par le patient');
    expect(withData.text()).toContain('21,5');
  });

  it('Historique: the current consultation is pinned first and not expandable', async () => {
    const { fixture } = await setup({ current: CURRENT_ID });
    tab(fixture, 'Historique').click();
    await stable(fixture);
    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('.h-list > li');
    expect(items[0].getAttribute('data-testid')).toBe('current-consultation');
    expect(items[0].textContent).toContain('Consultation actuelle');
    expect(items[0].textContent).toContain('commencée à 10:05');
    expect(items[0].textContent).toContain('En cours');
    expect(items[0].querySelector('button')).toBeNull();
    expect(card(fixture, CURRENT_ID)).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('3 consultations');
  });

  it('a card expands, fetches its detail once, and shows diagnosis, treatment, orders, follow-up and distinct documents', async () => {
    const { fixture, api, text } = await setup({ current: CURRENT_ID });
    tab(fixture, 'Historique').click();
    await stable(fixture);
    expect(api.getConsultationDetail).not.toHaveBeenCalled();
    const toggle = card(fixture, DONE_ID).querySelector('button') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await stable(fixture);
    expect(api.getConsultationDetail).toHaveBeenCalledTimes(1);
    expect(api.getConsultationDetail).toHaveBeenCalledWith(CHART_ID, DONE_ID);
    const body = card(fixture, DONE_ID).textContent!;
    expect(body).toContain('Angine');
    expect(body).toContain('Confirmé');
    expect(body).toContain('Provisoire');
    const lines = Array.from(card(fixture, DONE_ID).querySelectorAll('[data-testid="prescription-tags"]'))
      .map((element) => Array.from(element.querySelectorAll('oc-tag')).map((tag) => tag.textContent?.trim()));
    expect(lines).toEqual([['1 g', 'Voie orale', '2× par jour', '1 semaine'], ['2 bouffées', 'Voie inhalée', '2× par jour', 'Au long cours']]);
    expect(card(fixture, DONE_ID).querySelector('[data-testid="detail-orders"] oc-tag')?.textContent?.trim()).toBe('Analyse · NFS');
    expect(body).toContain('Contrôle le mar. 24 nov. 2026');
    expect(body).not.toContain('Gorge rouge.');
    (Array.from(card(fixture, DONE_ID).querySelectorAll<HTMLElement>('button')).find((element) => element.textContent?.includes('Voir l’examen clinique et les notes'))!).click();
    await stable(fixture);
    expect(card(fixture, DONE_ID).textContent).toContain('Gorge rouge.');

    toggle.click();
    await stable(fixture);
    toggle.click();
    await stable(fixture);
    expect(api.getConsultationDetail).toHaveBeenCalledTimes(1);
    expect(text()).not.toMatch(RAW_CODE);
  });

  it('a completed consultation the server does not share is listed but not expandable', async () => {
    const hidden: RecordConsultationItem = { ...ITEMS[1], id: 'hidden00-0000-4000-8000-000000000006', clinicalAvailable: false, reason: null, diagnosisSummary: null };
    const { fixture, api } = await setup({ page: page([hidden]) });
    tab(fixture, 'Historique').click();
    await stable(fixture);
    expect(card(fixture, hidden.id)).toBeTruthy();
    expect(card(fixture, hidden.id).querySelector('button')).toBeNull();
    expect(api.getConsultationDetail).not.toHaveBeenCalled();
  });

  it('search filters the loaded page; « Afficher plus » loads the next page with its cursor', async () => {
    const { fixture, api, text } = await setup();
    tab(fixture, 'Historique').click();
    await stable(fixture);
    const search = (fixture.nativeElement as HTMLElement).querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'lombal';
    search.dispatchEvent(new Event('input'));
    await stable(fixture);
    expect(text()).toContain('Douleur lombaire');
    expect(text()).not.toContain('Fièvre et toux');
    search.value = '';
    search.dispatchEvent(new Event('input'));
    await stable(fixture);
    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('button')).find((element) => element.textContent?.includes('Afficher plus'))!).click();
    await stable(fixture);
    expect(api.getConsultationPage).toHaveBeenLastCalledWith(CHART_ID, 'next-1', 20);
    expect(text()).toContain('Contrôle');
  });

  it('« Dernière consultation » opens that card in Historique', async () => {
    const { fixture, api } = await setup();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="last-consultation"]')?.textContent).toContain('Fièvre et toux');
    const last = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="last-consultation"]') as HTMLElement;
    expect(last.textContent).toContain('Angine');
    expect(last.textContent).toContain('Motif : Fièvre et toux · Dr Sami Ben Ali');
    expect(last.querySelector('oc-date-block')?.textContent).toContain('NOV.');
    (Array.from(last.querySelectorAll<HTMLElement>('button')).find((element) => element.textContent?.includes('Voir le détail'))!).click();
    await stable(fixture);
    expect(card(fixture, DONE_ID).querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
    expect(api.getConsultationDetail).toHaveBeenCalledWith(CHART_ID, DONE_ID);
  });

  it('RESTRICTED: no clinical request, « Accès requis », nothing expandable', async () => {
    const administrative = page([
      { id: DONE_ID, date: '2026-11-10T10:00:00Z', status: 'COMPLETED', doctor: { name: 'Dr Sami Ben Ali', specialty: null } },
    ], null, 'ADMINISTRATIVE');
    const { fixture, api, text } = await setup({ access: RESTRICTED, page: administrative });
    expect(text()).toContain('Accès requis');
    tab(fixture, 'Historique').click();
    await stable(fixture);
    expect(text()).toContain('Dr Sami Ben Ali');
    expect(card(fixture, DONE_ID).querySelector('button')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.h-chevron')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="access-required"]').length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="safety-strip"]')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type="search"]')).toBeNull();
    tab(fixture, 'Documents').click();
    await stable(fixture);
    expect(api.getMedicalSummary).not.toHaveBeenCalled();
    expect(api.getMedications).not.toHaveBeenCalled();
    expect(api.getConsultationDetail).not.toHaveBeenCalled();
    expect(api.getDocuments).not.toHaveBeenCalled();
  });

  it('Documents: no upload in this view, count line or empty state', async () => {
    const { fixture, text } = await setup();
    tab(fixture, 'Documents').click();
    await stable(fixture);
    expect(text()).toContain('Aucun document médical disponible');
    expect(text()).not.toContain('Ajouter un document');
    // One sentence, no illustration.
    expect((fixture.nativeElement as HTMLElement).querySelector('oc-empty-state')).toBeNull();
  });

  it('renders no English, raw code or jargon with everything open', async () => {
    const { fixture, text } = await setup({ current: CURRENT_ID, summary: summary({ bodyMeasurements: { heightCm: 165, weightKg: 58.5, measuredAt: null } }) });
    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('button')).find((element) => element.textContent?.includes('Activité du dossier'))!).click();
    await stable(fixture);
    let rendered = text();
    tab(fixture, 'Historique').click();
    await stable(fixture);
    (card(fixture, DONE_ID).querySelector('button') as HTMLElement).click();
    await stable(fixture);
    rendered += text();
    for (const pattern of [ENGLISH, JARGON, RAW_CODE]) expect(rendered.match(pattern)?.[0] ?? null).toBeNull();
  });

  describe('safety strip', () => {
    function strip(fixture: ComponentFixture<unknown>): HTMLElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="safety-strip"]');
    }

    it('shows the allergies and the blood group under the header', async () => {
      const { fixture } = await setup({ summary: summary({ allergiesStatus: 'LIST', allergies: ['Pénicilline', 'Aspirine'], bloodType: 'A+' }) });
      expect(strip(fixture)?.textContent?.replace(/\s+/g, ' ')).toContain('Allergies : Pénicilline, Aspirine');
      expect(strip(fixture)?.textContent?.replace(/\s+/g, ' ')).toContain('Groupe : A+');
    });

    it('uses the singular for one allergy, and shows the blood group alone when no allergy is listed', async () => {
      const one = await setup({ summary: summary({ allergiesStatus: 'LIST', allergies: ['Pénicilline'], bloodType: null }) });
      expect(strip(one.fixture)?.textContent?.replace(/\s+/g, ' ')).toContain('Allergie : Pénicilline');
      expect(strip(one.fixture)?.textContent).not.toContain('Groupe');
      TestBed.resetTestingModule();
      const blood = await setup({ summary: summary({ allergiesStatus: 'NONE_KNOWN', allergies: [], bloodType: 'O+' }) });
      expect(strip(blood.fixture)?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Groupe : O+');
    });

    it.each([
      ['« Aucune connue » and no blood group', summary({ allergiesStatus: 'NONE_KNOWN', allergies: [], bloodType: null })],
      ['« Non renseigné » and no blood group', summary({ allergiesStatus: 'UNKNOWN', allergies: [], bloodType: null })],
      ['essentials not shared', summary({ essentialInformationShared: false, allergiesStatus: 'LIST', allergies: ['Pénicilline'] })],
    ])('is hidden with %s', async (_label, value) => {
      const { fixture } = await setup({ summary: value });
      expect(strip(fixture)).toBeNull();
    });

    it('is never shown in OMNICARE_RESTRICTED (no summary is read)', async () => {
      const { fixture, api } = await setup({ access: RESTRICTED, page: page([], null, 'ADMINISTRATIVE') });
      expect(strip(fixture)).toBeNull();
      expect(api.getMedicalSummary).not.toHaveBeenCalled();
    });

    it('is there whatever the opened tab (the chart page can open on Historique)', async () => {
      const { fixture, api } = await setup({ summary: summary({ allergiesStatus: 'LIST', allergies: ['Pénicilline'] }), initialTab: 'history' });
      expect(strip(fixture)).toBeTruthy();
      expect(api.getMedicalSummary).toHaveBeenCalledTimes(1);
      expect(api.getMedications).not.toHaveBeenCalled();
    });
  });

  it('renders the three essential states as plain text, the lists as tinted tags', async () => {
    const states = await setup({ summary: summary({ allergiesStatus: 'NONE_KNOWN', allergies: [], conditionsStatus: 'UNKNOWN', conditions: [], bloodType: null }) });
    const root = states.fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="essential-allergies"] .r-state')?.textContent?.trim()).toBe('Aucune connue');
    expect(root.querySelector('[data-testid="essential-conditions"] .r-state')?.textContent?.trim()).toBe('Non renseigné');
    expect(root.querySelector('[data-testid="essential-blood"] .r-state')?.textContent?.trim()).toBe('Non renseigné');
    expect(root.querySelector('[data-testid="essentials"] oc-tag')).toBeNull();
    TestBed.resetTestingModule();
    const known = await setup({ summary: summary({ conditionsStatus: 'NONE_KNOWN', conditions: [] }) });
    expect((known.fixture.nativeElement as HTMLElement).querySelector('[data-testid="essential-conditions"] .r-state')?.textContent?.trim()).toBe('Aucun connu');
    TestBed.resetTestingModule();
    const listed = await setup({ summary: summary({ allergiesStatus: 'LIST', allergies: ['Pénicilline'] }) });
    const chip = (listed.fixture.nativeElement as HTMLElement).querySelector('[data-testid="essential-allergies"] oc-tag nz-tag');
    expect(chip?.classList).toContain('oc-tag--allergy');
    expect((listed.fixture.nativeElement as HTMLElement).querySelector('[data-testid="essential-blood"] .r-big')?.textContent?.trim()).toBe('O+');
  });

  it('shows the generated documents as distinct file cards with their subtitles', async () => {
    const { fixture, api } = await setup({ current: CURRENT_ID });
    tab(fixture, 'Historique').click();
    await stable(fixture);
    (card(fixture, DONE_ID).querySelector('button') as HTMLElement).click();
    await stable(fixture);
    const cards = Array.from(card(fixture, DONE_ID).querySelectorAll<HTMLElement>('[data-testid="generated-documents"] oc-file-card'));
    const rows = cards.map((element) => [
      element.querySelector('.oc-file-card__title')?.textContent?.trim(),
      element.querySelector('.oc-file-card__subtitle')?.textContent?.trim(),
    ]);
    expect(rows).toEqual([
      ['Ordonnance', '2 médicaments'],
      ['Arrêt de travail', '10 → 12 nov. 2026 · 3 jours'],
      ['Certificat médical', '10 nov. 2026'],
    ]);
    expect(new Set(rows.map((row) => row.join('|'))).size).toBe(rows.length);
    // The whole card is one native button, named by its title.
    const button = cards[1].querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Télécharger : Arrêt de travail, 10 → 12 nov. 2026 · 3 jours');
    button.click();
    await stable(fixture);
    expect(api.downloadArtifact).toHaveBeenCalledWith(CHART_ID, DONE_ID, 'a2');
  });

  it('gives the most recent consultation the primary date block, older ones the neutral one', async () => {
    const { fixture } = await setup({ current: CURRENT_ID });
    tab(fixture, 'Historique').click();
    await stable(fixture);
    expect(card(fixture, DONE_ID).querySelector('.oc-date-block')?.classList).toContain('oc-date-block--care');
    expect(card(fixture, ITEMS[2].id).querySelector('.oc-date-block')?.classList).not.toContain('oc-date-block--care');
    expect(card(fixture, DONE_ID).textContent).toContain('Fièvre et toux');
    expect(card(fixture, DONE_ID).textContent).toContain('Dr Sami Ben Ali · Médecine générale · 11:00');
    expect(card(fixture, DONE_ID).textContent).toContain('Terminée');
  });

  it('the medications segmented control works with the keyboard', async () => {
    const { fixture, api } = await setup();
    const selected = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-testid="medications"] label'))
      .find((element) => element.textContent?.trim() === 'Actuels')!;
    selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
    await stable(fixture);
    expect(api.getMedications).toHaveBeenCalledWith(CHART_ID, 'past');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Paracétamol');
  });

  it('uses no uppercase CSS (labels are sentence case)', async () => {
    const { fixture } = await setup({ current: CURRENT_ID });
    tab(fixture, 'Historique').click();
    await stable(fixture);
    (card(fixture, DONE_ID).querySelector('button') as HTMLElement).click();
    await stable(fixture);
    tab(fixture, 'Documents').click();
    await stable(fixture);
    const css = Array.from(document.querySelectorAll('style')).map((element) => element.textContent ?? '').join('\n');
    expect(css).toContain('r-card');
    expect(css).not.toMatch(/text-transform\s*:\s*uppercase/i);
  });
});
