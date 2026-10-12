import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import {
  OcActionMenu,
  OcButton,
  OcCard,
  OcConfirmDialog,
  OcEmptyState,
  OcIcon,
  OcSkeleton,
} from '../../../shared/ui';
import {
  ProfessionalQualificationDialog,
  ProfessionalQualificationEntry,
  ProfessionalQualificationKind,
  ProfessionalQualificationSubmission,
} from './professional-qualification-dialog';
import {
  CreateProfessionalCertificationRequest,
  CreateProfessionalEducationRequest,
  ProfessionalCertificationResponse,
  ProfessionalEducationResponse,
  UpdateProfessionalCertificationRequest,
  UpdateProfessionalEducationRequest,
} from './professional-profile-api.models';
import { ProfessionalProfileApiService } from './professional-profile-api.service';
import {
  RE_AUTHENTICATE_MESSAGE,
  STALE_QUALIFICATION_MESSAGE,
  isAuthenticationError,
  isConflict,
  isNetworkError,
  isValidationError,
  problemCode,
} from './professional-profile-errors';

interface DeleteTarget {
  readonly kind: ProfessionalQualificationKind;
  readonly entry: ProfessionalQualificationEntry;
}

@Component({
  selector: 'app-professional-qualifications-section',
  imports: [
    OcActionMenu,
    OcButton,
    OcCard,
    OcConfirmDialog,
    OcEmptyState,
    OcIcon,
    OcSkeleton,
    ProfessionalQualificationDialog,
  ],
  templateUrl: './professional-qualifications-section.html',
  styleUrl: './professional-qualifications-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalQualificationsSection {
  private readonly api = inject(ProfessionalProfileApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly education = signal<readonly ProfessionalEducationResponse[]>([]);
  readonly certifications = signal<readonly ProfessionalCertificationResponse[]>([]);
  readonly educationLoading = signal(false);
  readonly certificationLoading = signal(false);
  readonly educationError = signal<string | null>(null);
  readonly certificationError = signal<string | null>(null);
  readonly authError = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly dialogKind = signal<ProfessionalQualificationKind>('education');
  readonly dialogEntry = signal<ProfessionalQualificationEntry | null>(null);
  readonly dialogSaving = signal(false);
  readonly dialogError = signal<string | null>(null);
  readonly dialogConflict = signal(false);

  readonly deleteTarget = signal<DeleteTarget | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deleteConflict = signal<ProfessionalQualificationKind | null>(null);

  constructor() {
    this.loadEducation();
    this.loadCertifications();
  }

  loadEducation(): void {
    this.educationLoading.set(true);
    this.educationError.set(null);
    this.api
      .listEducation()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.educationLoading.set(false)),
      )
      .subscribe({
        next: (entries) => this.education.set(sortEntries(entries)),
        error: (error: unknown) => this.handleLoadError('education', error),
      });
  }

  loadCertifications(): void {
    this.certificationLoading.set(true);
    this.certificationError.set(null);
    this.api
      .listCertifications()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.certificationLoading.set(false)),
      )
      .subscribe({
        next: (entries) => this.certifications.set(sortEntries(entries)),
        error: (error: unknown) => this.handleLoadError('certification', error),
      });
  }

  add(kind: ProfessionalQualificationKind): void {
    this.openDialog(kind, null);
  }

  edit(kind: ProfessionalQualificationKind, entry: ProfessionalQualificationEntry): void {
    this.openDialog(kind, entry);
  }

  closeDialog(): void {
    if (this.dialogSaving()) return;
    this.dialogOpen.set(false);
    this.dialogError.set(null);
    this.dialogConflict.set(false);
  }

  saveQualification(submission: ProfessionalQualificationSubmission): void {
    if (this.dialogSaving()) return;
    this.dialogSaving.set(true);
    this.dialogError.set(null);
    this.dialogConflict.set(false);
    this.success.set(null);

    if (submission.kind === 'education') {
      const operation =
        submission.id === null
          ? this.api.createEducation(submission.value)
          : this.api.updateEducation(
              submission.id,
              educationUpdate(submission.value, requireRevision(submission.revision)),
            );
      operation
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.dialogSaving.set(false)),
        )
        .subscribe({
          next: (saved) => this.finishEducationSave(saved, submission.id === null),
          error: (error: unknown) => this.handleMutationError(error),
        });
      return;
    }

    const operation =
      submission.id === null
        ? this.api.createCertification(submission.value)
        : this.api.updateCertification(
            submission.id,
            certificationUpdate(submission.value, requireRevision(submission.revision)),
          );
    operation
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.dialogSaving.set(false)),
      )
      .subscribe({
        next: (saved) => this.finishCertificationSave(saved, submission.id === null),
        error: (error: unknown) => this.handleMutationError(error),
      });
  }

  refreshAfterConflict(): void {
    const kind = this.dialogKind();
    this.closeDialog();
    if (kind === 'education') this.loadEducation();
    else this.loadCertifications();
  }

  requestDelete(kind: ProfessionalQualificationKind, entry: ProfessionalQualificationEntry): void {
    this.deleteError.set(null);
    this.deleteConflict.set(null);
    this.deleteTarget.set({ kind, entry });
  }

  cancelDelete(): void {
    if (!this.deleting()) this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (target === null || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.deleteConflict.set(null);
    this.success.set(null);
    const operation =
      target.kind === 'education'
        ? this.api.deleteEducation(target.entry.id, target.entry.revision)
        : this.api.deleteCertification(target.entry.id, target.entry.revision);
    operation
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deleting.set(false)),
      )
      .subscribe({
        next: () => {
          if (target.kind === 'education') {
            this.education.update((entries) =>
              entries.filter((entry) => entry.id !== target.entry.id),
            );
            this.success.set('Formation supprimée.');
          } else {
            this.certifications.update((entries) =>
              entries.filter((entry) => entry.id !== target.entry.id),
            );
            this.success.set('Certification supprimée.');
          }
          this.deleteConflict.set(null);
          this.deleteTarget.set(null);
        },
        error: (error: unknown) => {
          if (isAuthenticationError(error)) {
            this.authError.set(RE_AUTHENTICATE_MESSAGE);
            this.deleteTarget.set(null);
            return;
          }
          if (isConflict(error)) {
            this.deleteConflict.set(target.kind);
            this.deleteError.set(
              'Cette qualification a été modifiée ailleurs. Rechargez les données avant de la supprimer.',
            );
            this.deleteTarget.set(null);
            return;
          }
          this.deleteError.set(
            isNetworkError(error)
              ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
              : 'La suppression a échoué. Réessayez.',
          );
        },
      });
  }

  refreshAfterDeleteConflict(): void {
    const kind = this.deleteConflict();
    if (kind === null) return;
    this.deleteConflict.set(null);
    this.deleteError.set(null);
    if (kind === 'education') this.loadEducation();
    else this.loadCertifications();
  }

  nextDisplayOrder(kind: ProfessionalQualificationKind): number {
    const entries = kind === 'education' ? this.education() : this.certifications();
    return Math.min(
      999,
      entries.reduce((maximum, entry) => Math.max(maximum, entry.displayOrder), -1) + 1,
    );
  }

  deleteTitle(): string {
    return this.deleteTarget()?.kind === 'education'
      ? 'Supprimer la formation'
      : 'Supprimer la certification';
  }

  deleteMessage(): string {
    const target = this.deleteTarget();
    if (target === null) return '';
    const label =
      target.kind === 'education'
        ? (target.entry as ProfessionalEducationResponse).qualification
        : (target.entry as ProfessionalCertificationResponse).name;
    return `Supprimer « ${label} » de votre profil professionnel ?`;
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  private openDialog(
    kind: ProfessionalQualificationKind,
    entry: ProfessionalQualificationEntry | null,
  ): void {
    this.dialogKind.set(kind);
    this.dialogEntry.set(entry);
    this.dialogError.set(null);
    this.dialogConflict.set(false);
    this.dialogOpen.set(true);
  }

  private finishEducationSave(saved: ProfessionalEducationResponse, created: boolean): void {
    this.education.update((entries) => upsertEntry(entries, saved));
    this.dialogOpen.set(false);
    this.success.set(created ? 'Formation ajoutée.' : 'Formation mise à jour.');
  }

  private finishCertificationSave(
    saved: ProfessionalCertificationResponse,
    created: boolean,
  ): void {
    this.certifications.update((entries) => upsertEntry(entries, saved));
    this.dialogOpen.set(false);
    this.success.set(created ? 'Certification ajoutée.' : 'Certification mise à jour.');
  }

  private handleLoadError(kind: ProfessionalQualificationKind, error: unknown): void {
    if (isAuthenticationError(error)) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      return;
    }
    const message = isNetworkError(error)
      ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
      : kind === 'education'
        ? 'Impossible de charger les formations.'
        : 'Impossible de charger les certifications.';
    if (kind === 'education') this.educationError.set(message);
    else this.certificationError.set(message);
  }

  private handleMutationError(error: unknown): void {
    if (isAuthenticationError(error)) {
      this.authError.set(RE_AUTHENTICATE_MESSAGE);
      this.closeDialog();
      return;
    }
    if (isConflict(error)) {
      this.dialogConflict.set(true);
      this.dialogError.set(STALE_QUALIFICATION_MESSAGE);
      return;
    }
    if (isValidationError(error)) {
      this.dialogError.set('Certaines informations sont invalides. Vérifiez le formulaire.');
      return;
    }
    if (
      error instanceof HttpErrorResponse &&
      error.status === 409 &&
      problemCode(error) === 'QUALIFICATION_LIMIT_REACHED'
    ) {
      this.dialogError.set('Le nombre maximal d’éléments est atteint.');
      return;
    }
    this.dialogError.set(
      isNetworkError(error)
        ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
        : 'Impossible d’enregistrer cette information. Réessayez.',
    );
  }
}

function educationUpdate(
  value: CreateProfessionalEducationRequest,
  revision: number,
): UpdateProfessionalEducationRequest {
  return {
    institution: value.institution,
    qualification: value.qualification,
    fieldOfStudy: value.fieldOfStudy ?? '',
    ...(value.completionYear === null ? {} : { completionYear: value.completionYear }),
    displayOrder: value.displayOrder,
    expectedRevision: revision,
  };
}

function certificationUpdate(
  value: CreateProfessionalCertificationRequest,
  revision: number,
): UpdateProfessionalCertificationRequest {
  return {
    name: value.name,
    issuer: value.issuer ?? '',
    ...(value.issuedYear === null ? {} : { issuedYear: value.issuedYear }),
    ...(value.expiryDate === null ? {} : { expiryDate: value.expiryDate }),
    displayOrder: value.displayOrder,
    expectedRevision: revision,
  };
}

function requireRevision(revision: number | null): number {
  if (revision === null) throw new Error('A saved qualification must include a revision.');
  return revision;
}

function sortEntries<T extends { readonly id: string; readonly displayOrder: number }>(
  entries: readonly T[],
): readonly T[] {
  return [...entries].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
  );
}

function upsertEntry<T extends { readonly id: string; readonly displayOrder: number }>(
  entries: readonly T[],
  saved: T,
): readonly T[] {
  return sortEntries([...entries.filter((entry) => entry.id !== saved.id), saved]);
}
