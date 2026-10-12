import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { CabinetFormDialog } from './cabinet-form-dialog';
import { PracticeLocationService } from './practice-location.service';

describe('CabinetFormDialog', () => {
  let fixture: ComponentFixture<CabinetFormDialog>;
  let component: CabinetFormDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CabinetFormDialog],
      providers: [
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        {
          provide: PracticeLocationService,
          useValue: {
            getCurrentPosition: vi
              .fn()
              .mockResolvedValue({ latitude: 36.8064942, longitude: 10.1815316 }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(CabinetFormDialog);
    component = fixture.componentInstance;
  });

  it('validates required fields, coordinate ranges, phone and primary-active consistency', () => {
    component.form.patchValue({
      latitude: '91',
      longitude: '181',
      publicPhone: 'invalid',
      primary: true,
      active: false,
    });
    component.form.markAllAsTouched();
    expect(component.form.invalid).toBe(true);
    expect(component.errorFor('name')).toBe('Ce champ est obligatoire.');
    expect(component.errorFor('latitude')).toContain('plage');
    expect(component.errorFor('publicPhone')).toContain('téléphone');
    expect(component.form.hasError('primaryInactive')).toBe(true);
  });

  it('emits the exact create payload and does not substitute a private phone', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.form.setValue({
      name: ' Cabinet La Marsa ',
      governorate: ' Tunis ',
      city: ' La Marsa ',
      address: ' 10 avenue Habib Bourguiba ',
      latitude: '36.8782',
      longitude: '10.3247',
      publicPhone: '',
      wheelchairAccessible: true,
      patientInstructions: ' Ascenseur à droite. ',
      primary: true,
      active: true,
    });
    component.submit();
    expect(submitted).toHaveBeenCalledWith({
      id: null,
      revision: null,
      value: expect.objectContaining({
        type: 'CABINET',
        name: 'Cabinet La Marsa',
        publicPhone: null,
        patientInstructions: 'Ascenseur à droite.',
        primary: true,
        active: true,
      }),
    });
  });

  it('uses geolocation only after an explicit action and limits displayed precision', async () => {
    await component.useCurrentPosition();
    expect(component.form.controls.latitude.value).toBe('36.806494');
    expect(component.form.controls.longitude.value).toBe('10.181532');
  });

  it('renders the four form sections and accessible switch controls', async () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const overlay = document.querySelector('.oc-dialog');
    expect(overlay?.textContent).toContain('Informations générales');
    expect(overlay?.textContent).toContain('Localisation');
    expect(overlay?.textContent).toContain('Informations publiques');
    expect(overlay?.textContent).toContain('Options');
    expect(overlay?.querySelectorAll('[role="switch"]')).toHaveLength(3);
    expect(overlay?.classList.contains('oc-dialog--wide')).toBe(true);
    expect(overlay?.querySelector('.cabinet-form__grid--coordinates')).not.toBeNull();
    expect(overlay?.querySelectorAll('.cabinet-form__option')).toHaveLength(3);
  });
});
