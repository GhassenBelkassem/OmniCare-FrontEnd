import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { OcActionMenu, OcButton, OcIcon, OcStatusBadge } from '../../../shared/ui';
import { CabinetGallery } from './cabinet-gallery';
import {
  PracticeLocationMediaResponse,
  PracticeLocationResponse,
} from './practice-location-api.models';

@Component({
  selector: 'app-cabinet-card',
  imports: [OcActionMenu, OcButton, OcIcon, OcStatusBadge, CabinetGallery],
  templateUrl: './cabinet-card.html',
  styleUrl: './cabinet-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabinetCard {
  readonly location = input.required<PracticeLocationResponse>();
  readonly editRequested = output<PracticeLocationResponse>();
  readonly deleteRequested = output<PracticeLocationResponse>();
  readonly galleryChange = output<readonly PracticeLocationMediaResponse[]>();
}
