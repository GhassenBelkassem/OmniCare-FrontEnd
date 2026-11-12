import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import type { DocumentTemplateField } from '../documents/document-template-api.models';
import { ConsultationFinishFlow } from './consultation-finish.flow';
import { ConsultationSessionStore } from './consultation-session.store';
import { ConsultationUi } from './consultation-ui';
import { ContactCompletionDrawer } from './contact-completion-drawer';
import { identityWarning, identityWarningMessage } from './model/identity-warning';
import { STANDARD_TEMPLATE_ID, SickLeaveTemplatePicker } from './sick-leave-template-picker';
import {
  COMPLETE_NOTE,
  CONSULTATION_ID,
  DRAFT_PRESCRIPTION,
  certificate,
  consultation,
  createFakes,
  fakeProviders,
  record,
  sickLeaveTemplate,
  type FakeOptions,
} from './testing/consultation-harness';

const fields = (...keys: string[]) => keys.map((fieldKey) => ({ fieldKey }) as DocumentTemplateField);
const SICK_LEAVE = certificate({
  artifactId: 'artifact-sick-leave',
  artifactType: 'SICK_LEAVE_CERTIFICATE',
  definition: { certificate: { statement: 'Repos.', startDate: '2026-11-10', endDate: '2026-11-12' } },
});
const PATIENT_ZONES = sickLeaveTemplate({
  id: 'template-1', isDefault: true, fields: fields('patientFullName', 'patientDateOfBirth', 'patientAddress'),
});

describe('« Terminer » patient-data warning wording (G-1 D5)', () => {
  it('uses the CTO wording when birth date and address are missing', () => {
    expect(identityWarningMessage(['dateOfBirth', 'address'])).toBe(
      'La date de naissance et l’adresse du patient ne sont pas renseignées : elles resteront vides sur l’arrêt de travail.',
    );
  });

  it('agrees with what is missing', () => {
    expect(identityWarningMessage(['dateOfBirth'])).toBe(
      'La date de naissance du patient n’est pas renseignée : elle restera vide sur l’arrêt de travail.');
    expect(identityWarningMessage(['address'])).toBe(
      'L’adresse du patient n’est pas renseignée : elle restera vide sur l’arrêt de travail.');
    expect(identityWarningMessage(['age'])).toBe(
      'L’âge du patient n’est pas renseigné : il restera vide sur l’arrêt de travail.');
    expect(identityWarningMessage(['dateOfBirth', 'age', 'address'])).toBe(
      'La date de naissance, l’âge et l’adresse du patient ne sont pas renseignés : ils resteront vides sur l’arrêt de travail.');
  });

  it('only warns for zones the template has; an approximate age fills « Âge » but never the birth date', () => {
    const approximate = { patientType: 'EXTERNAL' as const, dateOfBirth: null, ageYears: 20, addressKnown: true };
    expect(identityWarning(new Set(['patientAge']), approximate)).toBeNull();
    expect(identityWarning(new Set(['patientDateOfBirth', 'patientAge']), approximate)?.missing).toEqual(['dateOfBirth']);
    expect(identityWarning(new Set(['patientFullName']), { ...approximate, addressKnown: false })).toBeNull();
    expect(identityWarning(new Set(), { ...approximate, addressKnown: false })).toBeNull();
  });

  it('lets the doctor complete an external patient, and only warns for an OmniCare patient', () => {
    const facts = { dateOfBirth: null, ageYears: null, addressKnown: false };
    expect(identityWarning(new Set(['patientAddress']), { ...facts, patientType: 'EXTERNAL' })?.editable).toBe(true);
    expect(identityWarning(new Set(['patientAddress']), { ...facts, patientType: 'OMNICARE' })?.editable).toBe(false);
  });
});

describe('« Terminer » with missing patient data on the template (G-1 D5)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: FakeOptions) {
    const fakes = createFakes({
      record: record(COMPLETE_NOTE),
      prescription: DRAFT_PRESCRIPTION,
      artifacts: [SICK_LEAVE],
      ...options,
    });
    TestBed.configureTestingModule({
      providers: [...fakeProviders(fakes), ConsultationSessionStore, ConsultationFinishFlow, ConsultationUi, SickLeaveTemplatePicker,
        provideNzIcons(OMNICARE_ICONS), provideNzI18n(fr_FR), provideNoopAnimations()],
    });
    const session = TestBed.inject(ConsultationSessionStore);
    const flow = TestBed.inject(ConsultationFinishFlow);
    const templates = TestBed.inject(SickLeaveTemplatePicker);
    await session.load(CONSULTATION_ID);
    templates.ensureLoaded();
    return { fakes, flow, templates, session };
  }

  it('warns instead of opening the confirmation, and « Terminer quand même » goes on', async () => {
    const { flow } = await setup({ templates: [PATIENT_ZONES] });
    expect(await flow.requestFinish()).toBe(true);
    expect(flow.identityGate()).toBe(true);
    expect(flow.confirmOpen()).toBe(false);
    expect(flow.identityWarning()?.message).toBe(
      'La date de naissance et l’adresse du patient ne sont pas renseignées : elles resteront vides sur l’arrêt de travail.');
    expect(flow.identityWarning()?.editable).toBe(true);

    flow.continueDespiteIdentity();
    expect(flow.identityGate()).toBe(false);
    expect(flow.confirmOpen()).toBe(true);
  });

  it('goes straight to the confirmation when the data is known or the standard model is chosen', async () => {
    const known = consultation({
      patient: { ...consultation().patient!, dateOfBirth: '2006-03-14', ageApproximate: false, addressKnown: true },
    });
    const complete = await setup({ templates: [PATIENT_ZONES], consultation: known });
    await complete.flow.requestFinish();
    expect(complete.flow.identityGate()).toBe(false);
    expect(complete.flow.confirmOpen()).toBe(true);
    TestBed.resetTestingModule();

    const standard = await setup({ templates: [PATIENT_ZONES] });
    standard.templates.select(STANDARD_TEMPLATE_ID);
    await standard.flow.requestFinish();
    expect(standard.flow.identityWarning()).toBeNull();
    expect(standard.flow.confirmOpen()).toBe(true);
  });

  it('warns an OmniCare patient without offering an edit', async () => {
    const omnicare = consultation({ patient: { ...consultation().patient!, patientType: 'OMNICARE' } }, 'OMNICARE_GRANTED');
    const { flow } = await setup({ templates: [PATIENT_ZONES], consultation: omnicare });
    await flow.requestFinish();
    expect(flow.identityGate()).toBe(true);
    expect(flow.identityWarning()?.editable).toBe(false);
  });

  it('« Compléter les coordonnées »: opens the « Coordonnées » edit, then back to the checklist without the warning', async () => {
    const { fakes, flow } = await setup({ templates: [PATIENT_ZONES] });
    await flow.requestFinish();
    const ui = TestBed.inject(ConsultationUi);
    const fixture = TestBed.createComponent(ContactCompletionDrawer);
    ui.contactOpen.set(true);
    fixture.detectChanges();
    expect(fakes.chart.getChart).toHaveBeenCalled();

    const completed = consultation({
      patient: { ...consultation().patient!, dateOfBirth: '2006-03-14', ageApproximate: false, addressKnown: true },
    });
    fakes.consultations.get.mockReturnValue(of(completed));
    await fixture.componentInstance.onSaved();

    expect(ui.contactOpen()).toBe(false);
    expect(flow.identityWarning()).toBeNull();
  });
});
