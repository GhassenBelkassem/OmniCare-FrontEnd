import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { OcButton, OcDataTableShell, OcEmptyState, OcPageHeader } from '../../shared/ui';
import {
  CLINIC_ROUTING_INCIDENT_TYPES,
  ClinicRoutingIncident,
  ClinicRoutingIncidentStatus,
  hasClinicCapability,
} from './clinic-api.models';
import { ClinicApiService } from './clinic-api.service';
import { ClinicContextStore } from './clinic-context.store';
import {
  clinicRoutingIncidentStatusLabel,
  clinicRoutingIncidentTypeLabel,
  isRetryableRoutingIncident,
} from './clinic-routing-incident-utils';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-clinic-routing-incidents-page',
  imports: [DatePipe, RouterLink, OcButton, OcDataTableShell, OcEmptyState, OcPageHeader],
  template: `
    <oc-page-header title="Routing Incidents" description="Backend-recorded routing and escalation issues.">
      <span ocBreadcrumbs>Clinic workspace&nbsp; / &nbsp;Routing Incidents</span>
      <div ocSecondaryActions><oc-button variant="quiet" (click)="load()">Refresh</oc-button></div>
    </oc-page-header>
    <div class="incident-filters" aria-label="Routing incident filters">
      <label>Status
        <select [value]="status()" (change)="setStatus($any($event.target).value)">
          <option value="OPEN">Open incidents</option><option value="RESOLVED">Resolved history</option>
        </select>
      </label>
      <label>Type
        <select [value]="type() ?? ''" (change)="setType($any($event.target).value)">
          <option value="">All incident types</option>
          @for (item of incidentTypes; track item) { <option [value]="item">{{ typeLabel(item) }}</option> }
        </select>
      </label>
    </div>
    @if (notice(); as message) { <p class="incident-message" role="status">{{ message }}</p> }
    @if (error(); as message) { <p class="incident-message incident-message--error" role="alert">{{ message }}</p> }
    <oc-data-table-shell [state]="tableState()" density="compact">
      <div ocTableTitle><h2>{{ status() === 'OPEN' ? 'Open incidents' : 'Resolved history' }}</h2></div>
      <div ocTableEmpty><oc-empty-state icon="audit" [title]="status() === 'OPEN' ? 'No open routing incidents' : 'No resolved routing incidents'" description="No operational action is required here." /></div>
      @if (tableState() === 'default') {
        <table class="incidents-table"><thead><tr><th>Incident</th><th>Related task</th><th>Opened</th><th>Resolution</th><th>Actions</th></tr></thead>
          <tbody>@for (incident of items(); track incident.id) { <tr>
            <td><strong>{{ typeLabel(incident.incidentType) }}</strong><small>{{ statusLabel(incident.status) }}</small></td>
            <td><a [routerLink]="['/clinic/tasks', incident.taskId]">View task</a></td>
            <td><time [attr.datetime]="incident.openedAt">{{ incident.openedAt | date: 'dd MMM, HH:mm' }}</time></td>
            <td>@if (incident.resolutionCode) { {{ resolutionLabel(incident.resolutionCode) }} } @else { — }</td>
            <td class="incident-actions"><a [routerLink]="['/clinic/routing-incidents', incident.id]">View</a>
              @if (canRetry(incident)) { <oc-button size="small" [disabled]="busy()" (click)="retry(incident)">Retry routing</oc-button> }
            </td>
          </tr> }</tbody></table>
      }
      <div ocTableFooter class="incident-footer"><span>Page {{ page() + 1 }} · {{ items().length }} shown</span><div><oc-button size="small" variant="quiet" [disabled]="page() === 0 || loading()" (click)="go(page() - 1)">Previous</oc-button><oc-button size="small" variant="quiet" [disabled]="!hasNext() || loading()" (click)="go(page() + 1)">Next</oc-button></div></div>
    </oc-data-table-shell>
  `,
  styles: [`
    .incident-filters,.incident-footer,.incident-actions{display:flex;gap:var(--oc-space-3);align-items:end;flex-wrap:wrap;margin-block:var(--oc-space-4)}
    label{display:grid;gap:var(--oc-space-1);font-weight:600} select{min-height:36px;padding-inline:var(--oc-space-2)}
    .incidents-table{width:100%;border-collapse:collapse}.incidents-table th,.incidents-table td{padding:var(--oc-space-3);border-bottom:1px solid var(--oc-color-border-subtle);text-align:start}.incidents-table small{display:block;color:var(--oc-color-text-muted);margin-top:4px}.incident-footer{justify-content:space-between}.incident-message{padding:var(--oc-space-3);background:var(--oc-color-surface-hover)}.incident-message--error{color:var(--oc-color-text-danger)}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicRoutingIncidentsPage {
  private readonly context = inject(ClinicContextStore); private readonly api = inject(ClinicApiService);
  private readonly router = inject(Router); private readonly route = inject(ActivatedRoute);
  readonly items = signal<readonly ClinicRoutingIncident[]>([]); readonly loading = signal(true); readonly error = signal<string | null>(null); readonly notice = signal<string | null>(null); readonly hasNext = signal(false); readonly busy = signal(false);
  readonly page = signal(0); readonly status = signal<ClinicRoutingIncidentStatus>('OPEN'); readonly type = signal<(typeof CLINIC_ROUTING_INCIDENT_TYPES)[number] | null>(null);
  readonly incidentTypes = CLINIC_ROUTING_INCIDENT_TYPES; readonly typeLabel = clinicRoutingIncidentTypeLabel; readonly statusLabel = clinicRoutingIncidentStatusLabel;
  readonly resolutionLabel = (value: NonNullable<ClinicRoutingIncident['resolutionCode']>) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase());
  readonly tableState = computed<'loading' | 'empty' | 'default'>(() => this.loading() ? 'loading' : this.items().length === 0 ? 'empty' : 'default');
  constructor() { this.context.initialize({route:false}); effect(() => { if (hasClinicCapability(this.context.bootstrap(), 'CLINIC_ROUTING_INCIDENT_READ')) untracked(() => this.load()); }); }
  setStatus(value: string): void { this.status.set(value === 'RESOLVED' ? 'RESOLVED' : 'OPEN'); this.page.set(0); this.load(); }
  setType(value: string): void { this.type.set((CLINIC_ROUTING_INCIDENT_TYPES as readonly string[]).includes(value) ? value as (typeof CLINIC_ROUTING_INCIDENT_TYPES)[number] : null); this.page.set(0); this.load(); }
  go(page: number): void { if (page < 0) return; this.page.set(page); this.load(); }
  canRetry(incident: ClinicRoutingIncident): boolean { return hasClinicCapability(this.context.bootstrap(), 'CLINIC_ROUTING_INCIDENT_RETRY') && incident.status === 'OPEN' && isRetryableRoutingIncident(incident.incidentType); }
  load(): void { const clinicId = this.context.selectedClinicId(); if (!clinicId || !hasClinicCapability(this.context.bootstrap(), 'CLINIC_ROUTING_INCIDENT_READ')) return; this.loading.set(true); this.error.set(null); this.api.listRoutingIncidents(clinicId, {status:this.status(), type:this.type() ?? undefined, page:this.page(), size:PAGE_SIZE}).subscribe({next: page => { this.items.set(page.items); this.hasNext.set(page.hasNext); this.loading.set(false); }, error: () => { this.loading.set(false); this.error.set('We couldn’t load routing incidents. Try again in a moment.'); }}); }
  retry(incident: ClinicRoutingIncident): void { const clinicId=this.context.selectedClinicId(); if (!clinicId || !this.canRetry(incident)) return; this.busy.set(true); this.error.set(null); this.api.retryRoutingIncident(clinicId, incident.id).subscribe({next: () => {this.busy.set(false); this.notice.set('Routing recovery was requested. The latest incident information has been loaded.'); this.load();}, error: (error:HttpErrorResponse) => {this.busy.set(false); this.error.set(error.status===409?'This changed while you were viewing it. The latest information has been loaded.':'This routing action is unavailable. The latest information has been loaded.'); this.load();}}); }
}
