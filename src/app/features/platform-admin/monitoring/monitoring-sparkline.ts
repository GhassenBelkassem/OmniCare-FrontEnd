import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MonitoringSeriesPoint } from '../monitoring.models';

interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Lightweight, dependency-free inline SVG time-series chart.
 *
 * Bounded synthetic data only. Renders a labelled, accessible `role="img"` figure with a
 * text alternative so the same information is available without the visual. When there is
 * no data it renders an explicit empty state instead of a misleading flat line.
 */
@Component({
  selector: 'oc-monitoring-sparkline',
  template: `
    @if (points().length < 2) {
      <p class="oc-sparkline__empty">No series data for this window.</p>
    } @else {
      <figure class="oc-sparkline">
        <svg
          class="oc-sparkline__svg"
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          preserveAspectRatio="none"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          <polyline
            class="oc-sparkline__line"
            [attr.points]="polylinePoints()"
            fill="none"
          />
          <circle
            class="oc-sparkline__dot"
            [attr.cx]="lastPoint().x"
            [attr.cy]="lastPoint().y"
            r="2.5"
          />
        </svg>
        <figcaption class="oc-sparkline__caption">
          <span>{{ label() }}</span>
          <span class="oc-sparkline__unit">{{ valueLabel() }} {{ unit() }}</span>
        </figcaption>
      </figure>
    }
  `,
  styleUrl: './monitoring-sparkline.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringSparkline {
  readonly points = input.required<readonly MonitoringSeriesPoint[]>();
  readonly label = input.required<string>();
  readonly unit = input('');
  readonly valueLabel = input('');

  readonly width = 240;
  readonly height = 48;

  private readonly chartPoints = computed<readonly ChartPoint[]>(() =>
    normalize(this.points(), this.width, this.height),
  );

  readonly polylinePoints = computed(() =>
    this.chartPoints()
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' '),
  );

  readonly lastPoint = computed<ChartPoint>(() => {
    const chart = this.chartPoints();
    return chart[chart.length - 1] ?? { x: 0, y: 0 };
  });

  readonly ariaLabel = computed(() => {
    const values = this.points().map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return `${this.label()} trend: minimum ${min}${this.unit()} maximum ${max}${this.unit()} over ${values.length} points`;
  });
}

function normalize(
  points: readonly MonitoringSeriesPoint[],
  width: number,
  height: number,
): readonly ChartPoint[] {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padding = 4;
  const usableHeight = height - padding * 2;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  return points.map((point, index) => ({
    x: index * step,
    y: padding + usableHeight - ((point.value - min) / span) * usableHeight,
  }));
}
