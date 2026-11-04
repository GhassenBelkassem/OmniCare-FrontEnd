export type ClinicalOrderCategory = 'LAB' | 'IMAGING' | 'REFERRAL';
export type ClinicalOrderStatus = 'DRAFT' | 'FINALIZED';

export interface ClinicalOrderDefinition {
  readonly requestedExamination: string | null;
  readonly requestedStudy: string | null;
  readonly targetSpecialty: string | null;
}

export interface ClinicalOrder {
  readonly clinicalOrderId: string;
  readonly consultationId: string;
  readonly category: ClinicalOrderCategory;
  readonly status: ClinicalOrderStatus;
  readonly clinicalOrderVersion: number;
  readonly schemaVersion: number;
  readonly definition: ClinicalOrderDefinition;
}

export interface ClinicalOrderListResponse { readonly orders: readonly ClinicalOrder[]; }

export const EMPTY_ORDER_DEFINITION: ClinicalOrderDefinition = {
  requestedExamination: null,
  requestedStudy: null,
  targetSpecialty: null,
};

export function orderLabel(order: Pick<ClinicalOrder, 'category' | 'definition'>): string {
  switch (order.category) {
    case 'LAB': return order.definition.requestedExamination ?? '';
    case 'IMAGING': return order.definition.requestedStudy ?? '';
    case 'REFERRAL': return order.definition.targetSpecialty ?? '';
  }
}
