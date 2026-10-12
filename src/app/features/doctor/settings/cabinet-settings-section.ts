import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { OcAlertDialog, OcButton, OcEmptyState, OcSkeleton } from '../../../shared/ui';
import { CabinetCard } from './cabinet-card';
import { CabinetFormDialog, CabinetFormSubmission } from './cabinet-form-dialog';
import {
  PRACTICE_LOCATION_LIMIT,
  PracticeLocationMediaResponse,
  PracticeLocationResponse,
  UpdatePracticeLocationRequest,
} from './practice-location-api.models';
import { PracticeLocationApiService } from './practice-location-api.service';
import {
  RE_AUTHENTICATE_MESSAGE,
  isAuthenticationError,
  isConflict,
  isNetworkError,
  isValidationError,
  problemCode,
} from './professional-profile-errors';

@Component({
  selector: 'app-cabinet-settings-section',
  imports: [OcAlertDialog, OcButton, OcEmptyState, OcSkeleton, CabinetCard, CabinetFormDialog],
  templateUrl: './cabinet-settings-section.html',
  styleUrl: './cabinet-settings-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetSettingsSection {
  private readonly api = inject(PracticeLocationApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly locations = signal<readonly PracticeLocationResponse[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly authError = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly formOpen = signal(false);
  readonly editing = signal<PracticeLocationResponse | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formConflict = signal(false);

  readonly deleteTarget = signal<PracticeLocationResponse | null>(null);
  readonly deleting = signal(false);
  readonly deleteConflict = signal(false);

  readonly atLimit = computed(() => this.locations().length >= PRACTICE_LOCATION_LIMIT);
  readonly limit = PRACTICE_LOCATION_LIMIT;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (locations) => this.locations.set(sortLocations(locations)),
        error: (error: unknown) => this.handleLoadError(error),
      });
  }

  add(): void {
    if (this.atLimit()) return;
    this.editing.set(null);
    this.formError.set(null);
    this.formConflict.set(false);
    this.formOpen.set(true);
  }

  edit(location: PracticeLocationResponse): void {
    this.editing.set(location);
    this.formError.set(null);
    this.formConflict.set(false);
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
    this.formError.set(null);
    this.formConflict.set(false);
  }

  save(submission: CabinetFormSubmission): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    this.formConflict.set(false);
    this.success.set(null);
    this.actionError.set(null);

    const operation =
      submission.id === null
        ? this.api.create(submission.value)
        : this.api.update(
            submission.id,
            updateRequest(submission.value, requireRevision(submission.revision)),
          );
    const created = submission.id === null;
    operation
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (saved) => this.finishSave(saved, created),
        error: (error: unknown) => this.handleSaveError(error),
      });
  }

  refreshAfterConflict(): void {
    this.closeForm();
    this.load();
  }

  requestDelete(location: PracticeLocationResponse): void {
    this.actionError.set(null);
    this.deleteConflict.set(false);
    this.deleteTarget.set(location);
  }

  cancelDelete(): void {
    if (!this.deleting()) this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (target === null || this.deleting()) return;
    this.deleting.set(true);
    this.actionError.set(null);
    this.success.set(null);
    this.api
      .delete(target.id, target.revision)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deleting.set(false)),
      )
      .subscribe({
        next: () => {
          this.locations.update((locations) => locations.filter((item) => item.id !== target.id));
          this.deleteTarget.set(null);
          this.success.set('Cabinet supprimé.');
        },
        error: (error: unknown) => this.handleDeleteError(error),
      });
  }

  refreshAfterDeleteConflict(): void {
    this.deleteConflict.set(false);
    this.actionError.set(null);
    this.load();
  }

  updateGallery(locationId: string, gallery: readonly PracticeLocationMediaResponse[]): void {
    this.locations.update((locations) =>
      locations.map((location) =>
        location.id === locationId ? { ...location, gallery } : location,
      ),
    );
  }

  deleteMessage(): string {
    const target = this.deleteTarget();
    return target === null
      ? ''
      : `« ${target.name} » ainsi que ses informations publiques et sa galerie seront définitivement supprimés.`;
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  private finishSave(saved: PracticeLocationResponse, created: boolean): void {
    const hadOtherPrimary =
      saved.primary && this.locations().some((item) => item.primary && item.id !== saved.id);
    this.locations.update((locations) => upsertLocation(locations, saved));
    this.formOpen.set(false);
    this.editing.set(null);
    this.success.set(created ? 'Cabinet ajouté.' : 'Cabinet mis à jour.');
    if (hadOtherPrimary) this.reloadAfterPrimaryChange();
  }

  private reloadAfterPrimaryChange(): void {
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => this.locations.set(sortLocations(locations)),
        error: () =>
          this.actionError.set(
            'Le cabinet est enregistré, mais la liste complète n’a pas pu être actualisée.',
          ),
      });
  }

  private handleLoadError(error: unknown): void {
    if (isAuthenticationError(error)) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      return;
    }
    this.loadError.set(
      isNetworkError(error)
        ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
        : 'Impossible de charger vos cabinets.',
    );
  }

  private handleSaveError(error: unknown): void {
    if (isAuthenticationError(error)) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      this.formOpen.set(false);
      this.formError.set(null);
      this.formConflict.set(false);
      return;
    }
    const code = problemCode(error);
    if (isConflict(error)) {
      this.formConflict.set(true);
      this.formError.set(
        'Ce cabinet a été modifié depuis son ouverture. Vos saisies sont conservées.',
      );
      return;
    }
    if (code === 'CARE_CAPABILITY_REQUIRES_ACTIVE_CABINET') {
      this.formError.set(
        'Impossible de désactiver ce cabinet. Les services Cabinet ou Urgence au cabinet sont encore activés. Désactivez d’abord ces services.',
      );
      return;
    }
    if (code === 'PRACTICE_LOCATION_LIMIT_REACHED') {
      this.formError.set(`Vous avez atteint la limite de ${PRACTICE_LOCATION_LIMIT} cabinets.`);
      return;
    }
    if (code === 'PRACTICE_LOCATION_PRIMARY_CONFLICT') {
      this.formConflict.set(true);
      this.formError.set(
        'Le cabinet principal a changé ailleurs. Rechargez les données avant de réessayer.',
      );
      return;
    }
    if (code === 'PRACTICE_LOCATION_NOT_FOUND') {
      this.formConflict.set(true);
      this.formError.set('Ce cabinet n’existe plus. Rechargez les données.');
      return;
    }
    if (isValidationError(error)) {
      this.formError.set('Certaines informations sont invalides. Vérifiez le formulaire.');
      return;
    }
    this.formError.set(
      isNetworkError(error)
        ? 'Connexion impossible. Vos saisies sont conservées.'
        : 'Impossible d’enregistrer ce cabinet. Réessayez.',
    );
  }

  private handleDeleteError(error: unknown): void {
    this.deleteTarget.set(null);
    if (isAuthenticationError(error)) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      return;
    }
    const code = problemCode(error);
    if (isConflict(error)) {
      this.deleteConflict.set(true);
      this.actionError.set(
        'Ce cabinet a été modifié ailleurs. Rechargez les données avant de le supprimer.',
      );
      return;
    }
    if (code === 'CARE_CAPABILITY_REQUIRES_ACTIVE_CABINET') {
      this.actionError.set(
        'Impossible de supprimer ce cabinet. Les services Cabinet ou Urgence au cabinet sont encore activés. Désactivez d’abord ces services.',
      );
      return;
    }
    if (code === 'PRACTICE_LOCATION_NOT_FOUND') {
      this.deleteConflict.set(true);
      this.actionError.set('Ce cabinet n’existe plus. Rechargez la liste.');
      return;
    }
    this.actionError.set(
      isNetworkError(error)
        ? 'Connexion impossible. Le cabinet n’a pas été supprimé.'
        : 'Impossible de supprimer le cabinet. Il reste dans votre liste.',
    );
  }
}

function updateRequest(
  value: CabinetFormSubmission['value'],
  expectedRevision: number,
): UpdatePracticeLocationRequest {
  return {
    name: value.name,
    governorate: value.governorate,
    city: value.city,
    address: value.address,
    latitude: value.latitude,
    longitude: value.longitude,
    publicPhone: value.publicPhone ?? '',
    wheelchairAccessible: value.wheelchairAccessible,
    patientInstructions: value.patientInstructions ?? '',
    primary: value.primary,
    active: value.active,
    expectedRevision,
  };
}

function requireRevision(revision: number | null): number {
  if (revision === null) throw new Error('A revision is required to update a cabinet.');
  return revision;
}

function upsertLocation(
  locations: readonly PracticeLocationResponse[],
  saved: PracticeLocationResponse,
): readonly PracticeLocationResponse[] {
  const normalized = saved.primary
    ? locations.map((location) =>
        location.id === saved.id ? location : { ...location, primary: false },
      )
    : locations;
  const exists = normalized.some((location) => location.id === saved.id);
  return sortLocations(
    exists
      ? normalized.map((location) => (location.id === saved.id ? saved : location))
      : [...normalized, saved],
  );
}

function sortLocations(
  locations: readonly PracticeLocationResponse[],
): readonly PracticeLocationResponse[] {
  return [...locations].sort(
    (left, right) =>
      Number(right.primary) - Number(left.primary) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}
