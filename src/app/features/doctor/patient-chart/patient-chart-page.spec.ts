import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { ActiveConsultationStore } from '../active-consultation.store';
import { PracticePatientApiService } from '../practice-patient-api.service';
import { PracticeLocationApiService } from '../settings/practice-location-api.service';
import { documentFileError } from './chart-documents-tab';
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
    getConsultations: vi.fn(() => of({ view: 'ADMINISTRATIVE' as const, items: [] })),
    getDocuments: vi.fn(() =>
      clinicalError
        ? throwError(() => clinicalError)
        : of({ canUpload: dto !== 'not-found' && dto !== 'error' && dto.access.editable, items: [], nextCursor: null }),
    ),
    getHistory: vi.fn(() => of({ clinicalIncluded: false, clinicalUnavailable: false, items: [] })),
    downloadArtifact: vi.fn(),
    uploadDocument: vi.fn(),
    createPreview: vi.fn(),
    previewPage: vi.fn(),
  };
  const queryParams = new BehaviorSubject(convertToParamMap({}));
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
  return { fixture, api, store, element, selectTab };
}

function buttonByText(element: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...element.querySelectorAll('button')].find((button) => button.textContent?.trim() === text);
}

describe('PatientChartPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('EXTERNAL_OWNER', () => {
    it('shows the external tag, the edit action and the upload action', () => {
      const { element, api, selectTab } = setup(chart('EXTERNAL_OWNER'));

      expect(element.querySelector('[data-testid="type-tag"]')?.textContent).toContain('Patient externe');
      expect(element.textContent).toContain('34 ans · Femme · +216 20 123 456');
      expect(api.getMedicalSummary).toHaveBeenCalledWith(PATIENT_ID);
      expect(buttonByText(element, 'Modifier')).toBeTruthy();
      expect(element.textContent).toContain('Pénicilline');

      selectTab('documents');
      expect(buttonByText(element, 'Ajouter un document')).toBeTruthy();
    });

    it('opens the inline edit form inside the card, not a modal', () => {
      const { element, fixture } = setup(chart('EXTERNAL_OWNER'));

      buttonByText(element, 'Modifier')?.click();
      fixture.detectChanges();

      expect(element.querySelector('app-chart-medical-summary-card form')).toBeTruthy();
      expect(document.querySelector('.ant-modal')).toBeNull();
      expect(buttonByText(element, 'Enregistrer')).toBeTruthy();
    });

    it('never renders technical identifiers or removed chips', () => {
      const { element } = setup(chart('EXTERNAL_OWNER'));
      const text = element.textContent ?? '';

      expect(text).not.toContain(PATIENT_ID);
      for (const forbidden of ['MRS', 'projection', 'N° assurance', 'Documents protégés', 'Saisie manuelle', 'Non lié', 'Genre']) {
        expect(text).not.toContain(forbidden);
      }
      expect(text).toContain('Sexe');
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
    it('shows one compact « Accès requis » block per medical section and fires no clinical request', () => {
      const { element, api, selectTab } = setup(chart('OMNICARE_RESTRICTED'));

      const blocks = element.querySelectorAll('[data-testid="access-required"]');
      expect(blocks.length).toBe(2);
      expect(blocks[0].textContent).toContain('Accès requis');
      expect(blocks[0].textContent).toContain('QR code ou autorisation');
      expect(element.textContent).toContain('Coordonnées');
      expect(api.getMedicalSummary).not.toHaveBeenCalled();
      expect(api.getDocuments).not.toHaveBeenCalled();

      selectTab('documents');
      expect(element.querySelector('[data-testid="access-required"]')).toBeTruthy();
      expect(api.getDocuments).not.toHaveBeenCalled();

      selectTab('consultations');
      expect(api.getConsultations).toHaveBeenCalled();
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

      expect(element.querySelectorAll('[data-testid="access-required"]').length).toBe(2);
      expect(element.textContent).not.toContain('n’a pas pu être chargé');
      expect(buttonByText(element, 'Modifier')).toBeUndefined();

      selectTab('documents');
      expect(element.querySelector('[data-testid="access-required"]')).toBeTruthy();
      expect(buttonByText(element, 'Ajouter un document')).toBeUndefined();
      expect(element.textContent).not.toContain('n’ont pas pu être chargés');
    });

    it('keeps the red error with « Réessayer » for a real failure', () => {
      const { element } = setup(chart('EXTERNAL_OWNER'), SUMMARY, new HttpErrorResponse({ status: 503 }));

      expect(element.textContent).toContain('Le résumé médical n’a pas pu être chargé');
      expect(buttonByText(element, 'Réessayer')).toBeTruthy();
    });

    it('never calls clinical endpoints outside EXTERNAL_OWNER and OMNICARE_GRANTED', () => {
      const restricted = chart('OMNICARE_RESTRICTED');
      const inconsistent = setup({ ...restricted, access: { ...restricted.access, clinical: true } });
      expect(inconsistent.api.getMedicalSummary).not.toHaveBeenCalled();
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
    it('shows empty states with their actions', () => {
      const { element, selectTab } = setup(chart('EXTERNAL_OWNER'));

      expect(element.querySelector('[data-testid="next-appointment-empty"]')?.textContent).toContain(
        'Aucun rendez-vous à venir',
      );
      expect(element.textContent).toContain('Aucun document');

      selectTab('documents');
      const empty = element.querySelector('oc-empty-state');
      expect(empty?.textContent).toContain('Aucun document');
      expect(empty?.textContent).toContain('Ajouter un document');

      selectTab('consultations');
      expect(element.querySelector('oc-empty-state')?.textContent).toContain('Planifier un rendez-vous');
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
    expect(documentFileError({ name: 'a.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 })).toContain(
      '20 Mo',
    );
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
