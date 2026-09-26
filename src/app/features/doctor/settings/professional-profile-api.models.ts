export interface MeProfessionalProfileResponse {
  readonly userId: string;
  readonly professionalLicenseNumber: string | null;
  readonly specialty: string | null;
  readonly governorate: string | null;
  readonly affiliatedClinicId: string | null;
  readonly alsoIndependent: boolean | null;
  readonly verifiedAt: string | null;
  readonly mfaMethod: string | null;
  readonly consultationPriceTnd?: number | null;
  readonly experienceYears?: number | null;
  readonly practiceLatitude?: number | null;
  readonly practiceLongitude?: number | null;
  readonly practiceCity?: string | null;
  readonly acceptingNewPatients?: boolean;
  readonly subSpecialties?: readonly string[] | null;
  readonly languages?: readonly string[] | null;
  readonly areasOfCare?: readonly string[] | null;
  readonly expertise?: readonly string[] | null;
  readonly visitReasons?: readonly string[] | null;
  readonly patientAgeGroups?: readonly string[] | null;
  readonly consultationTypes?: readonly string[] | null;
  readonly biography?: string | null;
  readonly updatedAt?: string | null;
}

/** Partial update of the editable fields. Omitted keys stay unchanged; empty arrays clear lists. */
export interface UpdateProfessionalProfileRequest {
  specialty?: string;
  consultationPriceTnd?: number;
  experienceYears?: number;
  practiceLatitude?: number;
  practiceLongitude?: number;
  practiceCity?: string;
  acceptingNewPatients?: boolean;
  subSpecialties?: readonly string[];
  languages?: readonly string[];
  areasOfCare?: readonly string[];
  expertise?: readonly string[];
  visitReasons?: readonly string[];
  patientAgeGroups?: readonly string[];
  consultationTypes?: readonly string[];
  biography?: string;
}