import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';

import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../../core/realtime/live-event.models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ClinicalOrderApiService } from '../clinical-order-api.service';
import type { ClinicalOrder, ClinicalOrderCategory } from '../clinical-order.models';
import { ClinicalOrderStore } from '../clinical-order.store';
import { ClinicalOrders } from './clinical-orders';

const CONSULTATION_ID = '11111111-1111-4111-8111-111111111111';

describe('ClinicalOrders', () => {
  const user = signal<AuthenticatedUser | null>({
    id: 'doctor-1',
    role: 'DOCTOR',
    mustChangePassword: false,
  });
  let fixture: ComponentFixture<ClinicalOrders>;
  let create: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    create = vi.fn();
    TestBed.configureTestingModule({
      imports: [ClinicalOrders],
      providers: [
        ClinicalOrderStore,
        {
          provide: ClinicalOrderApiService,
          useValue: {
            list: vi.fn().mockReturnValue(of({ orders: [] })),
            create,
            update: vi.fn(),
            finalize: vi.fn(),
          },
        },
        {
          provide: RealtimeService,
          useValue: { scheduledCareEvents$: new Subject<ScheduledCareEvent>() },
        },
        { provide: AuthTokenStore, useValue: { user } },
      ],
    });

    fixture = TestBed.createComponent(ClinicalOrders);
    fixture.componentRef.setInput('consultationId', CONSULTATION_ID);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it.each([
    ['LAB', 'Laboratoire', 'Complete blood count — E2E test', 'requestedExamination'],
    ['IMAGING', 'Imagerie', 'Chest X-ray', 'requestedStudy'],
    ['REFERRAL', 'Orientation', 'Cardiology', 'targetSpecialty'],
  ] as const)(
    'creates one %s DRAFT through the rendered form',
    async (category, categoryLabel, value, definitionField) => {
      create.mockReturnValue(of(order(category, value)));

      clickButton(categoryLabel);
      fixture.detectChanges();
      enterValue(value);
      fixture.detectChanges();
      clickButton('Enregistrer');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith(
        CONSULTATION_ID,
        category,
        {
          requestedExamination: definitionField === 'requestedExamination' ? value : null,
          requestedStudy: definitionField === 'requestedStudy' ? value : null,
          targetSpecialty: definitionField === 'targetSpecialty' ? value : null,
        },
        expect.stringMatching(/^order-save:/),
      );
      expect(fixture.nativeElement.textContent).toContain(value);
      expect(fixture.nativeElement.textContent).toContain('Brouillon');
    },
  );

  it('renders a safe backend failure and keeps the local LAB value', async () => {
    create.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 503,
      error: { code: 'MRS_UNAVAILABLE', message: 'internal detail must not render' },
    })));

    clickButton('Laboratoire');
    fixture.detectChanges();
    enterValue('Complete blood count — E2E test');
    fixture.detectChanges();
    clickButton('Enregistrer');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'L’opération a échoué',
    );
    expect(fixture.nativeElement.textContent).not.toContain('internal detail must not render');
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).value).toBe(
      'Complete blood count — E2E test',
    );
  });

  it('shows why an empty LAB definition cannot be saved', () => {
    clickButton('Laboratoire');
    fixture.detectChanges();
    enterValue('   ');
    fixture.detectChanges();

    expect(create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Ce champ est obligatoire',
    );
  });

  it('does not duplicate create while a LAB save is pending', () => {
    const response = new Subject<ClinicalOrder>();
    create.mockReturnValue(response);

    clickButton('Laboratoire');
    fixture.detectChanges();
    enterValue('Complete blood count — E2E test');
    fixture.detectChanges();
    const save = button('Enregistrer');
    save.click();
    save.click();

    expect(create).toHaveBeenCalledTimes(1);
  });

  function enterValue(value: string): void {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clickButton(label: string): void {
    button(label).click();
  }

  function button(label: string): HTMLButtonElement {
    const match = fixture.debugElement
      .queryAll(By.css('button'))
      .map((element) => element.nativeElement as HTMLButtonElement)
      .find((element) => element.textContent?.trim() === label);
    if (match === undefined) throw new Error(`Button not found: ${label}`);
    return match;
  }
});

function order(category: ClinicalOrderCategory, value: string): ClinicalOrder {
  return {
    clinicalOrderId: crypto.randomUUID(),
    consultationId: CONSULTATION_ID,
    category,
    status: 'DRAFT',
    clinicalOrderVersion: 1,
    schemaVersion: 1,
    definition: {
      requestedExamination: category === 'LAB' ? value : null,
      requestedStudy: category === 'IMAGING' ? value : null,
      targetSpecialty: category === 'REFERRAL' ? value : null,
    },
  };
}
