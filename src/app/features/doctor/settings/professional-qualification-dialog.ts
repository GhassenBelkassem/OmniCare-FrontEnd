import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { OcButton, OcDialog, OcField } from '../../../shared/ui';
import {
  CreateProfessionalCertificationRequest,
  CreateProfessionalEducationRequest,
  ProfessionalCertificationResponse,
  ProfessionalEducationResponse,
} from './professional-profile-api.models';

export type ProfessionalQualificationKind = 'education' | 'certification';
export type ProfessionalQualificationEntry =
  ProfessionalEducationResponse | ProfessionalCertificationResponse;

export type ProfessionalQualificationSubmission =
  | {
      readonly kind: 'education';
      readonly id: string | null;
      readonly revision: number | null;
      readonly value: CreateProfessionalEducationRequest;
    }
  | {
      readonly kind: 'certification';
      readonly id: string | null;
      readonly revision: number | null;
      readonly value: CreateProfessionalCertificationRequest;
    };

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;
const TEXT_MAX = 200;

@Component({
  selector: 'app-professional-qualification-dialog',
  imports: [ReactiveFormsModule, OcButton, OcDialog, OcField],
  templateUrl: './professional-qualification-dialog.html',
  styleUrl: './professional-qualification-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalQualificationDialog {
  readonly open = input(false);
  readonly kind = input<ProfessionalQualificationKind>('education');
  readonly entry = input<ProfessionalQualificationEntry | null>(null);
  readonly nextDisplayOrder = input(0);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly conflict = input(false);

  readonly dismissed = output<void>();
  readonly submitted = output<ProfessionalQualificationSubmission>();
  readonly refreshRequested = output<void>();

  readonly form = new FormGroup(
    {
      primary: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(TEXT_MAX)],
      }),
      secondary: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(TEXT_MAX)],
      }),
      tertiary: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(TEXT_MAX)],
      }),
      year: new FormControl('', { nonNullable: true, validators: [optionalYearValidator()] }),
      expiryDate: new FormControl('', { nonNullable: true }),
    },
    { validators: [certificationDateValidator(() => this.kind())] },
  );

  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const entry = this.entry();
      const submitting = this.submitting();
      const kind = this.kind();

      this.form.controls.secondary.setValidators(
        kind === 'education'
          ? [Validators.required, Validators.maxLength(TEXT_MAX)]
          : [Validators.maxLength(TEXT_MAX)],
      );
      this.form.controls.secondary.updateValueAndValidity({ emitEvent: false });

      if (isOpen && !this.wasOpen) this.resetForm(entry);
      if (!isOpen && this.wasOpen) this.form.reset();
      if (submitting) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
      this.wasOpen = isOpen;
    });
  }

  get title(): string {
    const action = this.entry() === null ? 'Ajouter' : 'Modifier';
    return this.kind() === 'education' ? `${action} une formation` : `${action} une certification`;
  }

  get primaryLabel(): string {
    return this.kind() === 'education' ? 'Diplôme ou qualification' : 'Nom de la certification';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const raw = this.form.getRawValue();
    const entry = this.entry();
    const id = entry?.id ?? null;
    const revision = entry?.revision ?? null;
    const displayOrder = entry?.displayOrder ?? this.nextDisplayOrder();

    if (this.kind() === 'education') {
      this.submitted.emit({
        kind: 'education',
        id,
        revision,
        value: {
          institution: raw.secondary.trim(),
          qualification: raw.primary.trim(),
          fieldOfStudy: nullableText(raw.tertiary),
          completionYear: nullableNumber(raw.year),
          displayOrder,
        },
      });
      return;
    }

    this.submitted.emit({
      kind: 'certification',
      id,
      revision,
      value: {
        name: raw.primary.trim(),
        issuer: nullableText(raw.secondary),
        issuedYear: nullableNumber(raw.year),
        expiryDate: raw.expiryDate === '' ? null : raw.expiryDate,
        displayOrder,
      },
    });
  }

  invalid(controlName: keyof ProfessionalQualificationDialog['form']['controls']): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  errorFor(controlName: keyof ProfessionalQualificationDialog['form']['controls']): string | null {
    if (!this.invalid(controlName)) return null;
    const control = this.form.controls[controlName];
    if (control.hasError('required')) return 'Ce champ est obligatoire.';
    if (control.hasError('maxlength')) return `${TEXT_MAX} caractères maximum.`;
    if (control.hasError('year')) return `Année comprise entre ${YEAR_MIN} et ${YEAR_MAX}.`;
    return 'Valeur invalide.';
  }

  private resetForm(entry: ProfessionalQualificationEntry | null): void {
    if (entry === null) {
      this.form.reset({ primary: '', secondary: '', tertiary: '', year: '', expiryDate: '' });
      return;
    }
    if (this.kind() === 'education') {
      const education = entry as ProfessionalEducationResponse;
      this.form.reset({
        primary: education.qualification,
        secondary: education.institution,
        tertiary: education.fieldOfStudy ?? '',
        year: numberText(education.completionYear),
        expiryDate: '',
      });
      return;
    }
    const certification = entry as ProfessionalCertificationResponse;
    this.form.reset({
      primary: certification.name,
      secondary: certification.issuer ?? '',
      tertiary: '',
      year: numberText(certification.issuedYear),
      expiryDate: certification.expiryDate ?? '',
    });
  }
}

function optionalYearValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '').trim();
    if (raw === '') return null;
    if (!/^\d{4}$/.test(raw)) return { year: true };
    const year = Number(raw);
    return year >= YEAR_MIN && year <= YEAR_MAX ? null : { year: true };
  };
}

function certificationDateValidator(kind: () => ProfessionalQualificationKind): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (kind() !== 'certification') return null;
    const yearRaw = control.get('year')?.value as string | undefined;
    const expiryDate = control.get('expiryDate')?.value as string | undefined;
    if (!yearRaw || !expiryDate) return null;
    return Number(expiryDate.slice(0, 4)) < Number(yearRaw) ? { expiryBeforeIssue: true } : null;
  };
}

function nullableText(value: string): string | null {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function nullableNumber(value: string): number | null {
  const normalized = value.trim();
  return normalized === '' ? null : Number(normalized);
}

function numberText(value: number | null): string {
  return value === null ? '' : String(value);
}
