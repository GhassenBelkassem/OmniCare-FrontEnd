import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { Observable, of, throwError } from 'rxjs';

import { OMNICARE_ICONS } from '../../../app.icons';
import { UrgentPermanentCapabilityProjection } from './urgent-readiness.models';
import { URGENT_OPERATION_FIXTURES } from './urgent-readiness.fixtures';
import { UrgentReadinessCapabilityReader } from './urgent-readiness-capability-reader.service';
import { UrgentReadinessPage } from './urgent-readiness-page';

describe('UrgentReadinessPage', () => {
  let fixture: ComponentFixture<UrgentReadinessPage>;
  let reader: {
    load: ReturnType<typeof vi.fn<() => Observable<UrgentPermanentCapabilityProjection>>>;
  };

  const capabilityProjection: UrgentPermanentCapabilityProjection = {
    revision: 12,
    urgentHomeEnabled: true,
    urgentCabinetEnabled: true,
    activePracticeLocations: [
      { id: 'cabinet-demo-1', label: 'Cabinet Démo Lac' },
      { id: 'cabinet-demo-2', label: 'Cabinet Démo Centre' },
    ],
  };

  beforeEach(async () => {
    reader = { load: vi.fn(() => of(capabilityProjection)) };
    await TestBed.configureTestingModule({
      imports: [UrgentReadinessPage],
      providers: [
        provideRouter([]),
        provideNzIcons(OMNICARE_ICONS),
        { provide: UrgentReadinessCapabilityReader, useValue: reader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UrgentReadinessPage);
    fixture.detectChanges();
  });

  it('separates permanent capabilities from runtime availability per active cabinet', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Capacité permanente');
    expect(text).toContain('Disponibilité déclarée');
    expect(text).toContain('Éligibilité effective');
    expect(text).toContain('Non renseignée');
    expect(text).toContain('À confirmer');
    expect(text).toContain('Cabinet Démo Lac');
    expect(text).toContain('Cabinet Démo Centre');
    expect(text).toContain('proviennent du serveur');
    expect(text).toContain('données synthétiques de prévisualisation');
    expect(text).toContain('se déclare et se gère dans l’application mobile Doctor');
    expect(text).toContain('Aucune observation');
    expect(text).not.toContain('Mode HOME');
    expect(text).not.toContain('Mode CABINET');

    const homeCard = fixture.nativeElement.querySelector(
      '.readiness-card--home .oc-card--information',
    );
    const cabinetCard = fixture.nativeElement.querySelector(
      '.readiness-card--cabinet .oc-card--success',
    );
    const primaryAction = fixture.nativeElement.querySelector('oc-page-header .oc-button--primary');
    expect(homeCard).toBeTruthy();
    expect(cabinetCard).toBeTruthy();
    expect(primaryAction).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.status-reason--information')).toHaveLength(3);
  });

  it('renders HOME, CABINET and explanation icons through registered OcIcon SVG content', () => {
    for (const selector of [
      '.readiness-card--home .mode-icon oc-icon svg',
      '.readiness-card--cabinet .mode-icon oc-icon svg',
      '.status-reason__icon oc-icon svg',
    ]) {
      const icons = fixture.nativeElement.querySelectorAll(selector) as NodeListOf<SVGElement>;
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of Array.from(icons)) {
        expect(icon.hasAttribute('data-icon-fallback')).toBe(false);
        expect(icon.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
      }
    }
  });

  it('renders explicit non-empty text for every readiness status badge', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        'oc-status-badge .oc-status__label',
      ) as NodeListOf<HTMLElement>,
    ).map((label) => label.textContent?.trim() ?? '');

    expect(labels).toEqual(
      expect.arrayContaining(['Activée', 'Non renseignée', 'À confirmer', 'Aucune opération']),
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });

  it('renders HOME metadata with intentional fallbacks when runtime values are unavailable', () => {
    const homeFacts = fixture.nativeElement.querySelector(
      '.readiness-card--home .readiness-facts',
    ) as HTMLElement;

    expect(homeFacts.textContent).toContain('Temps réel dégradé');
    expect(homeFacts.textContent).toContain('Non disponible');
    expect(homeFacts.textContent).toContain('Aucune observation');
    expect(
      Array.from(homeFacts.querySelectorAll('dd')).every((value) => value.textContent?.trim()),
    ).toBe(true);
  });

  it('renders active CABINET availability, eligibility and metadata for every source location', () => {
    const cabinetEntries = fixture.nativeElement.querySelectorAll('.cabinet-runtime');
    expect(cabinetEntries).toHaveLength(2);
    for (const entry of Array.from(cabinetEntries) as HTMLElement[]) {
      expect(entry.textContent).toContain('Disponibilité déclarée');
      expect(entry.textContent).toContain('Éligibilité effective');
      expect(entry.textContent).toContain('Non renseignée');
      expect(entry.textContent).toContain('À confirmer');
      expect(entry.textContent).toContain('Non raccordé');
      expect(entry.textContent).toContain('Aucune observation');
    }
  });

  it('renders disabled CABINET capability as explicit ineligibility without hiding source locations', () => {
    fixture.componentInstance.capabilities.set({
      ...capabilityProjection,
      urgentCabinetEnabled: false,
    });
    fixture.detectChanges();

    const cabinetCard = fixture.nativeElement.querySelector(
      '.readiness-card--cabinet',
    ) as HTMLElement;
    expect(cabinetCard.textContent).toContain('Non activée');
    expect(cabinetCard.textContent).toContain('Non éligible');
    expect(cabinetCard.querySelectorAll('.cabinet-runtime')).toHaveLength(2);
  });

  it('renders an intentional CABINET empty state when no active location exists', () => {
    fixture.componentInstance.capabilities.set({
      ...capabilityProjection,
      activePracticeLocations: [],
    });
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector('.cabinet-runtime-empty') as HTMLElement;
    expect(empty.getAttribute('role')).toBe('status');
    expect(empty.textContent).toContain('Aucun cabinet actif');
    expect(empty.textContent).toContain('Ajoutez ou activez un cabinet');
    expect(fixture.nativeElement.querySelectorAll('.cabinet-runtime')).toHaveLength(0);
  });

  it('keeps CABINET details out of the DOM while the readiness source is loading', () => {
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    const loading = fixture.nativeElement.querySelector('.readiness-loading') as HTMLElement;
    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.getAttribute('aria-label')).toBe('Chargement de la préparation urgente');
    expect(fixture.nativeElement.querySelector('.readiness-card--cabinet')).toBeNull();
  });

  it.each([
    ['none', 'Aucune prise en charge urgente active'],
    ['homeActive', 'Engagement urgent à domicile en cours'],
    ['cabinetActive', 'Engagement urgent au cabinet en cours'],
    ['waitingReconnect', 'Synchronisation de l’opération en attente'],
    ['staleLocation', 'Fraîcheur de localisation insuffisante'],
    ['realtimeDegraded', 'Mises à jour en direct indisponibles'],
    ['missingEligibility', 'Configuration urgente incomplète'],
  ] as const)('renders the %s read-only operation state', (fixtureName, expectedTitle) => {
    fixture.componentInstance.operation.set(URGENT_OPERATION_FIXTURES[fixtureName]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(expectedTitle);
  });

  it('does not render active urgent commands or sensitive patient fields', () => {
    fixture.componentInstance.operation.set(URGENT_OPERATION_FIXTURES.homeActive);
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent as string).toLowerCase();

    for (const forbidden of [
      'accepter',
      'refuser',
      'démarrer le trajet',
      'confirmer l’arrivée',
      'scanner',
      'téléphone du patient',
      'adresse du patient',
      'coordonnées gps',
    ]) {
      expect(text).not.toContain(forbidden);
    }
    expect(text).toContain('10/10/2026 à 09:30 utc');
  });

  it('renders a retryable load failure', () => {
    reader.load.mockReset();
    reader.load
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of(capabilityProjection));
    const retryFixture = TestBed.createComponent(UrgentReadinessPage);
    retryFixture.detectChanges();

    expect(retryFixture.nativeElement.textContent).toContain('État impossible à charger');
    const retryButton = Array.from(
      retryFixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Réessayer'));
    retryButton?.click();
    retryFixture.detectChanges();

    expect(reader.load).toHaveBeenCalledTimes(2);
    expect(retryFixture.nativeElement.textContent).toContain('Urgences à domicile');
  });
});
