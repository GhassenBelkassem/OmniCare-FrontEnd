import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { OcPageHeader } from '../../../shared/ui';
import { OcTabs } from '../../../shared/ui';
import { OcDataTableShell } from '../../../shared/ui';
import { OcButton } from '../../../shared/ui';
import { OcStatusBadge } from '../../../shared/ui';
import { OcEmptyState } from '../../../shared/ui';
import { OcCard } from '../../../shared/ui';

interface LabResult {
  id: string;
  patientName: string;
  date: string;
  testName: string;
  status: 'pending' | 'reviewed' | 'critical';
  summary?: string;
}

interface ImagingResult {
  id: string;
  patientName: string;
  date: string;
  examType: string;
  status: 'pending' | 'reviewed' | 'critical';
  summary?: string;
}

interface PatientRecall {
  id: string;
  patientName: string;
  phone: string;
  lastVisit: string;
  reason: string;
  suggestedAction: string;
}

interface Task {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  completed: boolean;
  description: string;
}

@Component({
  selector: 'app-results-page',
  imports: [
    OcPageHeader,
    OcTabs,
    OcDataTableShell,
    OcButton,
    OcStatusBadge,
    OcEmptyState,
    OcCard,
  ],
  templateUrl: './results-page.html',
  styleUrl: './results-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPage {
  readonly tabs = signal([
    { id: 'inbox', label: 'Boite de reception' },
    { id: 'recalls', label: 'Rappels patients' },
    { id: 'tasks', label: 'Taches' },
  ]);

  readonly activeTab = signal<string>('inbox');

  readonly labResults = signal<LabResult[]>([
    { id: '1', patientName: 'Ahmed Ben Ali', date: '2026-08-16', testName: 'Bilan sanguin complet', status: 'pending' },
    { id: '2', patientName: 'Fatma Trabelsi', date: '2026-08-15', testName: 'Glycemie a jeun', status: 'reviewed', summary: 'Glycemie normale - 0.92 g/L' },
    { id: '3', patientName: 'Mohamed Sahli', date: '2026-08-15', testName: 'Creatinine + Clearance', status: 'critical', summary: 'Creatinine elevee - 1.8 mg/dL' },
    { id: '4', patientName: 'Leila Karray', date: '2026-08-14', testName: 'NFS complete', status: 'pending' },
    { id: '5', patientName: 'Ali Mezghani', date: '2026-08-13', testName: 'HbA1c', status: 'reviewed', summary: 'HbA1c - 7.2% - a revoir' },
    { id: '6', patientName: 'Nadia Bouazizi', date: '2026-08-12', testName: 'Bilan lipidique', status: 'reviewed', summary: 'Cholesterol LDL eleve' },
  ]);

  readonly imagingResults = signal<ImagingResult[]>([
    { id: '1', patientName: 'Youssef Gharbi', date: '2026-08-16', examType: 'Radio thorax', status: 'pending' },
    { id: '2', patientName: 'Ahmed Ben Ali', date: '2026-08-15', examType: 'Echographie abdominale', status: 'pending' },
    { id: '3', patientName: 'Fatma Trabelsi', date: '2026-08-14', examType: 'IRM lombaire', status: 'critical', summary: 'Hernie discale L4-L5' },
    { id: '4', patientName: 'Mohamed Sahli', date: '2026-08-13', examType: 'ECG', status: 'reviewed', summary: 'Rythme sinusal normal' },
  ]);

  readonly patientRecalls = signal<PatientRecall[]>([
    { id: '1', patientName: 'Ahmed Ben Ali', phone: '+216 71 234 567', lastVisit: '2026-06-01', reason: 'Suivi diabete - HbA1c a controler', suggestedAction: 'Rappeler pour RDV controle glycémique' },
    { id: '2', patientName: 'Fatma Trabelsi', phone: '+216 98 765 432', lastVisit: '2026-05-15', reason: 'Suivi hypertension arterielle', suggestedAction: 'Rappeler pour mesure tensionnelle' },
    { id: '3', patientName: 'Leila Karray', phone: '+216 71 345 678', lastVisit: '2026-07-01', reason: 'Bilan annuel - age > 50 ans', suggestedAction: 'Envoyer courrier rappel depistage' },
    { id: '4', patientName: 'Ali Mezghani', phone: '+216 55 678 901', lastVisit: '2026-04-20', reason: 'Renevelement ordonnance chronic', suggestedAction: 'Rappeler pour renouvellement traitement' },
    { id: '5', patientName: 'Nadia Bouazizi', phone: '+216 71 456 789', lastVisit: '2026-07-15', reason: 'Controle post-operators', suggestedAction: 'Rappeler pour point sutures' },
  ]);

  readonly tasks = signal<Task[]>([
    { id: '1', title: 'Revoir resultats labo Ahmed Ben Ali', priority: 'high', dueDate: '2026-08-17', completed: false, description: 'Bilan sanguin complet a interpreter' },
    { id: '2', title: 'Valider comptes-rendus imagerie', priority: 'high', dueDate: '2026-08-17', completed: false, description: '3 examens en attente de validation' },
    { id: '3', title: 'Rappeler patient Fatma Trabelsi', priority: 'medium', dueDate: '2026-08-18', completed: false, description: 'Suivi tensionnel a effectuer' },
    { id: '4', title: 'Rediger courrier cardiologue', priority: 'medium', dueDate: '2026-08-19', completed: false, description: 'Orientation patient Mohamed Sahli' },
    { id: '5', title: 'Archiver ordonnances terminees', priority: 'low', dueDate: '2026-08-20', completed: true, description: 'Trier et archiver les ordonnances de la semaine' },
    { id: '6', title: 'Mettre a jour protocole diabete', priority: 'low', dueDate: '2026-08-22', completed: false, description: 'Revoir protocole de surveillance diabete type 2' },
  ]);

  readonly allResults = computed(() => {
    const lab = this.labResults().map(r => ({ ...r, sourceType: 'lab' as const }));
    const imaging = this.imagingResults().map(r => ({ ...r, sourceType: 'imaging' as const }));
    return [...lab, ...imaging].sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly inboxCount = computed(() => {
    const pending = this.allResults().filter(r => r.status === 'pending').length;
    const critical = this.allResults().filter(r => r.status === 'critical').length;
    return pending + critical;
  });

  readonly recallsCount = computed(() => this.patientRecalls().length);
  readonly tasksCount = computed(() => this.tasks().filter(t => !t.completed).length);

  readonly pendingLabCount = computed(() => this.labResults().filter(r => r.status === 'pending').length);
  readonly pendingImagingCount = computed(() => this.imagingResults().filter(r => r.status === 'pending').length);
  readonly criticalCount = computed(() => this.allResults().filter(r => r.status === 'critical').length);

  readonly highPriorityTasks = computed(() => this.tasks().filter(t => t.priority === 'high' && !t.completed));
  readonly mediumPriorityTasks = computed(() => this.tasks().filter(t => t.priority === 'medium' && !t.completed));
  readonly lowPriorityTasks = computed(() => this.tasks().filter(t => t.priority === 'low' && !t.completed));

  readonly resultStatusLabel = computed(() => {
    const map: Record<string, string> = {
      pending: 'En attente',
      reviewed: 'Analyse',
      critical: 'Critique',
    };
    return map;
  });

  readonly resultStatusColor = computed(() => {
    const map: Record<string, string> = {
      pending: 'var(--oc-color-warning)',
      reviewed: 'var(--oc-color-success)',
      critical: 'var(--oc-color-error)',
    };
    return map;
  });

  readonly priorityLabel = computed(() => {
    const map: Record<string, string> = {
      high: 'Haute',
      medium: 'Moyenne',
      low: 'Basse',
    };
    return map;
  });

  readonly priorityColor = computed(() => {
    const map: Record<string, string> = {
      high: 'var(--oc-color-error)',
      medium: 'var(--oc-color-warning)',
      low: 'var(--oc-color-info)',
    };
    return map;
  });

  readonly priorityOcStatus = computed(() => {
    const map: Record<string, 'critical' | 'requires-attention' | 'pending'> = {
      high: 'critical',
      medium: 'requires-attention',
      low: 'pending',
    };
    return map;
  });

  onTabChange(key: string): void {
    this.activeTab.set(key);
  }

  onReviewResult(result: LabResult | ImagingResult): void {
    const updated = { ...result, status: 'reviewed' as const };
    if ('testName' in result) {
      this.labResults.update(items =>
        items.map(i => i.id === result.id ? { ...i, status: 'reviewed' as const, summary: 'Review effectue' } : i)
      );
    } else {
      this.imagingResults.update(items =>
        items.map(i => i.id === result.id ? { ...i, status: 'reviewed' as const, summary: 'Review effectue' } : i)
      );
    }
  }

  onCallPatient(recall: PatientRecall): void {
    console.log('Call patient', recall);
  }

  onDismissRecall(recall: PatientRecall): void {
    this.patientRecalls.update(items => items.filter(i => i.id !== recall.id));
  }

  onToggleTask(task: Task): void {
    this.tasks.update(items =>
      items.map(i => i.id === task.id ? { ...i, completed: !i.completed } : i)
    );
  }

  onDeleteTask(task: Task): void {
    this.tasks.update(items => items.filter(i => i.id !== task.id));
  }

  onAddTask(): void {
    console.log('Add task');
  }
}
