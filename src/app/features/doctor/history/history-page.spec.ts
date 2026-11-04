import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { CompletedConsultationListItem } from '../completed-consultation.models';
import { HistoryPage } from './history-page';

const COMPLETED: CompletedConsultationListItem = {
  consultationId: '11111111-1111-4111-8111-111111111111',
  patient: { displayName: 'Nadia Ben Ali', relationship: null },
  sourceType: 'SCHEDULED_APPOINTMENT',
  sourceId: '22222222-2222-4222-8222-222222222222',
  status: 'COMPLETED',
  medicalAccessStatus: 'EXPIRED',
  startedAt: '2026-10-22T09:00:00Z',
  completedAt: '2026-10-27T10:00:00Z',
};

describe('HistoryPage', () => {
  it('renders backend-owned completed consultations as navigable entries', () => {
    TestBed.configureTestingModule({
      imports: [HistoryPage],
      providers: [
        provideRouter([]),
        { provide: ActiveConsultationApiService, useValue: { listCompleted: () => of([COMPLETED]) } },
      ],
    });

    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Nadia Ben Ali');
    expect(element.textContent).toContain('Terminée');
    expect(element.querySelector('a.history-row')?.getAttribute('href')).toBe(
      '/doctor/history/11111111-1111-4111-8111-111111111111',
    );
  });
});
