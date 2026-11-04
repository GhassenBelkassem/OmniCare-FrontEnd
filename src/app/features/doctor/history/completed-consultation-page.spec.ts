import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { CompletedConsultationDetail } from '../completed-consultation.models';
import { CompletedConsultationPage } from './completed-consultation-page';

const ID = '11111111-1111-4111-8111-111111111111';
const DETAIL: CompletedConsultationDetail = {
  consultation: {
    consultationId: ID,
    patient: { displayName: 'Nadia Ben Ali', relationship: null },
    sourceType: 'SCHEDULED_APPOINTMENT',
    sourceId: '22222222-2222-4222-8222-222222222222',
    status: 'COMPLETED',
    medicalAccessStatus: 'EXPIRED',
    startedAt: '2026-10-22T09:00:00Z',
    completedAt: '2026-10-27T10:00:00Z',
  },
  historicalMedicalAccessStatus: 'NOT_AUTHORIZED',
  artifactStatusAvailable: true,
  artifacts: [{
    artifactId: '33333333-3333-4333-8333-333333333333',
    artifactType: 'PRESCRIPTION',
    artifactVersion: 1,
    status: 'FINALIZED',
    renderStatus: 'READY',
    renderVersion: 1,
    createdAt: '2026-10-27T09:55:00Z',
    updatedAt: '2026-10-27T10:01:00Z',
  }],
};

describe('CompletedConsultationPage', () => {
  it('shows a locked read-only operational detail and safe artifact status', () => {
    TestBed.configureTestingModule({
      imports: [CompletedConsultationPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => ID } } } },
        { provide: ActiveConsultationApiService, useValue: { getCompleted: () => of(DETAIL) } },
      ],
    });

    const fixture = TestBed.createComponent(CompletedConsultationPage);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Consultation terminée');
    expect(text).toContain('Expiré');
    expect(text).toContain('Dossier médical historique non autorisé');
    expect(text).toContain('Ordonnance');
    expect(text).toContain('Prêt');
    expect(text).not.toContain('Enregistrer');
    expect(text).not.toContain('Finaliser');
    expect(text).not.toContain('Terminer la consultation');
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
  });
});
