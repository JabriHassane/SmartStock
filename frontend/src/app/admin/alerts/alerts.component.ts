import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { downloadCsv } from '../../core/csv';
import { STOCK_STATUS } from '../../core/labels';
import { StockAlert } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [RouterLink, IconComponent, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Alertes & réapprovisionnement</h1>
        <p class="page-subtitle">Produits en rupture, sous leur seuil, ou dont le stock ne couvre plus 7 jours de sorties.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" (click)="load()"><app-icon name="refresh" /> Actualiser</button>
        <button class="btn btn-secondary" (click)="exportCsv()" [disabled]="!alerts().length"><app-icon name="download" /> Exporter</button>
      </div>
    </div>

    <div class="grid grid-3">
      <button class="summary out" [class.active]="filter() === 'OUT'" (click)="toggle('OUT')">
        <span class="s-icon"><app-icon name="ban" /></span>
        <span><strong>{{ counts().out }}</strong><small>En rupture</small></span>
      </button>
      <button class="summary low" [class.active]="filter() === 'LOW'" (click)="toggle('LOW')">
        <span class="s-icon"><app-icon name="alert" /></span>
        <span><strong>{{ counts().low }}</strong><small>Sous le seuil</small></span>
      </button>
      <button class="summary soon" [class.active]="filter() === 'SOON'" (click)="toggle('SOON')">
        <span class="s-icon"><app-icon name="clock" /></span>
        <span><strong>{{ counts().soon }}</strong><small>Rupture sous 7 jours</small></span>
      </button>
    </div>

    <div class="card mt-6">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Produit</th><th>Statut</th><th class="num">Stock</th><th class="num">Seuil</th><th class="num">Sorties / jour</th><th>Couverture</th><th class="num">À commander</th><th class="actions"></th></tr>
          </thead>
          <tbody>
            @for (a of visible(); track a.productId) {
              <tr>
                <td>
                  <a [routerLink]="['/app/products', a.productId]" class="strong">{{ a.productName }}</a>
                  <div class="muted small"><span class="mono">{{ a.sku }}</span> @if (a.categoryName) { · {{ a.categoryName }} }</div>
                </td>
                <td>
                  @if (a.status === 'IN_STOCK') { <span class="badge badge-info">Rupture proche</span> }
                  @else { <span class="badge" [class]="'badge ' + STATUS[a.status].badge">{{ STATUS[a.status].label }}</span> }
                </td>
                <td class="num strong">{{ a.totalQuantity | num }}</td>
                <td class="num">{{ a.reorderPoint | num }}</td>
                <td class="num">{{ a.avgDailyOut | num }}</td>
                <td>
                  @if (a.daysOfCover === null) { <span class="muted">Pas de sorties récentes</span> }
                  @else {
                    <div class="cover">
                      <div class="cover-bar"><span [style.width.%]="Math.min(100, (a.daysOfCover / 30) * 100)" [class.bad]="a.daysOfCover < 7" [class.warn]="a.daysOfCover >= 7 && a.daysOfCover < 14"></span></div>
                      <b>{{ a.daysOfCover }} j</b>
                    </div>
                  }
                </td>
                <td class="num"><span class="suggest">{{ a.suggestedReorder | num }}</span></td>
                <td class="actions">
                  @if (auth.canManage && a.suggestedReorder > 0) {
                    <a class="btn btn-primary btn-sm" routerLink="/app/orders/new" [queryParams]="{ type: 'PURCHASE', productId: a.productId, quantity: a.suggestedReorder }">
                      <app-icon name="truck" /> Commander
                    </a>
                  }
                </td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="8">
                  <div class="empty ok"><app-icon name="check-circle" /><h4>Tout est sous contrôle</h4><p>Aucun produit ne nécessite de réapprovisionnement pour le moment.</p></div>
                </td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .small { font-size: 12px; }
    .summary { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--radius-lg); border: 1.5px solid var(--border); background: var(--surface);
      cursor: pointer; text-align: left; transition: .15s; color: var(--text-body); }
    .summary:hover { box-shadow: var(--shadow); }
    .summary strong { display: block; font-size: 28px; font-weight: 800; color: var(--text); line-height: 1.1; }
    .summary small { font-size: 13px; }
    .s-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
    .s-icon app-icon { width: 24px; height: 24px; }
    .out .s-icon { background: var(--danger-soft); color: var(--danger); }
    .low .s-icon { background: var(--warning-soft); color: #d97706; }
    .soon .s-icon { background: var(--info-soft); color: var(--info); }
    .summary.active.out { border-color: var(--danger); }
    .summary.active.low { border-color: var(--warning); }
    .summary.active.soon { border-color: var(--info); }
    .cover { display: flex; align-items: center; gap: 10px; }
    .cover-bar { width: 80px; height: 6px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
    .cover-bar span { display: block; height: 100%; background: var(--success); border-radius: 99px; }
    .cover-bar span.warn { background: var(--warning); }
    .cover-bar span.bad { background: var(--danger); }
    .cover b { font-size: 13px; color: var(--text); }
    .suggest { display: inline-block; min-width: 48px; padding: 4px 10px; border-radius: 8px; background: var(--primary-soft); color: var(--primary); font-weight: 700; }
    .empty.ok app-icon { color: var(--success); }
  `],
})
export class AlertsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);

  protected readonly Math = Math;
  protected readonly STATUS = STOCK_STATUS;
  protected readonly alerts = signal<StockAlert[]>([]);
  protected readonly loading = signal(true);
  protected readonly filter = signal<'OUT' | 'LOW' | 'SOON' | null>(null);

  protected readonly counts = computed(() => {
    const a = this.alerts();
    return { out: a.filter(x => x.status === 'OUT').length, low: a.filter(x => x.status === 'LOW').length, soon: a.filter(x => x.status === 'IN_STOCK').length };
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    if (!f) return this.alerts();
    return this.alerts().filter(a => (f === 'SOON' ? a.status === 'IN_STOCK' : a.status === f));
  });

  ngOnInit(): void {
    this.load();
  }

  toggle(f: 'OUT' | 'LOW' | 'SOON'): void {
    this.filter.set(this.filter() === f ? null : f);
  }

  load(): void {
    this.loading.set(true);
    this.api.alerts().subscribe({
      next: a => {
        this.alerts.set(a);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  exportCsv(): void {
    downloadCsv(`alertes-${new Date().toISOString().slice(0, 10)}.csv`,
      ['SKU', 'Produit', 'Catégorie', 'Statut', 'Stock', 'Seuil', 'Sorties/jour', 'Couverture (j)', 'À commander'],
      this.alerts().map(a => [a.sku, a.productName, a.categoryName, a.status === 'IN_STOCK' ? 'Rupture proche' : STOCK_STATUS[a.status].label,
        a.totalQuantity, a.reorderPoint, a.avgDailyOut, a.daysOfCover, a.suggestedReorder]));
  }
}
