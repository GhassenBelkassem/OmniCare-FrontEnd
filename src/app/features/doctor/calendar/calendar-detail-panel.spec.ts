import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { en_GB, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OMNICARE_ICONS } from '../../../app.icons';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type {
  Appointment,
  AvailabilitySlot,
  BookingRequest,
  DoctorScheduledCareItem,
  ScheduledCareAction,
} from '../scheduled-care/scheduled-care.models';
import { CalendarDetailPanel } from './calendar-detail-panel';
import { CalendarPreferencesStore } from './calendar-preferences.store';

const PHONE = '+216 20 123 456';

function appointmentDetail(overrides: Partial<Appointment> = {}): Appointment {
  return {
    appointmentId: 'appointment-1',
    sourceBookingRequestId: null,
    version: 3,
    status: 'CONFIRMED',
    doctor: { doctorId: 'doctor-1', displayName: 'Dr Test', specialty: null },
    subject: {
      subjectType: 'PRACTICE_PATIENT',
      familyMemberId: null,
      displayName: 'Test Patient',
      relationship: null,
    },
    cabinet: {
      practiceLocationId: 'cabinet-1',
      name: 'Cabinet Test',
      address: '1 rue Test',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    slot: {
      start: '2031-04-08T08:00:00.000Z',
      end: '2031-04-08T08:30:00.000Z',
      durationMinutes: 30,
      timezone: 'Africa/Tunis',
    },
    quotedPrice: null,
    confirmedAt: '2031-04-01T08:00:00.000Z',
    createdAt: '2031-04-01T08:00:00.000Z',
    updatedAt: '2031-04-01T08:00:00.000Z',
    cancellation: null,
    intakeStatus: null,
    availableActions: ['CANCEL_APPOINTMENT'],
    practicePatient: {
      practicePatientId: 'patient-7',
      dateOfBirth: null,
      sex: null,
      phone: PHONE,
      email: null,
      address: null,
    },
    consultationReason: 'Toux persistante',
    ...overrides,
  };
}

function requestDetail(
  availableActions: readonly ScheduledCareAction[] = [
    'ACCEPT_REQUEST',
    'PROPOSE_NEW_TIME',
    'DECLINE_REQUEST',
  ],
  overrides: Partial<BookingRequest> = {},
): BookingRequest {
  return {
    requestId: 'request-1',
    version: 2,
    status: 'PENDING_DOCTOR',
    subject: {
      subjectType: 'SELF',
      familyMemberId: null,
      displayName: 'Test Patient',
      relationship: null,
    },
    cabinet: {
      practiceLocationId: 'cabinet-1',
      name: 'Cabinet Test',
      address: '1 rue Test',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    originalRequestedSlot: { start: '2031-04-08T09:00:00.000Z', end: '2031-04-08T09:30:00.000Z' },
    proposedSlot: null,
    activeSlot: {
      start: '2031-04-08T09:00:00.000Z',
      end: '2031-04-08T09:30:00.000Z',
      durationMinutes: 30,
    },
    createdAt: '2031-04-01T08:00:00.000Z',
    responseDeadline: '2031-04-07T09:00:00.000Z',
    patientResponseDeadline: null,
    confirmedAppointmentId: null,
    cancellation: null,
    expiredAt: null,
    expiryReason: null,
    slotReleased: false,
    availableActions,
    updatedAt: '2031-04-01T08:00:00.000Z',
    ...overrides,
  };
}

const SLOT: AvailabilitySlot = {
  start: '2031-04-09T09:00:00.000Z',
  end: '2031-04-09T09:30:00.000Z',
  durationMinutes: 30,
};

describe('CalendarDetailPanel', () => {
  let fixture: ComponentFixture<CalendarDetailPanel>;
  let panel: CalendarDetailPanel;
  let discreet: WritableSignal<boolean>;
  let activeAppointment: WritableSignal<Appointment | null>;
  let activeRequest: WritableSignal<BookingRequest | null>;
  let availability: WritableSignal<readonly AvailabilitySlot[]>;
  let care: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    discreet = signal(false);
    activeAppointment = signal<Appointment | null>(null);
    activeRequest = signal<BookingRequest | null>(null);
    availability = signal<readonly AvailabilitySlot[]>([]);
    care = {
      openAppointment: vi.fn(),
      closeAppointment: vi.fn(),
      cancelAppointment: vi.fn(),
      openRequest: vi.fn(),
      closeRequest: vi.fn(),
      acceptRequest: vi.fn(),
      declineRequest: vi.fn(),
      proposeTime: vi.fn(),
      loadProposalAvailability: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CalendarDetailPanel],
      providers: [
        provideRouter([]),
        provideNzI18n(en_GB),
        provideNzIcons(OMNICARE_ICONS),
        { provide: CalendarPreferencesStore, useValue: { discreet } },
        {
          provide: ScheduledCareFacade,
          useValue: {
            ...care,
            appointmentLoading: signal(false),
            appointmentError: signal(null),
            activeAppointment,
            requestLoading: signal(false),
            requestError: signal(null),
            activeRequest,
            commandLoading: signal(false),
            commandError: signal(null),
            availability,
            availabilityTimezone: signal('Africa/Tunis'),
            availabilityLoading: signal(false),
            availabilityError: signal(null),
          },
        },
        {
          provide: ActiveConsultationStore,
          useValue: {
            active: signal(null),
            loading: signal(false),
            error: signal(null),
            starting: signal(false),
            startError: signal(null),
            clearStartError: vi.fn(),
            startScheduledAppointment: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(CalendarDetailPanel);
    panel = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  /** Footer action labels (buttons and links), in order. */
  function actions(): string[] {
    return [...document.querySelectorAll('.cal-panel__actions oc-button, .cal-panel__actions a')].map(
      (element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  }

  function bodyText(): string {
    return (document.body.textContent ?? '').replace(/\s+/g, ' ');
  }

  function click(label: string): void {
    const target = [
      ...document.querySelectorAll<HTMLElement>('.cal-panel__actions oc-button, .cal-panel__actions a'),
    ].find((element) => (element.textContent ?? '').trim() === label);
    expect(target, `action « ${label} »`).toBeTruthy();
    (target?.querySelector('button') ?? target)?.click();
    fixture.detectChanges();
  }

  function openAppointment(detail = appointmentDetail()): void {
    activeAppointment.set(detail);
    panel.openWith('appointment-1');
    fixture.detectChanges();
  }

  function openRequest(detail = requestDetail()): void {
    activeRequest.set(detail);
    panel.openRequest('request-1');
    fixture.detectChanges();
  }

  describe('appointment', () => {
    it('shows « Démarrer la consultation », « Voir le dossier », « Appeler » and « Annuler »', () => {
      openAppointment();

      expect(actions()).toEqual([
        'Démarrer la consultation',
        'Voir le dossier',
        'Appeler',
        'Annuler le rendez-vous',
        'Fermer',
      ]);
      expect(care['openAppointment']).toHaveBeenCalledWith('appointment-1', null);
    });

    it('calls through a tel: link built from the number, only when a number exists', () => {
      openAppointment();

      const call = [...document.querySelectorAll<HTMLAnchorElement>('.cal-panel__actions a')].find(
        (link) => (link.textContent ?? '').trim() === 'Appeler',
      );
      expect(call?.getAttribute('href')).toBe('tel:+21620123456');
      expect(bodyText()).toContain(PHONE);
    });

    it('does not render « Appeler » without a phone number, nor with an unusable one', () => {
      const withoutPhone = appointmentDetail();
      openAppointment({
        ...withoutPhone,
        practicePatient: { ...withoutPhone.practicePatient!, phone: null },
      });
      expect(actions()).not.toContain('Appeler');
      expect(actions()).toContain('Voir le dossier');

      openAppointment({
        ...withoutPhone,
        practicePatient: { ...withoutPhone.practicePatient!, phone: ' - ' },
      });
      expect(actions()).not.toContain('Appeler');
    });

    it('does not render « Voir le dossier » or « Appeler » for a patient without a practice record', () => {
      openAppointment(appointmentDetail({ practicePatient: null }));

      expect(actions()).toEqual(['Démarrer la consultation', 'Annuler le rendez-vous', 'Fermer']);
    });

    it('never renders Déplacer, Message or Marquer absent', () => {
      for (const detail of [
        appointmentDetail(),
        appointmentDetail({ practicePatient: null }),
        appointmentDetail({ status: 'IN_PROGRESS', availableActions: [] }),
      ]) {
        openAppointment(detail);
        const text = bodyText();
        expect(text).not.toContain('Déplacer');
        expect(text).not.toMatch(/Message/);
        expect(text).not.toContain('Marquer absent');
      }
      openRequest();
      expect(bodyText()).not.toContain('Déplacer');
      expect(bodyText()).not.toContain('Marquer absent');
    });

    it('only offers cancellation when the appointment allows it, and confirms it in two steps', () => {
      openAppointment(appointmentDetail({ availableActions: [] }));
      expect(actions()).not.toContain('Annuler le rendez-vous');

      openAppointment();
      click('Annuler le rendez-vous');
      expect(care['cancelAppointment']).not.toHaveBeenCalled();
      expect(actions()).toContain('Confirmer l’annulation');

      panel.setCancelReason('SCHEDULE_CONFLICT');
      fixture.detectChanges();
      click('Confirmer l’annulation');
      expect(care['cancelAppointment']).toHaveBeenCalledExactlyOnceWith('SCHEDULE_CONFLICT');
    });

    it('shows the state of a follow-up with its violet label', () => {
      panel.openWith({
        resourceType: 'APPOINTMENT',
        appointmentId: 'appointment-1',
        followUp: true,
      } as unknown as DoctorScheduledCareItem);
      activeAppointment.set(appointmentDetail());
      fixture.detectChanges();

      expect(bodyText()).toContain('Suivi à venir');
      expect(document.querySelector('.cal-panel__chip')?.className).toContain('oc-cal-state--followUpUpcoming');
    });

    it('fix 5: a confirmed appointment already over shows « Non clôturé », never « À venir »', () => {
      panel.openWith({ resourceType: 'APPOINTMENT', appointmentId: 'appointment-1' } as unknown as DoctorScheduledCareItem);
      const detail = appointmentDetail();
      activeAppointment.set({
        ...detail,
        slot: { ...detail.slot, start: '2020-01-06T08:00:00.000Z', end: '2020-01-06T08:30:00.000Z' },
      });
      fixture.detectChanges();

      expect(document.querySelector('.cal-panel__chip')?.textContent?.trim()).toBe('Non clôturé');
      expect(document.querySelector('.cal-panel__chip')?.className).toContain('oc-cal-state--not-closed');
      expect(bodyText()).not.toContain('À venir');
    });

    it('in « Mode discret » shows initials, hides the reason and the digits, and keeps « Appeler »', () => {
      discreet.set(true);
      openAppointment();

      const text = bodyText();
      expect(document.querySelector('.cal-panel__name')?.textContent?.trim()).toBe('T. P.');
      expect(text).not.toContain('Test Patient');
      expect(text).not.toContain('Toux persistante');
      expect(text).not.toContain('20 123 456');
      expect(text).toContain('Masqué (mode discret)');
      expect(actions()).toContain('Appeler');
      const call = [...document.querySelectorAll<HTMLAnchorElement>('.cal-panel__actions a')].find(
        (link) => (link.textContent ?? '').trim() === 'Appeler',
      );
      expect(call?.getAttribute('href')).toBe('tel:+21620123456');
    });
  });

  describe('booking request', () => {
    it('offers « Accepter », « Proposer un autre horaire » and « Refuser » through the existing facade', () => {
      openRequest();

      expect(actions()).toEqual(['Accepter', 'Proposer un autre horaire', 'Refuser', 'Fermer']);
      expect(care['openRequest']).toHaveBeenCalledWith('request-1');
      expect(bodyText()).toContain('Demande');

      click('Accepter');
      expect(care['acceptRequest']).toHaveBeenCalledOnce();
    });

    it('only shows the actions the request allows', () => {
      openRequest(requestDetail(['ACCEPT_REQUEST']));
      expect(actions()).toEqual(['Accepter', 'Fermer']);

      openRequest(requestDetail([]));
      expect(actions()).toEqual(['Fermer']);
    });

    it('asks for a reason and a second confirmation before refusing', () => {
      openRequest();

      click('Refuser');
      expect(care['declineRequest']).not.toHaveBeenCalled();
      expect(actions()).toContain('Confirmer le refus');
      expect(bodyText()).toContain('Le patient sera prévenu du refus.');

      // No reason yet: the confirmation does nothing.
      panel.submitDecline();
      expect(care['declineRequest']).not.toHaveBeenCalled();

      panel.setDeclineReason('DOCTOR_UNAVAILABLE');
      fixture.detectChanges();
      click('Confirmer le refus');
      expect(care['declineRequest']).toHaveBeenCalledExactlyOnceWith('DOCTOR_UNAVAILABLE');
    });

    it('rejects an unknown refusal reason', () => {
      openRequest();
      click('Refuser');

      panel.setDeclineReason('NOT_A_REASON');
      panel.submitDecline();

      expect(care['declineRequest']).not.toHaveBeenCalled();
    });

    it('proposes another time from the free slots of the facade', () => {
      openRequest();
      availability.set([SLOT]);

      click('Proposer un autre horaire');
      expect(care['loadProposalAvailability']).toHaveBeenCalledOnce();

      // Nothing selected yet: the proposal cannot be sent.
      panel.submitProposal();
      expect(care['proposeTime']).not.toHaveBeenCalled();

      panel.selectedSlotKey.set(`${SLOT.start}|${SLOT.end}`);
      fixture.detectChanges();
      click('Envoyer la proposition');
      expect(care['proposeTime']).toHaveBeenCalledExactlyOnceWith(SLOT);
    });

    it('shows « En attente du patient » once another time was proposed', () => {
      openRequest(
        requestDetail([], {
          status: 'PENDING_PATIENT_TIME_CONFIRMATION',
          proposedSlot: {
            proposalId: 'p1',
            start: '2031-04-09T09:00:00.000Z',
            end: '2031-04-09T09:30:00.000Z',
            proposedAt: '2031-04-01T08:00:00.000Z',
            patientResponseDeadline: '2031-04-02T08:00:00.000Z',
          },
        }),
      );

      expect(bodyText()).toContain('En attente du patient');
      expect(bodyText()).toContain('Horaire proposé');
    });

    it('offers no phone call and no record link: a request carries neither', () => {
      openRequest();

      expect(actions()).not.toContain('Appeler');
      expect(actions()).not.toContain('Voir le dossier');
    });

    it('follows « Mode discret »: initials instead of the name', () => {
      discreet.set(true);
      openRequest();

      expect(document.querySelector('.cal-panel__name')?.textContent?.trim()).toBe('T. P.');
      expect(bodyText()).not.toContain('Test Patient');
      expect(actions()).toContain('Accepter');
    });

    it('triggers no command from the keyboard', () => {
      openRequest();
      openAppointment();

      for (const key of ['a', 'A', 'r', 'R', 'c', 'd', 'Enter', ' ', 'Delete']) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      }

      expect(care['acceptRequest']).not.toHaveBeenCalled();
      expect(care['declineRequest']).not.toHaveBeenCalled();
      expect(care['cancelAppointment']).not.toHaveBeenCalled();
      expect(care['proposeTime']).not.toHaveBeenCalled();
    });
  });

  it('shows times in Tunis whatever zone the snapshot or the browser reports', () => {
    openAppointment(
      appointmentDetail({
        slot: {
          start: '2031-04-08T08:00:00.000Z',
          end: '2031-04-08T08:30:00.000Z',
          durationMinutes: 30,
          timezone: 'America/New_York',
        },
      }),
    );

    const text = bodyText();
    expect(text).toContain('09:00');
    expect(text).not.toContain('04:00');
    expect(text).not.toContain('10:00');

    openRequest(
      requestDetail(undefined, {
        cabinet: { ...requestDetail().cabinet, timezone: 'Asia/Tokyo' },
      }),
    );
    expect(bodyText()).toContain('10:00'); // 09:00Z = 10:00 in Tunis
    expect(bodyText()).not.toContain('18:00');
  });

  it('closes by resetting the facade state of the opened resource', () => {
    openRequest();
    panel.close();
    expect(care['closeRequest']).toHaveBeenCalledOnce();

    openAppointment();
    panel.close();
    expect(care['closeAppointment']).toHaveBeenCalledOnce();
    expect(fixture.debugElement.query(By.css('nz-drawer'))).toBeTruthy();
  });
});
