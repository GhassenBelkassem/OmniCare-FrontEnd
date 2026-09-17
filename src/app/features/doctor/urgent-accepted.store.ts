import { Injectable, signal, computed } from '@angular/core';
import { UrgentOfferDto } from './appointment-api.models';

const STORAGE_KEY = 'omnicare_accepted_offers';

@Injectable({ providedIn: 'root' })
export class UrgentAcceptedStore {
  private readonly _offers = signal<readonly UrgentOfferDto[]>(this.loadFromStorage());

  readonly offers = this._offers.asReadonly();
  readonly count = computed(() => this._offers().length);

  add(offer: UrgentOfferDto): void {
    this._offers.update((current) => {
      if (current.some((o) => o.offerId === offer.offerId)) return current;
      return [...current, { ...offer, status: 'ACCEPTED' as const }];
    });
    this.persist();
  }

  remove(offerId: string): void {
    this._offers.update((current) => current.filter((o) => o.offerId !== offerId));
    this.persist();
  }

  has(offerId: string): boolean {
    return this._offers().some((o) => o.offerId === offerId);
  }

  get(offerId: string): UrgentOfferDto | undefined {
    return this._offers().find((o) => o.offerId === offerId);
  }

  private loadFromStorage(): readonly UrgentOfferDto[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as UrgentOfferDto[];
      return parsed.filter((o) => o.status === 'ACCEPTED');
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      const accepted = this._offers().filter((o) => o.status === 'ACCEPTED');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accepted));
    } catch {
      // localStorage unavailable — ignore
    }
  }
}
