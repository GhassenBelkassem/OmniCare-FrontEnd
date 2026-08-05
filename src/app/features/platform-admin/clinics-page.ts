import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { ClinicPage } from './admin-api.models';
import { AdminApiService } from './admin-api.service';
import { apiMessage } from './admin-page-utils';

@Component({
  selector: 'app-clinics-page',
  imports: [ReactiveFormsModule, RouterLink, OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge],
  templateUrl: './clinics-page.html',
  styleUrl: './admin-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicsPage {
  private readonly api = inject(AdminApiService);
  readonly page = signal<ClinicPage | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly createOpen = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    contactPhone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    governorate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    inpdpNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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

  submit(): void {
    if (this.form.invalid || this.submitting()) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.api.createClinic(this.form.getRawValue()).subscribe({
      next: () => { this.successMessage.set('Clinic created. You can now invite its administrator.'); this.submitting.set(false); this.createOpen.set(false); this.form.reset(); this.load(); },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.submitting.set(false); },
    });
  }

  tableState(): 'loading' | 'empty' | 'error' | 'default' {
    if (this.loading()) return 'loading';
    if (this.errorMessage() && !this.page()) return 'error';
    return this.page()?.items.length ? 'default' : 'empty';
  }
}
