import { HttpErrorResponse } from '@angular/common/http';
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
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';

import { OcButton, OcSectionCard } from '../../../shared/ui';
import { ChartAccessRequired } from './chart-access-required';
import type {
  PatientChartAccessDto,
  PatientChartMedicalSummaryDto,
  PatientChartRecordStatus,
} from './patient-chart-api.models';
import { PatientChartApiService, newChartIdempotencyKey } from './patient-chart-api.service';
import { BLOOD_TYPES, isAccessRequiredError, mayLoadClinical } from './patient-chart-format';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'denied';

@Component({
  selector: 'app-chart-medical-summary-card',
  imports: [
    FormsModule,
    NzSelectModule,
    NzSkeletonModule,
    NzTagModule,
    OcButton,
    OcSectionCard,
    ChartAccessRequired,
  ],
  template: `
    <oc-section-card title="Résumé médical" icon="medicine-box">
      @if (canEdit() && !editing()) {
        <oc-button ocSectionAction variant="ghost" size="small" leadingIcon="edit" (click)="startEdit()">
          Modifier
        </oc-button>
      }

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
        @if (editing()) {
          <form class="summary-form" (ngSubmit)="save()" (keydown.escape)="cancelEdit()">
            <label class="summary-form__field">
              <span>Allergies</span>
              <nz-select
                nzMode="tags"
                name="allergies"
                nzPlaceholder="Ajoutez une allergie puis Entrée"
                [nzTokenSeparators]="[',', ';']"
                [nzMaxTagCount]="50"
                [(ngModel)]="draftAllergies"
              />
            </label>
            <label class="summary-form__field">
              <span>Antécédents</span>
              <nz-select
                nzMode="tags"
                name="conditions"
                nzPlaceholder="Ajoutez un antécédent puis Entrée"
                [nzTokenSeparators]="[',', ';']"
                [(ngModel)]="draftConditions"
              />
            </label>
            <label class="summary-form__field summary-form__field--narrow">
              <span>Groupe sanguin</span>
              <nz-select name="bloodType" nzAllowClear nzPlaceholder="Non renseigné" [(ngModel)]="draftBloodType">
                @for (type of bloodTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="type" />
                }
              </nz-select>
            </label>
            <p class="chart-muted summary-form__hint">
              Les traitements en cours proviennent des ordonnances et ne se modifient pas ici.
            </p>
            @if (saveError(); as message) {
              <p class="summary-form__error" role="alert">{{ message }}</p>
            }
            <div class="summary-form__actions">
              <oc-button variant="ghost" (click)="cancelEdit()" [disabled]="saving()">Annuler</oc-button>
              <oc-button variant="primary" type="submit" [loading]="saving()">Enregistrer</oc-button>
            </div>
          </form>
        } @else {
          <dl class="summary-list">
            <div>
              <dt>Allergies</dt>
              <dd>
                @if (!data.essentialInformationShared) {
                  <span class="chart-muted">Non partagé par le patient</span>
                } @else {
                  @for (item of data.allergies; track item) {
                    <nz-tag class="summary-chip summary-chip--alert">{{ item }}</nz-tag>
                  } @empty {
                    <span class="chart-muted">Aucune allergie connue</span>
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
                  @for (item of data.conditions; track item) {
                    <nz-tag class="summary-chip">{{ item }}</nz-tag>
                  } @empty {
                    <span class="chart-muted">Aucun antécédent renseigné</span>
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

  readonly bloodTypes = BLOOD_TYPES;
  readonly state = signal<LoadState>('idle');
  readonly summary = signal<PatientChartMedicalSummaryDto | null>(null);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly clinicalAllowed = computed(() => mayLoadClinical(this.access()));
  readonly canEdit = computed(
    () =>
      this.access().editable &&
      this.recordStatus() === 'READY' &&
      this.state() === 'ready' &&
      (this.summary()?.editable ?? false),
  );

  draftAllergies: string[] = [];
  draftConditions: string[] = [];
  draftBloodType: string | null = null;
  private saveKey: { readonly payload: string; readonly key: string } | null = null;

  constructor() {
    effect(() => {
      const id = this.patientId();
      const allowed = mayLoadClinical(this.access()) && this.recordStatus() === 'READY';
      untracked(() => {
        this.editing.set(false);
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

  startEdit(): void {
    const summary = this.summary();
    if (!summary) return;
    this.draftAllergies = [...summary.allergies];
    this.draftConditions = [...summary.conditions];
    this.draftBloodType = summary.bloodType;
    this.saveError.set(null);
    this.editing.set(true);
  }

  cancelEdit(): void {
    if (this.saving()) return;
    this.editing.set(false);
    this.saveError.set(null);
  }

  save(): void {
    const summary = this.summary();
    if (!summary || this.saving()) return;
    const update = {
      expectedVersion: summary.version,
      bloodType: this.draftBloodType || null,
      allergies: clean(this.draftAllergies),
      conditions: clean(this.draftConditions),
    };
    if (update.bloodType === null && update.allergies.length === 0 && update.conditions.length === 0) {
      this.saveError.set('Renseignez au moins une allergie, un antécédent ou le groupe sanguin.');
      return;
    }
    if (update.allergies.some((item) => item.length > 200) || update.conditions.some((item) => item.length > 200)) {
      this.saveError.set('Chaque élément doit contenir au plus 200 caractères.');
      return;
    }
    const payload = JSON.stringify(update);
    if (this.saveKey?.payload !== payload) {
      this.saveKey = { payload, key: newChartIdempotencyKey('chart-summary') };
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.api
      .updateMedicalSummary(this.patientId(), update, this.saveKey.key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.saveKey = null;
          this.summary.set(updated);
          this.editing.set(false);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.saveKey = null;
            this.saveError.set(
              'Le résumé médical a été modifié entre-temps. Rechargez-le puis recommencez.',
            );
            this.editing.set(false);
            this.load();
            return;
          }
          this.saveError.set(
            error instanceof HttpErrorResponse && error.status === 422
              ? 'Les informations saisies sont invalides.'
              : 'L’enregistrement a échoué. Réessayez.',
          );
        },
      });
  }

  treatmentDetail(item: PatientChartMedicalSummaryDto['treatments'][number]): string {
    return [item.strength, item.dosage, item.frequency].filter(Boolean).join(' · ');
  }
}

function clean(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const item = value.trim();
    const key = item.toLocaleLowerCase('fr-FR');
    if (item && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
