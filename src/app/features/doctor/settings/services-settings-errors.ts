import {
  isAuthenticationError,
  isNetworkError,
  isValidationError,
  problemCode,
} from './professional-profile-errors';

export type ServicesSettingsDomain =
  'capabilities' | 'mobile-equipment' | 'cabinet-equipment' | 'coverage' | 'cabinets';

export interface ServicesSettingsFailure {
  readonly message: string;
  readonly authentication: boolean;
  readonly conflict: boolean;
}

export function mapServicesSettingsFailure(
  error: unknown,
  domain: ServicesSettingsDomain,
  operation: 'load' | 'save',
): ServicesSettingsFailure {
  if (isAuthenticationError(error)) {
    return {
      message: 'Votre session n’est plus valide. Reconnectez-vous pour continuer.',
      authentication: true,
      conflict: false,
    };
  }
  if (isNetworkError(error)) {
    return {
      message:
        operation === 'load'
          ? 'Connexion impossible. Vérifiez votre réseau puis réessayez.'
          : 'Connexion impossible. Vos modifications sont conservées.',
      authentication: false,
      conflict: false,
    };
  }

  const code = problemCode(error);
  if (code === 'RESOURCE_STATE_CONFLICT' || code === 'COVERAGE_CONFIGURATION_CONFLICT') {
    return {
      message:
        domain === 'coverage'
          ? 'La couverture de ce cabinet a été modifiée ailleurs. Vos choix sont conservés.'
          : 'Cette configuration a été modifiée ailleurs. Vos choix sont conservés.',
      authentication: false,
      conflict: true,
    };
  }
  if (code === 'CARE_CAPABILITY_REQUIRES_ACTIVE_CABINET') {
    return failure('Ajoutez d’abord un cabinet actif pour proposer ce mode de prise en charge.');
  }
  if (code === 'CARE_CAPABILITY_CONFLICT') {
    return failure('Cette combinaison de modes de prise en charge ne peut pas être enregistrée.');
  }
  if (code === 'PROFESSIONAL_PROFILE_NOT_FOUND') {
    return failure('Votre profil professionnel est introuvable. Contactez l’assistance OmniCare.');
  }
  if (code === 'EQUIPMENT_NOT_FOUND') {
    return refreshFailure('Un matériel sélectionné n’est plus disponible. Rechargez le catalogue.');
  }
  if (code === 'EQUIPMENT_NOT_PORTABLE') {
    return refreshFailure(
      'Seul le matériel indiqué comme portable peut être ajouté au matériel mobile.',
    );
  }
  if (code === 'PRACTICE_LOCATION_NOT_FOUND') {
    return {
      message: 'Ce cabinet n’existe plus ou n’est plus accessible. Rechargez vos cabinets.',
      authentication: false,
      conflict: true,
    };
  }
  if (isValidationError(error)) {
    return failure('La configuration envoyée est invalide. Vérifiez vos choix puis réessayez.');
  }

  return failure(
    operation === 'load'
      ? loadFallback(domain)
      : 'Impossible d’enregistrer cette configuration. Vos modifications sont conservées.',
  );
}

function failure(message: string): ServicesSettingsFailure {
  return { message, authentication: false, conflict: false };
}

function refreshFailure(message: string): ServicesSettingsFailure {
  return { message, authentication: false, conflict: true };
}

function loadFallback(domain: ServicesSettingsDomain): string {
  switch (domain) {
    case 'capabilities':
      return 'Impossible de charger vos modes de prise en charge.';
    case 'mobile-equipment':
      return 'Impossible de charger le catalogue et votre matériel mobile.';
    case 'cabinet-equipment':
      return 'Impossible de charger le matériel de ce cabinet.';
    case 'coverage':
      return 'Impossible de charger la couverture de ce cabinet.';
    case 'cabinets':
      return 'Impossible de charger vos cabinets.';
  }
}
