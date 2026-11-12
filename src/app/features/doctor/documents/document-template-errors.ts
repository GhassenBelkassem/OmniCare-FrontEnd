import { normalizeHttpError, type AppHttpError } from '../../../core/http/app-http-error';

export const DOCUMENT_TEMPLATE_GENERIC_ERROR =
  'L’opération sur le modèle n’a pas abouti. Réessayez dans un instant.';
export const DOCUMENT_TEMPLATE_NETWORK_ERROR =
  'Connexion impossible. Vérifiez votre connexion internet puis réessayez.';

/**
 * Error code (« Modèles de documents » API) → French. The server `detail` / `message` is never
 * shown: an unknown code gets the generic sentence (or the caller's context sentence).
 */
const CODE_MESSAGES: Readonly<Record<string, string>> = {
  TEMPLATE_NOT_FOUND: 'Ce modèle est introuvable. Il a peut-être été supprimé.',
  VERSION_NOT_FOUND: 'Cette version du modèle est introuvable. Actualisez la page.',
  PROFESSIONAL_PROFILE_NOT_FOUND:
    'Votre profil professionnel est incomplet. Complétez-le avant d’ajouter un modèle.',
  INVALID_PDF: 'Ce fichier n’est pas un PDF valide. Vérifiez le fichier puis réessayez.',
  INVALID_PAGE: 'Cette page n’existe pas dans le document.',
  INVALID_FIELD:
    'Certaines zones sont incomplètes ou mal placées. Vérifiez les champs obligatoires et leur position.',
  INVALID_DOCUMENT_TYPE: 'Ce type de document n’est pas encore pris en charge.',
  INVALID_TEMPLATE_STATE:
    'Cette action n’est pas possible pour ce modèle dans son état actuel. Actualisez la page.',
  RESOURCE_STATE_CONFLICT: 'Ce modèle a été modifié entre-temps. Actualisez la page puis réessayez.',
  VALIDATION_FAILED: 'Certaines informations sont incorrectes. Vérifiez-les puis réessayez.',
  PREVIEW_FAILED: 'L’aperçu de ce document n’a pas pu être généré.',
  OBJECT_STORAGE_UNAVAILABLE:
    'Le stockage des documents est momentanément indisponible. Réessayez dans un instant.',
  RATE_LIMITED: 'Trop d’envois en peu de temps. Patientez une minute puis réessayez.',
  TEMPLATE_INFECTED:
    'Ce fichier a été bloqué par le contrôle de sécurité. Utilisez un autre fichier PDF.',
  SCANNER_UNAVAILABLE:
    'Le contrôle de sécurité des fichiers est momentanément indisponible. Réessayez dans un instant.',
  PAGE_TOO_LARGE:
    'Une page de ce PDF est trop volumineuse pour être affichée. Utilisez un PDF plus léger.',
  FILE_TOO_LARGE: 'Ce fichier dépasse la taille maximale autorisée de 10 Mo.',
  TOO_MANY_PAGES: 'Le modèle ne peut pas dépasser 10 pages.',
  PAGE_ROTATED: 'Une page de ce PDF est pivotée. Enregistrez le PDF avec les pages à l’endroit, puis réessayez.',
  TOO_MANY_REQUESTS: 'Trop de demandes en peu de temps. Patientez quelques secondes.',
};

/** Every code the catalog knows (used by the specs). */
export const DOCUMENT_TEMPLATE_ERROR_CODES: readonly string[] = Object.keys(CODE_MESSAGES);

/**
 * French message for a documents-feature failure. Accepts the raw HTTP error, an already
 * normalized error, or a bare code. `fallback` replaces the generic sentence for unknown codes.
 */
export function documentTemplateErrorMessage(
  error: unknown,
  fallback: string = DOCUMENT_TEMPLATE_GENERIC_ERROR,
): string {
  if (error === null || error === undefined) return fallback;
  if (typeof error === 'string') return CODE_MESSAGES[error] ?? fallback;
  const normalized: Pick<AppHttpError, 'code' | 'status'> = isNormalized(error)
    ? error
    : normalizeHttpError(error);
  if (normalized.code !== null && CODE_MESSAGES[normalized.code] !== undefined) {
    return CODE_MESSAGES[normalized.code];
  }
  if (normalized.status === 0) return DOCUMENT_TEMPLATE_NETWORK_ERROR;
  if (normalized.status === 413) return CODE_MESSAGES['FILE_TOO_LARGE'];
  if (normalized.status === 429) return CODE_MESSAGES['TOO_MANY_REQUESTS'];
  return fallback;
}

function isNormalized(value: unknown): value is Pick<AppHttpError, 'code' | 'status'> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Error) &&
    'status' in value &&
    'code' in value &&
    typeof (value as { status: unknown }).status === 'number'
  );
}
