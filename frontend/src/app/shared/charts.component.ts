import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

const W = 640;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / magnitude;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * magnitude;
}

function compact(value: number): string {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Courbes lissées avec aire en dégradé et infobulle au survol. SVG pur, aucune dépendance. */
@Component({
  selector: 'app-area-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend">
      @for (s of series(); track s.label) {
        <span><i [style.background]="s.color"></i>{{ s.label }}</span>
      }
    </div>
    <div class="wrap" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + height()" preserveAspectRatio="none" (mousemove)="onMove($event)">
        <defs>
          @for (s of series(); track s.label; let i = $index) {
            <linearGradient [attr.id]="gid + i" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" [attr.stop-color]="s.color" stop-opacity=".28" />
              <stop offset="1" [attr.stop-color]="s.color" stop-opacity="0" />
            </linearGradient>
          }
        </defs>
        @for (t of ticks(); track t.y) {
          <line [attr.x1]="PAD.left" [attr.x2]="W - PAD.right" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="t.y + 4" text-anchor="end" class="axis">{{ t.label }}</text>
        }
        @for (l of xLabels(); track l.x) {
          <text [attr.x]="l.x" [attr.y]="height() - 8" text-anchor="middle" class="axis">{{ l.label }}</text>
        }
        @for (p of paths(); track p.color; let i = $index) {
          <path [attr.d]="p.area" [attr.fill]="'url(#' + gid + i + ')'" />
          <path [attr.d]="p.line" fill="none" [attr.stroke]="p.color" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        }
        @if (hover() !== null) {
          <line [attr.x1]="x(hover()!)" [attr.x2]="x(hover()!)" [attr.y1]="PAD.top" [attr.y2]="height() - PAD.bottom" class="cursor" />
          @for (s of series(); track s.label) {
            <circle [attr.cx]="x(hover()!)" [attr.cy]="y(s.values[hover()!] || 0)" r="4" [attr.fill]="s.color" stroke="var(--surface)" stroke-width="2" />
          }
        }
      </svg>
      @if (hover() !== null) {
        <div class="tip" [style.left.%]="(x(hover()!) / W) * 100">
          <strong>{{ labels()[hover()!] }}</strong>
          @for (s of series(); track s.label) {
            <span><i [style.background]="s.color"></i>{{ s.label }} : <b>{{ format()(s.values[hover()!] || 0) }}</b></span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .legend { display: flex; gap: 16px; font-size: 13px; margin-bottom: 8px; color: var(--text-body); }
    .legend span, .tip span { display: inline-flex; align-items: center; gap: 6px; }
    i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .wrap { position: relative; }
    svg { width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); stroke-dasharray: 3 4; }
    .axis { font-size: 11px; fill: var(--text-muted); }
    .cursor { stroke: var(--border-strong); }
    .tip { position: absolute; top: 0; transform: translateX(-50%); pointer-events: none; background: var(--navy-deep); color: #fff;
      padding: 8px 12px; border-radius: 10px; font-size: 12px; display: flex; flex-direction: column; gap: 3px; white-space: nowrap; box-shadow: var(--shadow-lg); }
    .tip strong { font-size: 12px; opacity: .8; }
  `],
})
export class AreaChartComponent {
  readonly series = input.required<ChartSeries[]>();
  readonly labels = input.required<string[]>();
  readonly height = input(240);
  readonly format = input<(v: number) => string>(v => compact(v));

  protected readonly W = W;
  protected readonly PAD = PAD;
  protected readonly gid = 'ag' + Math.random().toString(36).slice(2, 8);
  protected readonly hover = signal<number | null>(null);

  private readonly max = computed(() => niceMax(Math.max(0, ...this.series().flatMap(s => s.values))));
  private readonly count = computed(() => Math.max(1, this.labels().length));

  protected readonly ticks = computed(() => [0, .25, .5, .75, 1].map(f => ({ y: this.y(this.max() * f), label: compact(this.max() * f) })));

  protected readonly xLabels = computed(() => {
    const n = this.count();
    const step = Math.max(1, Math.ceil(n / 7));
    return this.labels().map((label, i) => ({ label, x: this.x(i), i })).filter(l => l.i % step === 0 || l.i === n - 1);
  });

  protected readonly paths = computed(() => this.series().map(s => {
    const pts = s.values.map((v, i) => [this.x(i), this.y(v)] as const);
    if (pts.length === 0) return { color: s.color, line: '', area: '' };
    let line = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      line += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    const base = this.height() - PAD.bottom;
    const area = `${line} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`;
    return { color: s.color, line, area };
  }));

  x(i: number): number {
    const n = this.count();
    return PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  }

  y(v: number): number {
    const h = this.height() - PAD.top - PAD.bottom;
    return PAD.top + h - (v / this.max()) * h;
  }

  onMove(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const n = this.count();
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
    this.hover.set(Math.min(n - 1, Math.max(0, i)));
  }
}

/** Barres groupées (ex. achats vs ventes par mois). */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend">
      @for (s of series(); track s.label) {
        <span><i [style.background]="s.color"></i>{{ s.label }}</span>
      }
    </div>
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + height()" preserveAspectRatio="none">
      @for (t of ticks(); track t.y) {
        <line [attr.x1]="PAD.left" [attr.x2]="W - PAD.right" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
        <text [attr.x]="PAD.left - 8" [attr.y]="t.y + 4" text-anchor="end" class="axis">{{ t.label }}</text>
      }
      @for (g of groups(); track g.label) {
        @for (b of g.bars; track $index) {
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="4" [attr.fill]="b.color">
            <title>{{ b.title }}</title>
          </rect>
        }
        <text [attr.x]="g.cx" [attr.y]="height() - 8" text-anchor="middle" class="axis">{{ g.label }}</text>
      }
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .legend { display: flex; gap: 16px; font-size: 13px; margin-bottom: 8px; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    svg { width: 100%; height: auto; }
    .grid { stroke: var(--border); stroke-dasharray: 3 4; }
    .axis { font-size: 11px; fill: var(--text-muted); }
    rect { transition: opacity .15s; }
    rect:hover { opacity: .8; }
  `],
})
export class BarChartComponent {
  readonly series = input.required<ChartSeries[]>();
  readonly labels = input.required<string[]>();
  readonly height = input(240);
  readonly format = input<(v: number) => string>(v => compact(v));

  protected readonly W = W;
  protected readonly PAD = PAD;

  private readonly max = computed(() => niceMax(Math.max(0, ...this.series().flatMap(s => s.values))));

  protected readonly ticks = computed(() => [0, .25, .5, .75, 1].map(f => ({ y: this.y(this.max() * f), label: compact(this.max() * f) })));

  protected readonly groups = computed(() => {
    const n = Math.max(1, this.labels().length);
    const slot = (W - PAD.left - PAD.right) / n;
    const count = this.series().length;
    const barW = Math.min(26, (slot * 0.62) / count);
    const base = this.height() - PAD.bottom;
    return this.labels().map((label, i) => {
      const start = PAD.left + i * slot + (slot - barW * count - 4 * (count - 1)) / 2;
      return {
        label,
        cx: PAD.left + i * slot + slot / 2,
        bars: this.series().map((s, j) => {
          const v = s.values[i] ?? 0;
          const y = this.y(v);
          return { x: start + j * (barW + 4), y, w: barW, h: Math.max(0, base - y), color: s.color, title: `${s.label} : ${this.format()(v)}` };
        }),
      };
    });
  });

  y(v: number): number {
    const h = this.height() - PAD.top - PAD.bottom;
    return PAD.top + h - (v / this.max()) * h;
  }
}

/** Anneau de répartition (ex. valeur du stock par catégorie). */
@Component({
  selector: 'app-donut',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="48" class="track" />
        @for (s of arcs(); track s.label) {
          <circle cx="60" cy="60" r="48" fill="none" [attr.stroke]="s.color" stroke-width="16"
            [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset" transform="rotate(-90 60 60)">
            <title>{{ s.label }}</title>
          </circle>
        }
      </svg>
      <div class="center">
        <strong>{{ centerValue() }}</strong>
        <span>{{ centerLabel() }}</span>
      </div>
    </div>
    <ul>
      @for (s of arcs(); track s.label) {
        <li><i [style.background]="s.color"></i><span class="name">{{ s.label }}</span><b>{{ s.pct }}%</b></li>
      }
    </ul>
  `,
  styles: [`
    :host { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
    .ring { position: relative; width: 170px; height: 170px; flex: none; }
    svg { width: 100%; height: 100%; }
    .track { fill: none; stroke: var(--surface-2); stroke-width: 16; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .center strong { font-size: 17px; color: var(--text); }
    .center span { font-size: 12px; color: var(--text-muted); }
    ul { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 10px; }
    li { display: flex; align-items: center; gap: 10px; font-size: 13px; }
    li i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
    li .name { flex: 1; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    li b { color: var(--text); }
  `],
})
export class DonutComponent {
  readonly segments = input.required<{ label: string; value: number; color: string }[]>();
  readonly centerValue = input('');
  readonly centerLabel = input('');

  protected readonly arcs = computed(() => {
    const total = this.segments().reduce((sum, s) => sum + s.value, 0) || 1;
    const c = 2 * Math.PI * 48;
    let acc = 0;
    return this.segments().map(s => {
      const len = (s.value / total) * c;
      const arc = { label: s.label, color: s.color, dash: `${Math.max(0, len - 2)} ${c}`, offset: -acc, pct: Math.round((s.value / total) * 100) };
      acc += len;
      return arc;
    });
  });
}
