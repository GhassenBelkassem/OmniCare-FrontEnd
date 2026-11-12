import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

export interface OcTab {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly route?: string;
  readonly badge?: string | number;
  readonly disabled?: boolean;
}

@Component({
  selector: 'oc-tabs',
  imports: [RouterLink, NzIconModule],
  template: `
    <nav class="oc-tabs" [attr.aria-label]="label()">
      <ul role="tablist">
        @for (tab of tabs(); track tab.id; let index = $index) {
          <li role="presentation">
            @if (tab.route) {
              <a
                #tabElement
                role="tab"
                class="oc-tabs__item"
                [class.oc-tabs__item--active]="selected() === tab.id"
                [attr.aria-selected]="selected() === tab.id"
                [attr.aria-disabled]="tab.disabled || null"
                [attr.tabindex]="selected() === tab.id ? 0 : -1"
                [routerLink]="tab.route"
                (keydown.arrowright)="move(index, 1, $event)"
                (keydown.arrowleft)="move(index, -1, $event)"
                (keydown.home)="moveToEdge('first', $event)"
                (keydown.end)="moveToEdge('last', $event)"
              >
                @if (tab.icon) {
                  <nz-icon [nzType]="tab.icon" aria-hidden="true" />
                }
                <span>{{ tab.label }}</span>
                @if (tab.badge !== undefined) {
                  <span class="oc-tabs__badge">{{ tab.badge }}</span>
                }
              </a>
            } @else {
              <button
                #tabElement
                type="button"
                role="tab"
                class="oc-tabs__item"
                [class.oc-tabs__item--active]="selected() === tab.id"
                [attr.aria-selected]="selected() === tab.id"
                [attr.tabindex]="selected() === tab.id ? 0 : -1"
                [disabled]="tab.disabled"
                (click)="select(tab.id)"
                (keydown.arrowright)="move(index, 1, $event)"
                (keydown.arrowleft)="move(index, -1, $event)"
                (keydown.home)="moveToEdge('first', $event)"
                (keydown.end)="moveToEdge('last', $event)"
              >
                @if (tab.icon) {
                  <nz-icon [nzType]="tab.icon" aria-hidden="true" />
                }
                <span>{{ tab.label }}</span>
                @if (tab.badge !== undefined) {
                  <span class="oc-tabs__badge">{{ tab.badge }}</span>
                }
              </button>
            }
          </li>
        }
      </ul>
    </nav>
  `,
  styleUrl: './oc-tabs.scss',
  host: { '[class.oc-tabs--prominent]': "variant() === 'prominent'" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcTabs {
  readonly label = input('Navigation');
  /** `prominent`: text tabs, 3px primary underline, 15 / 700 active label, neutral count badge. */
  readonly variant = input<'default' | 'prominent'>('default');
  readonly tabs = input.required<readonly OcTab[]>();
  readonly selected = model.required<string>();
  private readonly tabElements = viewChildren<ElementRef<HTMLElement>>('tabElement');

  constructor() {
    afterRenderEffect({
      earlyRead: () => {
        const index = this.tabs().findIndex((tab) => tab.id === this.selected());
        const item = this.tabElements()[index]?.nativeElement;
        const strip = item?.parentElement?.parentElement;
        if (!item || !strip) return null;

        const visibleStart = strip.scrollLeft;
        const visibleEnd = visibleStart + strip.clientWidth;
        const itemStart = item.offsetLeft;
        const itemEnd = itemStart + item.offsetWidth;
        if (itemStart >= visibleStart && itemEnd <= visibleEnd) return null;

        return {
          strip,
          left: itemStart < visibleStart ? itemStart : Math.max(0, itemEnd - strip.clientWidth),
        };
      },
      write: (target) => {
        const reveal = target();
        if (reveal) reveal.strip.scrollLeft = reveal.left;
      },
    });
  }

  select(id: string): void {
    this.selected.set(id);
  }

  move(index: number, direction: 1 | -1, event: Event): void {
    event.preventDefault();
    const tabs = this.tabs();
    let nextIndex = index;
    for (let attempt = 0; attempt < tabs.length; attempt += 1) {
      nextIndex = (nextIndex + direction + tabs.length) % tabs.length;
      if (!tabs[nextIndex]?.disabled) break;
    }
    const next = tabs[nextIndex];
    if (next) {
      this.selected.set(next.id);
      this.tabElements()[nextIndex]?.nativeElement.focus();
    }
  }

  moveToEdge(edge: 'first' | 'last', event: Event): void {
    event.preventDefault();
    const tabs = this.tabs();
    const indexes = edge === 'first' ? tabs.keys() : [...tabs.keys()].reverse();
    for (const index of indexes) {
      const tab = tabs[index];
      if (tab && !tab.disabled) {
        this.selected.set(tab.id);
        this.tabElements()[index]?.nativeElement.focus();
        return;
      }
    }
  }
}
