import { Directive, ElementRef, inject, input } from '@angular/core';

import { ConsultationUi, isInsideOverlay, type ConsultationSection } from './consultation-ui';

/**
 * Marks a section card. When focus leaves it for an element outside it, the section's errors are
 * revealed. Moving into an overlay that belongs to a field (select menu, date panel, a dialog) is
 * not a leave, so opening or choosing in a select, a segmented control or a date picker never
 * turns a field red.
 */
@Directive({
  selector: '[appConsultationSection]',
  host: {
    '(focusout)': 'onFocusOut($event)',
    '[attr.data-section]': 'section()',
  },
})
export class ConsultationSectionDirective {
  private readonly ui = inject(ConsultationUi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly section = input.required<ConsultationSection>({ alias: 'appConsultationSection' });

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next !== null) {
      if (this.host.nativeElement.contains(next) || isInsideOverlay(next)) return;
      this.ui.leaveSection(this.section());
      return;
    }
    // Focus went nowhere (a click on a non-focusable area, or inside an overlay panel that does not
    // take focus): decide once the click has settled.
    setTimeout(() => {
      const active = globalThis.document?.activeElement ?? null;
      if (active !== null && (this.host.nativeElement.contains(active) || isInsideOverlay(active))) return;
      if (this.ui.pointerInOverlayRecently()) return;
      this.ui.leaveSection(this.section());
    });
  }
}
