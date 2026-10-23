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

import { AuthService } from '../../../core/auth/auth.service';
import {
  OcButton,
  OcIcon,
  OcIconName,
  OcSkeleton,
  OcStatusBadge,
  OcSwitch,
} from '../../../shared/ui';
import { CareCapability } from './professional-services-api.models';
import { CareCapabilityApiService } from './professional-services-api.service';
import { mapServicesSettingsFailure } from './services-settings-errors';

export type ActiveCabinetStatus = 'loading' | 'available' | 'none' | 'unknown';

interface CareCapabilityOption {
  readonly value: CareCapability;
  readonly label: string;
  readonly description: string;
  readonly requiresActiveCabinet: boolean;
  readonly icon: OcIconName;
}

const CAPABILITY_OPTIONS: readonly CareCapabilityOption[] = [
  {
    value: 'CABINET',
    label: 'Consultation au cabinet',
    description: 'Indique que vous proposez des consultations dans l’un de vos cabinets.',
    requiresActiveCabinet: true,
    icon: 'building',
  },
  {
    value: 'URGENT_HOME',
    label: 'Urgence à domicile',
    description: 'Configure votre participation aux prises en charge urgentes à domicile.',
    requiresActiveCabinet: false,
    icon: 'emergency',
  },
  {
    value: 'URGENT_CABINET',
    label: 'Urgence au cabinet',
    description: 'Permet de configurer l’accueil rapide de patients dans l’un de vos cabinets.',
    requiresActiveCabinet: true,
    icon: 'emergency',
  },
];

@Component({
  selector: 'app-care-capabilities-settings',
  imports: [OcButton, OcIcon, OcSkeleton, OcStatusBadge, OcSwitch],
  templateUrl: './care-capabilities-settings.html',
  styleUrl: './care-capabilities-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CareCapabilitiesSettings {
  private readonly api = inject(CareCapabilityApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeCabinetStatus = input<ActiveCabinetStatus>('loading');
  readonly capabilitiesChange = output<readonly CareCapability[]>();
  readonly revisionCommitted = output<number>();
  readonly options = CAPABILITY_OPTIONS;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly revision = signal<number | null>(null);
  private readonly sharedRevisionFloor = signal(0);
  readonly baseline = signal<readonly CareCapability[]>([]);
  readonly draft = signal<readonly CareCapability[]>([]);
  readonly error = signal<string | null>(null);
  readonly authenticationError = signal(false);
  readonly conflict = signal(false);
  readonly success = signal<string | null>(null);

  readonly dirty = computed(() => !sameSet(this.baseline(), this.draft()));
  readonly hasUnavailableCabinetSelection = computed(
    () =>
      this.activeCabinetStatus() !== 'available' &&
      this.options.some(
        (option) => option.requiresActiveCabinet && this.draft().includes(option.value),
      ),
  );

  constructor() {
    this.load();
  }

  isSelected(capability: CareCapability): boolean {
    return this.draft().includes(capability);
  }

  isDisabled(option: CareCapabilityOption): boolean {
    return (
      this.saving() ||
      (option.requiresActiveCabinet &&
        this.activeCabinetStatus() !== 'available' &&
        !this.isSelected(option.value))
    );
  }

  toggle(option: CareCapabilityOption): void {
    if (this.isDisabled(option)) return;
    this.error.set(null);
    this.conflict.set(false);
    this.success.set(null);
    this.draft.update((current) =>
      current.includes(option.value)
        ? current.filter((value) => value !== option.value)
        : [...current, option.value],
    );
    this.capabilitiesChange.emit(this.draft());
  }

  save(): void {
    const revision = this.revision();
    if (
      revision === null ||
      this.saving() ||
      !this.dirty() ||
      this.hasUnavailableCabinetSelection()
    ) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.conflict.set(false);
    this.success.set(null);
    this.api
      .replace({ expectedRevision: revision, capabilities: this.draft() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.revision.set(Math.max(response.revision, this.sharedRevisionFloor()));
          this.baseline.set(response.capabilities);
          this.draft.set(response.capabilities);
          this.capabilitiesChange.emit(response.capabilities);
          this.revisionCommitted.emit(response.revision);
          this.success.set('Modes de prise en charge enregistrés.');
        },
        error: (error: unknown) => this.handleError(error, 'save'),
      });
  }

  load(): void {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set(null);
    this.authenticationError.set(false);
    this.conflict.set(false);
    this.success.set(null);
    this.api
      .get()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.revision.set(Math.max(response.revision, this.sharedRevisionFloor()));
          this.baseline.set(response.capabilities);
          this.draft.set(response.capabilities);
          this.capabilitiesChange.emit(response.capabilities);
        },
        error: (error: unknown) => this.handleError(error, 'load'),
      });
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  adoptSharedRevision(revision: number): void {
    this.sharedRevisionFloor.update((current) => Math.max(current, revision));
    const current = this.revision();
    if (current !== null && revision > current) this.revision.set(revision);
  }

  private handleError(error: unknown, operation: 'load' | 'save'): void {
    const failure = mapServicesSettingsFailure(error, 'capabilities', operation);
    this.error.set(failure.message);
    this.authenticationError.set(failure.authentication);
    this.conflict.set(failure.conflict);
  }
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}
