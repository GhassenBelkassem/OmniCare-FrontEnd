import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ClinicContextStore } from './clinic-context.store';

@Component({
  selector: 'app-clinic-entry-page',
  template: `
    <div class="clinic-page">
      <section class="clinic-state" role="status" aria-live="polite">
        <h1>Preparing your clinic workspace</h1>
        <p>
          We are confirming your access family, resolving your clinic memberships and loading the
          clinic context. You will be redirected as soon as it is ready.
        </p>
      </section>
    </div>
  `,
  styleUrl: './clinic-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicEntryPage {
  private readonly store = inject(ClinicContextStore);

  constructor() {
    this.store.initialize({ route: true });
  }
}
