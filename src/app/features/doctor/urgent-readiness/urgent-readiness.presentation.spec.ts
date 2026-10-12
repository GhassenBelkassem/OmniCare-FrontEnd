import { isOcIconName } from '../../../shared/ui';
import {
  SAFE_URGENT_READINESS_FIXTURE,
  URGENT_OPERATION_FIXTURES,
  URGENT_RUNTIME_FIXTURES,
} from './urgent-readiness.fixtures';
import { presentUrgentOperation, presentUrgentRuntime } from './urgent-readiness.presentation';

describe('urgent readiness presentation', () => {
  it.each([
    ['none', 'Aucune opération'],
    ['homeActive', 'À domicile · active'],
    ['cabinetActive', 'Au cabinet · active'],
    ['waitingReconnect', 'Reconnexion'],
    ['staleLocation', 'Position ancienne'],
    ['realtimeDegraded', 'Temps réel dégradé'],
    ['missingEligibility', 'Configuration requise'],
  ] as const)('maps the %s operation fixture', (fixtureName, expectedLabel) => {
    expect(presentUrgentOperation(URGENT_OPERATION_FIXTURES[fixtureName]).statusLabel).toBe(
      expectedLabel,
    );
  });

  it('maps runtime freshness and eligibility reasons to explicit French guidance', () => {
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.staleLocation)).toMatchObject({
      availability: { status: 'confirmed', label: 'Disponible déclarée' },
      eligibility: { status: 'blocked', label: 'Non éligible' },
      reasonTone: 'critical',
      reasonIcon: 'location',
      operationalHealthLabel: 'Localisation obsolète',
      freshnessLabel: '8 min',
    });
    expect(
      presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.missingCabinetEligibility).reason,
    ).toContain('cabinet actif');
  });

  it('presents source metadata and truthful unavailable fallbacks without inventing values', () => {
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.availableHome)).toMatchObject({
      operationalHealthLabel: 'À jour',
      observation: {
        label: '10/10/2026 à 09:30 UTC',
        dateTime: '2026-10-10T09:30:00.000Z',
      },
      freshnessLabel: '38 s',
    });
    expect(presentUrgentRuntime(SAFE_URGENT_READINESS_FIXTURE.runtimeHome)).toMatchObject({
      observation: { label: 'Aucune observation', dateTime: null },
      freshnessLabel: 'Non disponible',
    });
  });

  it('uses only registered drawable icon names for every operation and runtime explanation', () => {
    for (const operation of Object.values(URGENT_OPERATION_FIXTURES)) {
      expect(isOcIconName(presentUrgentOperation(operation).icon)).toBe(true);
    }
    for (const runtime of Object.values(URGENT_RUNTIME_FIXTURES)) {
      expect(isOcIconName(presentUrgentRuntime(runtime).reasonIcon)).toBe(true);
    }
  });

  it('reserves critical red for genuine operational failures', () => {
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.missingHomeEligibility)).toMatchObject({
      eligibility: { status: 'requires-attention', label: 'Non éligible' },
      reasonTone: 'warning',
    });
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.missingCabinetEligibility)).toMatchObject({
      eligibility: { status: 'requires-attention', label: 'Non éligible' },
      reasonTone: 'warning',
    });
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.realtimeDegraded)).toMatchObject({
      eligibility: { status: 'pending', label: 'À confirmer' },
      reasonTone: 'critical',
    });
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.staleLocation)).toMatchObject({
      eligibility: { status: 'blocked', label: 'Non éligible' },
      reasonTone: 'critical',
    });
  });

  it('presents a missing-eligibility operation as configuration attention, not failure', () => {
    expect(presentUrgentOperation(URGENT_OPERATION_FIXTURES.missingEligibility)).toMatchObject({
      status: 'requires-attention',
      intent: 'warning',
      statusLabel: 'Configuration requise',
    });
  });

  it('uses contextual explanation tones without marking synthetic data as success', () => {
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.availableHome).reasonTone).toBe('success');
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.waitingReconnect).reasonTone).toBe(
      'warning',
    );
    expect(presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.unavailableCabinet).reasonTone).toBe(
      'information',
    );
  });

  it('never presents effective ineligibility as declared unavailability', () => {
    const presentation = presentUrgentRuntime(URGENT_RUNTIME_FIXTURES.missingHomeEligibility);

    expect(presentation.availability.label).toBe('Non renseignée');
    expect(presentation.eligibility.label).toBe('Non éligible');
  });

  it('keeps the future projection privacy-minimal', () => {
    const serialized = JSON.stringify(URGENT_OPERATION_FIXTURES.homeActive).toLowerCase();

    expect(serialized).not.toContain('patient');
    expect(serialized).not.toContain('phone');
    expect(serialized).not.toContain('address');
    expect(serialized).not.toContain('latitude');
    expect(serialized).not.toContain('longitude');
    expect(serialized).not.toContain('triage');
  });
});
