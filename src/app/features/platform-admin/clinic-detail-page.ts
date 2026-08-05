import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { OcButton, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { Clinic, ClinicMembership } from './admin-api.models';
import { AdminApiService } from './admin-api.service';
import { apiMessage, statusTone } from './admin-page-utils';

@Component({
  selector: 'app-clinic-detail-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, OcButton, OcPageHeader, OcStatusBadge],
  templateUrl: './clinic-detail-page.html',
  styleUrl: './admin-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicDetailPage {
  private readonly api = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  readonly clinicId = this.route.snapshot.paramMap.get('clinicId') ?? '';
  readonly clinic = signal<Clinic | null>(null);
  readonly memberships = signal<readonly ClinicMembership[]>([]);
  readonly loading = signal(true);
  readonly inviteOpen = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly statusTone = statusTone;
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true }),
  });

  constructor() { this.load(); }

  load(): void {
    forkJoin({ clinic: this.api.getClinic(this.clinicId), memberships: this.api.listMemberships(this.clinicId) })
      .subscribe({
        next: ({ clinic, memberships }) => { this.clinic.set(clinic); this.memberships.set(memberships); this.loading.set(false); },
        error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.loading.set(false); },
      });
  }

  invite(): void {
    if (this.form.invalid || this.submitting()) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    const { email, phone } = this.form.getRawValue();
    this.api.inviteClinicAdmin(this.clinicId, email, phone.trim() || null).subscribe({
      next: () => { this.successMessage.set('Clinic administrator created and invitation queued.'); this.submitting.set(false); this.inviteOpen.set(false); this.form.reset(); this.load(); },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.submitting.set(false); },
    });
  }
}
