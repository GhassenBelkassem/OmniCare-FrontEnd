import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { AdminProfessional, ProfessionalPage } from './admin-api.models';
import { AdminApiService } from './admin-api.service';
import { apiMessage, professionalRoleLabel, statusTone } from './admin-page-utils';

@Component({
  selector: 'app-professionals-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge],
  templateUrl: './professionals-page.html',
  styleUrl: './admin-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalsPage {
  private readonly api = inject(AdminApiService);
  readonly page = signal<ProfessionalPage | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly createOpen = signal(false);
  readonly submitting = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    phone: new FormControl('', { nonNullable: true }),
    professionalLicenseNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    specialty: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    governorate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly statusTone = statusTone;
  readonly roleLabel = professionalRoleLabel;

  constructor() { this.load(); }

  load(page = 0): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.listProfessionals(this.search.value, page).subscribe({
      next: (result) => { this.page.set(result); this.loading.set(false); },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.loading.set(false); },
    });
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();
    this.api.createDoctor({
      ...value,
      email: value.email.trim(),
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      phone: value.phone.trim() || null,
      professionalLicenseNumber: value.professionalLicenseNumber.trim(),
      specialty: value.specialty.trim(),
      governorate: value.governorate.trim(),
    }).subscribe({
      next: () => {
        this.successMessage.set('Doctor created. An invitation was sent so they can create their password.');
        this.submitting.set(false);
        this.createOpen.set(false);
        this.form.reset();
        this.load();
      },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.submitting.set(false); },
    });
  }

  tableState(): 'loading' | 'empty' | 'error' | 'default' {
    if (this.loading()) return 'loading';
    if (this.errorMessage() && !this.page()) return 'error';
    return this.page()?.items.length ? 'default' : 'empty';
  }

  trackProfessional(_index: number, item: AdminProfessional): string { return item.userId; }
}
