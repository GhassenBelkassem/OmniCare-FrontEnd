import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { OcButton, OcCheckbox, OcIcon, OcSkeleton } from '../../../shared/ui';
import { EquipmentDefinitionResponse } from './professional-services-api.models';
import { MedicalEquipmentApiService } from './professional-services-api.service';
import { mergeDefinitions } from './mobile-equipment-settings';
import { mapServicesSettingsFailure } from './services-settings-errors';

@Component({
  selector: 'app-cabinet-equipment-settings',
  imports: [OcButton, OcCheckbox, OcIcon, OcSkeleton],
  templateUrl: './cabinet-equipment-settings.html',
  styleUrl: './equipment-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetEquipmentSettings implements OnInit {
  private readonly api = inject(MedicalEquipmentApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly locationId = input.required<string>();
  readonly catalog = input.required<readonly EquipmentDefinitionResponse[]>();
  readonly revision = signal<number | null>(null);
  readonly assignedDefinitions = signal<readonly EquipmentDefinitionResponse[]>([]);
  readonly baseline = signal<readonly string[]>([]);
  readonly draft = signal<readonly string[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly authenticationError = signal(false);
  readonly conflict = signal(false);
  readonly success = signal<string | null>(null);

  readonly options = computed(() => mergeDefinitions(this.catalog(), this.assignedDefinitions()));
  readonly dirty = computed(() => !sameSet(this.baseline(), this.draft()));

  ngOnInit(): void {
    this.load();
  }

  isSelected(code: string): boolean {
    return this.draft().includes(code);
  }

  toggle(definition: EquipmentDefinitionResponse): void {
    if (this.saving() || (!definition.active && !this.isSelected(definition.code))) return;
    this.error.set(null);
    this.conflict.set(false);
    this.success.set(null);
    this.draft.update((current) =>
      current.includes(definition.code)
        ? current.filter((code) => code !== definition.code)
        : [...current, definition.code],
    );
  }

  load(): void {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set(null);
    this.authenticationError.set(false);
    this.conflict.set(false);
    this.success.set(null);
    this.api
      .getPracticeLocation(this.locationId())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (response) => {
          const selected = response.equipment.map((definition) => definition.code);
          this.revision.set(response.revision);
          this.assignedDefinitions.set(response.equipment);
          this.baseline.set(selected);
          this.draft.set(selected);
        },
        error: (error: unknown) => this.handleError(error, 'load'),
      });
  }

  save(): void {
    const revision = this.revision();
    if (revision === null || this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.error.set(null);
    this.conflict.set(false);
    this.success.set(null);
    this.api
      .replacePracticeLocation(this.locationId(), {
        expectedRevision: revision,
        equipmentCodes: this.draft(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (response) => {
          const selected = response.equipment.map((definition) => definition.code);
          this.revision.set(response.revision);
          this.assignedDefinitions.set(response.equipment);
          this.baseline.set(selected);
          this.draft.set(selected);
          this.success.set('Matériel du cabinet enregistré.');
        },
        error: (error: unknown) => this.handleError(error, 'save'),
      });
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  private handleError(error: unknown, operation: 'load' | 'save'): void {
    const failure = mapServicesSettingsFailure(error, 'cabinet-equipment', operation);
    this.error.set(failure.message);
    this.authenticationError.set(failure.authentication);
    this.conflict.set(failure.conflict);
  }
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}
