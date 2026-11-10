import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { OcButton, OcEmptyState, OcPageHeader } from '../../shared/ui';
import { ClinicPosition, ClinicResponsibility, hasClinicCapability } from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { ClinicContextStore } from './clinic-context.store';
import { hasDuplicateResponsibilityPositions } from './clinic-responsibility-utils';

@Component({
  selector: 'app-clinic-responsibility-detail-page',
  imports: [ReactiveFormsModule, OcButton, OcEmptyState, OcPageHeader],
  template: `
    @if (item(); as responsibility) {
      <oc-page-header [title]="label(responsibility)" description="Routing position configuration"
        ><span ocBreadcrumbs
          >Clinic workspace / Configuration / Responsibilities / Detail</span
        ></oc-page-header
      >
      <section class="routing">
        <h2>Routing path</h2>
        <p>Primary → {{ positionName(primary.value) }}</p>
        <p>Backup → {{ backup.value ? positionName(backup.value) : 'Not configured' }}</p>
        <p>
          Escalation → {{ escalation.value ? positionName(escalation.value) : 'Not configured' }}
        </p>
      </section>
      @if (canManage()) {
        <section class="form">
          <label
            >Primary position<select [formControl]="primary">
              @for (position of positions(); track position.id) {
                <option [value]="position.id">{{ position.displayName }}</option>
              }
            </select></label
          >
          <label
            >Backup position<select [formControl]="backup">
              <option [ngValue]="null">Not configured</option>
              @for (position of positions(); track position.id) {
                <option [value]="position.id">{{ position.displayName }}</option>
              }
            </select></label
          >
          <label
            >Escalation position<select [formControl]="escalation">
              <option [ngValue]="null">Not configured</option>
              @for (position of positions(); track position.id) {
                <option [value]="position.id">{{ position.displayName }}</option>
              }
            </select></label
          >
          @if (hasDuplicatePositions()) {
            <p role="alert">Primary, backup, and escalation positions must be different.</p>
          }
          <oc-button [disabled]="hasDuplicatePositions()" (click)="save(responsibility)"
            >Save configuration</oc-button
          ><oc-button variant="secondary" (click)="lifecycle(responsibility)">{{
            responsibility.active ? 'Deactivate' : 'Reactivate'
          }}</oc-button>
        </section>
      }
      @if (message(); as message) {
        <p role="status">{{ message }}</p>
      }
      @if (error(); as error) {
        <p role="alert">{{ error }}</p>
      }
    } @else if (notFound()) {
      <oc-empty-state
        icon="search"
        title="Responsibility not found"
        description="This responsibility is unavailable."
      />
    }
  `,
  styles: [
    `
      .form {
        display: flex;
        gap: 12px;
        align-items: end;
        flex-wrap: wrap;
        margin-block: 16px;
      }
      label {
        display: grid;
        gap: 4px;
      }
      select {
        min-height: 36px;
      }
      .routing {
        padding: 12px;
        border: 1px solid var(--oc-color-border-subtle);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicResponsibilityDetailPage {
  private readonly context = inject(ClinicContextStore);
  private readonly api = inject(ClinicApiService);
  private readonly route = inject(ActivatedRoute);

  readonly item = signal<ClinicResponsibility | null>(null);
  readonly positions = signal<readonly ClinicPosition[]>([]);
  readonly primary = new FormControl('');
  readonly backup = new FormControl<string | null>(null);
  readonly escalation = new FormControl<string | null>(null);
  readonly notFound = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.context.initialize({ route: false });
    effect(() => this.load());
  }

  canManage(): boolean {
    return hasClinicCapability(this.context.bootstrap(), 'CLINIC_RESPONSIBILITY_MANAGE');
  }
  label(responsibility: ClinicResponsibility): string {
    return responsibility.responsibilityType === 'ADMISSIONS'
      ? 'Admissions'
      : 'Request coordination';
  }
  positionName(id: string | null): string {
    return (
      this.positions().find((position) => position.id === id)?.displayName ?? id ?? 'Not configured'
    );
  }
  hasDuplicatePositions(): boolean {
    return hasDuplicateResponsibilityPositions(
      this.primary.value || null,
      this.backup.value,
      this.escalation.value,
    );
  }

  load(): void {
    const clinicId = this.context.selectedClinicId();
    const responsibilityId = this.route.snapshot.paramMap.get('responsibilityId');
    if (!clinicId || !responsibilityId) return;
    this.api.getResponsibility(clinicId, responsibilityId).subscribe({
      next: (responsibility) => {
        this.item.set(responsibility);
        this.primary.setValue(responsibility.primaryPositionId);
        this.backup.setValue(responsibility.backupPositionId);
        this.escalation.setValue(responsibility.escalationPositionId);
        this.api
          .listPositions(clinicId, { active: true, page: 0, pageSize: 100 })
          .subscribe({ next: (response) => this.positions.set(response.items) });
      },
      error: () => this.notFound.set(true),
    });
  }

  save(responsibility: ClinicResponsibility): void {
    const clinicId = this.context.selectedClinicId();
    const primaryPositionId = this.primary.value;
    if (!clinicId || !primaryPositionId) return;
    if (this.hasDuplicatePositions()) {
      this.error.set('Primary, backup, and escalation positions must be different.');
      return;
    }
    this.api
      .updateResponsibility(clinicId, responsibility.id, {
        primaryPositionId,
        backupPositionId: this.backup.value,
        escalationPositionId: this.escalation.value,
        expectedVersion: responsibility.version,
      })
      .subscribe({
        next: () => {
          this.message.set('Responsibility configuration updated.');
          this.load();
        },
        error: () => {
          this.error.set(
            'This configuration changed while you were viewing it. The latest information has been loaded.',
          );
          this.load();
        },
      });
  }

  lifecycle(responsibility: ClinicResponsibility): void {
    const clinicId = this.context.selectedClinicId();
    if (!clinicId) return;
    (responsibility.active
      ? this.api.deactivateResponsibility(clinicId, responsibility.id, responsibility.version)
      : this.api.reactivateResponsibility(clinicId, responsibility.id, responsibility.version)
    ).subscribe({
      next: () => {
        this.message.set('Responsibility status updated.');
        this.load();
      },
      error: () => {
        this.error.set(
          'This configuration changed while you were viewing it. The latest information has been loaded.',
        );
        this.load();
      },
    });
  }
}
