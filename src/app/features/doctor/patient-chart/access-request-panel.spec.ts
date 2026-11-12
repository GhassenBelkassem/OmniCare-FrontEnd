import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { AccessRequestState } from '../active-consultation.models';
import { AccessRequestPanel, accessRequestErrorMessage } from './access-request-panel';

const PENDING: AccessRequestState = {
  request: { requestId: 'request-1', status: 'PENDING', version: 2, createdAt: '2026-11-11T08:05:00Z', respondedAt: null },
  used: 1, max: 3, canRequest: false,
};

function setup(state: AccessRequestState | null, api: Partial<Record<'requestAccess' | 'cancelAccessRequest', ReturnType<typeof vi.fn>>> = {}) {
  const fake = { requestAccess: vi.fn(() => of(PENDING)), cancelAccessRequest: vi.fn(() => of({ ...PENDING, canRequest: true })), ...api };
  TestBed.configureTestingModule({
    imports: [AccessRequestPanel],
    providers: [provideNzIcons(OMNICARE_ICONS), { provide: ActiveConsultationApiService, useValue: fake }],
  });
  const fixture = TestBed.createComponent(AccessRequestPanel);
  fixture.componentRef.setInput('consultationId', 'consultation-1');
  fixture.componentRef.setInput('state', state);
  const changes: AccessRequestState[] = [];
  fixture.componentInstance.stateChange.subscribe((value) => changes.push(value));
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const button = (label: string) => Array.from(root.querySelectorAll('button')).find((element) => element.textContent?.trim() === label);
  return { fixture, fake, root, button, changes };
}

describe('AccessRequestPanel (G-1 D2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('cancels a pending request with its version and a key', () => {
    const { fake, button, changes, root } = setup(PENDING);
    expect(root.textContent).toContain('Demande envoyée…');
    button('Annuler la demande')!.click();
    expect(fake.cancelAccessRequest).toHaveBeenCalledWith('consultation-1', 'request-1', 2, expect.stringMatching(/^access-request:/));
    expect(changes).toHaveLength(1);
  });

  it('tells the doctor where the patient answers, only while the request is pending', () => {
    const pending = setup(PENDING);
    expect(pending.root.querySelector('[data-testid="access-request-hint"]')?.textContent?.trim())
      .toBe('Le patient peut accepter depuis son application, dans « Mes rendez-vous ».');
    TestBed.resetTestingModule();
    const refused = setup({ ...PENDING, request: { ...PENDING.request!, status: 'REFUSED' }, canRequest: true });
    expect(refused.root.querySelector('[data-testid="access-request-hint"]')).toBeNull();
  });

  it('shows a French message for a duplicate or the limit, never a raw code', () => {
    const conflict = (code: string) => new HttpErrorResponse({ status: 409, error: { errorCode: code } });
    expect(accessRequestErrorMessage(conflict('ACCESS_REQUEST_ALREADY_PENDING'))).toBe('Une demande d’accès est déjà en attente de réponse.');
    expect(accessRequestErrorMessage(conflict('ACCESS_REQUEST_LIMIT_REACHED'))).toBe('Vous avez atteint le nombre maximal de demandes d’accès pour cette consultation.');
    expect(accessRequestErrorMessage(conflict('SOMETHING_ELSE'))).toBe('La demande n’a pas pu être prise en compte. La page a été actualisée.');
  });

  it('retries an ambiguous failure with the same idempotency key', () => {
    const requestAccess = vi.fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of(PENDING));
    const { fixture, button, root } = setup({ request: null, used: 0, max: 3, canRequest: true }, { requestAccess });
    button('Demander l’accès')!.click();
    fixture.detectChanges();
    expect(root.textContent).toContain('La demande n’a pas pu être envoyée. Réessayez.');
    button('Demander l’accès')!.click();
    expect(requestAccess.mock.calls[0][1]).toBe(requestAccess.mock.calls[1][1]);
  });

  it('without a consultation state it only explains how the patient shares (no button)', () => {
    const { root } = setup(null);
    expect(root.textContent).toContain('Le patient peut vous accorder l’accès depuis son application OmniCare.');
    expect(root.querySelector('button')).toBeNull();
  });
});
