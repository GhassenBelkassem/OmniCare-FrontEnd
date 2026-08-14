import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { OcButton, OcEmptyState, OcPageHeader } from '../../shared/ui';
import { ClinicContextStore } from './clinic-context.store';

@Component({
  selector: 'app-clinic-access-unavailable-page',
  imports: [OcButton, OcEmptyState, OcPageHeader],
  template: `
    <div class="clinic-page">
      <oc-page-header
        title="Clinic access unavailable"
        description="We could not open a clinic workspace for this account."
      />
      <section class="panel">
        <oc-empty-state
          icon="exclamation-circle"
          title="This clinic workspace cannot be opened"
          [description]="message()"
        >
          <oc-button variant="primary" (click)="retry()">Try again</oc-button>
          <oc-button variant="quiet" (click)="signOut()">Back to sign in</oc-button>
        </oc-empty-state>
        <p class="meta">
          If you expect access, ask your clinic administrator to confirm that your membership and
          the clinic are active.
        </p>
      </section>
    </div>
  `,
  styleUrl: './clinic-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicAccessUnavailablePage {
  private readonly store = inject(ClinicContextStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly message = computed(
    () =>
      this.store.accessError()?.message ??
      'Your clinic workspace could not be opened. Please try again.',
  );

  retry(): void {
    this.store.clear();
    void this.router.navigateByUrl('/clinic');
  }

  signOut(): void {
    this.store.clear();
    this.auth.logout();
  }
}
