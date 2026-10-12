import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { OcButton, OcDialog, OcField, OcSwitch, OcTextarea } from '../../../shared/ui';
import {
  CreatePracticeLocationRequest,
  PracticeLocationResponse,
} from './practice-location-api.models';
import { PracticeLocationService } from './practice-location.service';

export interface CabinetFormSubmission {
  readonly id: string | null;
  readonly revision: number | null;
  readonly value: CreatePracticeLocationRequest;
}

const PHONE_PATTERN = /^$|^\+?[0-9][0-9 ()-]{5,30}$/;

@Component({
  selector: 'app-cabinet-form-dialog',
  imports: [ReactiveFormsModule, OcButton, OcDialog, OcField, OcSwitch, OcTextarea],
  templateUrl: './cabinet-form-dialog.html',
  styleUrl: './cabinet-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetFormDialog {
  private readonly geolocation = inject(PracticeLocationService);

  readonly open = input(false);
  readonly location = input<PracticeLocationResponse | null>(null);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly conflict = input(false);

  readonly dismissed = output<void>();
  readonly submitted = output<CabinetFormSubmission>();
  readonly refreshRequested = output<void>();

  readonly locating = signal(false);
  readonly locationError = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(160)],
      }),
      governorate: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      city: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      address: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(500)],
      }),
      latitude: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, coordinateValidator(-90, 90)],
      }),
      longitude: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, coordinateValidator(-180, 180)],
      }),
      publicPhone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(32), Validators.pattern(PHONE_PATTERN)],
      }),
      wheelchairAccessible: new FormControl(false, { nonNullable: true }),
      patientInstructions: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(1000)],
      }),
      primary: new FormControl(false, { nonNullable: true }),
      active: new FormControl(true, { nonNullable: true }),
    },
    { validators: [primaryMustBeActive()] },
  );

  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const location = this.location();
      const submitting = this.submitting();
      if (isOpen && !this.wasOpen) this.resetForm(location);
      if (!isOpen && this.wasOpen) this.form.reset();
      if (submitting) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
      this.wasOpen = isOpen;
    });
  }

  get title(): string {
    return this.location() === null ? 'Ajouter un cabinet' : 'Modifier le cabinet';
  }

  async useCurrentPosition(): Promise<void> {
    if (this.locating() || this.submitting()) return;
    this.locating.set(true);
    this.locationError.set(null);
    const coordinates = await this.geolocation.getCurrentPosition();
    this.locating.set(false);
    if (coordinates === null) {
      this.locationError.set(
        'Position indisponible. Autorisez la géolocalisation ou saisissez les coordonnées.',
      );
      return;
    }
    this.form.patchValue({
      latitude: coordinates.latitude.toFixed(6),
      longitude: coordinates.longitude.toFixed(6),
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.conflict()) return;
    const raw = this.form.getRawValue();
    const location = this.location();
    this.submitted.emit({
      id: location?.id ?? null,
      revision: location?.revision ?? null,
      value: {
        type: 'CABINET',
        name: raw.name.trim(),
        governorate: raw.governorate.trim(),
        city: raw.city.trim(),
        address: raw.address.trim(),
        latitude: Number(raw.latitude),
        longitude: Number(raw.longitude),
        publicPhone: nullableText(raw.publicPhone),
        wheelchairAccessible: raw.wheelchairAccessible,
        patientInstructions: nullableText(raw.patientInstructions),
        primary: raw.primary,
        active: raw.active,
      },
    });
  }

  invalid(name: keyof CabinetFormDialog['form']['controls']): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  errorFor(name: keyof CabinetFormDialog['form']['controls']): string | null {
    if (!this.invalid(name)) return null;
    const control = this.form.controls[name];
    if (control.hasError('required')) return 'Ce champ est obligatoire.';
    if (control.hasError('maxlength')) {
      return `${String(control.getError('maxlength').requiredLength)} caractères maximum.`;
    }
    if (control.hasError('pattern')) return 'Saisissez un numéro de téléphone valide.';
    if (control.hasError('coordinate')) return 'Coordonnée hors de la plage autorisée.';
    return 'Valeur invalide.';
  }

  private resetForm(location: PracticeLocationResponse | null): void {
    this.locationError.set(null);
    this.form.reset({
      name: location?.name ?? '',
      governorate: location?.governorate ?? '',
      city: location?.city ?? '',
      address: location?.address ?? '',
      latitude: location === null ? '' : String(location.latitude),
      longitude: location === null ? '' : String(location.longitude),
      publicPhone: location?.publicPhone ?? '',
      wheelchairAccessible: location?.wheelchairAccessible ?? false,
      patientInstructions: location?.patientInstructions ?? '',
      primary: location?.primary ?? false,
      active: location?.active ?? true,
    });
  }
}

function coordinateValidator(minimum: number, maximum: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (raw === '') return null;
    const coordinate = Number(raw);
    return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
      ? null
      : { coordinate: true };
  };
}

function primaryMustBeActive(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    return control.get('primary')?.value === true && control.get('active')?.value !== true
      ? { primaryInactive: true }
      : null;
  };
}

function nullableText(value: string): string | null {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}
