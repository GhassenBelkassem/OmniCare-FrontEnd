import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';
import { BehaviorSubject, NEVER, Subject, of, throwError } from 'rxjs';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../../core/realtime/live-event.models';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { ActiveConsultationStore } from '../active-consultation.store';
import { PracticePatientApiService } from '../practice-patient-api.service';
import { PracticeLocationApiService } from '../settings/practice-location-api.service';
import { documentFileError } from './chart-document-upload';
import { groupHistoryByDay } from './chart-history-tab';
import type {
  PatientChartAccessMode,
  PatientChartDto,
  PatientChartMedicalSummaryDto,
} from './patient-chart-api.models';
import { PatientChartApiService } from './patient-chart-api.service';
import { PatientChartPage } from './patient-chart-page';

const PATIENT_ID = '7d4b2c39-4f0a-4c2a-9b6e-2f1f0a6d3e11';

function chart(mode: PatientChartAccessMode, overrides: Partial<PatientChartDto> = {}): PatientChartDto {
  const external = mode === 'EXTERNAL_OWNER';
  return {
    id: PATIENT_ID,
    patientType: external ? 'EXTERNAL' : 'OMNICARE',
    identity: {
      firstName: 'Amel',
      lastName: 'Ben Ali',
      fullName: 'Amel Ben Ali',
      ageYears: 34,
      ageApproximate: false,
      sex: 'F',
      dateOfBirth: '1992-03-12',
      phone: '+216 20 123 456',
      email: null,
      address: null,
      practiceIdentifier: null,
    },
    access: {
      mode,
      clinical: mode !== 'OMNICARE_RESTRICTED',
      editable: external,
      grantExpiresAt: mode === 'OMNICARE_GRANTED' ? '2026-11-10T15:30:00Z' : null,
      verificationUnavailable: false,
    },
    medicalRecord: { status: 'READY' },
    schedulable: external,
    nextAppointment: null,
    startableAppointment: null,
    lastConsultation: null,
    counts: { consultations: 0, documents: external ? 0 : null, history: null },
    ...overrides,
  };
}

const SUMMARY: PatientChartMedicalSummaryDto = {
  editable: true,
  version: 2,
  essentialInformationShared: true,
  treatmentsShared: true,
  bloodType: 'A+',
  allergies: ['Pénicilline'],
  conditions: ['Asthme'],
  treatments: [],
};

function setup(
  dto: PatientChartDto | 'not-found' | 'error',
  summary: PatientChartMedicalSummaryDto = SUMMARY,
  clinicalError: HttpErrorResponse | null = null,
) {
  const api = {
    getChart: vi.fn(() =>
      dto === 'not-found'
        ? throwError(() => new HttpErrorResponse({ status: 404 }))
        : dto === 'error'
          ? throwError(() => new HttpErrorResponse({ status: 500 }))
          : of(dto),
    ),
    getMedicalSummary: vi.fn(() => (clinicalError ? throwError(() => clinicalError) : of(summary))),
    updateMedicalSummary: vi.fn(),
    getConsultationPage: vi.fn(() => of({ view: 'ADMINISTRATIVE' as const, items: [], nextCursor: null, total: 0 })),
    getConsultationDetail: vi.fn(),
    getMedications: vi.fn((_id: string, state: 'current' | 'past') => (clinicalError ? throwError(() => clinicalError) : of({ state, activeCount: 0, items: [] }))),
    getDocuments: vi.fn(() =>
      clinicalError
        ? throwError(() => clinicalError)
        : of({ canUpload: dto !== 'not-found' && dto !== 'error' && dto.access.editable, items: [], nextCursor: null }),
    ),
    getHistory: vi.fn(() => of({ clinicalIncluded: false, clinicalUnavailable: false, items: [] })),
    downloadArtifact: vi.fn(),
    uploadDocument: vi.fn(() => of({ id: 'doc-1', type: 'LAB_RESULT', name: 'Bilan', status: 'AVAILABLE', contentType: 'application/pdf', pageCount: 1, createdAt: '2026-11-11T10:00:00Z', previewable: true })),
    updateContact: vi.fn(),
    createPreview: vi.fn(),
    previewPage: vi.fn(),
  };
  const queryParams = new BehaviorSubject(convertToParamMap({}));
  const realtime = { scheduledCareEvents$: new Subject<ScheduledCareEvent>() };
  const store = {
    starting: vi.fn(() => false),
    startError: vi.fn(() => null),
    startScheduledAppointment: vi.fn(async () => ({ kind: 'FAILED' })),
  };
  TestBed.configureTestingModule({
    imports: [PatientChartPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideNoopAnimations(),
      provideRouter([]),
      provideNzIcons(OMNICARE_ICONS),
      provideNzI18n(fr_FR),
      { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      { provide: PatientChartApiService, useValue: api },
      { provide: ActiveConsultationStore, useValue: store },
      {
        provide: PracticePatientApiService,
        useValue: {
          reconcileMrsPatient: vi.fn(),
          getPatient: vi.fn(() => NEVER),
          listPatients: vi.fn(() => of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 })),
        },
      },
      { provide: PracticeLocationApiService, useValue: { list: vi.fn(() => of([])) } },
      { provide: RealtimeService, useValue: realtime },
      { provide: ActiveConsultationApiService, useValue: {
        requestAccess: vi.fn(() => of({ request: { requestId: 'request-1', status: 'PENDING', version: 0, createdAt: '2026-11-11T08:05:00Z', respondedAt: null }, used: 1, max: 3, canRequest: false })),
        cancelAccessRequest: vi.fn(),
      } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ id: PATIENT_ID })),
          queryParamMap: queryParams,
          snapshot: { queryParamMap: convertToParamMap({}) },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(PatientChartPage);
  fixture.detectChanges();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const selectTab = (tab: string) => {
    fixture.componentInstance.selectTab(tab);
    fixture.detectChanges();
    fixture.detectChanges();
  };
  return { fixture, api, store, element, selectTab, realtime };
}

function buttonByText(element: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...element.querySelectorAll('button')].find((button) => button.textContent?.trim() === text);
}

describe('PatientChartPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('access request (G-1 D2)', () => {
    const REQUEST = { consultationId: 'consultation-1', request: null, used: 0, max: 3, canRequest: true };
    const changed = (realtime: { scheduledCareEvents$: Subject<ScheduledCareEvent> }) => realtime.scheduledCareEvents$.next({
      eventId: `e-${Math.random()}`, eventType: 'CLINICAL_ACCESS_CHANGED', resourceType: 'CONSULTATION',
      resourceId: 'consultation-1', version: 2, occurredAt: '2026-11-11T08:10:00Z',
    });

    it('offers « Demander l’accès » during the doctor’s consultation and shows « Demande envoyée… »', () => {
      const { element, fixture } = setup(chart('OMNICARE_RESTRICTED', { accessRequest: REQUEST }));
      const panel = element.querySelector('[data-testid="access-request-panel"]')!;
      expect(panel.textContent).toContain('Accès requis');
      buttonByText(panel as HTMLElement, 'Demander l’accès')!.click();
      fixture.detectChanges();
      expect(element.querySelector('[data-testid="access-request-panel"]')?.textContent).toContain('Demande envoyée…');
    });

    it('no consultation in progress: no request button (the passive explanation stays)', () => {
      const { element } = setup(chart('OMNICARE_RESTRICTED', { accessRequest: null }));
      expect(element.querySelector('[data-testid="access-request-panel"]')).toBeNull();
    });

    it('switches to full access live when the patient accepts, and shows « retiré » after a revoke', () => {
      const { element, fixture, api, realtime } = setup(chart('OMNICARE_RESTRICTED', { accessRequest: REQUEST }));
      api.getChart.mockReturnValue(of(chart('OMNICARE_GRANTED', { accessRequest: { ...REQUEST, canRequest: false } })));
      changed(realtime);
      fixture.detectChanges();
      expect(api.getChart).toHaveBeenCalledTimes(2);
      expect(element.querySelector('[data-testid="access-request-panel"]')).toBeNull();

      api.getChart.mockReturnValue(of(chart('OMNICARE_RESTRICTED', { accessRequest: REQUEST })));
      changed(realtime);
      fixture.detectChanges();
      expect(element.querySelector('[data-testid="access-request-panel"]')?.textContent).toContain('Votre accès au dossier médical de ce patient a été retiré.');
    });
  });

  describe('EXTERNAL_OWNER', () => {
    it('renders the shared « Dossier patient » view, read-only, under the page header', () => {
      const { element, api, selectTab } = setup(chart('EXTERNAL_OWNER'));

      expect(element.querySelector('[data-testid="type-tag"]')?.textContent).toContain('Patient externe');
      expect(element.textContent).toContain('34 ans · Femme · +216 20 123 456');
      expect(element.querySelector('app-patient-record-view')).toBeTruthy();
      const tabs = Array.from(element.querySelectorAll('app-patient-record-view [role="tab"]')).map((tab) => tab.querySelector('span')?.textContent?.trim());
      expect(tabs).toEqual(['Résumé', 'Historique', 'Documents']);
      expect(api.getMedicalSummary).toHaveBeenCalledWith(PATIENT_ID);
      expect(element.querySelector('[data-testid="essentials"]')?.textContent).toContain('Pénicilline');
      // The medical record stays read-only (only « Coordonnées » is editable, P3b).
      expect(element.querySelector('app-patient-record-view')?.textContent).not.toContain('Modifier');

      // P3b: the upload is a page-header action, not part of the Documents tab.
      selectTab('documents');
      expect(element.querySelector('app-patient-record-view')?.textContent).not.toContain('Ajouter un document');
    });

    it('shows « Aucune connue » and « Non renseigné » as different states', () => {
      const { element } = setup(chart('EXTERNAL_OWNER'), {
        ...SUMMARY, allergies: [], conditions: [], bloodType: 'O+', allergiesStatus: 'NONE_KNOWN', conditionsStatus: 'UNKNOWN',
      });
      const essentials = element.querySelector('[data-testid="essentials"]')?.textContent ?? '';

      expect(essentials).toContain('Aucune connue');
      expect(essentials).toContain('Non renseigné');
      expect(essentials).toContain('O+');
      expect(element.querySelector('form')).toBeNull();
    });

    it('never renders technical identifiers', () => {
      const { element } = setup(chart('EXTERNAL_OWNER'));
      const text = element.textContent ?? '';

      expect(text).not.toContain(PATIENT_ID);
      for (const forbidden of ['MRS', 'projection', 'N° assurance', 'Documents protégés', 'Saisie manuelle', 'Non lié', 'Genre']) {
        expect(text).not.toContain(forbidden);
      }
    });

    it('maps the former « Consultations » tab link to Historique', () => {
      const { fixture } = setup(chart('EXTERNAL_OWNER'));
      fixture.componentInstance.selectTab('history');
      expect(fixture.componentInstance.activeTab()).toBe('history');
      expect((fixture.componentInstance as unknown as { tabFrom(value: string): string }).tabFrom('consultations')).toBe('history');
    });
  });

  describe('OMNICARE_GRANTED', () => {
    it('is read-only and shows the grant expiry', () => {
      const { element, selectTab } = setup(chart('OMNICARE_GRANTED'), { ...SUMMARY, editable: false });

      expect(element.querySelector('[data-testid="type-tag"]')?.textContent).toContain('Patient OmniCare');
      expect(element.querySelector('[data-testid="grant-tag"]')?.textContent).toMatch(
        /Accès autorisé jusqu’au 10\/11\/2026 16:30/u,
      );
      expect(buttonByText(element, 'Modifier')).toBeUndefined();
      expect(element.textContent).toContain('Pénicilline');

      selectTab('documents');
      expect(buttonByText(element, 'Ajouter un document')).toBeUndefined();
    });
  });

  describe('OMNICARE_RESTRICTED', () => {
    it('shows « Accès requis » on medical content and fires no clinical request', () => {
      const { element, api, selectTab } = setup(chart('OMNICARE_RESTRICTED'));

      const block = element.querySelector('[data-testid="access-required"]');
      expect(block?.textContent).toContain('Accès requis');
      expect(block?.textContent).toContain('QR code ou autorisation');
      expect(api.getMedicalSummary).not.toHaveBeenCalled();
      expect(api.getMedications).not.toHaveBeenCalled();
      expect(api.getDocuments).not.toHaveBeenCalled();

      selectTab('documents');
      expect(element.querySelector('[data-testid="access-required"]')).toBeTruthy();
      expect(api.getDocuments).not.toHaveBeenCalled();

      selectTab('history');
      expect(api.getConsultationPage).toHaveBeenCalled();
      expect(api.getConsultationDetail).not.toHaveBeenCalled();
      expect(element.querySelector('[data-testid="access-required"]')).toBeTruthy();
    });
  });

  describe('access answers from the server', () => {
    const accessRequired = new HttpErrorResponse({
      status: 403,
      error: { code: 'PATIENT_CHART_CLINICAL_ACCESS_REQUIRED', message: 'refusé' },
    });

    it('renders « Accès requis », not the red load error, when a clinical call is refused', () => {
      const { element, selectTab } = setup(chart('EXTERNAL_OWNER'), SUMMARY, accessRequired);

      expect(element.querySelector('[data-testid="access-required"]')).toBeTruthy();
      expect(element.textContent).not.toContain('n’ont pas pu être chargé');

      selectTab('documents');
      expect(element.querySelector('[data-testid="access-required"]')).toBeTruthy();
      expect(element.querySelector('app-patient-record-view')?.textContent).not.toContain('Ajouter un document');
      expect(element.textContent).not.toContain('n’ont pas pu être chargés');
    });

    it('keeps the red error with « Réessayer » for a real failure', () => {
      const { element } = setup(chart('EXTERNAL_OWNER'), SUMMARY, new HttpErrorResponse({ status: 503 }));

      expect(element.textContent).toContain('Les informations n’ont pas pu être chargées.');
      expect(buttonByText(element, 'Réessayer')).toBeTruthy();
    });

    it('never calls clinical endpoints outside EXTERNAL_OWNER and OMNICARE_GRANTED', () => {
      const restricted = chart('OMNICARE_RESTRICTED');
      const inconsistent = setup({ ...restricted, access: { ...restricted.access, clinical: true } });
      expect(inconsistent.api.getMedicalSummary).not.toHaveBeenCalled();
      expect(inconsistent.api.getMedications).not.toHaveBeenCalled();
      expect(inconsistent.api.getDocuments).not.toHaveBeenCalled();
      TestBed.resetTestingModule();

      const owner = chart('EXTERNAL_OWNER');
      const secretaryLike = setup({ ...owner, access: { ...owner.access, clinical: false, editable: false } });
      expect(secretaryLike.api.getMedicalSummary).not.toHaveBeenCalled();
      expect(secretaryLike.api.getDocuments).not.toHaveBeenCalled();
      expect(secretaryLike.element.querySelector('[data-testid="access-required"]')).toBeTruthy();
    });
  });

  it('shows a baby’s age in days instead of « 0 an »', () => {
    const elevenDaysAgo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(
      new Date(Date.now() - 11 * 86_400_000),
    );
    const owner = chart('EXTERNAL_OWNER');
    const { element } = setup({
      ...owner,
      identity: { ...owner.identity, ageYears: 0, dateOfBirth: elevenDaysAgo },
    });

    expect(element.querySelector('.chart-header__meta')?.textContent).toMatch(/^\s*\d+ jours? · Femme/u);
    expect(element.textContent).not.toContain('0 an');
  });

  describe('header actions', () => {
    it('shows « Démarrer la consultation » only for a confirmed appointment today and starts it', async () => {
      const appointment = {
        id: 'appointment-today',
        startTime: '2026-11-10T10:00:00Z',
        endTime: null,
        status: 'CONFIRMED',
        version: 3,
      };
      const { element, store } = setup(chart('EXTERNAL_OWNER', { startableAppointment: appointment }));

      const start = element.querySelector('[data-testid="start-action"] button') as HTMLButtonElement;
      expect(start.textContent).toContain('Démarrer la consultation');
      start.click();
      await Promise.resolve();
      expect(store.startScheduledAppointment).toHaveBeenCalledWith('appointment-today', 3);
    });

    it('hides the start action without a startable appointment', () => {
      const { element } = setup(chart('EXTERNAL_OWNER'));
      expect(element.querySelector('[data-testid="start-action"]')).toBeNull();
    });

    it('enables scheduling for an external patient and disables it for an OmniCare patient', () => {
      const owner = setup(chart('EXTERNAL_OWNER'));
      const enabled = owner.element.querySelector('[data-testid="schedule-action"] button') as HTMLButtonElement;
      expect(enabled.disabled).toBe(false);
      enabled.click();
      owner.fixture.detectChanges();
      expect(owner.fixture.componentInstance.drawerOpen()).toBe(true);
      TestBed.resetTestingModule();

      const omniCare = setup(chart('OMNICARE_RESTRICTED'));
      const disabled = omniCare.element.querySelector('[data-testid="schedule-action"] button') as HTMLButtonElement;
      expect(disabled.disabled).toBe(true);
    });
  });

  describe('states', () => {
    it('shows the empty states; scheduling stays in the page header', () => {
      const { element, selectTab } = setup(chart('EXTERNAL_OWNER'));

      expect(buttonByText(element, 'Planifier un rendez-vous')).toBeTruthy();

      selectTab('documents');
      const empty = element.querySelector('[data-testid="documents-empty"]');
      expect(empty?.textContent).toContain('Aucun document médical disponible');
      expect(element.querySelector('app-patient-record-view')?.textContent).not.toContain('Ajouter un document');

      selectTab('history');
      expect(element.textContent).toContain('Aucune consultation pour le moment.');
    });

    it('renders « Patient introuvable » on 404', () => {
      const { element } = setup('not-found');
      expect(element.textContent).toContain('Patient introuvable');
    });

    it('offers « Réessayer » on a server error and reloads', () => {
      const { element, api, fixture } = setup('error');
      expect(element.textContent).toContain('Impossible de charger la fiche');
      api.getChart.mockReturnValue(of(chart('EXTERNAL_OWNER')));
      buttonByText(element, 'Réessayer')?.click();
      fixture.detectChanges();
      expect(api.getChart).toHaveBeenCalledTimes(2);
      expect(element.textContent).toContain('Amel Ben Ali');
    });
  });
});

describe('patient chart helpers', () => {
  it('validates document files in French', () => {
    expect(documentFileError(null)).toBe('Choisissez un fichier.');
    expect(documentFileError({ name: 'a.exe', type: 'application/x-msdownload', size: 10 })).toContain(
      'PDF, JPEG ou PNG',
    );
    expect(documentFileError({ name: 'a.pdf', type: 'application/pdf', size: 15 * 1024 * 1024 + 1 })).toContain(
      '15 Mo',
    );
    expect(documentFileError({ name: 'a.pdf', type: 'application/pdf', size: 15 * 1024 * 1024 })).toBeNull();
    expect(documentFileError({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toBeNull();
  });

  it('groups history events by Tunis day, newest first', () => {
    const groups = groupHistoryByDay([
      { id: '1', kind: 'APPOINTMENT_CONFIRMED', occurredAt: '2026-11-10T08:00:00Z', appointmentStart: null, label: null, targetType: null, targetId: null },
      { id: '2', kind: 'APPOINTMENT_BOOKED', occurredAt: '2026-11-10T07:00:00Z', appointmentStart: null, label: null, targetType: null, targetId: null },
      { id: '3', kind: 'PATIENT_CREATED', occurredAt: '2026-11-08T23:30:00Z', appointmentStart: null, label: null, targetType: null, targetId: null },
    ]);
    expect(groups.map((group) => group.events.length)).toEqual([2, 1]);
    expect(groups[0].heading).toBe('Mardi 10 novembre 2026');
    // 23:30 UTC is already 9 November in Tunis.
    expect(groups[1].heading).toBe('Lundi 9 novembre 2026');
  });
});

describe('PatientChartPage · practical information (P3b)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const card = (element: HTMLElement) => element.querySelector('[data-testid="contact-card"]') as HTMLElement;

  it('shows « Coordonnées » and « Prochain rendez-vous » above the record tabs', () => {
    const { element } = setup(chart('EXTERNAL_OWNER'));
    const practical = element.querySelector('.patient-chart__practical') as HTMLElement;
    const record = element.querySelector('app-patient-record-view') as HTMLElement;
    expect(practical.compareDocumentPosition(record) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card(element).textContent).toContain('Coordonnées');
    expect(card(element).textContent).toContain('+216 20 123 456');
    expect(card(element).textContent).toContain('Identifiant de pratique');
    expect(element.querySelector('[data-testid="next-appointment-card"]')?.textContent).toContain('Prochain rendez-vous');
  });

  it('Coordonnées: editable for the owner of an external patient, read-only for an OmniCare patient', () => {
    const owner = setup(chart('EXTERNAL_OWNER'));
    expect(owner.element.querySelector('[data-testid="contact-edit"]')).toBeTruthy();
    TestBed.resetTestingModule();
    const granted = setup(chart('OMNICARE_GRANTED'));
    expect(granted.element.querySelector('[data-testid="contact-edit"]')).toBeNull();
    expect(card(granted.element).textContent).toContain('Le patient gère ces informations depuis son application.');
    TestBed.resetTestingModule();
    const restricted = setup(chart('OMNICARE_RESTRICTED'));
    expect(restricted.element.querySelector('[data-testid="contact-edit"]')).toBeNull();
  });

  it('« Ajouter un document » is a header action for the owner only, and a successful upload reloads Documents', () => {
    const { element, api, fixture } = setup(chart('EXTERNAL_OWNER'));
    const action = element.querySelector('[data-testid="upload-action"] button') as HTMLButtonElement;
    expect(action.textContent).toContain('Ajouter un document');
    fixture.componentInstance.onDocumentUploaded();
    fixture.detectChanges();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe('documents');
    expect(api.getDocuments).toHaveBeenCalled();
    const calls = api.getDocuments.mock.calls.length;
    fixture.componentInstance.onDocumentUploaded();
    fixture.detectChanges();
    expect(api.getDocuments.mock.calls.length).toBe(calls + 1);
    for (const mode of ['OMNICARE_GRANTED', 'OMNICARE_RESTRICTED'] as const) {
      TestBed.resetTestingModule();
      const other = setup(chart(mode));
      expect(other.element.querySelector('[data-testid="upload-action"]')).toBeNull();
      expect(other.element.querySelector('app-chart-document-upload')).toBeNull();
    }
  });

  it('the upload action waits while the record is being prepared', () => {
    const { element } = setup(chart('EXTERNAL_OWNER', { medicalRecord: { status: 'PREPARING' } }));
    expect((element.querySelector('[data-testid="upload-action"] button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Prochain rendez-vous: date, time, cabinet and status, or an empty state with « Planifier »', () => {
    const next = { id: 'apt-1', startTime: '2026-11-13T08:30:00Z', endTime: '2026-11-13T09:00:00Z', status: 'CONFIRMED', version: 2, locationName: 'Cabinet El Menzah' };
    const withNext = setup(chart('EXTERNAL_OWNER', { nextAppointment: next }));
    const row = withNext.element.querySelector('[data-testid="next-appointment"]') as HTMLElement;
    expect(row.textContent).toContain('Ven. 13 nov. 2026');
    expect(row.textContent).toContain('09:30 · Cabinet El Menzah');
    expect(row.querySelector('oc-status-tag')?.textContent).toContain('Confirmé');
    TestBed.resetTestingModule();
    const empty = setup(chart('EXTERNAL_OWNER'));
    const box = empty.element.querySelector('[data-testid="next-appointment-empty"]') as HTMLElement;
    expect(box.textContent).toContain('Aucun rendez-vous à venir.');
    (Array.from(box.querySelectorAll('button')).find((button) => button.textContent?.includes('Planifier')) as HTMLButtonElement).click();
    empty.fixture.detectChanges();
    expect(empty.fixture.componentInstance.drawerOpen()).toBe(true);
    TestBed.resetTestingModule();
    const omnicare = setup(chart('OMNICARE_GRANTED'));
    expect(omnicare.element.querySelector('[data-testid="next-appointment-empty"] button')).toBeNull();
  });
});
