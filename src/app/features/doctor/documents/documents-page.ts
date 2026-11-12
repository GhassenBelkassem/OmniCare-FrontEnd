import { ChangeDetectionStrategy, Component } from '@angular/core';

import { OcPageHeader } from '../../../shared/ui';
import { DocumentTemplatesSection } from './document-templates-section';

@Component({
  selector: 'app-documents-page',
  imports: [OcPageHeader, DocumentTemplatesSection],
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {}
