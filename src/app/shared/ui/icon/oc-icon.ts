import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type OcIconIntent =
  'neutral' | 'primary' | 'success' | 'information' | 'warning' | 'critical' | 'coordination';

export const OC_ICON_NAMES = [
  'menu',
  'close',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'tasks',
  'requests',
  'staff',
  'settings',
  'handover',
  'warning',
  'refresh',
  'external',
  'workspace',
  'calendar',
  'waiting',
  'clinical',
  'prescription',
  'results',
  'analytics',
  'location',
  'building',
  'home',
  'emergency',
  'equipment',
  'coverage',
  'phone',
  'accessibility',
  'info',
  'image',
  'upload',
  'trash',
  'mail',
  'history',
  'user',
  'file',
  'download',
  'eye',
  'edit',
  'lock',
] as const;

export type OcIconName = (typeof OC_ICON_NAMES)[number];

const OC_ICON_NAME_SET: ReadonlySet<string> = new Set(OC_ICON_NAMES);

export function isOcIconName(value: string): value is OcIconName {
  return OC_ICON_NAME_SET.has(value);
}

/** Small vendor-neutral outline-icon boundary for production workspace UI. */
@Component({
  selector: 'oc-icon',
  template: `
    <svg
      class="oc-icon"
      [class]="'oc-icon oc-icon--' + intent()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="decorative() ? 'true' : null"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-label]="decorative() ? null : (label() ?? name())"
      [attr.data-icon-name]="name()"
      [attr.data-icon-fallback]="registered() ? null : 'true'"
    >
      @switch (name()) {
        @case ('menu') {
          <path d="M4 7h16M4 12h16M4 17h16" />
        }
        @case ('close') {
          <path d="m6 6 12 12M18 6 6 18" />
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6" />
        }
        @case ('chevron-left') {
          <path d="m15 18-6-6 6-6" />
        }
        @case ('chevron-right') {
          <path d="m9 18 6-6-6-6" />
        }
        @case ('tasks') {
          <path d="M9 5h10M9 12h10M9 19h10M5 5h.01M5 12h.01M5 19h.01" />
        }
        @case ('requests') {
          <path d="M6 3h9l3 3v15H6zM9 12h6M9 16h6" />
          <path d="M15 3v4h4" />
        }
        @case ('staff') {
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c.7-3 2.7-5 6-5s5.3 2 6 5M16 8h4M18 6v4" />
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3.5h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V13h-.2a1.7 1.7 0 0 0-1.5 1Z"
          />
        }
        @case ('handover') {
          <path d="M7 7h11l-3-3M17 17H6l3 3M18 7l3 3-3 3M6 17l-3-3 3-3" />
        }
        @case ('warning') {
          <path d="M12 3 2.7 20h18.6L12 3Z" />
          <path d="M12 9v4M12 17h.01" />
        }
        @case ('refresh') {
          <path d="M20 12a8 8 0 1 1-2.3-5.7L20 9M20 4v5h-5" />
        }
        @case ('external') {
          <path d="M14 4h6v6M20 4 10 14M18 13v6H4V5h6" />
        }
        @case ('workspace') {
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        }
        @case ('waiting') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        }
        @case ('clinical') {
          <path d="M8 3v5a4 4 0 0 0 8 0V3M6 3h4M14 3h4M12 12v2a5 5 0 0 0 10 0v-1" />
          <circle cx="20" cy="11" r="2" />
        }
        @case ('prescription') {
          <path d="M6 3h9l3 3v15H6zM15 3v4h4M9 11h5M9 15h3M15 14l4 4M19 14l-4 4" />
        }
        @case ('results') {
          <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3" />
          <path d="m14 16 1.5 1.5L19 14" />
        }
        @case ('analytics') {
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        }
        @case ('location') {
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        }
        @case ('building') {
          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18" />
          <path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M10 21v-3h4v3" />
        }
        @case ('home') {
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v11h14V10M9 21v-7h6v7" />
        }
        @case ('emergency') {
          <path d="M8 3h8v5h5v8h-5v5H8v-5H3V8h5V3Z" />
        }
        @case ('equipment') {
          <path d="M9 4h6l1 3h3a2 2 0 0 1 2 2v10H3V9a2 2 0 0 1 2-2h3l1-3Z" />
          <path d="M3 12h18M9 15h6M12 12v6" />
        }
        @case ('coverage') {
          <path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        }
        @case ('phone') {
          <path
            d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21a1.5 1.5 0 0 0 1.5-1.5V17l-4-1-1.2 2a15.2 15.2 0 0 1-9.8-9.8L8 7 7 3Z"
          />
        }
        @case ('accessibility') {
          <circle cx="12" cy="4" r="1.5" />
          <path d="M6 8h12M12 8v5m0 0-4 7m4-7 4 7" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        }
        @case ('image') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m5 18 5-5 3 3 2-2 4 4" />
        }
        @case ('upload') {
          <path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16" />
        }
        @case ('trash') {
          <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        }
        @case ('history') {
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5M12 7v5l3 3" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        }
        @case ('file') {
          <path d="M14 3H6v18h12V7l-4-4Z" />
          <path d="M14 3v4h4M9 13h6M9 17h6" />
        }
        @case ('download') {
          <path d="M12 4v12m0 0-5-5m5 5 5-5M4 20h16" />
        }
        @case ('eye') {
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        }
        @case ('edit') {
          <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
          <path d="m13 7 4 4" />
        }
        @case ('lock') {
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        }
        @default {
          <rect x="4" y="4" width="16" height="16" rx="3" />
        }
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
  readonly registered = computed(() => isOcIconName(this.name()));
}
