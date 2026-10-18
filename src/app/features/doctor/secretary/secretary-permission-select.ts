import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';

import { SECRETARY_PERMISSIONS, SecretaryPermission } from './secretary-api.models';
import { permissionLabel } from './secretary-page-utils';

/**
 * Multi-select over the delegable permission set.
 *
 * `OcSelect` is single-value only, so this wraps the established NG-ZORRO
 * multiple-select pattern and exposes it as a form control, letting the invite
 * form and the edit-permissions form share one rendering of the option list.
 */
@Component({
  selector: 'oc-secretary-permission-select',
  imports: [FormsModule, NzSelectModule],
  template: `
    <nz-select
      [ngModel]="value()"
      (ngModelChange)="handleChange($event)"
      [disabled]="disabled()"
      nzMode="multiple"
      [nzPlaceHolder]="placeholder()"
      [nzAllowClear]="true"
      nzSize="large"
    >
      @for (permission of permissions; track permission) {
        <nz-option [nzValue]="permission" [nzLabel]="labelFor(permission)" />
      }
    </nz-select>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    // A multiple select collapses to the chevron alone when nothing is selected: the inner
    // `.ant-select` sizes to content, so the host must carry the width. Same rule as
    // `.clinic-field nz-select`.
    'nz-select { width: 100%; }',
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SecretaryPermissionSelect),
      multi: true,
    },
  ],
})
export class SecretaryPermissionSelect implements ControlValueAccessor {
  readonly permissions = SECRETARY_PERMISSIONS;
  readonly placeholder = input('Select permissions');
  readonly value = signal<readonly SecretaryPermission[]>([]);
  readonly disabled = signal(false);

  private onChange: (value: readonly SecretaryPermission[]) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: readonly SecretaryPermission[] | null): void {
    this.value.set(value ?? []);
  }

  registerOnChange(fn: (value: readonly SecretaryPermission[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected labelFor(permission: SecretaryPermission): string {
    return permissionLabel(permission);
  }

  protected handleChange(value: readonly SecretaryPermission[] | null): void {
    const next = value ?? [];
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }
}