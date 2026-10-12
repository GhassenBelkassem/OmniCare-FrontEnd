import {
  UrgentObservationPresentation,
  UrgentOperationPresentation,
  UrgentOperationReadProjectionDto,
  UrgentRuntimeEligibilityDto,
  UrgentRuntimePresentation,
} from './urgent-readiness.models';

export function presentUrgentOperation(
  operation: UrgentOperationReadProjectionDto,
): UrgentOperationPresentation {
  const metadata = {
    observation: presentObservation(operation.lastSynchronizedAt),
    freshnessLabel: presentFreshness(operation.freshnessSeconds),
  };
  switch (operation.state) {
    case 'NONE':
      return {
        status: 'draft',
        statusLabel: 'Aucune opération',
        title: 'Aucune prise en charge urgente active',
        description:
          'Cette vue est strictement informative. Les opérations urgentes restent pilotées depuis l’application mobile Doctor.',
        icon: 'info',
        intent: 'neutral',
        showRetry: false,
        ...metadata,
      };
    case 'HOME_ACTIVE':
      return {
        status: 'confirmed',
        statusLabel: 'À domicile · active',
        title: 'Engagement urgent à domicile en cours',
        description:
          'Le contrôle opérationnel, la navigation et la publication de position restent dans l’application mobile Doctor.',
        icon: 'home',
        intent: 'information',
        showRetry: false,
        ...metadata,
      };
    case 'CABINET_ACTIVE':
      return {
        status: 'confirmed',
        statusLabel: 'Au cabinet · active',
        title: 'Engagement urgent au cabinet en cours',
        description:
          'Cette projection ne permet aucune acceptation, arrivée, clôture ou transmission clinique.',
        icon: 'building',
        intent: 'success',
        showRetry: false,
        ...metadata,
      };
    case 'WAITING_RECONNECT':
      return {
        status: 'pending',
        statusLabel: 'Reconnexion',
        title: 'Synchronisation de l’opération en attente',
        description:
          'Les dernières informations restent affichées avec leur fraîcheur. La reprise devra confirmer l’état auprès du serveur.',
        icon: 'refresh',
        intent: 'warning',
        showRetry: false,
        ...metadata,
      };
    case 'STALE_LOCATION':
      return {
        status: 'blocked',
        statusLabel: 'Position ancienne',
        title: 'Fraîcheur de localisation insuffisante',
        description:
          'La projection signale une position périmée sans afficher de coordonnées. La correction reste une action mobile.',
        icon: 'location',
        intent: 'critical',
        showRetry: false,
        ...metadata,
      };
    case 'REALTIME_DEGRADED':
      return {
        status: 'blocked',
        statusLabel: 'Temps réel dégradé',
        title: 'Mises à jour en direct indisponibles',
        description:
          'L’état peut être ancien. Le serveur demeure l’autorité et une resynchronisation REST est requise avant toute décision.',
        icon: 'warning',
        intent: 'critical',
        showRetry: true,
        ...metadata,
      };
    case 'MISSING_ELIGIBILITY':
      return {
        status: 'requires-attention',
        statusLabel: 'Configuration requise',
        title: 'Configuration urgente incomplète',
        description:
          'Une capacité permanente ou une condition opérationnelle requise n’est pas satisfaite.',
        icon: 'warning',
        intent: 'warning',
        showRetry: false,
        ...metadata,
      };
  }
}

export function presentUrgentRuntime(
  runtime: UrgentRuntimeEligibilityDto,
): UrgentRuntimePresentation {
  const reason = presentRuntimeReason(runtime);
  return {
    availability: presentDeclaredAvailability(runtime.declaredAvailability),
    eligibility: presentEffectiveEligibility(runtime),
    reason: reason.description,
    reasonTone: reason.tone,
    reasonIcon: reason.icon,
    operationalHealthLabel: presentOperationalHealth(runtime.operationalHealth),
    observation: presentObservation(runtime.updatedAt),
    freshnessLabel: presentFreshness(runtime.locationFreshnessSeconds),
  };
}

export function presentObservation(value: string | null): UrgentObservationPresentation {
  if (!value?.trim()) return { label: 'Aucune observation', dateTime: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { label: 'Non disponible', dateTime: null };
  const date = [
    pad(parsed.getUTCDate()),
    pad(parsed.getUTCMonth() + 1),
    parsed.getUTCFullYear(),
  ].join('/');
  const time = `${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
  return { label: `${date} à ${time} UTC`, dateTime: value };
}

export function presentFreshness(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return 'Non disponible';
  if (seconds < 60) return seconds < 1 ? 'À l’instant' : `${Math.floor(seconds)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} h`;
}

function presentOperationalHealth(value: UrgentRuntimeEligibilityDto['operationalHealth']): string {
  switch (value) {
    case 'CURRENT':
      return 'À jour';
    case 'NOT_CONNECTED':
      return 'Non raccordé';
    case 'WAITING_RECONNECT':
      return 'Reconnexion en cours';
    case 'STALE_LOCATION':
      return 'Localisation obsolète';
    case 'REALTIME_DEGRADED':
      return 'Temps réel dégradé';
  }
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function presentDeclaredAvailability(
  value: UrgentRuntimeEligibilityDto['declaredAvailability'],
): UrgentRuntimePresentation['availability'] {
  switch (value) {
    case 'AVAILABLE':
      return { status: 'confirmed', label: 'Disponible déclarée' };
    case 'UNAVAILABLE':
      return { status: 'draft', label: 'Indisponible déclarée' };
    case 'UNKNOWN':
      return { status: 'pending', label: 'Non renseignée' };
  }
}

function presentEffectiveEligibility(
  runtime: UrgentRuntimeEligibilityDto,
): UrgentRuntimePresentation['eligibility'] {
  switch (runtime.effectiveEligibility) {
    case 'ELIGIBLE':
      return { status: 'confirmed', label: 'Éligible au matching' };
    case 'INELIGIBLE':
      return {
        status: isConfigurationReason(runtime.reasonCode) ? 'requires-attention' : 'blocked',
        label: 'Non éligible',
      };
    case 'UNKNOWN':
      return { status: 'pending', label: 'À confirmer' };
  }
}

export function runtimeReason(reasonCode: string | null): string {
  switch (reasonCode) {
    case 'CAPABILITY_DISABLED':
      return 'La capacité permanente correspondante n’est pas activée dans les paramètres.';
    case 'ACTIVE_PRACTICE_LOCATION_REQUIRED':
      return 'Un cabinet actif est requis avant de pouvoir être éligible aux urgences au cabinet.';
    case 'LOCATION_STALE':
      return 'La dernière localisation opérationnelle est trop ancienne pour confirmer l’éligibilité.';
    case 'REALTIME_RECONNECTING':
      return 'La connexion temps réel se rétablit. L’état affiché peut ne plus être à jour.';
    case 'REALTIME_OFFLINE':
      return 'Les mises à jour temps réel sont indisponibles. Le serveur devra être resynchronisé.';
    case 'RUNTIME_PROJECTION_NOT_CONNECTED':
      return 'La disponibilité déclarée et l’éligibilité effective ne sont pas raccordées dans cette prévisualisation statique.';
    default:
      return 'La disponibilité opérationnelle est actuellement désactivée.';
  }
}

function presentRuntimeReason(runtime: UrgentRuntimeEligibilityDto): {
  readonly description: string;
  readonly tone: UrgentRuntimePresentation['reasonTone'];
  readonly icon: UrgentRuntimePresentation['reasonIcon'];
} {
  switch (runtime.reasonCode) {
    case 'CAPABILITY_DISABLED':
      return { description: runtimeReason(runtime.reasonCode), tone: 'warning', icon: 'warning' };
    case 'ACTIVE_PRACTICE_LOCATION_REQUIRED':
      return { description: runtimeReason(runtime.reasonCode), tone: 'warning', icon: 'building' };
    case 'LOCATION_STALE':
      return { description: runtimeReason(runtime.reasonCode), tone: 'critical', icon: 'location' };
    case 'REALTIME_RECONNECTING':
      return { description: runtimeReason(runtime.reasonCode), tone: 'warning', icon: 'refresh' };
    case 'REALTIME_OFFLINE':
      return { description: runtimeReason(runtime.reasonCode), tone: 'critical', icon: 'warning' };
    case 'RUNTIME_PROJECTION_NOT_CONNECTED':
      return {
        description: runtimeReason(runtime.reasonCode),
        tone: 'information',
        icon: 'info',
      };
    default:
      if (runtime.effectiveEligibility === 'ELIGIBLE') {
        return {
          description: 'Les conditions connues permettent actuellement le matching urgent.',
          tone: 'success',
          icon: 'coverage',
        };
      }
      if (runtime.declaredAvailability === 'UNAVAILABLE') {
        return {
          description: 'Le médecin a déclaré ce mode indisponible pour le moment.',
          tone: 'neutral',
          icon: 'info',
        };
      }
      return {
        description: runtimeReason(runtime.reasonCode),
        tone: 'neutral',
        icon: 'info',
      };
  }
}

function isConfigurationReason(reasonCode: string | null): boolean {
  return reasonCode === 'CAPABILITY_DISABLED' || reasonCode === 'ACTIVE_PRACTICE_LOCATION_REQUIRED';
}
