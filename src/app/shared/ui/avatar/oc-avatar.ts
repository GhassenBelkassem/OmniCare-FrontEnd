import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type AvatarSize = 'small' | 'default' | 'large';

@Component({
  selector: 'oc-avatar',
  template: `
    <span
      class="oc-avatar"
      [class]="'oc-avatar oc-avatar--' + size()"
      [style.background]="color()"
      [attr.aria-label]="name()"
      [attr.title]="name()"
    >{{ initials() }}</span>
  `,
  styleUrl: './oc-avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcAvatar {
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('default');
  readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() ?? '??';
  });
  readonly color = computed(() => {
    const name = this.name();
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 45%, 40%)`;
  });
}
