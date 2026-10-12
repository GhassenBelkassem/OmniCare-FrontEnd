import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { mapServicesSettingsFailure } from './services-settings-errors';

describe('mapServicesSettingsFailure', () => {
  it('maps authorization and network failures without exposing backend details', () => {
    expect(mapServicesSettingsFailure(response(403), 'capabilities', 'load').authentication).toBe(
      true,
    );
    expect(mapServicesSettingsFailure(response(0), 'coverage', 'save').message).toContain(
      'modifications sont conservées',
    );
  });

  it.each([
    ['CARE_CAPABILITY_REQUIRES_ACTIVE_CABINET', 'cabinet actif'],
    ['PROFESSIONAL_PROFILE_NOT_FOUND', 'profil professionnel'],
    ['EQUIPMENT_NOT_FOUND', 'matériel sélectionné'],
    ['EQUIPMENT_NOT_PORTABLE', 'matériel indiqué comme portable'],
    ['PRACTICE_LOCATION_NOT_FOUND', 'cabinet n’existe plus'],
    ['VALIDATION_FAILED', 'configuration envoyée est invalide'],
  ])('maps %s to actionable French', (code, expected) => {
    const result = mapServicesSettingsFailure(
      response(code === 'VALIDATION_FAILED' ? 400 : 409, { code, detail: 'internal detail' }),
      'mobile-equipment',
      'save',
    );
    expect(result.message).toContain(expected);
    expect(result.message).not.toContain('internal detail');
  });

  it('treats both revision vocabularies as explicit conflicts', () => {
    expect(
      mapServicesSettingsFailure(
        response(409, { code: 'RESOURCE_STATE_CONFLICT' }),
        'cabinet-equipment',
        'save',
      ).conflict,
    ).toBe(true);
    expect(
      mapServicesSettingsFailure(
        response(409, { code: 'COVERAGE_CONFIGURATION_CONFLICT' }),
        'coverage',
        'save',
      ).conflict,
    ).toBe(true);
  });

  it('offers a catalog refresh when equipment definitions changed', () => {
    expect(
      mapServicesSettingsFailure(
        response(409, { code: 'EQUIPMENT_NOT_PORTABLE' }),
        'mobile-equipment',
        'save',
      ).conflict,
    ).toBe(true);
  });
});

function response(status: number, error: object = {}): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}
