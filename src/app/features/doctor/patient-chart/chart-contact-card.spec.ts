import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { fr_FR, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { ChartContactCard, contactChanges, contactFormFrom, normalizePhone, validateContact } from './chart-contact-card';
import type { PatientChartAccessMode, PatientChartDto, PatientChartIdentityDto } from './patient-chart-api.models';
import { PatientChartApiService } from './patient-chart-api.service';

const IDENTITY: PatientChartIdentityDto = {
  firstName: 'Marwa', lastName: 'Mechergui', fullName: 'Marwa Mechergui', ageYears: 34, ageApproximate: false, sex: 'F',
  dateOfBirth: '1992-03-12', phone: '+21620123456', email: null, address: null, practiceIdentifier: 'D-12', contactVersion: 3,
};

function chart(mode: PatientChartAccessMode = 'EXTERNAL_OWNER'): PatientChartDto {
  return {
    id: 'chart-1', patientType: mode === 'EXTERNAL_OWNER' ? 'EXTERNAL' : 'OMNICARE', identity: IDENTITY,
    access: { mode, clinical: mode !== 'OMNICARE_RESTRICTED', editable: mode === 'EXTERNAL_OWNER', grantExpiresAt: null, verificationUnavailable: false },
    medicalRecord: { status: 'READY' }, schedulable: true, nextAppointment: null, startableAppointment: null, lastConsultation: null,
    counts: { consultations: 0, documents: 0, history: null },
  };
}

interface Setup {
  readonly fixture: ComponentFixture<ChartContactCard>;
  readonly api: { updateContact: ReturnType<typeof vi.fn> };
  readonly root: HTMLElement;
  readonly updated: ReturnType<typeof vi.fn>;
  readonly reload: ReturnType<typeof vi.fn>;
}

async function setup(mode: PatientChartAccessMode = 'EXTERNAL_OWNER'): Promise<Setup> {
  const api = {
    updateContact: vi.fn(() => of({ identity: { ...IDENTITY, phone: '+21698765432' }, contactVersion: 4, possibleDuplicate: false })),
  };
  TestBed.configureTestingModule({
    imports: [ChartContactCard],
    providers: [provideNoopAnimations(), provideNzIcons(OMNICARE_ICONS), provideNzI18n(fr_FR), { provide: PatientChartApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(ChartContactCard);
  fixture.componentRef.setInput('chart', chart(mode));
  const updated = vi.fn();
  const reload = vi.fn();
  fixture.componentInstance.updated.subscribe(updated);
  fixture.componentInstance.reloadRequested.subscribe(reload);
  await stable(fixture);
  return { fixture, api, root: fixture.nativeElement as HTMLElement, updated, reload };
}

async function stable(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
  }
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((element) => element.textContent?.trim() === label);
  if (!found) throw new Error(`button « ${label} »`);
  return found;
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ChartContactCard (« Coordonnées »)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('is read-only for an OmniCare patient, with no edit action', async () => {
    const { root } = await setup('OMNICARE_GRANTED');
    expect(root.textContent).toContain('Le patient gère ces informations depuis son application.');
    expect(root.querySelector('[data-testid="contact-edit"]')).toBeNull();
    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toContain('+21620123456');
  });

  it('shows a French error only after the field is left, and clears it as soon as it is fixed', async () => {
    const { fixture, root } = await setup();
    (root.querySelector('[data-testid="contact-edit"] button') as HTMLElement).click();
    await stable(fixture);
    const phone = root.querySelector('#contact-phone') as HTMLInputElement;
    type(phone, '12');
    await stable(fixture);
    expect(root.textContent).not.toContain('Numéro de téléphone invalide');
    phone.dispatchEvent(new Event('blur'));
    await stable(fixture);
    expect(root.querySelector('#contact-phone-error')?.textContent).toBe('Numéro de téléphone invalide (ex. +216 20 123 456).');
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    type(phone, '98 765 432');
    await stable(fixture);
    expect(root.querySelector('#contact-phone-error')).toBeNull();
  });

  it('« Enregistrer » reveals every error and sends nothing while one remains', async () => {
    const { fixture, root, api } = await setup();
    (root.querySelector('[data-testid="contact-edit"] button') as HTMLElement).click();
    await stable(fixture);
    type(root.querySelector('#contact-email') as HTMLInputElement, 'pas-un-email');
    await stable(fixture);
    expect(root.textContent).not.toContain('Adresse e-mail invalide.');
    button(root, 'Enregistrer').click();
    await stable(fixture);
    expect(root.textContent).toContain('Adresse e-mail invalide.');
    expect(api.updateContact).not.toHaveBeenCalled();
  });

  it('saves only the changed fields with the version and a key, then shows « Enregistré »', async () => {
    const { fixture, root, api, updated } = await setup();
    (root.querySelector('[data-testid="contact-edit"] button') as HTMLElement).click();
    await stable(fixture);
    type(root.querySelector('#contact-phone') as HTMLInputElement, '98 765 432');
    await stable(fixture);
    button(root, 'Enregistrer').click();
    await stable(fixture);
    expect(api.updateContact).toHaveBeenCalledWith('chart-1', { phone: '+21698765432', expectedVersion: 3 }, expect.stringMatching(/^chart-contact/));
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Enregistré');
    expect(root.querySelector('form')).toBeNull();
    expect(updated).toHaveBeenCalledWith(expect.objectContaining({ phone: '+21698765432', contactVersion: 4 }));
  });

  it('a version conflict says « Ces informations ont été modifiées ailleurs. » and reloads only after a confirmation', async () => {
    const { fixture, root, api, reload } = await setup();
    api.updateContact.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { errorCode: 'PATIENT_CONTACT_VERSION_CONFLICT' } })));
    (root.querySelector('[data-testid="contact-edit"] button') as HTMLElement).click();
    await stable(fixture);
    type(root.querySelector('#contact-identifier') as HTMLInputElement, 'D-99');
    await stable(fixture);
    button(root, 'Enregistrer').click();
    await stable(fixture);
    expect(root.textContent).toContain('Ces informations ont été modifiées ailleurs.');
    expect((root.querySelector('#contact-identifier') as HTMLInputElement).value).toBe('D-99');
    button(root, 'Recharger').click();
    await stable(fixture);
    expect(reload).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Recharger les coordonnées ?');
    const confirm = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ant-modal button')).find((element) => element.textContent?.trim() === 'Recharger')!;
    confirm.click();
    await stable(fixture);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('maps server field errors (2a contract) to the French message under the field', async () => {
    const { fixture, root, api } = await setup();
    api.updateContact.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: { errorCode: 'VALIDATION_ERROR', fieldErrors: { 'contact.email': 'x' }, fieldErrorCodes: { 'contact.email': 'INVALID_VALUE' } },
    })));
    (root.querySelector('[data-testid="contact-edit"] button') as HTMLElement).click();
    await stable(fixture);
    type(root.querySelector('#contact-email') as HTMLInputElement, 'marwa@exemple.tn');
    await stable(fixture);
    button(root, 'Enregistrer').click();
    await stable(fixture);
    expect(root.textContent).toContain('Adresse e-mail invalide.');
    expect(root.textContent).not.toContain('x\n');
  });
});

describe('contact rules', () => {
  it('normalises Tunisian phones like the server', () => {
    expect(normalizePhone('20 123 456')).toBe('+21620123456');
    expect(normalizePhone('+216 20-123-456')).toBe('+21620123456');
    expect(normalizePhone('0021620123456')).toBe('+21620123456');
    expect(normalizePhone('216 20123456')).toBe('+21620123456');
    expect(normalizePhone('+33 6 12 34 56 78')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });

  it('validates the birth estimate: required, not in the future, age 0–130', () => {
    const base = contactFormFrom(IDENTITY);
    expect(validateContact(base, '2026-11-11')).toEqual({});
    expect(validateContact({ ...base, dateOfBirth: '2026-11-12' }, '2026-11-11').dateOfBirth).toBe('La date de naissance ne peut pas être dans le futur.');
    expect(validateContact({ ...base, dateOfBirth: '2026-11-11' }, '2026-11-11')).toEqual({});
    expect(validateContact({ ...base, dateOfBirth: null }, '2026-11-11').dateOfBirth).toBe('Indiquez la date de naissance ou un âge approximatif.');
    expect(validateContact({ ...base, approximate: true, approximateAgeYears: '131' }, '2026-11-11').approximateAgeYears).toBe('Âge entre 0 et 130 ans.');
    expect(validateContact({ ...base, approximate: true, approximateAgeYears: '40' }, '2026-11-11')).toEqual({});
  });

  it('sends only what changed; switching to an approximate age replaces the date of birth', () => {
    const base = contactFormFrom(IDENTITY);
    expect(contactChanges(base, base, 3)).toBeNull();
    expect(contactChanges(base, { ...base, email: ' marwa@exemple.tn ' }, 3)).toEqual({ email: 'marwa@exemple.tn', expectedVersion: 3 });
    expect(contactChanges(base, { ...base, practiceIdentifier: '' }, 3)).toEqual({ practiceIdentifier: null, expectedVersion: 3 });
    expect(contactChanges(base, { ...base, phone: '20 123 456' }, 3)).toBeNull();
    expect(contactChanges(base, { ...base, approximate: true, approximateAgeYears: '40' }, 3)).toEqual({ approximateAgeYears: 40, expectedVersion: 3 });
  });
});
