import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { DoctorMockService, blankDraft } from '../doctor-mock.service';
import { ConsultationPage } from './consultation-page';

interface FakeParamMap {
  get(key: string): string | null;
}

function routeWith(id: string, source: string | null): Partial<ActivatedRoute> {
  const paramMap: FakeParamMap = { get: (key) => (key === 'id' ? id : null) };
  const queryParamMap: FakeParamMap = { get: (key) => (key === 'source' ? source : null) };
  return { snapshot: { paramMap, queryParamMap } as never };
}

describe('ConsultationPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  function create(
    id: string,
    source: string | null = null,
  ): { page: ConsultationPage; mock: DoctorMockService } {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: routeWith(id, source) }],
    });
    const mock = TestBed.inject(DoctorMockService);
    const fixture = TestBed.createComponent(ConsultationPage);
    return { page: fixture.componentInstance, mock };
  }

  it('enters active mode for an open consultation with its past visits', () => {
    const { page } = create('c-1');

    expect(page.mode).toBe('active');
    expect(page.record!.patient.name).toBe('Sami Trabelsi');
    expect(page.record!.pastConsultations.map((item) => item.id)).toEqual(['c-12']);
  });

  it('enters readonly mode for a closed consultation and seeds its draft', () => {
    const { page } = create('c-12');

    expect(page.mode).toBe('readonly');
    expect(page.draft().diagnosis).toBe('Rhino-pharyngite aigue');
    expect(page.draft().vitals.systolicBP).toBe(120);
    expect(page.draft().prescriptionLines[0]?.drugName).toBe('Paracetamol');
  });

  it('fails safely without loading a record for a legacy urgent deep link', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeWith('new', 'urgent') },
      ],
    });
    const mock = TestBed.inject(DoctorMockService);
    const recordSpy = vi.spyOn(mock, 'recordFor');
    const page = TestBed.createComponent(ConsultationPage).componentInstance;

    expect(page.legacyUrgentBlocked).toBe(true);
    expect(page.record).toBeNull();
    expect(page.consultation).toBeNull();
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('isolates a canonical consultation route from mock clinical authority', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: routeWith('11111111-1111-4111-8111-111111111111', null),
        },
      ],
    });
    const mock = TestBed.inject(DoctorMockService);
    const recordSpy = vi.spyOn(mock, 'recordFor');
    const consultationSpy = vi.spyOn(mock, 'consultationFor');

    const page = TestBed.createComponent(ConsultationPage).componentInstance;

    expect(page.canonicalRoute).toBe(true);
    expect(page.record).toBeNull();
    expect(page.consultation).toBeNull();
    expect(recordSpy).not.toHaveBeenCalled();
    expect(consultationSpy).not.toHaveBeenCalled();
  });

  it('persists draft edits back to the mock service', () => {
    const { page, mock } = create('c-1');
    const draft = blankDraft(mock.consultationFor('c-1'));

    page.storeDraft({ ...draft, diagnosis: 'Grippe' });

    expect(page.draft().diagnosis).toBe('Grippe');
    expect(mock.draftFor('c-1')?.diagnosis).toBe('Grippe');
  });

  it('closes the consultation from its draft and clears the draft', () => {
    const { page, mock } = create('c-1');
    const draft = blankDraft(mock.consultationFor('c-1'));
    page.storeDraft({ ...draft, diagnosis: 'Grippe' });

    page.closeConsultation();

    expect(page.closed()).toBe(true);
    expect(mock.consultationFor('c-1').status).toBe('closed');
    expect(mock.draftFor('c-1')).toBeNull();
  });

  it('deactivates without prompting when nothing was changed', () => {
    const { page, mock } = create('c-1');
    const blank = blankDraft(mock.consultationFor('c-1'));
    page.storeDraft({ ...blank, diagnosis: '' });
    const confirmSpy = vi.fn();
    vi.stubGlobal('window', { confirm: confirmSpy });

    expect(page.canDeactivate()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('asks before leaving with unsaved changes', () => {
    const { page, mock } = create('c-1');
    const draft = blankDraft(mock.consultationFor('c-1'));
    page.storeDraft({ ...draft, diagnosis: 'Grippe' });
    const confirmSpy = vi.fn().mockReturnValue(false);
    vi.stubGlobal('window', { confirm: confirmSpy });

    expect(page.canDeactivate()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    confirmSpy.mockReturnValue(true);
    expect(page.canDeactivate()).toBe(true);
  });

  it('never prompts in readonly mode even with draft content', () => {
    const { page } = create('c-12');
    const confirmSpy = vi.fn();
    vi.stubGlobal('window', { confirm: confirmSpy });

    expect(page.canDeactivate()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
