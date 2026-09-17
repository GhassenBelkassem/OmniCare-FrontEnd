import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type OcIconIntent = 'neutral' | 'primary' | 'success' | 'information' | 'warning' | 'critical' | 'coordination';
export type OcIconName = 'menu' | 'close' | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'tasks' | 'requests' | 'staff' | 'settings' | 'handover' | 'warning' | 'refresh' | 'external' | 'workspace';

/** Small vendor-neutral outline-icon boundary for production workspace UI. */
@Component({
  selector: 'oc-icon',
  template: `
    <svg class="oc-icon" [class]="'oc-icon oc-icon--' + intent()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" [attr.aria-hidden]="decorative() ? 'true' : null" [attr.role]="decorative() ? null : 'img'" [attr.aria-label]="decorative() ? null : label() ?? name()">
      @switch (name()) {
        @case ('menu') { <path d="M4 7h16M4 12h16M4 17h16"/> }
        @case ('close') { <path d="m6 6 12 12M18 6 6 18"/> }
        @case ('chevron-down') { <path d="m6 9 6 6 6-6"/> }
        @case ('chevron-left') { <path d="m15 18-6-6 6-6"/> }
        @case ('chevron-right') { <path d="m9 18 6-6-6-6"/> }
        @case ('tasks') { <path d="M9 5h10M9 12h10M9 19h10M5 5h.01M5 12h.01M5 19h.01"/> }
        @case ('requests') { <path d="M6 3h9l3 3v15H6zM9 12h6M9 16h6"/><path d="M15 3v4h4"/> }
        @case ('staff') { <circle cx="9" cy="8" r="3"/><path d="M3 20c.7-3 2.7-5 6-5s5.3 2 6 5M16 8h4M18 6v4"/> }
        @case ('settings') { <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3.5h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V13h-.2a1.7 1.7 0 0 0-1.5 1Z"/> }
        @case ('handover') { <path d="M7 7h11l-3-3M17 17H6l3 3M18 7l3 3-3 3M6 17l-3-3 3-3"/> }
        @case ('warning') { <path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v4M12 17h.01"/> }
        @case ('refresh') { <path d="M20 12a8 8 0 1 1-2.3-5.7L20 9M20 4v5h-5"/> }
        @case ('external') { <path d="M14 4h6v6M20 4 10 14M18 13v6H4V5h6"/> }
        @default { <rect x="4" y="4" width="16" height="16" rx="3"/> }
      }
    </svg>
  `,
  styleUrl: './oc-icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcIcon {
  readonly name = input<OcIconName | string>('tasks');
  readonly intent = input<OcIconIntent>('neutral');
  readonly decorative = input(true);
  readonly label = input<string>();
}
