import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { OcButton, OcIcon, OcTabs, OcTab } from '../../../shared/ui';
import {
  DemoPatientLinkage,
  DemoPatientRecord,
  DemoPatientSource,
  demoPatientAge,
  demoPatientFullName,
} from '../patients/patient-directory-demo.fixtures';
import { PatientDirectoryDemoStore } from '../patients/patient-directory-demo.store';

type DetailTab = 'overview' | 'consultations' | 'documents' | 'timeline';

interface AdministrativeAppointment {
  readonly id: string;
  readonly date: string;
  readonly status: 'Terminé' | 'Planifié';
}

interface AdministrativeTimelineEvent {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
}

const DETAIL_TABS: readonly OcTab[] = [
  { id: 'overview', label: 'Vue d’ensemble', icon: 'user' },
  { id: 'consultations', label: 'Consultations', icon: 'medicine-box' },
  { id: 'documents', label: 'Documents', icon: 'file-text' },
  { id: 'timeline', label: 'Timeline', icon: 'history' },
];

function isDetailTab(value: string | null): value is DetailTab {
  return (
    value === 'overview' ||
    value === 'consultations' ||
    value === 'documents' ||
    value === 'timeline'
  );
}

function shiftDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

@Component({
  selector: 'app-patient-chart-page',
  imports: [RouterLink, OcButton, OcIcon, OcTabs],
  templateUrl: './patient-chart-page.static-demo.html',
  styleUrl: './patient-chart-page.static-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChartPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly patientStore = inject(PatientDirectoryDemoStore);

  readonly patientId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly patient = signal<DemoPatientRecord | null>(this.patientStore.find(this.patientId));
  readonly tabs = DETAIL_TABS;
  readonly activeTab = signal<DetailTab>(this.initialTab());
  readonly demoNotice =
    'Données administratives fictives. Aucun contenu clinique réel ou simulé n’est chargé dans cette démonstration.';

  readonly appointments = computed<readonly AdministrativeAppointment[]>(() => {
    const patient = this.patient();
    if (!patient) return [];
    const rows: AdministrativeAppointment[] = [];
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
  });

  readonly timeline = computed<readonly AdministrativeTimelineEvent[]>(() => {
    const patient = this.patient();
    if (!patient) return [];
    const events: AdministrativeTimelineEvent[] = [
      {
        id: 'created',
        date: patient.createdAt,
        title: 'Ajout à la base patient',
        description: `Fiche administrative créée depuis la source ${this.sourceLabel(patient.source)}.`,
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
  });

  setTab(value: string): void {
    if (!isDetailTab(value)) return;
    this.activeTab.set(value);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: value === 'overview' ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  fullName(patient: DemoPatientRecord): string {
    return demoPatientFullName(patient);
  }

  age(patient: DemoPatientRecord): number {
    return demoPatientAge(patient);
  }

  initials(patient: DemoPatientRecord): string {
    return `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toLocaleUpperCase('fr-FR');
  }

  sexLabel(patient: DemoPatientRecord): string {
    return patient.sex === 'F' ? 'Femme' : patient.sex === 'M' ? 'Homme' : 'Autre';
  }

  sourceLabel(source: DemoPatientSource): string {
    return {
      OMNICARE: 'OmniCare',
      MANUAL: 'Saisie manuelle',
      IMPORTED: 'Import',
      WALK_IN: 'Passage',
    }[source];
  }

  linkageLabel(linkage: DemoPatientLinkage): string {
    return {
      LINKED: 'Lié à OmniCare',
      POSSIBLE: 'Correspondance possible',
      UNLINKED: 'Non lié',
    }[linkage];
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Tunis',
    }).format(new Date(value));
  }

  formatShortDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Africa/Tunis',
    }).format(new Date(value));
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Tunis',
    }).format(new Date(value));
  }

  formatDay(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      timeZone: 'Africa/Tunis',
    }).format(new Date(value));
  }

  formatMonth(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      timeZone: 'Africa/Tunis',
    })
      .format(new Date(value))
      .replace('.', '')
      .toLocaleUpperCase('fr-FR');
  }

  private initialTab(): DetailTab {
    const requested = this.route.snapshot.queryParamMap.get('tab');
    return isDetailTab(requested) ? requested : 'overview';
  }
}
