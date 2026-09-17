import { TestBed } from '@angular/core/testing';

import { ConsultationDraft } from './doctor-mock.models';
import { DoctorMockService, blankDraft, emptyVitals, hasDraftContent } from './doctor-mock.service';

describe('DoctorMockService', () => {
  let service: DoctorMockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DoctorMockService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists past closed consultations for the same patient', () => {
    const record = service.recordFor('c-1', undefined);

    expect(record.patient.name).toBe('Sami Trabelsi');
    expect(record.pastConsultations.map((item) => item.id)).toEqual(['c-12']);
  });

  it('returns an empty history when the patient has no other closed consultations', () => {
    const record = service.recordFor('c-13', undefined);

    expect(record.patient.name).toBe('Nadia Chaabane');
    expect(record.pastConsultations).toEqual([]);
  });

  it('builds an empty record for urgent requests regardless of the consultation', () => {
    const record = service.recordFor('c-1', 'urgent');

    expect(record.patient.name).toBe('Hedi Bouazizi');
    expect(record.pastConsultations).toEqual([]);
  });

  it('falls back to an ad hoc patient for an unknown consultation id', () => {
    const record = service.recordFor('does-not-exist', undefined);

    expect(record.patient.id).toBe('p-adhoc');
    expect(record.pastConsultations).toEqual([]);
  });

  it('creates a new active consultation when the id is unknown', () => {
    const created = service.consultationFor('new-id');

    expect(created.id).toBe('new-id');
    expect(created.status).toBe('active');
    expect(service.consultationFor('new-id')).toBe(created);
  });

  it('reuses the active consultation for a patient, creating one otherwise', () => {
    expect(service.consultationIdForPatient('p-1')).toBe('c-1');

    expect(service.consultationIdForPatient('p-6')).toBe('cons-p-6');
    expect(service.consultationIdForPatient('p-6')).toBe('cons-p-6');
  });

  it('searches patients by name or phone', () => {
    expect(service.findPatients('sami').map((match) => match.id)).toEqual(['p-1']);
    expect(service.findPatients('20 111').map((match) => match.id)).toEqual(['p-1']);
    expect(service.findPatients('   ')).toEqual([]);
  });

  it('round-trips drafts per consultation id', () => {
    const draft = blankDraft(service.consultationFor('c-1'));

    expect(service.draftFor('c-1')).toBeNull();
    service.updateDraft('c-1', draft);
    expect(service.draftFor('c-1')).toBe(draft);
    service.clearDraft('c-1');
    expect(service.draftFor('c-1')).toBeNull();
  });

  it('closes a consultation from its draft and clears the draft', () => {
    const draft = blankDraft(service.consultationFor('c-1'));
    const edited = { ...draft, diagnosis: 'Grippe', treatment: 'Repos' };
    service.updateDraft('c-1', edited);

    service.closeConsultation('c-1', edited);

    const closed = service.consultationFor('c-1');
    expect(closed.status).toBe('closed');
    expect(closed.diagnosis).toBe('Grippe');
    expect(closed.treatment).toBe('Repos');
    expect(service.draftFor('c-1')).toBeNull();
  });

  it('exposes an incoming urgent request with its countdown', () => {
    service.simulateIncomingRequest();

    expect(service.urgentPending()).toBe(true);
    expect(service.urgentCountdown()).toBe(30);
    expect(service.urgentRequest()?.patientName).toBe('Hedi Bouazizi');
  });

  it('ignores a second request while one is pending', () => {
    service.simulateIncomingRequest();
    service.simulateIncomingRequest();

    expect(service.urgentPending()).toBe(true);
    expect(service.urgentCountdown()).toBe(30);
  });

  it('clears the request when it is accepted', () => {
    service.simulateIncomingRequest();
    service.acceptUrgent();

    expect(service.urgentPending()).toBe(false);
    expect(service.urgentCountdown()).toBe(0);
    expect(service.urgentRequest()).toBeNull();
  });

  it('auto-dismisses the request when the countdown reaches zero', () => {
    vi.useFakeTimers();
    service.simulateIncomingRequest();

    vi.advanceTimersByTime(31_000);

    expect(service.urgentPending()).toBe(false);
    expect(service.urgentCountdown()).toBe(0);
    expect(service.urgentRequest()).toBeNull();
  });
});

describe('hasDraftContent', () => {
  it('is false for a blank draft', () => {
    expect(hasDraftContent(emptyDraft())).toBe(false);
  });

  it('is true when only whitespace is present', () => {
    expect(hasDraftContent({ ...emptyDraft(), diagnosis: '   ' })).toBe(false);
  });

  it('detects a diagnosis', () => {
    expect(hasDraftContent({ ...emptyDraft(), diagnosis: 'Grippe' })).toBe(true);
  });

  it('detects a single vitals value', () => {
    const draft = emptyDraft();
    draft.vitals.temperature = 38.2;
    expect(hasDraftContent(draft)).toBe(true);
  });

  it('detects a partially filled prescription line', () => {
    const draft = {
      ...emptyDraft(),
      prescriptionLines: [{ id: 1, drugName: 'Paracetamol', dosage: '', timing: '', duration: '' }],
    };
    expect(hasDraftContent(draft)).toBe(true);
  });

  it('detects scribe or ordonnance text', () => {
    expect(hasDraftContent({ ...emptyDraft(), ordonnanceText: 'Commentaire' })).toBe(true);
  });
});

function emptyDraft(): ConsultationDraft {
  return {
    diagnosis: '',
    treatment: '',
    vitals: emptyVitals(),
    prescriptionLines: [],
    scribeText: '',
    ordonnanceText: '',
  };
}
