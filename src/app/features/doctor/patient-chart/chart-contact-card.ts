import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { FormsModule } from '@angular/forms';

import { normalizeHttpError } from '../../../core/http/app-http-error';
import { OcButton, OcConfirmDialog, OcDateField, isRecentBirthDate, patientAgeLabel } from '../../../shared/ui';
import type { PatientChartDto, PatientChartIdentityDto, PatientContactUpdateRequest } from './patient-chart-api.models';
import { PatientChartApiService, newChartIdempotencyKey } from './patient-chart-api.service';
import { chartShortDate } from './patient-chart-format';

export type ContactField = 'phone' | 'email' | 'address' | 'practiceIdentifier' | 'dateOfBirth' | 'approximateAgeYears';

export interface ContactForm {
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly practiceIdentifier: string;
  readonly approximate: boolean;
  readonly dateOfBirth: string | null;
  readonly approximateAgeYears: string;
}

export const CONTACT_LIMITS = { phone: 32, email: 255, address: 2000, practiceIdentifier: 128 } as const;

const MESSAGES = {
  phone: 'Numéro de téléphone invalide (ex. +216 20 123 456).',
  email: 'Adresse e-mail invalide.',
  address: `Adresse trop longue (${CONTACT_LIMITS.address} caractères maximum).`,
  practiceIdentifier: `Identifiant trop long (${CONTACT_LIMITS.practiceIdentifier} caractères maximum).`,
  birthRequired: 'Indiquez la date de naissance ou un âge approximatif.',
  birthFuture: 'La date de naissance ne peut pas être dans le futur.',
  age: 'Âge entre 0 et 130 ans.',
} as const;

/** Same rule as the server (`PhoneNumberNormalizer`): a Tunisian number, stored as +216XXXXXXXX. */
export function normalizePhone(value: string): string | null {
  let digits = value.trim().replace(/[\s().-]/g, '');
  if (/^[0-9]{8}$/.test(digits)) digits = `+216${digits}`;
  else if (/^216[0-9]{8}$/.test(digits)) digits = `+${digits}`;
  else if (digits.startsWith('00216')) digits = `+216${digits.slice(5)}`;
  return /^\+216[0-9]{8}$/.test(digits) ? digits : null;
}

export function contactFormFrom(identity: PatientChartIdentityDto): ContactForm {
  const approximate = identity.dateOfBirth === null && identity.ageYears !== null;
  return {
    phone: identity.phone ?? '',
    email: identity.email ?? '',
    address: identity.address ?? '',
    practiceIdentifier: identity.practiceIdentifier ?? '',
    approximate,
    dateOfBirth: identity.dateOfBirth,
    approximateAgeYears: approximate && identity.ageYears !== null ? String(identity.ageYears) : '',
  };
}

/** Client rules (the server applies the same ones): field → French message. */
export function validateContact(form: ContactForm, today: string): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {};
  const phone = form.phone.trim();
  if (phone !== '' && (phone.length > CONTACT_LIMITS.phone || normalizePhone(phone) === null)) errors.phone = MESSAGES.phone;
  const email = form.email.trim();
  if (email !== '' && (email.length > CONTACT_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.email = MESSAGES.email;
  if (form.address.trim().length > CONTACT_LIMITS.address) errors.address = MESSAGES.address;
  if (form.practiceIdentifier.trim().length > CONTACT_LIMITS.practiceIdentifier) errors.practiceIdentifier = MESSAGES.practiceIdentifier;
  if (form.approximate) {
    const age = form.approximateAgeYears.trim();
    if (age === '') errors.approximateAgeYears = MESSAGES.birthRequired;
    else if (!/^\d{1,3}$/.test(age) || Number(age) > 130) errors.approximateAgeYears = MESSAGES.age;
  } else if (form.dateOfBirth === null || form.dateOfBirth === '') {
    errors.dateOfBirth = MESSAGES.birthRequired;
  } else if (form.dateOfBirth > today) {
    errors.dateOfBirth = MESSAGES.birthFuture;
  }
  return errors;
}

const blank = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Only the changed fields (a present field changes, `null` clears it). Null when nothing changed. */
export function contactChanges(initial: ContactForm, form: ContactForm, expectedVersion: number): PatientContactUpdateRequest | null {
  const changes: { -readonly [K in keyof PatientContactUpdateRequest]?: PatientContactUpdateRequest[K] } = {};
  const phone = blank(form.phone);
  const normalizedPhone = phone === null ? null : normalizePhone(phone) ?? phone;
  if (normalizedPhone !== (blank(initial.phone) === null ? null : normalizePhone(initial.phone) ?? blank(initial.phone))) changes.phone = normalizedPhone;
  if (blank(form.email) !== blank(initial.email)) changes.email = blank(form.email);
  if (blank(form.address) !== blank(initial.address)) changes.address = blank(form.address);
  if (blank(form.practiceIdentifier) !== blank(initial.practiceIdentifier)) changes.practiceIdentifier = blank(form.practiceIdentifier);
  if (form.approximate) {
    if (!initial.approximate || form.approximateAgeYears.trim() !== initial.approximateAgeYears.trim()) {
      changes.approximateAgeYears = Number(form.approximateAgeYears.trim());
    }
  } else if (initial.approximate || form.dateOfBirth !== initial.dateOfBirth) {
    if (form.dateOfBirth) changes.dateOfBirth = form.dateOfBirth;
  }
  return Object.keys(changes).length === 0 ? null : { ...changes, expectedVersion };
}

/** Server field path (`contact.phone`) → the French message of this card. */
function serverFieldMessage(field: ContactField, code: string | undefined): string {
  switch (field) {
    case 'phone': return MESSAGES.phone;
    case 'email': return MESSAGES.email;
    case 'address': return MESSAGES.address;
    case 'practiceIdentifier': return MESSAGES.practiceIdentifier;
    case 'approximateAgeYears': return MESSAGES.age;
    case 'dateOfBirth': return code === 'INVALID_DATE' ? MESSAGES.birthFuture : MESSAGES.birthRequired;
  }
}

function todayInTunis(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * « Coordonnées » (patient page only): phone, e-mail, address, practice identifier and date of
 * birth / approximate age. Editable inline for the owner of an external patient; read-only for an
 * OmniCare patient (they manage their own details). An error shows once its field is left, or on
 * « Enregistrer »; a fixed field clears its error at once.
 */
@Component({
  selector: 'app-chart-contact-card',
  imports: [FormsModule, NzIconModule, NzInputModule, NzSwitchModule, OcButton, OcConfirmDialog, OcDateField],
  template: `
    <section class="r-card k-card" aria-labelledby="contact-title" data-testid="contact-card">
      <div class="r-heading">
        <span class="r-tile r-tile--care" aria-hidden="true"><nz-icon nzType="idcard" /></span>
        <div class="r-heading__text">
          <h3 id="contact-title">Coordonnées</h3>
          @if (!editable()) { <p>Le patient gère ces informations depuis son application.</p> }
        </div>
        @if (editable() && !editing()) {
          <oc-button size="small" variant="outline" leadingIcon="edit" data-testid="contact-edit" (click)="startEdit()">Modifier</oc-button>
        }
      </div>

      @if (conflict()) {
        <div class="k-alert" role="alert">
          <span>Ces informations ont été modifiées ailleurs.</span>
          <oc-button size="small" variant="outline" (click)="confirmReload.set(true)">Recharger</oc-button>
        </div>
      }

      @if (!editing()) {
        <dl class="k-list">
          <div><dt class="r-label">Téléphone</dt><dd>
            @if (identity().phone; as phone) { <a [href]="'tel:' + phone">{{ phone }}</a> } @else { <span class="r-secondary">Non renseigné</span> }
          </dd></div>
          <div><dt class="r-label">E-mail</dt><dd>
            @if (identity().email; as email) { <a [href]="'mailto:' + email">{{ email }}</a> } @else { <span class="r-secondary">Non renseigné</span> }
          </dd></div>
          <div><dt class="r-label">Adresse</dt><dd>
            @if (identity().address; as address) { <span class="k-multiline">{{ address }}</span> } @else { <span class="r-secondary">Non renseigné</span> }
          </dd></div>
          <div><dt class="r-label">Identifiant de pratique</dt><dd>
            @if (identity().practiceIdentifier; as identifier) { {{ identifier }} } @else { <span class="r-secondary">Non renseigné</span> }
          </dd></div>
          <div><dt class="r-label">{{ identity().dateOfBirth ? 'Date de naissance' : 'Âge' }}</dt><dd>{{ birthLine() }}</dd></div>
        </dl>
        @if (saved()) { <p class="k-saved" role="status">Enregistré</p> }
        @if (duplicate()) { <p class="r-secondary" role="status">Un autre patient de votre patientèle a des coordonnées proches.</p> }
      } @else {
        <form class="k-form" (ngSubmit)="save()" novalidate>
          <div class="k-field">
            <label class="r-label" for="contact-phone">Téléphone</label>
            <input nz-input id="contact-phone" name="phone" type="tel" autocomplete="tel" placeholder="+216 20 123 456"
              [ngModel]="form().phone" (ngModelChange)="patch({ phone: $event })" (blur)="touch('phone')"
              [nzStatus]="error('phone') ? 'error' : ''" [attr.aria-invalid]="error('phone') ? 'true' : null"
              [attr.aria-describedby]="error('phone') ? 'contact-phone-error' : null" />
            @if (error('phone'); as message) { <p class="k-error" id="contact-phone-error" role="alert">{{ message }}</p> }
          </div>
          <div class="k-field">
            <label class="r-label" for="contact-email">E-mail</label>
            <input nz-input id="contact-email" name="email" type="email" autocomplete="email"
              [ngModel]="form().email" (ngModelChange)="patch({ email: $event })" (blur)="touch('email')"
              [nzStatus]="error('email') ? 'error' : ''" [attr.aria-invalid]="error('email') ? 'true' : null" />
            @if (error('email'); as message) { <p class="k-error" role="alert">{{ message }}</p> }
          </div>
          <div class="k-field k-field--wide">
            <label class="r-label" for="contact-address">Adresse</label>
            <textarea nz-input id="contact-address" name="address" rows="2" autocomplete="street-address"
              [ngModel]="form().address" (ngModelChange)="patch({ address: $event })" (blur)="touch('address')"
              [nzStatus]="error('address') ? 'error' : ''" [attr.aria-invalid]="error('address') ? 'true' : null"></textarea>
            @if (error('address'); as message) { <p class="k-error" role="alert">{{ message }}</p> }
          </div>
          <div class="k-field">
            <label class="r-label" for="contact-identifier">Identifiant de pratique</label>
            <input nz-input id="contact-identifier" name="practiceIdentifier" autocomplete="off"
              [ngModel]="form().practiceIdentifier" (ngModelChange)="patch({ practiceIdentifier: $event })" (blur)="touch('practiceIdentifier')"
              [nzStatus]="error('practiceIdentifier') ? 'error' : ''" [attr.aria-invalid]="error('practiceIdentifier') ? 'true' : null" />
            @if (error('practiceIdentifier'); as message) { <p class="k-error" role="alert">{{ message }}</p> }
          </div>
          <div class="k-field">
            @if (form().approximate) {
              <label class="r-label" for="contact-age">Âge approximatif (ans)</label>
              <input nz-input id="contact-age" name="approximateAgeYears" type="number" min="0" max="130" inputmode="numeric"
                [ngModel]="form().approximateAgeYears" (ngModelChange)="patch({ approximateAgeYears: ageText($event) })" (blur)="touch('approximateAgeYears')"
                [nzStatus]="error('approximateAgeYears') ? 'error' : ''" [attr.aria-invalid]="error('approximateAgeYears') ? 'true' : null" />
              @if (error('approximateAgeYears'); as message) { <p class="k-error" role="alert">{{ message }}</p> }
            } @else {
              <label class="r-label" for="contact-dob">Date de naissance</label>
              <div (focusout)="touch('dateOfBirth')">
                <oc-date-field controlId="contact-dob" ariaLabel="Date de naissance" [value]="form().dateOfBirth" [max]="today"
                  [invalid]="!!error('dateOfBirth')" (valueChange)="setBirthDate($event)" />
              </div>
              @if (error('dateOfBirth'); as message) {
                <p class="k-error" role="alert">{{ message }}</p>
              } @else if (recentBirth()) {
                <p class="k-warning" role="status" data-testid="contact-recent-birth">Date de naissance récente — vérifiez la saisie</p>
              }
            }
            <label class="k-switch">
              <nz-switch nzSize="small" name="approximate" [ngModel]="form().approximate" (ngModelChange)="patch({ approximate: $event })" />
              <span>Âge approximatif</span>
            </label>
          </div>
          @if (actionError(); as message) { <p class="k-error" role="alert">{{ message }}</p> }
          <div class="k-actions">
            <oc-button variant="ghost" [disabled]="saving()" (click)="cancelEdit()">Annuler</oc-button>
            <oc-button variant="primary" type="submit" [loading]="saving()">Enregistrer</oc-button>
          </div>
        </form>
      }
    </section>

    <oc-confirm-dialog
      [open]="confirmReload()"
      title="Recharger les coordonnées ?"
      message="Les informations enregistrées ailleurs remplaceront vos modifications non enregistrées."
      confirmLabel="Recharger"
      cancelLabel="Annuler"
      (confirm)="reload()"
      (cancelled)="confirmReload.set(false)"
    />
  `,
  styleUrl: './record/record-cards.scss',
  styles: `
    .k-card { align-content: start; }
    .k-card .r-heading { align-items: flex-start; }
    .k-list { display: grid; gap: var(--oc-space-3); margin: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .k-list > div { display: grid; gap: 2px; min-width: 0; }
    .k-list dd { margin: 0; color: var(--oc-ink); font-weight: var(--oc-font-weight-semibold); overflow-wrap: anywhere; }
    .k-list a { color: var(--oc-info-care-icon); }
    .k-multiline { white-space: pre-line; }
    .k-form { display: grid; gap: var(--oc-space-3); grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .k-field { display: grid; align-content: start; gap: var(--oc-space-1); min-width: 0; }
    .k-field--wide, .k-actions, .k-form > .k-error { grid-column: 1 / -1; }
    .k-error { margin: 0; color: var(--oc-error-dark); font-size: var(--oc-text-small-size); font-weight: var(--oc-font-weight-semibold); }
    .k-warning { margin: 0; color: var(--oc-info-allergy); font-size: var(--oc-text-small-size); }
    .k-switch { display: inline-flex; align-items: center; gap: var(--oc-space-2); margin-top: var(--oc-space-1); color: var(--oc-ink-secondary); font-size: var(--oc-text-small-size); }
    .k-actions { display: flex; justify-content: flex-end; gap: var(--oc-space-2); }
    .k-saved { margin: 0; color: var(--oc-info-care); font-weight: var(--oc-font-weight-semibold); }
    .k-alert {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--oc-space-2);
      padding: var(--oc-space-3) var(--oc-space-4); border-radius: var(--oc-radius-icon);
      background: var(--oc-info-allergy-tint); color: var(--oc-info-allergy); font-weight: var(--oc-font-weight-semibold);
    }
    @media (max-width: 768px) {
      .k-list, .k-form { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartContactCard {
  private readonly api = inject(PatientChartApiService);
  private readonly destroyRef = inject(DestroyRef);
  private key: { readonly signature: string; readonly value: string } | null = null;

  readonly chart = input.required<PatientChartDto>();
  /** The saved identity (the page replaces its chart with it). */
  readonly updated = output<PatientChartIdentityDto>();
  /** « Recharger » after a version conflict: the page reloads the chart. */
  readonly reloadRequested = output<void>();

  readonly today = todayInTunis();
  readonly identity = computed(() => this.chart().identity);
  /** Server-decided: only the owner of an external patient edits. */
  readonly editable = computed(() => this.chart().access.mode === 'EXTERNAL_OWNER' && this.chart().access.editable);

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly duplicate = signal(false);
  readonly conflict = signal(false);
  readonly confirmReload = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly form = signal<ContactForm>(contactFormFrom({
    firstName: '', lastName: '', fullName: '', ageYears: null, ageApproximate: false, sex: null, dateOfBirth: null,
    phone: null, email: null, address: null, practiceIdentifier: null,
  }));
  private readonly initial = signal<ContactForm | null>(null);
  private readonly touched = signal<ReadonlySet<ContactField>>(new Set());
  private readonly serverErrors = signal<Partial<Record<ContactField, string>>>({});

  readonly clientErrors = computed(() => validateContact(this.form(), this.today));
  readonly recentBirth = computed(() => !this.form().approximate && isRecentBirthDate(this.form().dateOfBirth));
  readonly birthLine = computed(() => {
    const identity = this.identity();
    if (identity.dateOfBirth) {
      const age = patientAgeLabel(identity.dateOfBirth);
      return age ? `${chartShortDate(identity.dateOfBirth)} (${age})` : chartShortDate(identity.dateOfBirth);
    }
    if (identity.ageYears !== null) return `Environ ${identity.ageYears} an${identity.ageYears > 1 ? 's' : ''}`;
    return 'Non renseigné';
  });

  constructor() {
    // A reloaded chart (new contact version) ends the edit and the conflict.
    effect(() => {
      this.identity();
      untracked(() => {
        if (this.saving()) return;
        this.conflict.set(false);
        this.confirmReload.set(false);
      });
    });
  }

  /** Shown once the field was left (or « Enregistrer » was tried); a fixed field clears it at once. */
  error(field: ContactField): string | null {
    const client = this.clientErrors()[field];
    if (client !== undefined) return this.touched().has(field) ? client : null;
    return this.serverErrors()[field] ?? null;
  }

  startEdit(): void {
    const form = contactFormFrom(this.identity());
    this.form.set(form);
    this.initial.set(form);
    this.touched.set(new Set());
    this.serverErrors.set({});
    this.actionError.set(null);
    this.saved.set(false);
    this.duplicate.set(false);
    this.editing.set(true);
  }

  cancelEdit(): void {
    if (this.saving()) return;
    this.editing.set(false);
    this.actionError.set(null);
  }

  patch(change: Partial<ContactForm>): void {
    this.form.update((form) => ({ ...form, ...change }));
    const cleared = Object.keys(change) as ContactField[];
    this.serverErrors.update((errors) => {
      const next = { ...errors };
      for (const field of cleared) delete next[field];
      if ('approximate' in change) { delete next.dateOfBirth; delete next.approximateAgeYears; }
      return next;
    });
  }

  setBirthDate(value: string | null): void {
    this.patch({ dateOfBirth: value });
    this.touch('dateOfBirth');
  }

  ageText(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  touch(field: ContactField): void {
    if (this.touched().has(field)) return;
    this.touched.update((set) => new Set(set).add(field));
  }

  save(): void {
    if (this.saving()) return;
    const initial = this.initial();
    if (initial === null) return;
    this.touched.set(new Set<ContactField>(['phone', 'email', 'address', 'practiceIdentifier', 'dateOfBirth', 'approximateAgeYears']));
    if (Object.keys(this.clientErrors()).length > 0) return;
    const request = contactChanges(initial, this.form(), this.identity().contactVersion ?? 0);
    if (request === null) {
      this.editing.set(false);
      return;
    }
    const signature = JSON.stringify(request);
    if (this.key?.signature !== signature) this.key = { signature, value: newChartIdempotencyKey('chart-contact') };
    this.saving.set(true);
    this.actionError.set(null);
    this.api.updateContact(this.chart().id, request, this.key.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.key = null;
        this.editing.set(false);
        this.saved.set(true);
        this.duplicate.set(response.possibleDuplicate);
        this.updated.emit({ ...response.identity, contactVersion: response.contactVersion });
      },
      error: (raw: unknown) => {
        this.saving.set(false);
        if (!(raw instanceof HttpErrorResponse && (raw.status === 0 || raw.status >= 500))) this.key = null;
        this.onError(raw);
      },
    });
  }

  reload(): void {
    this.confirmReload.set(false);
    this.conflict.set(false);
    this.editing.set(false);
    this.reloadRequested.emit();
  }

  private onError(raw: unknown): void {
    const error = normalizeHttpError(raw);
    if (error.code === 'PATIENT_CONTACT_VERSION_CONFLICT') {
      this.conflict.set(true);
      return;
    }
    const body = raw instanceof HttpErrorResponse ? raw.error as { fieldErrorCodes?: Record<string, string>; fieldErrors?: Record<string, string> } | null : null;
    const paths = { ...(body?.fieldErrors ?? {}), ...(body?.fieldErrorCodes ?? {}) };
    const fields: Partial<Record<ContactField, string>> = {};
    for (const path of Object.keys(paths)) {
      const field = path.replace(/^contact\./, '') as ContactField;
      if (['phone', 'email', 'address', 'practiceIdentifier', 'dateOfBirth', 'approximateAgeYears'].includes(field)) {
        fields[field] = serverFieldMessage(field, body?.fieldErrorCodes?.[path]);
      }
    }
    if (Object.keys(fields).length > 0) {
      this.serverErrors.set(fields);
      return;
    }
    this.actionError.set(error.status === 0
      ? 'Connexion impossible. Vérifiez votre connexion internet.'
      : error.status === 403
        ? 'Vous ne pouvez pas modifier les coordonnées de ce patient.'
        : 'Les coordonnées n’ont pas pu être enregistrées. Réessayez.');
  }
}
