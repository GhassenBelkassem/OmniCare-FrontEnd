import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { OcButton, OcCard, OcSkeleton, OcSwitch } from '../../../shared/ui';
import {
  NotificationCategoryPresentation,
  NotificationPreferenceResponse,
  NotificationPreferenceUpdateRequest,
  notificationCategoryOrder,
  notificationCategoryPresentation,
} from './notification-preference-api.models';
import { NotificationPreferenceApiService } from './notification-preference-api.service';

type NotificationLoadState = 'notLoaded' | 'loading' | 'loaded' | 'error';
type BooleanPreferenceField = 'pushEnabled' | 'smsEnabled' | 'dndEnabled';
type TimePreferenceField = 'dndStart' | 'dndEnd';

interface NotificationPreferenceDraft extends NotificationPreferenceUpdateRequest {
  readonly category: string;
}

@Component({
  selector: 'app-notification-settings-section',
  imports: [OcButton, OcCard, OcSkeleton, OcSwitch],
  templateUrl: './notification-settings-section.html',
  styleUrl: './notification-settings-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationSettingsSection implements OnInit {
  private readonly api = inject(NotificationPreferenceApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loadState = signal<NotificationLoadState>('notLoaded');
  readonly preferences = signal<readonly NotificationPreferenceResponse[]>([]);
  readonly drafts = signal<readonly NotificationPreferenceDraft[]>([]);
  readonly savingCategories = signal<ReadonlySet<string>>(new Set());
  readonly mutationErrors = signal<Readonly<Record<string, string>>>({});

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadState.set('loading');
    this.preferences.set([]);
    this.drafts.set([]);
    this.mutationErrors.set({});
    this.api
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preferences) => {
          const sorted = [...preferences].sort(
            (left, right) =>
              notificationCategoryOrder(left.category) -
                notificationCategoryOrder(right.category) ||
              left.category.localeCompare(right.category),
          );
          this.preferences.set(sorted);
          this.drafts.set(sorted.map((preference) => this.toDraft(preference)));
          this.loadState.set('loaded');
        },
        error: () => this.loadState.set('error'),
      });
  }

  presentation(category: string): NotificationCategoryPresentation {
    return notificationCategoryPresentation(category);
  }

  draftFor(category: string): NotificationPreferenceDraft {
    const draft = this.drafts().find((item) => item.category === category);
    if (!draft) {
      throw new Error('Notification preference draft is unavailable.');
    }
    return draft;
  }

  updateBoolean(category: string, field: BooleanPreferenceField, value: boolean): void {
    this.updateDraft(category, (draft) => ({ ...draft, [field]: value }));
    this.clearMutationError(category);
  }

  updateTime(category: string, field: TimePreferenceField, value: string): void {
    this.updateDraft(category, (draft) => ({ ...draft, [field]: value || null }));
    this.clearMutationError(category);
  }

  isSaving(category: string): boolean {
    return this.savingCategories().has(category);
  }

  isDirty(category: string): boolean {
    const authoritative = this.preferences().find((item) => item.category === category);
    const draft = this.drafts().find((item) => item.category === category);
    if (!authoritative || !draft) return false;
    return (
      authoritative.pushEnabled !== draft.pushEnabled ||
      authoritative.smsEnabled !== draft.smsEnabled ||
      authoritative.dndEnabled !== draft.dndEnabled ||
      this.normalizeTime(authoritative.dndStart) !== draft.dndStart ||
      this.normalizeTime(authoritative.dndEnd) !== draft.dndEnd
    );
  }

  hasValidDndWindow(category: string): boolean {
    const draft = this.draftFor(category);
    return !draft.dndEnabled || Boolean(draft.dndStart && draft.dndEnd);
  }

  save(category: string): void {
    const draft = this.draftFor(category);
    if (!this.hasValidDndWindow(category) || this.isSaving(category)) return;

    const request: NotificationPreferenceUpdateRequest = {
      pushEnabled: draft.pushEnabled,
      smsEnabled: draft.smsEnabled,
      dndEnabled: draft.dndEnabled,
      dndStart: draft.dndStart,
      dndEnd: draft.dndEnd,
    };
    this.setSaving(category, true);
    this.clearMutationError(category);
    this.api
      .update(category, request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.setSaving(category, false)),
      )
      .subscribe({
        next: (saved) => {
          this.preferences.update((items) =>
            items.map((item) => (item.category === category ? saved : item)),
          );
          this.updateDraft(category, () => this.toDraft(saved));
        },
        error: () => {
          const authoritative = this.preferences().find((item) => item.category === category);
          if (authoritative) {
            this.updateDraft(category, () => this.toDraft(authoritative));
          }
          this.mutationErrors.update((errors) => ({
            ...errors,
            [category]: "Les modifications n'ont pas été enregistrées.",
          }));
        },
      });
  }

  private toDraft(preference: NotificationPreferenceResponse): NotificationPreferenceDraft {
    return {
      category: preference.category,
      pushEnabled: preference.pushEnabled,
      smsEnabled: preference.smsEnabled,
      dndEnabled: preference.dndEnabled,
      dndStart: this.normalizeTime(preference.dndStart),
      dndEnd: this.normalizeTime(preference.dndEnd),
    };
  }

  private normalizeTime(value: string | null): string | null {
    return value ? value.slice(0, 5) : null;
  }

  private updateDraft(
    category: string,
    update: (draft: NotificationPreferenceDraft) => NotificationPreferenceDraft,
  ): void {
    this.drafts.update((drafts) =>
      drafts.map((draft) => (draft.category === category ? update(draft) : draft)),
    );
  }

  private setSaving(category: string, saving: boolean): void {
    this.savingCategories.update((categories) => {
      const next = new Set(categories);
      if (saving) next.add(category);
      else next.delete(category);
      return next;
    });
  }

  private clearMutationError(category: string): void {
    this.mutationErrors.update((errors) => {
      if (!(category in errors)) return errors;
      const next = { ...errors };
      delete next[category];
      return next;
    });
  }
}
