import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { OcAlertDialog, OcButton, OcDialog, OcIcon } from '../../../shared/ui';
import {
  PRACTICE_LOCATION_MEDIA_LIMIT,
  PRACTICE_LOCATION_MEDIA_MAX_BYTES,
  PRACTICE_LOCATION_MEDIA_TYPES,
  PracticeLocationMediaResponse,
} from './practice-location-api.models';
import { PracticeLocationApiService } from './practice-location-api.service';
import { isAuthenticationError, isNetworkError, problemCode } from './professional-profile-errors';

@Component({
  selector: 'app-cabinet-gallery',
  imports: [OcAlertDialog, OcButton, OcDialog, OcIcon],
  templateUrl: './cabinet-gallery.html',
  styleUrl: './cabinet-gallery.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetGallery {
  private readonly api = inject(PracticeLocationApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly locationId = input.required<string>();
  readonly locationName = input.required<string>();
  readonly media = input.required<readonly PracticeLocationMediaResponse[]>();
  readonly mediaChange = output<readonly PracticeLocationMediaResponse[]>();

  readonly uploading = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly deleteTarget = signal<PracticeLocationMediaResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly brokenImages = signal<ReadonlySet<string>>(new Set());
  readonly galleryOpen = signal(false);

  readonly maximum = PRACTICE_LOCATION_MEDIA_LIMIT;
  readonly previewLimit = 4;
  readonly previewMedia = computed(() => this.media().slice(0, this.previewLimit));
  readonly hiddenCount = computed(() => Math.max(0, this.media().length - this.previewLimit));
  readonly uploadDisabled = computed(
    () => this.uploading() || this.media().length >= PRACTICE_LOCATION_MEDIA_LIMIT,
  );

  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null || this.uploading()) return;
    this.error.set(null);
    this.success.set(null);
    if (this.media().length >= PRACTICE_LOCATION_MEDIA_LIMIT) {
      this.error.set(`La galerie est limitée à ${PRACTICE_LOCATION_MEDIA_LIMIT} photos.`);
      return;
    }
    if (!(PRACTICE_LOCATION_MEDIA_TYPES as readonly string[]).includes(file.type)) {
      this.error.set('Sélectionnez une image JPEG ou PNG.');
      return;
    }
    if (file.size <= 0 || file.size > PRACTICE_LOCATION_MEDIA_MAX_BYTES) {
      this.error.set('L’image doit peser au maximum 8 Mo.');
      return;
    }

    this.uploading.set(true);
    this.api
      .uploadMedia(this.locationId(), file, this.nextDisplayOrder())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.uploading.set(false)),
      )
      .subscribe({
        next: (created) => {
          this.mediaChange.emit(sortMedia([...this.media(), created]));
          this.success.set('Photo ajoutée.');
        },
        error: (error: unknown) => this.error.set(mediaErrorMessage(error, 'upload')),
      });
  }

  requestDelete(item: PracticeLocationMediaResponse): void {
    this.error.set(null);
    this.success.set(null);
    this.deleteTarget.set(item);
  }

  cancelDelete(): void {
    if (this.deletingId() === null) this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (target === null || this.deletingId() !== null) return;
    this.deletingId.set(target.id);
    this.api
      .deleteMedia(this.locationId(), target.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deletingId.set(null)),
      )
      .subscribe({
        next: () => {
          this.mediaChange.emit(this.media().filter((item) => item.id !== target.id));
          this.deleteTarget.set(null);
          this.success.set('Photo supprimée.');
        },
        error: (error: unknown) => {
          this.deleteTarget.set(null);
          this.error.set(mediaErrorMessage(error, 'delete'));
        },
      });
  }

  markBroken(mediaId: string): void {
    this.brokenImages.update((current) => new Set([...current, mediaId]));
  }

  private nextDisplayOrder(): number {
    return Math.min(
      999,
      this.media().reduce((maximum, item) => Math.max(maximum, item.displayOrder), -1) + 1,
    );
  }
}

function sortMedia(
  media: readonly PracticeLocationMediaResponse[],
): readonly PracticeLocationMediaResponse[] {
  return [...media].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
  );
}

function mediaErrorMessage(error: unknown, operation: 'upload' | 'delete'): string {
  const code = problemCode(error);
  if (code === 'PRACTICE_MEDIA_LIMIT_REACHED')
    return 'La galerie contient déjà le nombre maximal de photos.';
  if (code === 'INVALID_PRACTICE_MEDIA' || code === 'VALIDATION_FAILED')
    return 'Cette image est invalide. Utilisez un fichier JPEG ou PNG de 8 Mo maximum.';
  if (code === 'OBJECT_STORAGE_UNAVAILABLE')
    return 'Impossible d’envoyer l’image pour le moment. Réessayez plus tard.';
  if (code === 'PRACTICE_MEDIA_NOT_FOUND')
    return 'Cette photo n’existe plus. Rechargez la liste des cabinets.';
  if (isAuthenticationError(error))
    return 'Votre session n’est plus valide. Reconnectez-vous pour continuer.';
  if (isNetworkError(error)) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  if (error instanceof HttpErrorResponse && error.status >= 500)
    return 'Le service d’images est indisponible. Réessayez plus tard.';
  return operation === 'upload'
    ? 'Impossible d’ajouter la photo. Réessayez.'
    : 'Impossible de supprimer la photo. Elle reste dans la galerie.';
}
