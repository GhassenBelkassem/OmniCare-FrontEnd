import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { ArtifactApiService } from '../artifact-api.service';
import { ConsultationFinishFlow } from './consultation-finish.flow';
import { ConsultationSessionStore } from './consultation-session.store';
import {
  STANDARD_TEMPLATE_ID,
  SickLeaveTemplatePicker,
  preselectedTemplateId,
  sickLeaveTemplateOptions,
} from './sick-leave-template-picker';
import {
  COMPLETE_NOTE,
  CONSULTATION_ID,
  DRAFT_PRESCRIPTION,
  certificate,
  createFakes,
  fakeProviders,
  record,
  sickLeaveTemplate,
  type FakeOptions,
} from './testing/consultation-harness';

const SICK_LEAVE = certificate({
  artifactId: 'artifact-sick-leave',
  artifactType: 'SICK_LEAVE_CERTIFICATE',
  definition: { certificate: { statement: 'Repos.', startDate: '2026-11-10', endDate: '2026-11-12' } },
});
const MEDICAL = certificate({ artifactId: 'artifact-medical' });

function picker(options: FakeOptions = {}) {
  const fakes = createFakes(options);
  TestBed.configureTestingModule({ providers: [...fakeProviders(fakes), SickLeaveTemplatePicker] });
  return { fakes, picker: TestBed.inject(SickLeaveTemplatePicker) };
}

describe('sick-leave template preselection', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps only ACTIVE sick-leave templates, default first', () => {
    const options = sickLeaveTemplateOptions([
      sickLeaveTemplate({ id: 'draft', status: 'DRAFT' }),
      sickLeaveTemplate({ id: 'inactive', status: 'INACTIVE' }),
      sickLeaveTemplate({ id: 'plain', name: 'Cabinet B' }),
      sickLeaveTemplate({ id: 'default', name: 'Cabinet A', isDefault: true }),
    ]);
    expect(options.map((option) => option.id)).toEqual(['default', 'plain']);
    expect(options[0].label).toBe('Cabinet A (par défaut)');
  });

  it('preselects the default, else the only active one, else nothing', () => {
    expect(preselectedTemplateId([
      { id: 'a', label: 'A', isDefault: false },
      { id: 'b', label: 'B', isDefault: true },
    ])).toBe('b');
    expect(preselectedTemplateId([{ id: 'only', label: 'Seul', isDefault: false }])).toBe('only');
    expect(preselectedTemplateId([
      { id: 'a', label: 'A', isDefault: false },
      { id: 'b', label: 'B', isDefault: false },
    ])).toBeNull();
    expect(preselectedTemplateId([])).toBeNull();
  });

  it('loads once and preselects the default template', () => {
    const { fakes, picker: subject } = picker({
      templates: [sickLeaveTemplate({ id: 'one' }), sickLeaveTemplate({ id: 'two', isDefault: true })],
    });
    subject.ensureLoaded();
    subject.ensureLoaded();
    expect(fakes.templates.list).toHaveBeenCalledTimes(1);
    expect(subject.visible()).toBe(true);
    expect(subject.selectedId()).toBe('two');
    expect(subject.templateIdFor('SICK_LEAVE_CERTIFICATE')).toBe('two');
  });

  it('preselects the only active template when there is no default', () => {
    const { picker: subject } = picker({
      templates: [sickLeaveTemplate({ id: 'only' }), sickLeaveTemplate({ id: 'old', status: 'INACTIVE' })],
    });
    subject.ensureLoaded();
    expect(subject.selectedId()).toBe('only');
  });

  it('is hidden and sends nothing when the doctor has no active template', () => {
    const { picker: subject } = picker({ templates: [sickLeaveTemplate({ status: 'DRAFT' })] });
    subject.ensureLoaded();
    expect(subject.visible()).toBe(false);
    expect(subject.templateIdFor('SICK_LEAVE_CERTIFICATE')).toBeNull();
  });

  it('is hidden and sends nothing when the template list fails', () => {
    const { picker: subject } = picker({ templates: 'error' });
    subject.ensureLoaded();
    expect(subject.visible()).toBe(false);
    expect(subject.templateIdFor('SICK_LEAVE_CERTIFICATE')).toBeNull();
  });

  it('never gives a template for another document type', () => {
    const { picker: subject } = picker({ templates: [sickLeaveTemplate({ id: 'only' })] });
    subject.ensureLoaded();
    expect(subject.templateIdFor('MEDICAL_CERTIFICATE')).toBeNull();
    expect(subject.templateIdFor('PRESCRIPTION')).toBeNull();
  });

  it('ends the list with « Modèle standard », keeps the default preselected, and sends no template for it', () => {
    const { picker: subject } = picker({
      templates: [sickLeaveTemplate({ id: 'one' }), sickLeaveTemplate({ id: 'two', isDefault: true })],
    });
    subject.ensureLoaded();
    expect(subject.choices().map((option) => option.label)).toEqual([
      expect.stringContaining('(par défaut)'), expect.any(String), 'Modèle standard',
    ]);
    expect(subject.choices().at(-1)?.id).toBe(STANDARD_TEMPLATE_ID);
    expect(subject.selectedId()).toBe('two');
    subject.select(STANDARD_TEMPLATE_ID);
    expect(subject.selectedId()).toBe(STANDARD_TEMPLATE_ID);
    expect(subject.templateIdFor('SICK_LEAVE_CERTIFICATE')).toBeNull();
    subject.reload();
    expect(subject.selectedId()).toBe(STANDARD_TEMPLATE_ID);
  });

  it('offers no « Modèle standard » choice when the doctor has no active template (list hidden)', () => {
    const { picker: subject } = picker({ templates: [] });
    subject.ensureLoaded();
    expect(subject.choices()).toEqual([]);
  });

  it('ignores an id that is not in the list', () => {
    const { picker: subject } = picker({ templates: [sickLeaveTemplate({ id: 'only' })] });
    subject.ensureLoaded();
    subject.select('unknown');
    expect(subject.selectedId()).toBeNull();
    expect(subject.templateIdFor('SICK_LEAVE_CERTIFICATE')).toBeNull();
  });
});

describe('« Terminer » with a sick-leave template', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: FakeOptions) {
    const fakes = createFakes({
      record: record(COMPLETE_NOTE),
      prescription: DRAFT_PRESCRIPTION,
      artifacts: [SICK_LEAVE, MEDICAL],
      ...options,
    });
    TestBed.configureTestingModule({
      providers: [...fakeProviders(fakes), ConsultationSessionStore, ConsultationFinishFlow, SickLeaveTemplatePicker],
    });
    const session = TestBed.inject(ConsultationSessionStore);
    const flow = TestBed.inject(ConsultationFinishFlow);
    const templates = TestBed.inject(SickLeaveTemplatePicker);
    await session.load(CONSULTATION_ID);
    templates.ensureLoaded();
    return { fakes, flow, templates };
  }

  function finalizeCall(fakes: ReturnType<typeof createFakes>, artifactId: string): unknown[] {
    const call = fakes.artifacts.finalize.mock.calls.find((args) => (args[1] as { artifactId: string }).artifactId === artifactId);
    if (!call) throw new Error(`no finalize call for ${artifactId}`);
    return call;
  }

  it('sends the chosen template only for the sick-leave certificate', async () => {
    const { fakes, flow } = await setup({ templates: [sickLeaveTemplate({ id: 'template-1', isDefault: true })] });
    await flow.confirmFinish();
    expect(finalizeCall(fakes, 'artifact-sick-leave')[3]).toBe('template-1');
    expect(finalizeCall(fakes, 'artifact-medical')[3]).toBeNull();
    expect(flow.phase()).toBe('done');
  });

  it('sends no template when the list failed: « Terminer » still works', async () => {
    const { fakes, flow } = await setup({ templates: 'error' });
    await flow.confirmFinish();
    expect(finalizeCall(fakes, 'artifact-sick-leave')[3]).toBeNull();
    expect(flow.phase()).toBe('done');
  });

  it.each(['TEMPLATE_NOT_FOUND', 'INVALID_TEMPLATE_STATE'])(
    '%s at signature: French message, list reloaded, consultation left open',
    async (code) => {
      const { fakes, flow } = await setup({ templates: [sickLeaveTemplate({ id: 'template-1' })] });
      fakes.artifacts.finalize.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
        status: code === 'TEMPLATE_NOT_FOUND' ? 404 : 409, error: { code, detail: 'Template gone (English)' },
      })));
      await flow.confirmFinish();
      expect(flow.error()).toBe('Ce modèle n’est plus disponible. Choisissez-en un autre.');
      expect(flow.phase()).toBe('idle');
      expect(fakes.templates.list).toHaveBeenCalledTimes(2);
      expect(fakes.consultations.finish).not.toHaveBeenCalled();
    },
  );

  it('« Modèle standard » chosen: « Terminer » sends no template', async () => {
    const { fakes, flow, templates } = await setup({ templates: [sickLeaveTemplate({ id: 'template-1', isDefault: true })] });
    templates.select(STANDARD_TEMPLATE_ID);
    await flow.confirmFinish();
    expect(finalizeCall(fakes, 'artifact-sick-leave')[3]).toBeNull();
    expect(flow.phase()).toBe('done');
  });

  it('a name only the template cannot print: the message points to « Modèle standard »', async () => {
    const { fakes, flow } = await setup({ templates: [sickLeaveTemplate({ id: 'template-1', isDefault: true })] });
    fakes.artifacts.finalize.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
      status: 422, error: { code: 'TEMPLATE_UNPRINTABLE_TEXT', detail: 'Unprintable (English)' },
    })));
    await flow.confirmFinish();
    expect(flow.error()).toContain('Rien n’a été signé.');
    expect(flow.error()).toMatch(/ou choisissez « Modèle standard » dans la liste\.$/);
    expect(flow.phase()).toBe('idle');
  });

  it.each([
    ['UNPRINTABLE_TEXT', 'Le texte du document contient des caractères que l’impression ne prend pas encore en charge'],
    ['TEMPLATE_TEXT_OVERFLOW', 'Un texte est trop long pour sa zone sur votre modèle d’arrêt de travail.'],
  ])('%s at signature (G-1 D5 guard): French message, nothing signed, consultation left open', async (code, message) => {
    const { fakes, flow } = await setup({ templates: [sickLeaveTemplate({ id: 'template-1' })] });
    fakes.artifacts.finalize.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
      status: 422, error: { code, detail: 'Unprintable (English)' },
    })));
    await flow.confirmFinish();
    expect(flow.error()).toContain(message);
    expect(flow.error()).toContain('Rien n’a été signé.');
    expect(flow.error()).not.toContain('Modèle standard');
    expect(flow.phase()).toBe('idle');
    expect(fakes.consultations.finish).not.toHaveBeenCalled();
  });
});

describe('ArtifactApiService.finalize body', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } }],
    });
    return { api: TestBed.inject(ArtifactApiService), http: TestBed.inject(HttpTestingController) };
  }

  it('adds templateId when given', () => {
    const { api, http } = setup();
    api.finalize(CONSULTATION_ID, { ...SICK_LEAVE, artifactVersion: 3 }, 'key-1', 'template-1').subscribe();
    const request = http.expectOne(`/api/v1/doctor/consultations/${CONSULTATION_ID}/artifacts/artifact-sick-leave/finalize`);
    expect(request.request.body).toEqual({ expectedArtifactVersion: 3, confirmation: true, templateId: 'template-1' });
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    http.verify();
  });

  it('leaves templateId out otherwise', () => {
    const { api, http } = setup();
    api.finalize(CONSULTATION_ID, { ...MEDICAL, artifactVersion: 2 }, 'key-2').subscribe();
    const request = http.expectOne(`/api/v1/doctor/consultations/${CONSULTATION_ID}/artifacts/artifact-medical/finalize`);
    expect(request.request.body).toEqual({ expectedArtifactVersion: 2, confirmation: true });
    expect('templateId' in request.request.body).toBe(false);
    http.verify();
  });
});
