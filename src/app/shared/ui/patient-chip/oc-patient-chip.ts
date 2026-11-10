import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

export function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : (parts[0][1] ?? '');
  return `${first}${last}`.toLocaleUpperCase('fr-FR');
}

/** Selected patient: initials avatar, full name, optional phone and remove button. */
@Component({
  selector: 'oc-patient-chip',
  imports: [NzIconModule],
  template: `
    <span class="oc-patient-chip">
      <span class="oc-patient-chip__avatar" aria-hidden="true">{{ initials() }}</span>
      <span class="oc-patient-chip__copy">
        <strong>{{ name() }}</strong>
        @if (phone()) {
          <small>{{ phone() }}</small>
        }
      </span>
      <ng-content />
      @if (removable()) {
        <button
          type="button"
          class="oc-patient-chip__remove"
          [attr.aria-label]="'Retirer ' + name()"
          (click)="removed.emit()"
        >
          <nz-icon nzType="close" aria-hidden="true" />
        </button>
      }
    </span>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .oc-patient-chip {
      display: flex;
      align-items: center;
      gap: var(--oc-space-3);
      padding: var(--oc-space-2) var(--oc-space-3);
      border: 1px solid var(--oc-color-border-default);
      border-radius: var(--oc-radius-pill);
      background: var(--oc-color-surface-card);
    }
    .oc-patient-chip__avatar {
      display: inline-grid;
      width: 32px;
      height: 32px;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 50%;
      background: var(--oc-primary-tint);
      color: var(--oc-primary-dark);
      font-size: var(--oc-text-caption-size);
      font-weight: var(--oc-font-weight-strong);
    }
    .oc-patient-chip__copy { display: grid; min-width: 0; flex: 1; }
    strong, small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    strong { color: var(--oc-color-text-primary); font-size: var(--oc-text-small-size); }
    small { color: var(--oc-color-text-muted); font-size: var(--oc-text-caption-size); }
    .oc-patient-chip__remove {
      display: inline-grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--oc-color-text-muted);
      cursor: pointer;
    }
    .oc-patient-chip__remove:hover { background: var(--oc-color-surface-hover); }
    .oc-patient-chip__remove:focus-visible { outline: 2px solid var(--oc-primary); outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcPatientChip {
  readonly name = input.required<string>();
  readonly phone = input<string | null>(null);
  readonly removable = input(false);
  readonly removed = output<void>();
  readonly initials = computed(() => patientInitials(this.name()));
}
