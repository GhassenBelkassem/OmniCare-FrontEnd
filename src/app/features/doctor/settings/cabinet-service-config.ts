import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { OcIcon, OcStatusBadge } from '../../../shared/ui';
import { CabinetCoverageSettings } from './cabinet-coverage-settings';
import { CabinetEquipmentSettings } from './cabinet-equipment-settings';
import { PracticeLocationResponse } from './practice-location-api.models';
import { EquipmentDefinitionResponse } from './professional-services-api.models';

@Component({
  selector: 'app-cabinet-service-config',
  imports: [OcIcon, OcStatusBadge, CabinetEquipmentSettings, CabinetCoverageSettings],
  templateUrl: './cabinet-service-config.html',
  styleUrl: './cabinet-service-config.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetServiceConfig {
  readonly location = input.required<PracticeLocationResponse>();
  readonly catalog = input.required<readonly EquipmentDefinitionResponse[]>();
  readonly expanded = signal(false);

  toggle(): void {
    this.expanded.update((value) => !value);
  }
}
