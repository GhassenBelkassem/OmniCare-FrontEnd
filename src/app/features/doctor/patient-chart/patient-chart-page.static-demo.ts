import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { OcTab } from '../../../shared/ui';
import {
  DemoPatientRecord,
  demoPatientAge,
  demoPatientFullName,
} from '../patients/patient-directory-demo.fixtures';
import { PatientDirectoryDemoStore } from '../patients/patient-directory-demo.store';
import { PatientDetailView, isPatientDetailTab } from './patient-detail-view';
import type {
  PatientDetailAction,
  PatientDetailAppointment,
  PatientDetailPerson,
  PatientDetailTab,
  PatientDetailTimelineEvent,
  PatientDetailViewModel,
} from './patient-detail-view.models';

const DETAIL_TABS: readonly OcTab[] = [
  { id: 'overview', label: 'Vue d’ensemble', icon: 'user' },
  { id: 'consultations', label: 'Consultations', icon: 'medicine-box' },
  { id: 'documents', label: 'Documents', icon: 'file-text' },
  { id: 'timeline', label: 'Timeline', icon: 'history' },
];

@Component({
  selector: 'app-patient-chart-page',
  imports: [PatientDetailView],
  template: `<app-patient-detail-view [model]="viewModel()" (action)="handleViewAction($event)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChartPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly patientStore = inject(PatientDirectoryDemoStore);

  readonly patientId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly patient = signal<DemoPatientRecord | null>(this.patientStore.find(this.patientId));
  readonly activeTab = signal<PatientDetailTab>(this.initialTab());

  readonly viewModel = computed<PatientDetailViewModel>(() => {
    const patient = this.patient();
    return {
      notice:
        'Données administratives fictives. Aucun contenu clinique réel ou simulé n’est chargé dans cette démonstration.',
      state: patient ? 'ready' : 'not-found',
      stateDescription: patient
        ? ''
        : 'Aucune fiche de démonstration ne correspond à l’identifiant demandé.',
      directoryHref: '/doctor/patients',
      scheduleHref: patient ? `/doctor/calendar?patientId=${encodeURIComponent(patient.id)}` : null,
      patient: patient ? demoPatient(patient) : null,
      tabs: DETAIL_TABS,
      activeTab: this.activeTab(),
      appointments: patient ? demoAppointments(patient) : [],
      timeline: patient ? demoTimeline(patient) : [],
    };
  });

  handleViewAction(action: PatientDetailAction): void {
    switch (action.kind) {
      case 'SELECT_TAB':
        this.activeTab.set(action.value);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { tab: action.value === 'overview' ? null : action.value },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      case 'NAVIGATE_DIRECTORY':
        void this.router.navigate(['/doctor/patients']);
        return;
      case 'SCHEDULE': {
        const patient = this.patient();
        if (patient) {
          void this.router.navigate(['/doctor/calendar'], {
            queryParams: { patientId: patient.id },
          });
        }
        return;
      }
      case 'RETRY':
        return;
    }
  }

  private initialTab(): PatientDetailTab {
    const requested = this.route.snapshot.queryParamMap.get('tab');
    return isPatientDetailTab(requested) ? requested : 'overview';
  }
}

function demoPatient(patient: DemoPatientRecord): PatientDetailPerson {
  return {
    id: patient.id,
    fullName: demoPatientFullName(patient),
    initials: `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toLocaleUpperCase(
      'fr-FR',
    ),
    dateOfBirth: patient.dateOfBirth,
    dateOfBirthLabel: formatShortDate(patient.dateOfBirth),
    age: demoPatientAge(patient),
    sexLabel: patient.sex === 'F' ? 'Femme' : patient.sex === 'M' ? 'Homme' : 'Autre',
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    administrativeId: patient.insuranceNumber,
    insuranceNumber: patient.insuranceNumber,
    source: (
      {
        OMNICARE: 'omnicare',
        MANUAL: 'manual',
        IMPORTED: 'imported',
        WALK_IN: 'walk_in',
      } as const
    )[patient.source],
    sourceLabel: {
      OMNICARE: 'OmniCare',
      MANUAL: 'Saisie manuelle',
      IMPORTED: 'Import',
      WALK_IN: 'Passage',
    }[patient.source],
    linkage: (
      {
        LINKED: 'linked',
        POSSIBLE: 'possible',
        UNLINKED: 'unlinked',
      } as const
    )[patient.linkage],
    linkageLabel: {
      LINKED: 'Lié à OmniCare',
      POSSIBLE: 'Correspondance possible',
      UNLINKED: 'Non lié',
    }[patient.linkage],
  };
}

function demoAppointments(patient: DemoPatientRecord): readonly PatientDetailAppointment[] {
  const rows: PatientDetailAppointment[] = [];
  if (patient.nextAppointment) {
    rows.push({ id: 'next', date: patient.nextAppointment, status: 'Planifié' });
  }
  if (patient.lastConsultation) {
    rows.push(
      { id: 'last', date: patient.lastConsultation, status: 'Terminé' },
      { id: 'previous', date: shiftDays(patient.lastConsultation, -47), status: 'Terminé' },
      { id: 'older', date: shiftDays(patient.lastConsultation, -126), status: 'Terminé' },
    );
  }
  return rows;
}

function demoTimeline(patient: DemoPatientRecord): readonly PatientDetailTimelineEvent[] {
  const events: PatientDetailTimelineEvent[] = [
    {
      id: 'created',
      date: patient.createdAt,
      title: 'Ajout à la base patient',
      description: `Fiche administrative créée depuis la source ${demoPatient(patient).sourceLabel}.`,
      icon: 'staff',
    },
  ];
  if (patient.linkage === 'LINKED') {
    events.unshift({
      id: 'linked',
      date: shiftDays(patient.createdAt, 2),
      title: 'Liaison OmniCare confirmée',
      description:
        'Identité administrative reliée. Cette liaison ne donne pas un accès automatique au dossier médical.',
      icon: 'coverage',
    });
  }
  if (patient.nextAppointment) {
    events.unshift({
      id: 'scheduled',
      date: patient.nextAppointment,
      title: 'Rendez-vous planifié',
      description: 'Créneau enregistré dans le calendrier du cabinet.',
      icon: 'calendar',
    });
  }
  return events;
}

function shiftDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(value));
}
