import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink],
  template: `<main class="state-page"><div><h1>Access unavailable</h1><p>Your account does not have permission to open this workspace.</p><a routerLink="/login">Return to sign in</a></div></main>`,
  styles: [`.state-page{min-height:100dvh;display:grid;place-items:center;padding:var(--oc-space-6);background:var(--oc-color-surface-app)}.state-page div{max-width:34rem;padding:var(--oc-space-10);background:var(--oc-color-surface-card);border:1px solid var(--oc-color-border-default);border-radius:var(--oc-radius-lg)}a{color:var(--oc-color-text-link);font-weight:var(--oc-font-weight-semibold)}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
