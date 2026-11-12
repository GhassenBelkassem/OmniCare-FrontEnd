import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { OcButton, OcSectionCard } from '../../../shared/ui';
import { ChartAccessRequired } from './chart-access-required';
import type {
  PatientChartAccessDto,
  PatientChartMedicalSummaryDto,
  PatientChartRecordStatus,
  SummaryStatus,
} from './patient-chart-api.models';
import { PatientChartApiService } from './patient-chart-api.service';
import { isAccessRequiredError, mayLoadClinical } from './patient-chart-format';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'denied';

@Component({
  selector: 'app-chart-medical-summary-card',
  imports: [
    NzSkeletonModule,
    NzTagModule,
    OcButton,
    OcSectionCard,
    ChartAccessRequired,
  ],
  template: `
    <oc-section-card title="Résumé médical" icon="medicine-box">

      @if (!clinicalAllowed() || state() === 'denied') {
        <app-chart-access-required />
      } @else if (recordStatus() === 'PREPARING') {
        <p class="chart-muted" role="status">
          Le dossier médical est en cours de préparation. Le résumé sera disponible dans un instant.
        </p>
      } @else if (state() === 'loading') {
        <nz-skeleton [nzActive]="true" [nzTitle]="false" [nzParagraph]="{ rows: 4 }" />
      } @else if (state() === 'error') {
        <div class="chart-error" role="alert">
          <p>Le résumé médical n’a pas pu être chargé.</p>
          <oc-button size="small" (click)="load()">Réessayer</oc-button>
        </div>
      } @else if (summary(); as data) {
          <dl class="summary-list">
            <div>
              <dt>Allergies</dt>
              <dd>
                @if (!data.essentialInformationShared) {
                  <span class="chart-muted">Non partagé par le patient</span>
                } @else {
                  @if (statusOf(data.allergiesStatus, data.allergies) === 'NONE_KNOWN') {
                    <span>Aucune connue</span>
                  } @else if (statusOf(data.allergiesStatus, data.allergies) === 'LIST') {
                    @for (item of data.allergies; track item) {
                      <nz-tag class="summary-chip summary-chip--alert">{{ item }}</nz-tag>
                    }
                  } @else {
                    <span class="chart-muted">Non renseigné</span>
                  }
                }
              </dd>
            </div>
            <div>
              <dt>Antécédents</dt>
              <dd>
                @if (!data.essentialInformationShared) {
                  <span class="chart-muted">Non partagé par le patient</span>
                } @else {
                  @if (statusOf(data.conditionsStatus, data.conditions) === 'NONE_KNOWN') {
                    <span>Aucun connu</span>
                  } @else if (statusOf(data.conditionsStatus, data.conditions) === 'LIST') {
                    @for (item of data.conditions; track item) {
                      <nz-tag class="summary-chip">{{ item }}</nz-tag>
                    }
                  } @else {
                    <span class="chart-muted">Non renseigné</span>
                  }
                }
              </dd>
            </div>
            <div>
              <dt>Traitements en cours</dt>
              <dd>
                @if (!data.treatmentsShared) {
                  <span class="chart-muted">Non partagé par le patient</span>
                } @else {
                  <ul class="summary-treatments">
                    @for (item of data.treatments; track $index) {
                      <li>
                        <strong>{{ item.name }}</strong>
                        @if (treatmentDetail(item); as detail) {
                          <span>{{ detail }}</span>
                        }
                      </li>
                    } @empty {
                      <li class="chart-muted">Aucun traitement en cours</li>
                    }
                  </ul>
                }
              </dd>
            </div>
            <div>
              <dt>Groupe sanguin</dt>
              <dd>
                @if (!data.essentialInformationShared) {
                  <span class="chart-muted">Non partagé par le patient</span>
                } @else if (data.bloodType) {
                  <nz-tag class="summary-chip summary-chip--blood">{{ data.bloodType }}</nz-tag>
                } @else {
                  <span class="chart-muted">Non renseigné</span>
                }
              </dd>
            </div>
          </dl>
      }
    </oc-section-card>
  `,
  styleUrl: './patient-chart-cards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartMedicalSummaryCard {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientId = input.required<string>();
  readonly access = input.required<PatientChartAccessDto>();
  readonly recordStatus = input<PatientChartRecordStatus>('READY');

  readonly state = signal<LoadState>('idle');
  readonly summary = signal<PatientChartMedicalSummaryDto | null>(null);
  readonly clinicalAllowed = computed(() => mayLoadClinical(this.access()));


  constructor() {
    effect(() => {
      const id = this.patientId();
      const allowed = mayLoadClinical(this.access()) && this.recordStatus() === 'READY';
      untracked(() => {
        if (allowed && id) this.load();
        else this.state.set('idle');
      });
    });
  }

  load(): void {
    this.state.set('loading');
    this.api
      .getMedicalSummary(this.patientId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.state.set('ready');
        },
        error: (error: unknown) => this.state.set(isAccessRequiredError(error) ? 'denied' : 'error'),
      });
  }

  /** Three states; an older server without a status: a list is LIST, no item is UNKNOWN. */
  statusOf(status: SummaryStatus | null | undefined, items: readonly string[]): SummaryStatus {
    return status ?? (items.length > 0 ? 'LIST' : 'UNKNOWN');
  }

  treatmentDetail(item: PatientChartMedicalSummaryDto['treatments'][number]): string {
    return [item.strength, item.dosage, item.frequency].filter(Boolean).join(' · ');
  }
}

