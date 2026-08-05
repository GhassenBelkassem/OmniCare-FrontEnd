import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { AdminProfessional, ProfessionalPage } from './admin-api.models';
import { AdminApiService } from './admin-api.service';
import { apiMessage, statusTone } from './admin-page-utils';

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
    phone: new FormControl('', { nonNullable: true }),
    professionalLicenseNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    specialty: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    governorate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly statusTone = statusTone;

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
    this.api.createDoctor({ ...value, phone: value.phone.trim() || null }).subscribe({
      next: () => {
        this.successMessage.set('Doctor created. A one-time invitation has been queued for delivery.');
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
