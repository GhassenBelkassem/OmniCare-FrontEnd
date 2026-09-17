import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { OcButton, OcDataTableShell, OcEmptyState, OcPageHeader } from '../../shared/ui';
import {
  CLINIC_RESPONSIBILITY_TYPES,
  ClinicPosition,
  ClinicResponsibility,
  ClinicResponsibilityType,
  hasClinicCapability,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { ClinicContextStore } from './clinic-context.store';
import { hasDuplicateResponsibilityPositions } from './clinic-responsibility-utils';

@Component({
  selector: 'app-clinic-responsibilities-page',
  imports: [RouterLink, ReactiveFormsModule, OcButton, OcDataTableShell, OcEmptyState, OcPageHeader],
  template: `
    <oc-page-header title="Responsibilities" description="Authoritative routing configuration.">
      <span ocBreadcrumbs>Clinic workspace / Configuration / Responsibilities</span>
      <div ocSecondaryActions><oc-button variant="quiet" (click)="load()">Refresh</oc-button></div>
    </oc-page-header>

    @if (canManage()) {
      <section class="form">
        <h2>Create responsibility</h2>
        <label>Responsibility<select [formControl]="type">@for (type of types; track type) {<option [ngValue]="type">{{ type === 'ADMISSIONS' ? 'Admissions' : 'Request coordination' }}</option>}</select></label>
        <label>Primary position<select [formControl]="primary"><option [ngValue]="null">Select position</option>@for (position of positions(); track position.id) {<option [ngValue]="position.id">{{ position.displayName }}</option>}</select></label>
        <label>Backup position<select [formControl]="backup"><option [ngValue]="null">Not configured</option>@for (position of positions(); track position.id) {<option [ngValue]="position.id">{{ position.displayName }}</option>}</select></label>
        <label>Escalation position<select [formControl]="escalation"><option [ngValue]="null">Not configured</option>@for (position of positions(); track position.id) {<option [ngValue]="position.id">{{ position.displayName }}</option>}</select></label>
        @if (hasDuplicatePositions()) {<p role="alert">Primary, backup, and escalation positions must be different.</p>}
        <oc-button [disabled]="primary.value === null || hasDuplicatePositions() || busy()" (click)="create()">Create responsibility</oc-button>
      </section>
    }
    @if (error(); as error) {<p role="alert">{{ error }}</p>}

    <oc-data-table-shell [state]="state()">
      <div ocTableTitle><h2>Responsibility configuration</h2></div>
      <div ocTableEmpty><oc-empty-state icon="audit" title="No responsibility configuration is available." description="Routing remains backend-authoritative." /></div>
      @if (state() === 'default') {
        <table><thead><tr><th>Responsibility</th><th>Primary</th><th>Backup</th><th>Escalation</th><th>Status</th><th></th></tr></thead><tbody>
          @for (responsibility of items(); track responsibility.id) {<tr><td>{{ label(responsibility) }}</td><td>{{ responsibility.primaryPositionId }}</td><td>{{ responsibility.backupPositionId ?? 'Not configured' }}</td><td>{{ responsibility.escalationPositionId ?? 'Not configured' }}</td><td>{{ responsibility.active ? 'Active' : 'Inactive' }}</td><td><a [routerLink]="['/clinic/responsibilities', responsibility.id]">View</a></td></tr>}
        </tbody></table>
      }
      <div ocTableFooter><oc-button size="small" variant="quiet" [disabled]="page() === 0" (click)="go(page() - 1)">Previous</oc-button><oc-button size="small" variant="quiet" [disabled]="!next()" (click)="go(page() + 1)">Next</oc-button></div>
    </oc-data-table-shell>
  `,
  styles: [`table{width:100%;border-collapse:collapse}th,td{padding:var(--oc-space-3);border-bottom:1px solid var(--oc-color-border-subtle);text-align:start}.form{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-block:16px}label{display:grid;gap:4px}select{min-height:36px}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicResponsibilitiesPage {
  private readonly context = inject(ClinicContextStore);
  private readonly api = inject(ClinicApiService);
  private readonly router = inject(Router);

  readonly items = signal<readonly ClinicResponsibility[]>([]);
  readonly positions = signal<readonly ClinicPosition[]>([]);
  readonly page = signal(0);
  readonly next = signal(false);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly type = new FormControl<ClinicResponsibilityType>('ADMISSIONS', { nonNullable: true });
  readonly primary = new FormControl<string | null>(null);
  readonly backup = new FormControl<string | null>(null);
  readonly escalation = new FormControl<string | null>(null);
  readonly types = CLINIC_RESPONSIBILITY_TYPES;
  readonly state = computed<'loading' | 'empty' | 'default'>(() => this.loading() ? 'loading' : this.items().length ? 'default' : 'empty');

  constructor() {
    this.context.initialize({ route: false });
    effect(() => {
      if (hasClinicCapability(this.context.bootstrap(), 'CLINIC_RESPONSIBILITY_READ')) untracked(() => this.load());
    });
  }

  canManage(): boolean { return hasClinicCapability(this.context.bootstrap(), 'CLINIC_RESPONSIBILITY_MANAGE'); }
  label(responsibility: ClinicResponsibility): string { return responsibility.responsibilityType === 'ADMISSIONS' ? 'Admissions' : 'Request coordination'; }
  hasDuplicatePositions(): boolean { return hasDuplicateResponsibilityPositions(this.primary.value, this.backup.value, this.escalation.value); }

  load(): void {
    const clinicId = this.context.selectedClinicId();
    if (!clinicId) return;
    this.loading.set(true);
    this.api.listResponsibilities(clinicId, { page: this.page(), pageSize: 20 }).subscribe({ next: (response) => { this.items.set(response.items); this.next.set(response.hasNext); this.loading.set(false); }, error: () => this.loading.set(false) });
    if (this.canManage()) this.api.listPositions(clinicId, { active: true, page: 0, pageSize: 100 }).subscribe({ next: (response) => this.positions.set(response.items) });
  }

  go(page: number): void { if (page >= 0) { this.page.set(page); this.load(); } }

  create(): void {
    const clinicId = this.context.selectedClinicId();
    const primaryPositionId = this.primary.value;
    if (!clinicId || !primaryPositionId || !this.canManage()) return;
    if (this.hasDuplicatePositions()) { this.error.set('Primary, backup, and escalation positions must be different.'); return; }
    this.busy.set(true); this.error.set(null);
    this.api.createResponsibility(clinicId, { responsibilityType: this.type.value, primaryPositionId, backupPositionId: this.backup.value, escalationPositionId: this.escalation.value }).subscribe({ next: (responsibility) => { this.busy.set(false); this.load(); void this.router.navigate(['/clinic/responsibilities', responsibility.id]); }, error: () => { this.busy.set(false); this.error.set('This configuration could not be saved. The latest information has been loaded.'); this.load(); } });
  }
}
