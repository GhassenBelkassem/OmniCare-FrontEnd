import {
  ReplaceUrgentCareConfigurationRequest,
  UrgentCareConfigurationResponse,
} from './urgent-care-configuration-api.models';

/** Quotes JSON number tokens before JSON.parse so decimal lexemes never pass through IEEE-754. */
export function parseUrgentConfigurationJson(source: string): UrgentCareConfigurationResponse {
  const value: unknown = JSON.parse(quoteJsonNumbers(source));
  if (!isRecord(value) || !isRecord(value['home']) || !isRecord(value['cabinet'])) {
    throw new Error('Invalid urgent configuration response');
  }
  const revision = parseRevision(value['revision']);
  const homeFee = nullableDecimal(value['home']['consultationFeeTnd']);
  const homeDistance = nullableDecimal(value['home']['maxTravelKm']);
  const cabinetFee = nullableDecimal(value['cabinet']['consultationFeeTnd']);
  return {
    revision,
    home: {
      consultationFeeTnd: homeFee,
      feeConfigured: booleanValue(value['home']['feeConfigured']),
      maxTravelKm: homeDistance,
      maxTravelDistanceConfigured: booleanValue(value['home']['maxTravelDistanceConfigured']),
    },
    cabinet: {
      consultationFeeTnd: cabinetFee,
      feeConfigured: booleanValue(value['cabinet']['feeConfigured']),
    },
  };
}

export function serializeUrgentConfigurationRequest(
  request: ReplaceUrgentCareConfigurationRequest,
): string {
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new Error('Invalid urgent configuration revision');
  }
  return `{"expectedRevision":${request.expectedRevision},"homeFeeTnd":${decimalOrNull(request.homeFeeTnd)},"cabinetFeeTnd":${decimalOrNull(request.cabinetFeeTnd)},"maxHomeTravelKm":${decimalOrNull(request.maxHomeTravelKm)}}`;
}

function quoteJsonNumbers(source: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === '-' || (character >= '0' && character <= '9')) {
      const match = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (!match) throw new Error('Invalid JSON number');
      result += `"${match[0]}"`;
      index += match[0].length - 1;
      continue;
    }
    result += character;
  }
  return result;
}

function parseRevision(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Invalid revision');
  const revision = Number(value);
  if (!Number.isSafeInteger(revision)) throw new Error('Unsafe revision');
  return revision;
}

function nullableDecimal(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new Error('Invalid decimal');
  }
  return value;
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid boolean');
  return value;
}

function decimalOrNull(value: string | null): string {
  if (value === null) return 'null';
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Invalid decimal request');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
