import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { SpartanHelmImports } from './spartan-helm';

/**
 * Development-only compatibility harness. It proves Tailwind, Spartan Brain,
 * NG-ZORRO's shared CDK overlay container, and OmniCare tokens can coexist.
 * This is intentionally not exported from shared/ui and is never production-routed.
 */
@Component({
  selector: 'app-spartan-coexistence-harness',
  imports: [ReactiveFormsModule, BrnDialogImports, BrnSheetImports, SpartanHelmImports],
  template: `
    <section class="oc-spartan-compat" aria-labelledby="spartan-coexistence-title">
      <header class="oc-spartan-compat__heading">
        <div>
          <p class="oc-spartan-compat__eyebrow">Development-only compatibility harness</p>
          <h2 id="spartan-coexistence-title">Spartan coexistence</h2>
        </div>
        <p>
          Private Spartan Brain primitives use OmniCare tokens while existing NG-ZORRO controls above
          remain unchanged.
        </p>
      </header>

      <div class="oc-spartan-compat__grid">
        <article class="oc-spartan-compat__card">
          <h3>Buttons and statuses</h3>
          <div class="oc-spartan-compat__row">
            <button type="button" hlmBtn>Default action</button>
            <button type="button" hlmBtn variant="secondary">
              Secondary action
            </button>
            <button type="button" hlmBtn [disabled]="loading()" (click)="toggleLoading()">
              {{ loading() ? 'Loading…' : 'Show loading state' }}
            </button>
            <button type="button" hlmBtn disabled>Disabled</button>
          </div>
          <div class="oc-spartan-compat__row" aria-label="Visible urgency examples">
            <span class="oc-spartan-compat__badge">Routine</span>
            <span class="oc-spartan-compat__badge oc-spartan-compat__badge--urgent">Requires attention</span>
          </div>
        </article>

        <article class="oc-spartan-compat__card">
          <h3>Field and select</h3>
          <label class="oc-spartan-compat__field" for="spartan-compat-name">
            <span>Long operational contact label that remains understandable on narrow screens</span>
            <input
              id="spartan-compat-name"
              class="oc-spartan-compat__control"
              type="text"
              [formControl]="nameControl"
              aria-describedby="spartan-compat-name-hint spartan-compat-name-error"
            />
          </label>
          <p id="spartan-compat-name-hint" class="oc-spartan-compat__hint">Use the patient-safe display name only.</p>
          @if (nameControl.invalid && nameControl.touched) {
            <p id="spartan-compat-name-error" class="oc-spartan-compat__error" role="alert">Enter at least three characters.</p>
          }
          <label class="oc-spartan-compat__field" for="spartan-compat-area">
            <span>Area</span>
            <select id="spartan-compat-area" class="oc-spartan-compat__control" [formControl]="areaControl">
              <option [ngValue]="null">Select an area</option>
              <option value="intake">Intake coordination</option>
              <option value="planning">Care planning</option>
            </select>
          </label>
        </article>

        <article class="oc-spartan-compat__card">
          <h3>Alert and skeleton</h3>
          <div class="oc-spartan-compat__alert" role="status">
            <strong>Compatibility check</strong>
            <span>Visible text accompanies the informational surface and icon-free state.</span>
          </div>
          <div class="oc-spartan-compat__skeleton" role="status" aria-label="Loading example">
            <span></span><span></span><span></span>
          </div>
        </article>

        <article class="oc-spartan-compat__card">
          <h3>Presentational table</h3>
          <div class="oc-spartan-compat__table-scroll" tabindex="0">
            <table>
              <caption class="oc-sr-only">Compatibility table examples</caption>
              <thead><tr><th scope="col">Workflow</th><th scope="col">Status</th><th scope="col">Owner</th></tr></thead>
              <tbody>
                <tr><td>Request review</td><td>Open</td><td>Clinic team</td></tr>
                <tr><td>Care planning</td><td>Empty value —</td><td>Unassigned</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div class="oc-spartan-compat__row">
        <div brnDialog autoFocus="#spartan-compat-dialog-name">
          <span brnDialogOverlay class="oc-spartan-compat-backdrop" aria-hidden="true"></span>
          <button type="button" hlmBtn brnDialogTrigger>Open focus-safe dialog</button>
          <ng-template brnDialogContent class="oc-spartan-compat-dialog-pane">
            <section class="oc-spartan-compat__dialog" aria-label="Compatibility dialog">
              <h3 brnDialogTitle>Confirm compatibility behavior</h3>
              <p brnDialogDescription>Initial focus moves to the field. Escape closes this dialog and returns focus to its trigger.</p>
              <label class="oc-spartan-compat__field" for="spartan-compat-dialog-name">
                <span>Review note</span>
                <input id="spartan-compat-dialog-name" class="oc-spartan-compat__control" type="text" />
              </label>
              <div class="oc-spartan-compat__dialog-actions">
                <button type="button" hlmBtn variant="secondary" brnDialogClose>Cancel</button>
                <button type="button" hlmBtn brnDialogClose>Confirm</button>
              </div>
            </section>
          </ng-template>
        </div>

        <div brnSheet side="right">
          <span brnSheetOverlay class="oc-spartan-compat-backdrop" aria-hidden="true"></span>
          <button type="button" hlmBtn variant="secondary" brnSheetTrigger>
            Open focus-safe sheet
          </button>
          <ng-template brnSheetContent class="oc-spartan-compat-sheet-pane">
            <aside class="oc-spartan-compat__sheet" aria-label="Compatibility sheet">
              <h3 brnSheetTitle>Compatibility sheet</h3>
              <p brnSheetDescription>Keyboard focus stays within this sheet until it is dismissed.</p>
              <button type="button" hlmBtn brnSheetClose>Close sheet</button>
            </aside>
          </ng-template>
        </div>
      </div>
    </section>
  `,
  styleUrl: './spartan-coexistence-harness.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpartanCoexistenceHarness {
  readonly loading = signal(false);
  readonly nameControl = new FormControl('', { nonNullable: true, validators: [Validators.minLength(3)] });
  readonly areaControl = new FormControl<string | null>(null);

  toggleLoading(): void {
    this.loading.update((loading) => !loading);
  }
}
