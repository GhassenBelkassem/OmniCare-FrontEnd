import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'oc-timeline-item',
  imports: [NzIconModule],
  template: `
    <div class="oc-timeline-item">
      <span class="oc-timeline-item__dot" [class]="'oc-timeline-item__dot oc-timeline-item__dot--' + tone()"></span>
      <div class="oc-timeline-item__content">
        <div class="oc-timeline-item__header">
          @if (title()) {
            <strong class="oc-timeline-item__title">{{ title() }}</strong>
          }
          @if (time()) {
            <time class="oc-timeline-item__time">{{ time() }}</time>
          }
        </div>
        <p class="oc-timeline-item__body"><ng-content /></p>
      </div>
    </div>
  `,
  styleUrl: './oc-timeline-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcTimelineItem {
  readonly title = input<string>();
  readonly time = input<string>();
  readonly tone = input<'default' | 'success' | 'warning' | 'critical' | 'information'>('default');
}
