import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { AppointmentApiService } from '../appointment-api.service';
import { abortReasonOptions } from './consultation-abort';
import { ConsultationPage } from './consultation-page';
import type { ConsultationSummary } from '../medical-record.models';
import { ConsultationSessionStore } from './consultation-session.store';
import {
  COMPLETE_NOTE,
  CONSULTATION_ID,
  DRAFT_PRESCRIPTION,
  certificate,
  consultation,
  createFakes,
  fakeProviders,
  order,
  record,
  workspace,
  type FakeOptions,
  type Fakes,
} from './testing/consultation-harness';

const ENGLISH = /(?<!\p{L})(save|saved|required|invalid|error|loading|submit|cancel|confirm|select an option|elements|draft|pending|failed|unavailable)(?!\p{L})/iu;
const RAW_CODE = /\b[A-Z]{2,}(?:_[A-Z]{2,})+\b/;
const JARGON = /(?<!\p{L})(MRS|version|référence|contexte de soins|canonique|idempotence|artefact|épisode)(?!\p{L})/iu;

interface Rendered {
  readonly fixture: ComponentFixture<ConsultationPage>;
  readonly fakes: Fakes;
  readonly session: ConsultationSessionStore;
  readonly page: ConsultationPage;
  text(): string;
}

async function render(options: FakeOptions = {}): Promise<Rendered> {
  const fakes = createFakes(options);
  TestBed.configureTestingModule({
    imports: [ConsultationPage],
    providers: [
      provideNoopAnimations(),
      provideRouter([]),
      provideNzIcons(OMNICARE_ICONS),
      provideNzI18n(fr_FR),
      ...fakeProviders(fakes),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: CONSULTATION_ID }) } } },
    ],
  });
  const fixture = TestBed.createComponent(ConsultationPage);
  const session = fixture.debugElement.injector.get(ConsultationSessionStore);
  await stable(fixture);
  return { fixture, fakes, session, page: fixture.componentInstance, text: () => document.body.textContent ?? '' };
}

async function stable(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
  }
}

function segment(root: HTMLElement, label: string): HTMLElement {
  const item = Array.from(root.querySelectorAll<HTMLElement>('label[nz-segmented-item], label.ant-segmented-item'))
    .find((element) => element.textContent?.trim() === label);
  if (!item) throw new Error(`segment « ${label} » not found`);
  return item;
}

function dialogButton(label: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ant-modal button'))
    .find((element) => element.textContent?.trim() === label);
  if (!found) throw new Error(`dialog button « ${label} » not found`);
  return found;
}

/** Types into a field without leaving its section. */
function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.focus();
  element.value = value;
  element.dispatchEvent(new Event('input'));
}

/** Focus moves from `from` to `to` (a real focusout with its relatedTarget). */
function moveFocus(from: HTMLElement, to: HTMLElement | null): void {
  from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to }));
  to?.focus();
}

function errorsIn(selector: string): string[] {
  return Array.from(document.querySelectorAll(`${selector} .c-field__error`)).map((element) => element.textContent?.trim() ?? '');
}

function button(label: string | RegExp): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
    .find((element) => (typeof label === 'string' ? element.textContent?.trim() === label : label.test(element.textContent ?? '')));
  if (!found) throw new Error(`button « ${label} » not found`);
  return found;
}

describe('ConsultationPage (single page)', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
  });

  it('shows the patient, the appointment times and no static or technical text', async () => {
    const { text } = await render();
    expect(text()).toContain('Marwa Mechergui');
    expect(text()).toContain('environ 20 ans');
    expect(text()).toContain('Patient externe');
    expect(text()).toContain('En cours');
    expect(text()).toMatch(/Rendez-vous de 10:00 · commencée à 10:05/);
    expect(text()).not.toMatch(/Constantes|Aperçu PDF|Synchronisé|Ctrl\+S|Modifié/);
  });

  it('reveals the prescription editor only after « Prescrire », and hides it again on « Aucun médicament »', async () => {
    const { fixture, session, text } = await render();
    expect(text()).not.toContain('Médicament 1');
    segment(fixture.nativeElement, 'Prescrire').click();
    await stable(fixture);
    expect(text()).toContain('Médicament 1');
    expect(text()).toContain('Saisie libre · hors catalogue');
    expect(session.note().medicationDecision).toBe('MEDICATION_PRESCRIBED');

    segment(fixture.nativeElement, 'Aucun médicament').click();
    await stable(fixture);
    expect(text()).not.toContain('Médicament 1');
  });

  it('asks before discarding a saved prescription draft, and discards it on the server', async () => {
    const { fixture, fakes, text } = await render({ record: record(COMPLETE_NOTE), prescription: DRAFT_PRESCRIPTION });
    expect(text()).toContain('Médicament 1');
    segment(fixture.nativeElement, 'Aucun médicament').click();
    await stable(fixture);
    expect(text()).toContain('Retirer l’ordonnance ?');
    expect(fakes.prescriptions.discard).not.toHaveBeenCalled();
    dialogButton('Retirer').click();
    await stable(fixture);
    expect(fakes.prescriptions.discard).toHaveBeenCalledWith(CONSULTATION_ID, 2, expect.any(String));
    expect(text()).not.toContain('Médicament 1');
  });

  it('reveals orders, documents and the follow-up slot with their decisions', async () => {
    const { fixture, text } = await render();
    expect(text()).not.toContain('Analyse demandée');
    segment(fixture.nativeElement, 'Demander un examen').click();
    await stable(fixture);
    expect(text()).toContain('Analyse demandée');

    expect(text()).not.toContain('Créneau du contrôle');
    segment(fixture.nativeElement, 'Contrôle à une date').click();
    await stable(fixture);
    expect(text()).toContain('Créneau du contrôle');
    fixture.componentInstance.closeFollowUpPicker();
    await stable(fixture);

    expect(text()).not.toContain('Déclaration');
    (fixture.nativeElement.querySelector('#document-SICK_LEAVE_CERTIFICATE') as HTMLElement).click();
    await stable(fixture);
    expect(text()).toContain('Déclaration');
    expect(text()).toContain('Durée');
  });

  it('shows « Mise à jour du dossier médical » only for EXTERNAL_OWNER', async () => {
    const owner = await render();
    expect(owner.text()).toContain('Mise à jour du dossier médical');
    expect(owner.text()).toContain('Enregistré dans le dossier du patient à la fin de la consultation.');
    TestBed.resetTestingModule();
    document.body.innerHTML = '';

    const granted = await render({
      consultation: consultation({}, 'OMNICARE_GRANTED'),
      workspace: workspace({ access: { ...workspace().access, mode: 'OMNICARE_GRANTED' } }),
    });
    expect(granted.text()).not.toContain('Mise à jour du dossier médical');
    expect(granted.text()).toContain('Dossier médical');
  });

  it('shows « Aucune connue » and « Non renseigné » as different states in the read-only summary', async () => {
    const { text } = await render({
      workspace: workspace({
        essentialInformation: { bloodType: 'O+', allergies: [], criticalConditions: [], allergiesStatus: 'NONE_KNOWN', conditionsStatus: 'UNKNOWN' },
      }),
    });
    const aside = document.querySelector('.consultation-aside')!.textContent!;
    expect(aside).toContain('Aucune connue');
    expect(aside).toContain('Non renseigné');
    expect(aside).toContain('O+');
    expect(text()).toContain('Voir le dossier complet');
  });

  it('autosaves the motif after 1.5 s and shows « Enregistré »', async () => {
    const { fixture, fakes } = await render();
    vi.useFakeTimers();
    const motif = fixture.nativeElement.querySelector('#consultation-motif') as HTMLInputElement;
    motif.value = 'Fièvre';
    motif.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Enregistrement…');
    await vi.advanceTimersByTimeAsync(1400);
    expect(fakes.clinical.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(fakes.clinical.save).toHaveBeenCalledTimes(1);
    expect(fakes.clinical.save.mock.calls[0][2].chiefComplaint).toBe('Fièvre');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toMatch(/Enregistré · il y a \d+ s/);
  });

  it('keeps the draft on a 409 and asks for confirmation before « Recharger »', async () => {
    const { fixture, fakes, session, text } = await render();
    fakes.clinical.save.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { errorCode: 'CLINICAL_RECORD_VERSION_CONFLICT', detail: 'Version conflict' } })));
    session.updateNote({ chiefComplaint: 'Fièvre' });
    await session.flushAll();
    await stable(fixture);
    expect(text()).toContain('Cette consultation a été modifiée ailleurs.');
    expect(text()).not.toContain('Version conflict');
    expect(session.note().chiefComplaint).toBe('Fièvre');

    fakes.clinical.read.mockClear();
    button('Recharger').click();
    await stable(fixture);
    expect(text()).toContain('Vos modifications non enregistrées seront perdues.');
    expect(fakes.clinical.read).not.toHaveBeenCalled();
    dialogButton('Annuler').click();
    await stable(fixture);
    expect(fakes.clinical.read).not.toHaveBeenCalled();
    expect(session.note().chiefComplaint).toBe('Fièvre');
  });

  it('shows the retry state on 503', async () => {
    const { fixture, fakes, session, text } = await render();
    fakes.clinical.save.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 503, error: { errorCode: 'MRS_UNAVAILABLE' }, headers: new HttpHeaders({ 'Retry-After': '30' }),
    })));
    session.updateNote({ chiefComplaint: 'Fièvre' });
    await session.flushAll();
    await stable(fixture);
    expect(text()).toContain('Non enregistré — nouvelle tentative…');
    session.stopAutosave();
  });

  it('disables « Ajouter un médicament » at 15 lines and says why', async () => {
    const { fixture, session, text } = await render({ record: record({ medicationDecision: 'MEDICATION_PRESCRIBED' }) });
    for (let index = 0; index < 15; index += 1) session.addMedicationLine();
    await stable(fixture);
    expect(session.lines()).toHaveLength(15);
    expect(button(/Ajouter un médicament/).disabled).toBe(true);
    expect(text()).toContain('Une ordonnance peut contenir au plus 15 médicaments.');
    session.addMedicationLine();
    expect(session.lines()).toHaveLength(15);
  });

  it('« Terminer » with no follow-up: red fields, « Il manque : Suivi », focus moves to the first missing field', async () => {
    const { fixture, fakes, text } = await render({ record: record({ ...COMPLETE_NOTE, medicationDecision: 'NO_MEDICATION', followUp: { required: false, recommendedAt: null, decision: null } }) });
    button('Terminer la consultation').click();
    await stable(fixture);
    expect(text()).toContain('Il manque :');
    expect(text()).toContain('Choisissez le suivi recommandé.');
    expect(document.querySelector('#consultation-suivi')?.getAttribute('data-invalid')).toBe('true');
    expect(fakes.consultations.finish).not.toHaveBeenCalled();
  });

  it('the checklist links scroll to and focus their field', async () => {
    const { fixture } = await render();
    const link = Array.from(document.querySelectorAll<HTMLButtonElement>('.c-checklist__link'))
      .find((element) => element.textContent?.includes('Motif de consultation'))!;
    link.click();
    await stable(fixture);
    expect(document.activeElement?.id).toBe('consultation-motif');
  });

  it('runs « Terminer » end to end and shows « Consultation terminée » with the way back', async () => {
    const { fixture, fakes, text } = await render({ record: record(COMPLETE_NOTE), prescription: DRAFT_PRESCRIPTION, orders: [order()], artifacts: [certificate()] });
    button('Terminer la consultation').click();
    await stable(fixture);
    expect(text()).toContain('L’ordonnance et les documents seront signés et ne pourront plus être modifiés.');
    dialogButton('Terminer').click();
    await stable(fixture);
    expect(fakes.consultations.finish).toHaveBeenCalled();
    expect(text()).toContain('Consultation terminée');
    expect(text()).toContain('Retour à l’accueil');
    // G-1 D5: the signed documents are listed right away (« En préparation… » until rendered).
    expect(document.querySelector('[data-testid="finished-documents"]')).not.toBeNull();
    expect(fakes.consultations.getCompleted).toHaveBeenCalled();
  });

  it('renders no raw code, English word or jargon with every section open', async () => {
    const { fixture, session, text } = await render({
      record: record(COMPLETE_NOTE), prescription: DRAFT_PRESCRIPTION, orders: [order()],
      artifacts: [certificate(), certificate({ artifactId: 'a2', artifactType: 'SICK_LEAVE_CERTIFICATE', definition: { certificate: { statement: 'Repos', startDate: '2026-11-10', endDate: '2026-11-12' } } })],
    });
    segment(fixture.nativeElement, 'Contrôle à une date').click();
    session.updateNote({ diagnosis: 'x'.repeat(600) });
    button('Terminer la consultation').click();
    await stable(fixture);
    const rendered = text();
    expect(rendered.match(RAW_CODE)?.[0] ?? null).toBeNull();
    expect(rendered.match(ENGLISH)?.[0] ?? null).toBeNull();
    expect(rendered.match(JARGON)?.[0] ?? null).toBeNull();
  });

  describe('error timing (P2c)', () => {
    it('shows nothing while focus stays in the section, then the error when focus leaves it', async () => {
      const { fixture } = await render();
      const diagnostic = document.querySelector('#consultation-diagnostic') as HTMLTextAreaElement;
      const motif = document.querySelector('#consultation-motif') as HTMLInputElement;
      type(diagnostic, 'x'.repeat(501));
      // Focus moves inside the same section (to the status control): still nothing.
      const status = document.querySelector('[data-section="diagnostic"] nz-segmented label') as HTMLElement;
      moveFocus(diagnostic, status);
      await stable(fixture);
      expect(errorsIn('[data-section="diagnostic"]')).toEqual([]);
      expect(diagnostic.getAttribute('aria-invalid')).toBeNull();

      moveFocus(status, motif);
      await stable(fixture);
      expect(errorsIn('[data-section="diagnostic"]')).toEqual(['Texte trop long (500 caractères maximum).']);
      expect(diagnostic.getAttribute('aria-invalid')).toBe('true');
    });

    it('hides a revealed error as soon as it is fixed; a new one waits for the next leave', async () => {
      const { fixture } = await render();
      const diagnostic = document.querySelector('#consultation-diagnostic') as HTMLTextAreaElement;
      const motif = document.querySelector('#consultation-motif') as HTMLInputElement;
      type(diagnostic, 'x'.repeat(501));
      moveFocus(diagnostic, motif);
      await stable(fixture);
      expect(errorsIn('[data-section="diagnostic"]')).toHaveLength(1);

      type(diagnostic, 'Angine');
      await stable(fixture);
      expect(errorsIn('[data-section="diagnostic"]')).toEqual([]);

      type(diagnostic, 'y'.repeat(600));
      await stable(fixture);
      expect(errorsIn('[data-section="diagnostic"]')).toEqual([]);
      moveFocus(diagnostic, motif);
      await stable(fixture);
      expect(errorsIn('[data-section="diagnostic"]')).toEqual(['Texte trop long (500 caractères maximum).']);
    });

    it('server field errors from autosave follow the same rule', async () => {
      const { fixture, fakes, session } = await render();
      fakes.clinical.save.mockReturnValue(throwError(() => new HttpErrorResponse({
        status: 400,
        error: { errorCode: 'VALIDATION_ERROR', fieldErrors: { 'clinicalRecord.chiefComplaint': 'x' }, fieldErrorCodes: { 'clinicalRecord.chiefComplaint': 'TOO_LONG' } },
      })));
      const motif = document.querySelector('#consultation-motif') as HTMLInputElement;
      type(motif, 'Fièvre');
      await session.flushAll();
      await stable(fixture);
      expect(document.body.textContent).toContain('Non enregistré · champs à corriger');
      expect(errorsIn('[data-section="motif"]')).toEqual([]);
      moveFocus(motif, document.querySelector('#consultation-diagnostic') as HTMLElement);
      await stable(fixture);
      expect(errorsIn('[data-section="motif"]')).toHaveLength(1);
      expect(errorsIn('[data-section="motif"]')[0]).toMatch(/^Texte trop long \(1\s000 caractères maximum\)\.$/u);
    });

    it('« Terminer » reveals the errors of every section', async () => {
      const { fixture } = await render({ record: record({ medicationDecision: 'MEDICATION_PRESCRIBED' }), prescription: DRAFT_PRESCRIPTION });
      type(document.querySelector('#consultation-diagnostic') as HTMLTextAreaElement, 'x'.repeat(501));
      type(document.querySelector('#medication-0-quantity') as HTMLInputElement, '0');
      await stable(fixture);
      // Focus is still in the treatment section: nothing red there yet.
      expect(errorsIn('[data-section="traitement"]')).toEqual([]);
      button('Terminer la consultation').click();
      await stable(fixture);
      const shown = errorsIn('.consultation-main');
      expect(shown).toContain('Indiquez le motif de consultation.');
      expect(shown).toContain('Texte trop long (500 caractères maximum).');
      expect(shown).toContain('Indiquez une quantité d’au moins 1.');
      expect(shown).toContain('Choisissez le suivi recommandé.');
    });

    it('choosing in a select or a segmented control never turns anything red', async () => {
      const { fixture, session } = await render({ record: record({ medicationDecision: 'MEDICATION_PRESCRIBED' }) });
      session.addMedicationLine();
      await stable(fixture);
      const unit = (document.querySelector('#medication-0-unit') as HTMLElement).closest('nz-select') as HTMLElement;
      (unit.querySelector('.ant-select-selector') as HTMLElement).click();
      await stable(fixture);
      const option = document.querySelector('.cdk-overlay-container .ant-select-item-option') as HTMLElement;
      expect(option).toBeTruthy();
      // Focus moving into the menu is not a leave.
      moveFocus(unit.querySelector('input') as HTMLElement, option);
      option.click();
      await stable(fixture);
      segment(fixture.nativeElement, 'Aucun suivi').click();
      segment(fixture.nativeElement, 'Confirmé').click();
      await stable(fixture);
      expect(session.lines()[0].unit).not.toBeNull();
      expect(errorsIn('.consultation-main')).toEqual([]);
      expect(document.querySelectorAll('.consultation-main [aria-invalid="true"], .consultation-main [data-invalid="true"]')).toHaveLength(0);
    });
  });

  describe('« Dossier patient » side panel (P2c)', () => {
    it('opens over the page with the chart components read-only, and closes without touching drafts or queues', async () => {
      const { fixture, fakes, session } = await render();
      session.updateNote({ chiefComplaint: 'Toux sèche' });
      const queueState = session.noteQueue.state();
      const unsaved = session.hasUnsavedChanges();
      expect(fakes.chart.getChart).not.toHaveBeenCalled();

      button('Dossier patient').click();
      await stable(fixture);
      await stable(fixture);
      const drawer = document.querySelector('.ant-drawer') as HTMLElement;
      expect(drawer).toBeTruthy();
      expect(drawer.querySelector('.pr-header__name')?.textContent).toContain('Marwa Mechergui');
      expect(fakes.chart.getChart).toHaveBeenCalledTimes(1);
      // The same component as the chart page (« Dossier patient » = the medical record).
      expect(drawer.querySelector('app-patient-record-view')).toBeTruthy();
      const tabs = Array.from(drawer.querySelectorAll<HTMLElement>('[role="tab"]'));
      expect(tabs.map((tab) => tab.querySelector('span')?.textContent?.trim())).toEqual(['Résumé', 'Historique', 'Documents']);
      expect(drawer.textContent).toContain('Aucune connue');
      expect(drawer.textContent).not.toContain('Modifier');

      tabs[1].click();
      await stable(fixture);
      expect(drawer.querySelector('[data-testid="current-consultation"]')?.textContent).toContain('Consultation actuelle');
      expect(drawer.querySelector('[data-testid="current-consultation"]')?.textContent).toContain('En cours');
      tabs[2].click();
      await stable(fixture);
      expect(drawer.textContent).not.toContain('Ajouter un document');
      // P3b: the patient page's practical information stays out of the drawer.
      expect(drawer.querySelector('[data-testid="contact-card"]')).toBeNull();
      expect(drawer.querySelector('[data-testid="next-appointment-card"]')).toBeNull();
      expect(drawer.querySelector('[data-testid="upload-action"]')).toBeNull();
      expect(drawer.textContent).not.toContain('Coordonnées');
      expect(drawer.textContent).not.toContain('Prochain rendez-vous');

      // The close button is a 44px bordered square in the record header.
      (drawer.querySelector('button[aria-label="Fermer le dossier"]') as HTMLElement).click();
      await stable(fixture);
      expect(session.note().chiefComplaint).toBe('Toux sèche');
      expect(session.noteQueue.state()).toBe(queueState);
      expect(session.hasUnsavedChanges()).toBe(unsaved);
      expect(fakes.prescriptions.discard).not.toHaveBeenCalled();
      session.stopAutosave();
    });

    it('opens from « Voir le dossier complet » in the Dossier médical card', async () => {
      const { fixture } = await render();
      button(/Voir le dossier complet/).click();
      await stable(fixture);
      expect(document.querySelector('.ant-drawer .pr-header__name')?.textContent).toContain('Marwa Mechergui');
    });
  });

  describe('« Annuler la consultation » and closure states (P3a)', () => {
    function abortButton(): HTMLElement | null {
      return document.querySelector('[data-testid="abort-action"] button');
    }

    it('the dialog lists the four reasons, each with its consequence on the appointment', async () => {
      const { fixture } = await render();
      abortButton()!.click();
      await stable(fixture);
      const modal = document.querySelector('.ant-modal') as HTMLElement;
      expect(modal.textContent).toContain('Annuler la consultation ?');
      const reasons = Array.from(modal.querySelectorAll<HTMLElement>('[data-reason]')).map((element) => [
        element.getAttribute('data-reason'),
        element.querySelector('.c-abort__label')?.textContent?.trim(),
        element.querySelector('.c-abort__consequence')?.textContent?.trim(),
      ]);
      // The slot (10 nov. 09:00) is in the past in the harness: « Démarrée par erreur » cancels.
      expect(reasons).toEqual([
        ['PATIENT_ABSENT', 'Patient absent', 'Le rendez-vous sera marqué absent.'],
        ['PATIENT_LEFT', 'Patient parti avant la fin', 'Le rendez-vous sera annulé.'],
        ['STARTED_BY_MISTAKE', 'Démarrée par erreur', 'Le rendez-vous sera annulé (son horaire est passé).'],
        ['TECHNICAL_ISSUE', 'Problème technique', 'Le rendez-vous sera annulé (son horaire est passé).'],
      ]);
      expect(dialogButton('Annuler la consultation').disabled).toBe(true);
      expect(dialogButton('Revenir')).toBeTruthy();
    });

    it('« Démarrée par erreur » says the appointment becomes « Confirmé » again while its slot has not started', () => {
      const now = new Date('2026-11-11T08:00:00Z');
      const options = abortReasonOptions('2026-11-11T09:00:00Z', now);
      expect(options.find((option) => option.value === 'STARTED_BY_MISTAKE')?.consequence).toBe('Le rendez-vous redevient confirmé.');
      expect(options.find((option) => option.value === 'TECHNICAL_ISSUE')?.consequence).toBe('Le rendez-vous redevient confirmé.');
      expect(abortReasonOptions(null, now)[2].consequence).toContain('si son horaire n’est pas encore passé');
    });

    it('aborts with the reason and version, stops autosave and shows « Consultation annulée »', async () => {
      const { fixture, fakes, session, text } = await render();
      const stop = vi.spyOn(session, 'stopAutosave');
      abortButton()!.click();
      await stable(fixture);
      (document.querySelector('.ant-modal [data-reason="PATIENT_ABSENT"]') as HTMLElement).click();
      await stable(fixture);
      dialogButton('Annuler la consultation').click();
      await stable(fixture);
      await stable(fixture);
      expect(fakes.consultations.abort).toHaveBeenCalledWith(CONSULTATION_ID, 'PATIENT_ABSENT', 3, expect.stringMatching(/^consultation-abort:/));
      expect(stop).toHaveBeenCalled();
      expect(session.hasUnsavedChanges()).toBe(false);
      expect(document.querySelector('[data-testid="aborted-state"]')?.textContent).toContain('Consultation annulée');
      expect(text()).toContain('Retour à l’accueil');
      expect(abortButton()).toBeNull();
      expect(fakes.active.refresh).toHaveBeenCalled();
    });

    it('maps a refusal to French and keeps the consultation open', async () => {
      const { fixture, fakes, session } = await render();
      fakes.consultations.abort.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { errorCode: 'CONSULTATION_HAS_SIGNED_ITEMS', detail: 'signed' } })));
      abortButton()!.click();
      await stable(fixture);
      (document.querySelector('.ant-modal [data-reason="PATIENT_LEFT"]') as HTMLElement).click();
      await stable(fixture);
      dialogButton('Annuler la consultation').click();
      await stable(fixture);
      expect(document.querySelector('.ant-modal')?.textContent).toContain('Un élément est déjà signé : la consultation ne peut plus être annulée. Terminez-la.');
      expect(document.querySelector('.ant-modal')?.textContent).not.toContain('signed');
      expect(session.consultation()?.status).toBe('IN_PROGRESS');
    });

    it.each([
      ['a signed prescription', { prescription: { ...DRAFT_PRESCRIPTION, status: 'ACTIVE' as const, finalized: true } }],
      ['a validated order', { orders: [order({ status: 'FINALIZED' })] }],
      ['a signed document', { artifacts: [certificate({ status: 'FINALIZED' })] }],
    ])('hides « Annuler la consultation » once there is %s', async (_label, options) => {
      await render({ record: record({ ...COMPLETE_NOTE, medicationDecision: 'MEDICATION_PRESCRIBED' }), ...options });
      expect(abortButton()).toBeNull();
    });

    it('hides it outside IN_PROGRESS', async () => {
      await render({ consultation: consultation({ status: 'FINALIZING', finishState: 'FAILED' }) });
      expect(abortButton()).toBeNull();
    });

    it('FINALIZING + failed closure: « La clôture n’a pas pu aboutir. Le support a été prévenu. », no polling, no resume', async () => {
      const { fakes, text } = await render({ consultation: consultation({ status: 'FINALIZING', finishState: 'FAILED' }) });
      expect(document.querySelector('[data-testid="closure-failed"]')?.textContent).toContain('La clôture n’a pas pu aboutir.');
      expect(text()).toContain('Le support a été prévenu.');
      expect(text()).toContain('Retour à l’accueil');
      expect(text()).not.toContain('Reprendre la clôture');
      expect(fakes.consultations.get).toHaveBeenCalledTimes(1);
      expect(fakes.clinical.read).not.toHaveBeenCalled();
    });

    it('no legacy appointment start / complete caller is left', () => {
      const api = AppointmentApiService.prototype as unknown as Record<string, unknown>;
      expect(api['startAppointment']).toBeUndefined();
      expect(api['completeAppointment']).toBeUndefined();
      expect(api['cancelAppointment']).toBeUndefined();
    });
  });

  describe('clinical visual language (P2e)', () => {
    it('« Avant de terminer »: done = primary check, missing = amber until a « Terminer » attempt, then red', async () => {
      const { fixture } = await render({ record: record({ ...COMPLETE_NOTE, medicationDecision: 'NO_MEDICATION', followUp: { required: false, recommendedAt: null, decision: null } }) });
      const states = (): string[] => Array.from(document.querySelectorAll('.c-checklist li')).map((element) => element.getAttribute('data-state') ?? '');
      expect(states()).toContain('done');
      expect(states()).toContain('missing');
      expect(states()).not.toContain('blocking');
      button('Terminer la consultation').click();
      await stable(fixture);
      expect(states()).toContain('blocking');
      expect(states()).not.toContain('missing');
    });

    it('the « Dossier médical » card uses the tints: amber allergies, violet antécédents, blood group, small date blocks', async () => {
      const visit = {
        consultationId: 'prev0000-0000-4000-8000-000000000009', recordVersion: 1, schemaVersion: 1, occurredAt: '2026-10-02T09:00:00Z',
        clinicalCodes: [], chiefComplaint: 'Toux', history: null, clinicalFindings: [], diagnoses: [{ system: null, code: null, label: 'Bronchite', status: 'CONFIRMED' }],
      } as unknown as ConsultationSummary;
      await render({
        workspace: workspace({
          essentialInformation: { bloodType: 'A+', allergies: ['Pénicilline'], criticalConditions: ['Asthme'], allergiesStatus: 'LIST', conditionsStatus: 'LIST' },
          consultationSummaries: { items: [visit], nextCursor: null },
        }),
      });
      const aside = document.querySelector('.consultation-aside') as HTMLElement;
      expect(aside.querySelector('.c-chip--allergy')?.textContent?.trim()).toBe('Pénicilline');
      expect(aside.querySelector('.c-chip--history')?.textContent?.trim()).toBe('Asthme');
      expect(aside.querySelector('.x-blood')?.textContent?.trim()).toBe('A+');
      const row = aside.querySelector('.x-visit') as HTMLElement;
      expect(row.querySelector('oc-date-block')?.textContent).toContain('OCT.');
      expect(row.textContent).toContain('Bronchite');
    });

    it('the allergy and antécédent chips being edited use their tints', async () => {
      const { fixture, session } = await render();
      session.updateNote({ summary: { allergies: { status: 'LIST', items: ['Pénicilline'] }, conditions: { status: 'LIST', items: ['Asthme'] }, bloodType: 'UNKNOWN' } });
      await stable(fixture);
      const section = document.querySelector('#consultation-dossier') as HTMLElement;
      expect(section.querySelector('nz-tag.c-chip--allergy')?.textContent).toContain('Pénicilline');
      expect(section.querySelector('nz-tag.c-chip--history')?.textContent).toContain('Asthme');
    });

    it('the segmented controls change with the arrow keys', async () => {
      const { fixture, session } = await render();
      const before = session.note().diagnosisStatus;
      const group = document.querySelector('[aria-labelledby="diagnostic-status-label"]') as HTMLElement;
      const selected = group.querySelector('.ant-segmented-item-selected') ?? group.querySelector('label');
      (selected as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
      await stable(fixture);
      expect(session.note().diagnosisStatus).not.toBe(before);
    });

    it('uses no uppercase CSS and no left-border accent', async () => {
      await render();
      const css = Array.from(document.querySelectorAll('style')).map((element) => element.textContent ?? '').join('\n');
      expect(css).toContain('c-card');
      expect(css).not.toMatch(/text-transform\s*:\s*uppercase/i);
      expect(css).not.toMatch(/border-inline-start\s*:\s*3px/i);
    });
  });

  describe('access request (G-1 D2)', () => {
    const OMNICARE_PATIENT = {
      chartId: '2c8d9e07-0000-4000-8000-000000000002', patientType: 'OMNICARE' as const, firstName: 'Sami', lastName: 'Trabelsi',
      fullName: 'Sami Trabelsi', ageYears: 41, ageApproximate: false, sex: 'M' as const, dateOfBirth: '1985-03-04',
    };
    const CAN_REQUEST = { request: null, used: 0, max: 3, canRequest: true };

    function restricted(patch: Partial<Parameters<typeof consultation>[0]> = {}) {
      return consultation({ medicalAccessStatus: 'NONE', patient: OMNICARE_PATIENT, accessRequest: CAN_REQUEST, ...patch }, 'OMNICARE_RESTRICTED');
    }

    function accessChanged(fakes: Fakes): void {
      fakes.realtime.scheduledCareEvents$.next({
        eventId: `event-${Math.random()}`, eventType: 'CLINICAL_ACCESS_CHANGED', resourceType: 'CONSULTATION',
        resourceId: CONSULTATION_ID, version: 4, occurredAt: '2026-11-11T08:10:00Z',
      });
    }

    function panelButton(label: string): HTMLButtonElement {
      const found = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="access-request-panel"] button'))
        .find((element) => element.textContent?.trim() === label);
      if (!found) throw new Error(`button « ${label} » not found`);
      return found;
    }

    it('« Demander l’accès » sends the request and shows « Demande envoyée… »', async () => {
      const { fixture, fakes } = await render({ consultation: restricted() });
      expect(document.querySelector('[data-testid="access-request-panel"]')?.textContent).toContain('Accès requis');
      // The server's state after the request (the page re-reads it for the new version).
      fakes.consultations.get.mockReturnValue(of(restricted({ version: 4, accessRequest: {
        request: { requestId: 'request-1', status: 'PENDING', version: 0, createdAt: '2026-11-11T08:05:00Z', respondedAt: null }, used: 1, max: 3, canRequest: false,
      } })));
      panelButton('Demander l’accès').click();
      await stable(fixture);
      expect(fakes.consultations.requestAccess).toHaveBeenCalledWith(CONSULTATION_ID, expect.stringMatching(/^access-request:/));
      expect(document.querySelector('[data-testid="access-request-panel"]')?.textContent).toContain('Demande envoyée…');
      expect(panelButton('Annuler la demande')).toBeTruthy();
    });

    it('keeps the consultation version current after a request (finish/abort never hit a stale version)', async () => {
      const { fixture, fakes, session } = await render({ consultation: restricted() });
      fakes.consultations.get.mockReturnValue(of(restricted({ version: 4, accessRequest: {
        request: { requestId: 'request-1', status: 'PENDING', version: 0, createdAt: '2026-11-11T08:05:00Z', respondedAt: null }, used: 1, max: 3, canRequest: false,
      } })));
      panelButton('Demander l’accès').click();
      await stable(fixture);
      expect(session.consultation()?.version).toBe(4);
      expect(session.consultation()?.accessRequest?.request?.status).toBe('PENDING');
    });

    it('switches to full access live when the patient accepts (no reload)', async () => {
      const pending = { request: { requestId: 'request-1', status: 'PENDING' as const, version: 0, createdAt: '2026-11-11T08:05:00Z', respondedAt: null }, used: 1, max: 3, canRequest: false };
      const { fixture, fakes, session } = await render({ consultation: restricted({ accessRequest: pending }) });
      expect(session.canReadContext()).toBe(false);
      fakes.consultations.get.mockReturnValue(of(consultation({
        medicalAccessStatus: 'ACTIVE', patient: OMNICARE_PATIENT,
        accessRequest: { ...pending, request: { ...pending.request, status: 'ACCEPTED', version: 1, respondedAt: '2026-11-11T08:07:00Z' } },
      }, 'OMNICARE_GRANTED')));
      fakes.medicalRecord.attach.mockClear();
      accessChanged(fakes);
      await stable(fixture);
      expect(session.canReadContext()).toBe(true);
      expect(fakes.medicalRecord.attach).toHaveBeenCalledWith(CONSULTATION_ID);
      expect(document.querySelector('[data-testid="access-request-panel"]')).toBeNull();
    });

    it('a refusal shows « Le patient a refusé l’accès. » with « Redemander »', async () => {
      const { fixture, fakes } = await render({ consultation: restricted({ accessRequest: {
        request: { requestId: 'request-1', status: 'PENDING', version: 0, createdAt: '2026-11-11T08:05:00Z', respondedAt: null }, used: 1, max: 3, canRequest: false,
      } }) });
      fakes.consultations.get.mockReturnValue(of(restricted({ accessRequest: {
        request: { requestId: 'request-1', status: 'REFUSED', version: 1, createdAt: '2026-11-11T08:05:00Z', respondedAt: '2026-11-11T08:07:00Z' }, used: 1, max: 3, canRequest: true,
      } })));
      accessChanged(fakes);
      await stable(fixture);
      const panel = document.querySelector('[data-testid="access-request-panel"]')!;
      expect(panel.textContent).toContain('Le patient a refusé l’accès.');
      panelButton('Redemander').click();
      await stable(fixture);
      expect(fakes.consultations.requestAccess).toHaveBeenCalledTimes(1);
    });

    it('the limit is explained in French and offers no button', async () => {
      await render({ consultation: restricted({ accessRequest: {
        request: { requestId: 'request-3', status: 'REFUSED', version: 1, createdAt: '2026-11-11T08:05:00Z', respondedAt: '2026-11-11T08:07:00Z' }, used: 3, max: 3, canRequest: false,
      } }) });
      const panel = document.querySelector('[data-testid="access-request-panel"]')!;
      expect(panel.textContent).toContain('Le patient a refusé l’accès.');
      expect(panel.querySelector('button')).toBeNull();
    });

    it('a revoke during the consultation shows « Votre accès … a été retiré. » and « Terminer » still works', async () => {
      const { fixture, fakes } = await render({
        consultation: consultation({ patient: OMNICARE_PATIENT, accessRequest: { ...CAN_REQUEST, canRequest: false } }, 'OMNICARE_GRANTED'),
        record: record(COMPLETE_NOTE), prescription: DRAFT_PRESCRIPTION, orders: [order()], artifacts: [certificate()],
      });
      fakes.consultations.get.mockReturnValue(of(restricted({ medicalAccessStatus: 'REVOKED' })));
      accessChanged(fakes);
      await stable(fixture);
      const panel = document.querySelector('[data-testid="access-request-panel"]')!;
      expect(panel.textContent).toContain('Votre accès au dossier médical de ce patient a été retiré.');
      expect(document.body.textContent).not.toContain('Réessayer');
      button('Terminer la consultation').click();
      await stable(fixture);
      dialogButton('Terminer').click();
      await stable(fixture);
      expect(fakes.consultations.finish).toHaveBeenCalled();
      expect(document.body.textContent).toContain('Consultation terminée');
    });

    it('a revoked read (before the live refresh) shows the « retiré » message without « Réessayer »', async () => {
      const { fixture, fakes } = await render({ consultation: consultation({ patient: OMNICARE_PATIENT }, 'OMNICARE_GRANTED'), workspace: null });
      fakes.medicalRecord.failure.set('CLINICAL_ACCESS_REVOKED');
      await stable(fixture);
      await stable(fixture);
      const card = (fixture.nativeElement as HTMLElement).querySelector('app-medical-context-card')!;
      expect(card.querySelector('[data-testid="access-revoked"]')?.textContent?.trim()).toBe('Votre accès au dossier médical de ce patient a été retiré.');
      expect(card.textContent).not.toContain('Réessayer');
    });

    it('ignores access events of other consultations', async () => {
      const { fixture, fakes } = await render({ consultation: restricted() });
      fakes.consultations.get.mockClear();
      fakes.realtime.scheduledCareEvents$.next({ eventId: 'other', eventType: 'CLINICAL_ACCESS_CHANGED', resourceType: 'CONSULTATION',
        resourceId: '00000000-0000-4000-8000-000000000099', version: 1, occurredAt: '2026-11-11T08:10:00Z' });
      await stable(fixture);
      expect(fakes.consultations.get).not.toHaveBeenCalled();
    });
  });

  describe('follow-up appointment (G-1 D4)', () => {
    afterEach(() => vi.useRealTimers());

    function pageButton(label: string): HTMLButtonElement {
      const found = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
        .find((element) => element.textContent?.trim() === label && !element.disabled);
      if (!found) throw new Error(`button « ${label} » not found`);
      return found;
    }

    /** A free slot of the picker, by its start time (« 10:20 »). */
    function slotButton(time: string): HTMLButtonElement {
      const found = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.quick-booking__slots button'))
        .find((element) => element.querySelector('strong')?.textContent?.trim() === time);
      if (!found) throw new Error(`slot « ${time} » not found`);
      return found;
    }

    async function renderAt(options: FakeOptions = {}): Promise<Rendered> {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-11T08:00:00Z'));
      return render(options);
    }

    it('« Contrôle à une date » opens the booking slot picker on the consultation cabinet; the chosen slot is stored and dated in the note', async () => {
      const { fixture, fakes, session, text } = await renderAt({ consultation: consultation({ sourcePracticeLocationId: 'cabinet-1' }) });
      segment(fixture.nativeElement, 'Contrôle à une date').click();
      await stable(fixture);
      expect(text()).toContain('Créneau du contrôle');
      expect(document.querySelector('[data-testid="follow-up-patient"]')?.textContent).toContain('Marwa');
      expect(fakes.consultations.followUpAvailability).toHaveBeenCalledWith(CONSULTATION_ID, 'cabinet-1', expect.any(String), expect.any(String));

      slotButton('10:20').click();
      await stable(fixture);
      pageButton('Choisir ce créneau').click();
      await stable(fixture);

      // G-1 pass 2: no slot yet → expectedVersion 0, with a fresh Idempotency-Key.
      expect(fakes.consultations.saveFollowUpSlot).toHaveBeenCalledWith(CONSULTATION_ID, {
        start: '2026-11-13T09:20:00Z', end: '2026-11-13T09:40:00Z', practiceLocationId: 'cabinet-1',
      }, 0, expect.stringMatching(/^follow-up-slot:/));
      expect(document.querySelector('[data-testid="follow-up-slot-text"]')?.textContent).toBe('ven. 13 nov. à 10:20 · Cabinet El Menzah');
      expect(session.note().followUpDate).toBe('2026-11-13');
      expect(text()).toContain('Réservé à la fin de la consultation.');
    });

    it('the follow-up picker reaches 90 days ahead (« Nouveau rendez-vous » keeps 21)', async () => {
      const { fixture, fakes } = await renderAt({ consultation: consultation({ sourcePracticeLocationId: 'cabinet-1' }) });
      segment(fixture.nativeElement, 'Contrôle à une date').click();
      await stable(fixture);
      // Today 11 Nov 2026 → last day 8 Feb 2027 (90 days, today included).
      expect(fakes.consultations.followUpAvailability).toHaveBeenCalledWith(
        CONSULTATION_ID, 'cabinet-1', '2026-11-10T12:00:00.000Z', '2027-02-09T12:00:00.000Z');
    });

    it('another follow-up choice drops the chosen slot', async () => {
      const slot = { start: '2026-11-13T09:20:00Z', end: '2026-11-13T09:40:00Z', practiceLocationId: 'cabinet-1', locationName: 'Cabinet El Menzah', version: 2 };
      const { fixture, fakes } = await renderAt({
        consultation: consultation({ followUpSlot: slot }),
        record: record({ followUp: { required: true, recommendedAt: '2026-11-13', decision: 'FOLLOW_UP_IN_PERIOD' } }),
      });
      expect(document.querySelector('[data-testid="follow-up-slot-text"]')?.textContent).toContain('13 nov. à 10:20');
      segment(fixture.nativeElement, 'Aucun suivi').click();
      await stable(fixture);
      expect(fakes.consultations.clearFollowUpSlot).toHaveBeenCalledWith(CONSULTATION_ID, 2, expect.stringMatching(/^follow-up-slot-clear:/));
      expect(document.querySelector('[data-testid="follow-up-slot"]')).toBeNull();
    });

    it('a refused slot shows a French error under the field', async () => {
      const { fixture, fakes, text } = await renderAt();
      fakes.consultations.saveFollowUpSlot.mockReturnValue(throwError(() => new HttpErrorResponse({
        status: 400, error: { errorCode: 'VALIDATION_ERROR', fieldErrorCodes: { 'followUpSlot.start': 'NOT_ALLOWED' } },
      })));
      segment(fixture.nativeElement, 'Contrôle à une date').click();
      await stable(fixture);
      slotButton('10:20').click();
      await stable(fixture);
      pageButton('Choisir ce créneau').click();
      await stable(fixture);
      expect(text()).toContain('Ce créneau ne peut pas être choisi pour le contrôle. Choisissez-en un autre.');
      expect(document.querySelector('[data-testid="follow-up-slot-text"]')).toBeNull();
    });

    it('the success state says « confirmé » for an external patient and « proposé au patient » for an OmniCare patient', async () => {
      const outcome = { appointmentId: 'appointment-9', start: '2026-11-13T09:20:00Z', end: '2026-11-13T09:40:00Z', locationName: 'Cabinet El Menzah', proposalExpiresAt: null };
      const confirmed = await renderAt({ consultation: consultation({ status: 'COMPLETED', followUp: { ...outcome, status: 'CONFIRMED' } }) });
      expect(document.querySelector('[data-testid="follow-up-outcome"]')?.textContent?.trim()).toBe('Rendez-vous de contrôle : ven. 13 nov. à 10:20 · confirmé');
      expect(confirmed.text()).not.toContain('Créneau du contrôle');
      TestBed.resetTestingModule();

      await renderAt({ consultation: consultation({ status: 'COMPLETED', followUp: { ...outcome, status: 'PROPOSED', proposalExpiresAt: '2026-11-13T07:20:00Z' } }, 'OMNICARE_GRANTED') });
      expect(document.querySelector('[data-testid="follow-up-outcome"]')?.textContent?.trim()).toBe('Rendez-vous de contrôle : ven. 13 nov. à 10:20 · proposé au patient');
    });

    it('SLOT_TAKEN: the consultation is done, the booking drawer opens with the patient, and rebooking shows the new outcome', async () => {
      const { fixture, fakes, text } = await renderAt({ consultation: consultation({
        status: 'COMPLETED', sourcePracticeLocationId: 'cabinet-1',
        followUp: { status: 'SLOT_TAKEN', appointmentId: null, start: '2026-11-13T08:00:00Z', end: '2026-11-13T08:20:00Z', locationName: 'Cabinet El Menzah', proposalExpiresAt: null },
      }) });
      expect(text()).toContain('Consultation terminée');
      expect(document.querySelector('[data-testid="follow-up-slot-taken"]')?.textContent).toContain('Le créneau du ven. 13 nov. à 09:00 n’était plus libre');
      expect(text()).toContain('Rendez-vous de contrôle');
      expect(document.querySelector('[data-testid="follow-up-patient"]')?.textContent).toContain('Marwa');

      slotButton('10:20').click();
      await stable(fixture);
      pageButton('Planifier le contrôle').click();
      await stable(fixture);

      expect(fakes.consultations.rebookFollowUp).toHaveBeenCalledWith(CONSULTATION_ID,
        { start: '2026-11-13T09:20:00Z', end: '2026-11-13T09:40:00Z', practiceLocationId: 'cabinet-1' }, expect.stringMatching(/^follow-up:/));
      expect(document.querySelector('[data-testid="follow-up-slot-taken"]')).toBeNull();
      expect(document.querySelector('[data-testid="follow-up-outcome"]')?.textContent?.trim()).toBe('Rendez-vous de contrôle : ven. 13 nov. à 10:20 · confirmé');
    });
  });

  describe('follow-ups (P2c)', () => {
    it('« Traitement au long cours » hides the duration and sends longTerm without a duration', async () => {
      const { fixture, session, fakes } = await render({ record: record({ medicationDecision: 'MEDICATION_PRESCRIBED' }), prescription: DRAFT_PRESCRIPTION });
      expect(document.querySelector('#medication-0-duration')).toBeTruthy();
      (document.querySelector('#medication-0-long-term') as HTMLElement).click();
      await stable(fixture);
      expect(session.lines()[0].longTerm).toBe(true);
      expect(document.querySelector('#medication-0-duration')).toBeNull();
      session.updateMedicationLine(0, { durationValue: '' });
      expect(Object.keys(session.clientErrors()).filter((key) => key.startsWith('prescription'))).toEqual([]);
      await session.flushAll();
      const sent = fakes.prescriptions.save.mock.calls.at(-1)![2] as { medications: { longTerm: boolean | null; duration: unknown }[] };
      expect(sent.medications[0]).toMatchObject({ longTerm: true, duration: null });
    });

    it('locks the exam type after the first successful save', async () => {
      const { fixture, session, fakes } = await render();
      segment(fixture.nativeElement, 'Demander un examen').click();
      await stable(fixture);
      const row = session.orders()[0];
      const select = (document.querySelector(`#order-${row.key}-category`) as HTMLElement).closest('nz-select') as HTMLElement;
      expect(select.classList).not.toContain('ant-select-disabled');

      session.updateOrder(row.key, { target: 'NFS' });
      await session.flushAll();
      await stable(fixture);
      expect(fakes.orders.create).toHaveBeenCalledTimes(1);
      expect(select.classList).toContain('ant-select-disabled');
      expect(document.body.textContent).toContain('Pour changer de type, retirez la demande et ajoutez-en une nouvelle.');
      session.updateOrder(row.key, { category: 'IMAGING' });
      expect(session.orders()[0].form.category).toBe('LAB');
    });
  });
});
