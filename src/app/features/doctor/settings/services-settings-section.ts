import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { OcButton, OcEmptyState, OcIcon, OcSkeleton } from '../../../shared/ui';
import { CabinetServiceConfig } from './cabinet-service-config';
import { ActiveCabinetStatus, CareCapabilitiesSettings } from './care-capabilities-settings';
import { MobileEquipmentSettings } from './mobile-equipment-settings';
import { PracticeLocationResponse } from './practice-location-api.models';
import { PracticeLocationApiService } from './practice-location-api.service';
import { CareCapability, EquipmentOverviewResponse } from './professional-services-api.models';
import { MedicalEquipmentApiService } from './professional-services-api.service';
import { mapServicesSettingsFailure } from './services-settings-errors';
import { UrgentCareConfigurationSettings } from './urgent-care-configuration-settings';
import { UrgentCareReadinessSettings } from './urgent-care-readiness-settings';

@Component({
  selector: 'app-services-settings-section',
  imports: [
    OcButton,
    OcEmptyState,
    OcIcon,
    OcSkeleton,
    CareCapabilitiesSettings,
    UrgentCareConfigurationSettings,
    UrgentCareReadinessSettings,
    MobileEquipmentSettings,
    CabinetServiceConfig,
  ],
  templateUrl: './services-settings-section.html',
  styleUrl: './services-settings-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesSettingsSection {
  private readonly locationsApi = inject(PracticeLocationApiService);
  private readonly equipmentApi = inject(MedicalEquipmentApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly capabilitiesSettings = viewChild(CareCapabilitiesSettings);
  private readonly urgentSettings = viewChild(UrgentCareConfigurationSettings);
  private readonly urgentReadiness = viewChild(UrgentCareReadinessSettings);

  readonly urgentConfigurationDirtyChange = output<boolean>();
  readonly capabilities = signal<readonly CareCapability[]>([]);
  readonly committedCapabilities = computed(
    () => this.capabilitiesSettings()?.baseline() ?? ([] as readonly CareCapability[]),
  );
  readonly capabilitySelectionLoaded = computed(
    () => this.capabilitiesSettings()?.revision() !== null,
  );
  readonly capabilitySelectionUnavailable = computed(() => {
    const settings = this.capabilitiesSettings();
    return (
      settings !== undefined &&
      !settings.loading() &&
      settings.revision() === null &&
      settings.error() !== null
    );
  });

  readonly locations = signal<readonly PracticeLocationResponse[]>([]);
  readonly locationsLoading = signal(false);
  readonly locationsError = signal<string | null>(null);
  readonly locationsAuthenticationError = signal(false);
  readonly equipmentOverview = signal<EquipmentOverviewResponse | null>(null);
  readonly equipmentLoading = signal(false);
  readonly equipmentError = signal<string | null>(null);
  readonly equipmentAuthenticationError = signal(false);

  readonly activeCabinetStatus = computed<ActiveCabinetStatus>(() => {
    if (this.locationsLoading()) return 'loading';
    if (this.locationsError() !== null) return 'unknown';
    return this.locations().some((location) => location.active) ? 'available' : 'none';
  });

  constructor() {
    this.loadLocations();
    this.loadEquipmentOverview();
  }

  loadLocations(): void {
    if (this.locationsLoading()) return;
    this.locationsLoading.set(true);
    this.locationsError.set(null);
    this.locationsAuthenticationError.set(false);
    this.locationsApi
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.locationsLoading.set(false)),
      )
      .subscribe({
        next: (locations) => this.locations.set(locations),
        error: (error: unknown) => {
          const failure = mapServicesSettingsFailure(error, 'cabinets', 'load');
          this.locationsError.set(failure.message);
          this.locationsAuthenticationError.set(failure.authentication);
        },
      });
  }

  loadEquipmentOverview(): void {
    if (this.equipmentLoading()) return;
    this.equipmentLoading.set(true);
    this.equipmentError.set(null);
    this.equipmentAuthenticationError.set(false);
    this.equipmentApi
      .getOverview()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.equipmentLoading.set(false)),
      )
      .subscribe({
        next: (overview) => this.equipmentOverview.set(overview),
        error: (error: unknown) => {
          const failure = mapServicesSettingsFailure(error, 'mobile-equipment', 'load');
          this.equipmentError.set(failure.message);
          this.equipmentAuthenticationError.set(failure.authentication);
        },
      });
  }

  reAuthenticate(): void {
    this.auth.logout();
  }

  onCapabilityRevisionCommitted(revision: number): void {
    this.urgentSettings()?.adoptSharedRevision(revision);
    this.urgentReadiness()?.refresh();
  }

  onUrgentRevisionCommitted(revision: number): void {
    this.capabilitiesSettings()?.adoptSharedRevision(revision);
    this.urgentReadiness()?.refresh();
  }
}
