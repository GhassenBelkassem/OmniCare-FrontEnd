import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { OcButton, OcEmptyState, OcMetricCard, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { ClinicContextStore } from './clinic-context.store';
import {
  CLINIC_MODULES,
  clinicCapabilityLabel,
  clinicRoleLabel,
  clinicStatusTone,
} from './clinic-page-utils';

@Component({
  selector: 'app-clinic-overview-page',
  imports: [DatePipe, OcButton, OcEmptyState, OcMetricCard, OcPageHeader, OcStatusBadge],
  template: `
    <div class="clinic-page">
      @if (context(); as bootstrap) {
        <oc-page-header
          [title]="bootstrap.clinic.clinicName"
          description="Clinic workspace · read-only Phase 1 access"
        >
          @if (store.canSwitchClinic()) {
            <oc-button ocSecondaryActions variant="quiet" (click)="switchClinic()"
              >Switch clinic</oc-button
            >
          }
          <oc-button
            ocPrimaryAction
            variant="secondary"
            leadingIcon="dashboard"
            [loading]="store.loading()"
            (click)="refresh()"
            >Refresh context</oc-button
          >
        </oc-page-header>

        <section class="panel" aria-labelledby="clinic-context-title">
          <h2 id="clinic-context-title">Clinic context</h2>
          <dl class="definition-grid">
            <div>
              <dt>Clinic</dt>
              <dd>{{ bootstrap.clinic.clinicName }}</dd>
            </div>
            <div>
              <dt>Clinic status</dt>
              <dd><oc-status-badge [status]="statusTone(bootstrap.clinic.clinicStatus)" /></dd>
            </div>
            <div>
              <dt>Professional role</dt>
              <dd>{{ roleLabel(bootstrap.membership.professionalRole) }}</dd>
            </div>
            <div>
              <dt>Membership status</dt>
              <dd>
                <oc-status-badge [status]="statusTone(bootstrap.membership.membershipStatus)" />
              </dd>
            </div>
            <div>
              <dt>Membership version</dt>
              <dd>v{{ bootstrap.membership.version }}</dd>
            </div>
          </dl>
        </section>

        <section class="metric-grid" aria-label="Clinic workspace summary">
          <oc-metric-card
            icon="audit"
            label="Read-only capabilities"
            [value]="capabilityCount()"
            supportingText="Granted by your active clinic membership"
          />
          <oc-metric-card
            icon="appstore"
            label="Enabled clinic modules"
            [value]="enabledModuleSummary()"
            supportingText="Additional modules arrive in later phases"
          />
          <oc-metric-card
            icon="calendar"
            label="Context resolved"
            [value]="(bootstrap.resolvedAt | date: 'shortTime') ?? '—'"
            supportingText="Reloaded from the clinic bootstrap contract"
          />
        </section>

        <section class="panel" aria-labelledby="clinic-capabilities-title">
          <h2 id="clinic-capabilities-title">Capabilities</h2>
          @if (capabilities().length > 0) {
            <ul class="stack-list capability-list">
              @for (capability of capabilities(); track capability) {
                <li>{{ capabilityLabel(capability) }}</li>
              }
            </ul>
          } @else {
            <oc-empty-state
              icon="audit"
              title="No capabilities granted"
              description="Your membership does not currently grant any clinic capability."
            />
          }
        </section>

        <section class="panel" aria-labelledby="clinic-modules-title">
          <h2 id="clinic-modules-title">Clinic modules</h2>
          <p class="meta">
            Phase 1 delivers secure clinic initialization only. Modules become available when their
            feature flag is enabled for this clinic.
          </p>
          @if (enabledModuleCount() === 0) {
            <oc-empty-state
              icon="appstore"
              title="No clinic modules are enabled"
              description="Nothing beyond the read-only overview is available for this clinic yet."
            />
          }
          <ul class="stack-list module-list">
            @for (module of modules(); track module.flag) {
              <li>
                <div>
                  <p class="module-list__name">{{ module.label }}</p>
                  <p class="meta">{{ module.description }}</p>
                </div>
                <span class="module-flag">{{
                  module.available ? 'Available' : 'Not available yet'
                }}</span>
              </li>
            }
          </ul>
        </section>
      } @else {
        <section class="clinic-state" role="status" aria-live="polite">
          <h1>Loading the clinic workspace</h1>
          <p>We are restoring your clinic context from the clinic bootstrap contract.</p>
        </section>
      }
    </div>
  `,
  styleUrl: './clinic-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicOverviewPage {
  readonly store = inject(ClinicContextStore);
  readonly roleLabel = clinicRoleLabel;
  readonly capabilityLabel = clinicCapabilityLabel;
  readonly statusTone = clinicStatusTone;

  readonly context = this.store.bootstrap;
  readonly capabilities = computed(() => this.context()?.capabilities ?? []);
  readonly capabilityCount = computed(() => `${this.capabilities().length}`);
  readonly modules = computed(() => {
    const flags = this.context()?.featureFlags ?? {};
    return CLINIC_MODULES.map((module) => ({ ...module, available: flags[module.flag] === true }));
  });
  readonly enabledModuleCount = computed(
    () => this.modules().filter((module) => module.available).length,
  );
  readonly enabledModuleSummary = computed(
    () => `${this.enabledModuleCount()} of ${CLINIC_MODULES.length}`,
  );

  constructor() {
    // A direct refresh must rebuild memberships and bootstrap, not trust navigation state.
    this.store.initialize({ route: true });
  }

  refresh(): void {
    this.store.refreshBootstrap();
  }

  switchClinic(): void {
    this.store.beginClinicSwitch();
  }
}
