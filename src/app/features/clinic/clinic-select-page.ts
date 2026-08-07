import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { OcEmptyState, OcPageHeader } from '../../shared/ui';
import { ClinicContextStore } from './clinic-context.store';
import { clinicRoleLabel, clinicUnavailabilityLabel } from './clinic-page-utils';

@Component({
  selector: 'app-clinic-select-page',
  imports: [OcEmptyState, OcPageHeader],
  template: `
    <div class="clinic-page">
      <oc-page-header
        title="Select a clinic"
        description="Choose the clinic workspace you want to open. Only active memberships can be opened."
      />

      @if (store.initialized()) {
        @if (store.activeMemberships().length > 0) {
          <section class="panel" aria-labelledby="clinic-active-title">
            <h2 id="clinic-active-title">Active memberships</h2>
            <ul class="stack-list clinic-choice-list">
              @for (membership of store.activeMemberships(); track membership.membershipId) {
                <li>
                  <button
                    class="clinic-choice"
                    type="button"
                    [disabled]="store.loading()"
                    (click)="open(membership.clinicId)"
                  >
                    <span class="clinic-choice__name">{{ membership.clinicName }}</span>
                    <span class="clinic-choice__role">{{ roleLabel(membership.professionalRole) }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>
        } @else {
          <section class="panel">
            <oc-empty-state
              icon="medicine-box"
              title="No active clinic membership"
              description="You do not have an active clinic membership yet. Contact your clinic administrator."
            />
          </section>
        }

        @if (store.unavailableMemberships().length > 0) {
          <section class="panel" aria-labelledby="clinic-unavailable-title">
            <h2 id="clinic-unavailable-title">Unavailable memberships</h2>
            <p class="meta">
              These clinics cannot be opened right now. Contact your clinic administrator if you
              expect access.
            </p>
            <ul class="stack-list clinic-info-list">
              @for (membership of store.unavailableMemberships(); track membership.membershipId) {
                <li>
                  <span>{{ membership.clinicName }}</span>
                  <span class="meta">{{ roleLabel(membership.professionalRole) }}</span>
                  <span class="clinic-info-list__reason">{{
                    unavailabilityLabel(membership.unavailabilityCode)
                  }}</span>
                </li>
              }
            </ul>
          </section>
        }
      } @else {
        <section class="clinic-state" role="status" aria-live="polite">
          <h1>Loading your clinic memberships</h1>
          <p>We are checking which clinic workspaces you can open.</p>
        </section>
      }
    </div>
  `,
  styleUrl: './clinic-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicSelectPage {
  readonly store = inject(ClinicContextStore);
  readonly roleLabel = clinicRoleLabel;
  readonly unavailabilityLabel = clinicUnavailabilityLabel;

  constructor() {
    // Direct page loads restore memberships without forcing a redirect away from the selector.
    this.store.initialize({ route: false });
  }

  open(clinicId: string): void {
    this.store.switchClinic(clinicId);
  }
}
