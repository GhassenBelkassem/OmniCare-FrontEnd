export interface MeProfessionalProfileResponse {
  readonly userId: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly displayName: string | null;
  readonly photoUrl: string | null;
  readonly professionalLicenseNumber: string | null;
  readonly specialty: string | null;
  readonly governorate: string | null;
  readonly affiliatedClinicId: string | null;
  readonly affiliatedClinicName: string | null;
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
  readonly revision: number;
}

/** Partial update of the editable fields. Omitted keys stay unchanged; empty arrays clear lists. */
export interface UpdateProfessionalProfileRequest {
  specialty?: string;
  consultationPriceTnd?: number;
  experienceYears?: number;
  acceptingNewPatients?: boolean;
  subSpecialties?: readonly string[];
  languages?: readonly string[];
  areasOfCare?: readonly string[];
  expertise?: readonly string[];
  visitReasons?: readonly string[];
  patientAgeGroups?: readonly string[];
  consultationTypes?: readonly string[];
  biography?: string;
  expectedRevision?: number;
}

export interface ProfessionalEducationResponse {
  readonly id: string;
  readonly institution: string;
  readonly qualification: string;
  readonly fieldOfStudy: string | null;
  readonly completionYear: number | null;
  readonly displayOrder: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProfessionalEducationRequest {
  readonly institution: string;
  readonly qualification: string;
  readonly fieldOfStudy: string | null;
  readonly completionYear: number | null;
  readonly displayOrder: number;
}

export interface UpdateProfessionalEducationRequest {
  readonly institution?: string;
  readonly qualification?: string;
  readonly fieldOfStudy?: string;
  readonly completionYear?: number;
  readonly displayOrder?: number;
  readonly expectedRevision: number;
}

export interface ProfessionalCertificationResponse {
  readonly id: string;
  readonly name: string;
  readonly issuer: string | null;
  readonly issuedYear: number | null;
  readonly expiryDate: string | null;
  readonly displayOrder: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProfessionalCertificationRequest {
  readonly name: string;
  readonly issuer: string | null;
  readonly issuedYear: number | null;
  readonly expiryDate: string | null;
  readonly displayOrder: number;
}

export interface UpdateProfessionalCertificationRequest {
  readonly name?: string;
  readonly issuer?: string;
  readonly issuedYear?: number;
  readonly expiryDate?: string;
  readonly displayOrder?: number;
  readonly expectedRevision: number;
}

export interface ApiProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly timestamp?: string;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}
