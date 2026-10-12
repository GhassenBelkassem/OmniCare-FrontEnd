import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { OcButton, OcCheckbox, OcIcon } from '../../../shared/ui';
import {
  EquipmentDefinitionResponse,
  EquipmentOverviewResponse,
} from './professional-services-api.models';
import { MedicalEquipmentApiService } from './professional-services-api.service';
import { mapServicesSettingsFailure } from './services-settings-errors';

@Component({
  selector: 'app-mobile-equipment-settings',
  imports: [OcButton, OcCheckbox, OcIcon],
  templateUrl: './mobile-equipment-settings.html',
  styleUrl: './equipment-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileEquipmentSettings implements OnChanges {
  private readonly api = inject(MedicalEquipmentApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly overview = input.required<EquipmentOverviewResponse>();
  readonly reloadRequested = output<void>();
  readonly revision = signal<number | null>(null);
  readonly assignedDefinitions = signal<readonly EquipmentDefinitionResponse[]>([]);
  readonly baseline = signal<readonly string[]>([]);
  readonly draft = signal<readonly string[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly authenticationError = signal(false);
  readonly conflict = signal(false);
  readonly success = signal<string | null>(null);

  readonly options = computed(() =>
    mergeDefinitions(
      this.overview().catalog.filter((definition) => definition.portable),
      this.assignedDefinitions().filter((definition) => definition.portable),
    ),
  );
  readonly dirty = computed(() => !sameSet(this.baseline(), this.draft()));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['overview']) this.applyOverview(this.overview());
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

  save(): void {
    const revision = this.revision();
    if (revision === null || this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.error.set(null);
    this.conflict.set(false);
    this.success.set(null);
    this.api
      .replaceMobile({ expectedRevision: revision, equipmentCodes: this.draft() })
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
          this.success.set('Matériel mobile enregistré.');
        },
        error: (error: unknown) => {
          const failure = mapServicesSettingsFailure(error, 'mobile-equipment', 'save');
          this.error.set(failure.message);
          this.authenticationError.set(failure.authentication);
          this.conflict.set(failure.conflict);
        },
      });
  }

  reload(): void {
    if (this.saving()) return;
    this.reloadRequested.emit();
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  private applyOverview(overview: EquipmentOverviewResponse): void {
    const selected = overview.mobile.equipment
      .filter((definition) => definition.portable)
      .map((definition) => definition.code);
    this.revision.set(overview.mobile.revision);
    this.assignedDefinitions.set(overview.mobile.equipment);
    this.baseline.set(selected);
    this.draft.set(selected);
    this.error.set(null);
    this.authenticationError.set(false);
    this.conflict.set(false);
    this.success.set(null);
  }
}

export function mergeDefinitions(
  primary: readonly EquipmentDefinitionResponse[],
  selected: readonly EquipmentDefinitionResponse[],
): readonly EquipmentDefinitionResponse[] {
  const byCode = new Map(primary.map((definition) => [definition.code, definition]));
  for (const definition of selected) {
    if (!byCode.has(definition.code)) byCode.set(definition.code, definition);
  }
  return [...byCode.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, 'fr'),
  );
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}
