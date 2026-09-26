import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { OcButton, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { AccountStatus, AdminProfessional, ProfessionalSession } from './admin-api.models';
import { AdminApiService } from './admin-api.service';
import { apiMessage, professionalRoleDescription, statusTone } from './admin-page-utils';

@Component({
  selector: 'app-professional-detail-page',
  imports: [DatePipe, RouterLink, OcButton, OcPageHeader, OcStatusBadge],
  templateUrl: './professional-detail-page.html',
  styleUrl: './admin-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalDetailPage {
  private readonly api = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  readonly userId = this.route.snapshot.paramMap.get('userId') ?? '';
  readonly professional = signal<AdminProfessional | null>(null);
  readonly sessions = signal<readonly ProfessionalSession[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly pendingStatus = signal<AccountStatus | null>(null);
  readonly pendingSessionRevocation = signal<string | null>(null);
  readonly statusTone = statusTone;
  readonly roleDescription = professionalRoleDescription;

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    forkJoin({ professional: this.api.getProfessional(this.userId), sessions: this.api.listSessions(this.userId) })
      .subscribe({
        next: ({ professional, sessions }) => { this.professional.set(professional); this.sessions.set(sessions); this.loading.set(false); },
        error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.loading.set(false); },
      });
  }

  changeStatus(): void {
    const status = this.pendingStatus();
    if (!status || this.busy()) return;
    this.busy.set(true);
    this.api.updateProfessionalStatus(this.userId, status).subscribe({
      next: (professional) => { this.professional.set(professional); this.pendingStatus.set(null); this.busy.set(false); this.successMessage.set(`Account changed to ${status.toLowerCase()}.`); this.loadSessions(); },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.busy.set(false); },
    });
  }

  resend(): void {
    this.busy.set(true);
    this.api.resendInvitation(this.userId).subscribe({
      next: (professional) => { this.professional.set(professional); this.busy.set(false); this.successMessage.set('A new invitation was queued for delivery.'); },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.busy.set(false); },
    });
  }

  revokeSession(): void {
    const sessionId = this.pendingSessionRevocation();
    if (!sessionId || this.busy()) return;
    this.busy.set(true);
    this.api.revokeSession(this.userId, sessionId).subscribe({
      next: () => { this.pendingSessionRevocation.set(null); this.busy.set(false); this.successMessage.set('Session revoked immediately.'); this.loadSessions(); },
      error: (error: unknown) => { this.errorMessage.set(apiMessage(error)); this.busy.set(false); },
    });
  }

  private loadSessions(): void {
    this.api.listSessions(this.userId).subscribe((sessions) => this.sessions.set(sessions));
  }
}
