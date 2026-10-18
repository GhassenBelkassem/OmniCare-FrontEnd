import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge } from '../../shared/ui';
import { AdminPatient, PatientPage } from './admin-api.models';
import { AdminApiService } from './admin-api.service';
import { apiMessage, roleLabel, statusTone } from './admin-page-utils';

/**
 * Read-only list of patient accounts.
 *
 * There is no create, edit or per-row action here, and that is a deliberate absence rather
 * than an unfinished screen: patients sign themselves up, so an admin console has no
 * provisioning step to own, and the endpoint deliberately exposes no per-patient route.
 * Adding an action would need a backend write path that does not exist.
 */
@Component({
  selector: 'app-patients-page',
  imports: [DatePipe, ReactiveFormsModule, OcButton, OcDataTableShell, OcEmptyState, OcPageHeader, OcStatusBadge],
  templateUrl: './patients-page.html',
  styleUrl: './admin-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientsPage {
  private readonly api = inject(AdminApiService);

  readonly page = signal<PatientPage | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  readonly statusTone = statusTone;
  readonly roleLabel = roleLabel;

  /** Zero-based, as the API expects. */
  readonly currentPage = computed(() => this.page()?.page ?? 0);
  readonly canGoBack = computed(() => this.currentPage() > 0);
  readonly canGoForward = computed(() =>
    this.page() ? this.currentPage() < this.page()!.totalPages - 1 : false,
  );
  readonly hasSearch = computed(() => this.search.value.trim() !== '');
  readonly resultSummary = computed(() => {
    const result = this.page();
    if (!result) return '';
    return `${result.totalElements} ${result.totalElements === 1 ? 'patient' : 'patients'}`;
  });

  constructor() {
    this.load();
  }

  /**
   * Always reads page 0 unless one is requested explicitly: a new search term must not
   * strand the admin on page 4 of a result set that no longer exists.
   */
  load(page = 0): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.listPatients(this.search.value, page).subscribe({
      next: (result) => {
        this.page.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(apiMessage(error));
        this.loading.set(false);
      },
    });
  }

  applySearch(): void {
    this.load();
  }

  clearSearch(): void {
    this.search.setValue('');
    this.load();
  }

  previousPage(): void {
    if (this.canGoBack()) this.load(this.currentPage() - 1);
  }

  nextPage(): void {
    if (this.canGoForward()) this.load(this.currentPage() + 1);
  }

  /**
   * A patient may have signed up without giving a name, so the fallback is the identifier
   * the admin can actually act on. An em dash would leave two nameless patients
   * indistinguishable in the list.
   */
  displayName(item: AdminPatient): string {
    const name = `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
    return name || item.email || item.phone || '—';
  }

  tableState(): 'loading' | 'empty' | 'error' | 'default' {
    if (this.loading()) return 'loading';
    if (this.errorMessage() && !this.page()) return 'error';
    return this.page()?.items.length ? 'default' : 'empty';
  }

  trackPatient(_index: number, item: AdminPatient): string {
    return item.userId;
  }
}