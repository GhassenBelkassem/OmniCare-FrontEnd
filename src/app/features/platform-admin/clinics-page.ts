import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { ClinicPage } from './admin-api.models';
import { AdminApiService, newIdempotencyKey } from './admin-api.service';
import { apiMessage, createClinicErrorMessage } from './admin-page-utils';
import { CLINIC_FIELD_LIMITS, notBlank, tunisianPhoneNumber } from './clinic-form.validators';

@Component({
  selector: 'app-clinics-page',
  imports: [ReactiveFormsModule, RouterLink, OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge],
  templateUrl: './clinics-page.html',
  styleUrl: './admin-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicsPage {
  private readonly api = inject(AdminApiService);
  /**
   * Held across a failed attempt so a retry replays the same `Idempotency-Key` and the
   * backend returns the original result instead of registering a second clinic. Rotated
   * only after a confirmed success.
   */
  private attemptIdempotencyKey = '';

  readonly page = signal<ClinicPage | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createOpen = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  /**
   * Bounds mirror `CreateClinicRequest`; `notBlank` stands in for the backend's
   * `@NotBlank` so a whitespace-only value is caught here rather than surfacing as an
   * unexplained server-side rejection.
   */
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [notBlank(), Validators.maxLength(CLINIC_FIELD_LIMITS.name)] }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [notBlank(), Validators.email, Validators.maxLength(CLINIC_FIELD_LIMITS.contactEmail)],
    }),
    contactPhone: new FormControl('', {
      nonNullable: true,
      validators: [notBlank(), Validators.maxLength(CLINIC_FIELD_LIMITS.contactPhone), tunisianPhoneNumber()],
    }),
    governorate: new FormControl('', { nonNullable: true, validators: [notBlank(), Validators.maxLength(CLINIC_FIELD_LIMITS.governorate)] }),
    address: new FormControl('', { nonNullable: true, validators: [notBlank(), Validators.maxLength(CLINIC_FIELD_LIMITS.address)] }),
    inpdpNumber: new FormControl('', { nonNullable: true, validators: [notBlank(), Validators.maxLength(CLINIC_FIELD_LIMITS.inpdpNumber)] }),
  });

  constructor() { this.load(); }

  load(page = 0): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.listClinics(this.search.value, page).subscribe({
      next: (result) => { this.page.set(result); this.loading.set(false); },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.loading.set(false); },
    });
  }

  /**
   * Named so the template can label the field a rejection refers to, and so a whitespace
   * or over-length value explains itself before any request is sent.
   */
  fieldError(controlName: keyof typeof CLINIC_FIELD_LIMITS): string | null {
    const control = this.form.controls[controlName];
    if (!control || (!control.dirty && !control.touched)) return null;
    if (control.hasError('required')) return 'This field is required.';
    if (control.hasError('blank')) return 'This field cannot be only spaces.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('tunisianPhoneNumber')) return 'Enter a valid Tunisian phone number, for example +216 20 123 456.';
    if (control.hasError('maxlength')) {
      return `Must be ${CLINIC_FIELD_LIMITS[controlName]} characters or fewer.`;
    }
    return null;
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    if (!this.attemptIdempotencyKey) {
      this.attemptIdempotencyKey = newIdempotencyKey();
    }
    const value = this.form.getRawValue();
    this.api
      .createClinic(
        {
          name: value.name.trim(),
          contactEmail: value.contactEmail.trim(),
          contactPhone: value.contactPhone.trim(),
          governorate: value.governorate.trim(),
          address: value.address.trim(),
          inpdpNumber: value.inpdpNumber.trim(),
        },
        this.attemptIdempotencyKey,
      )
      .subscribe({
        next: () => {
          this.attemptIdempotencyKey = '';
          this.successMessage.set('Clinic created. You can now invite its administrator.');
          this.submitting.set(false);
          this.createOpen.set(false);
          this.form.reset();
          this.load();
        },
        error: (error: unknown) => {
          this.errorMessage.set(createClinicErrorMessage(error));
          this.submitting.set(false);
        },
      });
  }

  tableState(): 'loading' | 'empty' | 'error' | 'default' {
    if (this.loading()) return 'loading';
    if (this.errorMessage() && !this.page()) return 'error';
    return this.page()?.items.length ? 'default' : 'empty';
  }
}
