import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';

export type OcSheetSide = 'left' | 'right';

/** Vendor-neutral controlled sheet backed by the pinned Spartan Brain sheet. */
@Component({
  selector: 'oc-sheet',
  imports: [BrnSheetImports],
  template: `
    <div brnSheet [state]="open() ? 'open' : 'closed'" [side]="side()" [autoFocus]="initialFocus()" [restoreFocus]="true" [disableClose]="dismissalDisabled()" [closeOnOutsidePointerEvents]="backdropDismissible() && !dismissalDisabled()" (closed)="onClosed()">
      <span brnSheetOverlay class="oc-sheet-backdrop" aria-hidden="true"></span>
      <ng-template brnSheetContent class="oc-sheet-panel">
        <aside class="oc-sheet" [style.--oc-sheet-width]="width()" [attr.aria-busy]="submitting()">
          <header class="oc-sheet__header"><div><h2 brnSheetTitle>{{ title() }}</h2>@if (description(); as text) { <p brnSheetDescription>{{ text }}</p> }</div>@if (!dismissalDisabled()) { <button type="button" class="oc-sheet__close" [attr.aria-label]="'Close ' + title()" (click)="dismiss()">×</button> }</header>
          <div class="oc-sheet__body"><ng-content /></div>
          @if (hasFooter()) { <footer class="oc-sheet__footer"><ng-content select="[ocSheetFooter]" /></footer> }
        </aside>
      </ng-template>
    </div>
  `,
  styleUrl: './oc-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcSheet {
  readonly open = input(false); readonly title = input.required<string>(); readonly description = input<string>();
  readonly side = input<OcSheetSide>('right'); readonly width = input('28rem'); readonly initialFocus = input<string | 'first-tabbable'>('first-tabbable');
  readonly backdropDismissible = input(true); readonly submitting = input(false); readonly disabled = input(false); readonly hasFooter = input(false);
  readonly dismissed = output<void>();
  protected dismissalDisabled(): boolean { return this.submitting() || this.disabled(); }
  protected dismiss(): void { if (!this.dismissalDisabled()) this.dismissed.emit(); }
  protected onClosed(): void { if (this.open() && !this.dismissalDisabled()) this.dismissed.emit(); }
}
