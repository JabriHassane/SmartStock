import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { downloadCsv } from '../../core/csv';
import { STOCK_STATUS, UNIT_LABELS } from '../../core/labels';
import { Page, StockLevel, StockStatus, Warehouse } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { AgoPipe, MoneyPipe, NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { MovementAction, MovementFormComponent } from './movement-form.component';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, PaginationComponent, MovementFormComponent, MoneyPipe, NumPipe, AgoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Niveaux de stock</h1>
        <p class="page-subtitle">Quantités par produit et par entrepôt. Enregistrez entrées, sorties, inventaires et transferts.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" (click)="exportCsv()"><app-icon name="download" /> Exporter</button>
        <button class="btn btn-secondary" (click)="open('TRANSFER')"><app-icon name="transfer" /> Transfert</button>
        <button class="btn btn-secondary" (click)="open('OUT')"><app-icon name="arrow-up" /> Sortie</button>
        <button class="btn btn-primary" (click)="open('IN')"><app-icon name="arrow-down" /> Entrée</button>
      </div>
    </div>

    <div class="wh-strip">
      <button class="wh" [class.active]="warehouseId === null" (click)="selectWarehouse(null)">
        <app-icon name="globe" />
        <span><b>Tous les entrepôts</b><small>{{ totalUnits() | num }} unités</small></span>
      </button>
      @for (w of warehouses(); track w.id) {
        <button class="wh" [class.active]="warehouseId === w.id" (click)="selectWarehouse(w.id)">
          <app-icon name="warehouse" />
          <span><b>{{ w.code }} · {{ w.name }}</b><small>{{ w.totalUnits | num }} unités · {{ w.stockValue | money:true }}</small></span>
        </button>
      }
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="input-group">
          <app-icon name="search" />
          <input class="input" [(ngModel)]="search" (ngModelChange)="search$.next()" placeholder="Produit ou SKU…" aria-label="Rechercher">
        </div>
        <select class="select" [(ngModel)]="status" (ngModelChange)="reload()" aria-label="Statut">
          <option [ngValue]="null">Tous les statuts</option>
          <option value="IN_STOCK">En stock</option>
          <option value="LOW">Stock bas</option>
          <option value="OUT">Rupture</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Produit</th><th>Entrepôt</th><th class="num">Quantité</th><th class="num">Seuil</th><th class="num">Valeur</th><th>Statut</th><th>Mis à jour</th><th class="actions"></th></tr>
          </thead>
          <tbody>
            @for (s of page()?.content; track s.id) {
              <tr>
                <td>
                  <a [routerLink]="['/app/products', s.productId]" class="strong">{{ s.productName }}</a>
                  <div class="mono muted small">{{ s.sku }}</div>
                </td>
                <td><span class="badge badge-muted no-dot">{{ s.warehouseCode }}</span> {{ s.warehouseName }}</td>
                <td class="num">
                  <span class="strong big">{{ s.quantityOnHand | num }}</span> <small class="muted">{{ UNIT[s.unitOfMeasure] }}</small>
                  <div class="level"><span [style.width.%]="levelPct(s)" [class]="'lvl-' + s.status"></span></div>
                </td>
                <td class="num">{{ s.reorderPoint | num }}</td>
                <td class="num">{{ s.stockValue | money }}</td>
                <td><span class="badge" [class]="'badge ' + STATUS[s.status].badge">{{ STATUS[s.status].label }}</span></td>
                <td class="muted nowrap">{{ s.updatedAt | ago }}</td>
                <td class="actions">
                  <button class="btn btn-ghost btn-icon btn-sm" title="Entrée" aria-label="Entrée" (click)="open('IN', s)"><app-icon name="arrow-down" /></button>
                  <button class="btn btn-ghost btn-icon btn-sm" title="Sortie" aria-label="Sortie" (click)="open('OUT', s)"><app-icon name="arrow-up" /></button>
                  <button class="btn btn-ghost btn-icon btn-sm" title="Inventaire" aria-label="Inventaire" (click)="open('ADJUSTMENT', s)"><app-icon name="clipboard" /></button>
                  <button class="btn btn-ghost btn-icon btn-sm" title="Transférer" aria-label="Transférer" (click)="open('TRANSFER', s)"><app-icon name="transfer" /></button>
                </td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="8"><div class="empty"><app-icon name="layers" /><h4>Aucun stock</h4><p>Enregistrez une entrée pour commencer à suivre vos quantités.</p></div></td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (page(); as pg) {
        <app-pagination [page]="pg.page" [size]="pg.size" [total]="pg.totalElements" [totalPages]="pg.totalPages" (changed)="goTo($event)" />
      }
    </div>

    @if (movement(); as m) {
      <app-movement-form [initialType]="m.type" [initialProductId]="m.productId" [initialWarehouseId]="m.warehouseId"
        (closed)="movement.set(null)" (saved)="onSaved()" />
    }
  `,
  styles: [`
    .small { font-size: 12px; }
    .big { font-size: 15px; }
    .wh-strip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 20px; }
    .wh { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface);
      cursor: pointer; text-align: left; flex: none; transition: .15s; color: var(--text-body); }
    .wh app-icon { color: var(--primary); }
    .wh span { display: flex; flex-direction: column; }
    .wh b { color: var(--text); font-size: 14px; }
    .wh small { font-size: 12px; color: var(--text-muted); }
    .wh:hover { border-color: var(--border-strong); }
    .wh.active { border-color: var(--primary); box-shadow: var(--ring); }
    .level { width: 90px; height: 4px; border-radius: 99px; background: var(--surface-2); margin: 6px 0 0 auto; overflow: hidden; }
    .level span { display: block; height: 100%; border-radius: 99px; }
    .lvl-IN_STOCK { background: var(--success); }
    .lvl-LOW { background: var(--warning); }
    .lvl-OUT { background: var(--danger); }
  `],
})
export class StockComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  /** ?action=IN|OUT|TRANSFER depuis la recherche rapide ou le tableau de bord. */
  readonly action = input<string>();

  protected readonly STATUS = STOCK_STATUS;
  protected readonly UNIT = UNIT_LABELS;
  protected readonly page = signal<Page<StockLevel> | null>(null);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly totalUnits = signal(0);
  protected readonly loading = signal(false);
  protected readonly movement = signal<{ type: MovementAction; productId: number | null; warehouseId: number | null } | null>(null);

  protected search = '';
  protected warehouseId: number | null = null;
  protected status: StockStatus | null = null;
  private pageIndex = 0;
  protected readonly search$ = new Subject<void>();

  ngOnInit(): void {
    this.loadWarehouses();
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.load();
    const action = this.action();
    if (action === 'IN' || action === 'OUT' || action === 'TRANSFER' || action === 'ADJUSTMENT') {
      this.open(action);
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  selectWarehouse(id: number | null): void {
    this.warehouseId = id;
    this.reload();
  }

  reload(): void {
    this.pageIndex = 0;
    this.load();
  }

  goTo(page: number): void {
    this.pageIndex = page;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.stock({ search: this.search, warehouseId: this.warehouseId, status: this.status, page: this.pageIndex, size: 15 }).subscribe({
      next: page => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  open(type: MovementAction, level?: StockLevel): void {
    this.movement.set({ type, productId: level?.productId ?? null, warehouseId: level?.warehouseId ?? this.warehouseId });
  }

  onSaved(): void {
    this.movement.set(null);
    this.load();
    this.loadWarehouses();
  }

  levelPct(s: StockLevel): number {
    const target = Math.max(s.reorderPoint * 3, 1);
    return Math.min(100, (s.quantityOnHand / target) * 100);
  }

  async exportCsv(): Promise<void> {
    try {
      const rows: StockLevel[] = [];
      for (let p = 0; ; p++) {
        const page = await firstValueFrom(this.api.stock({ search: this.search, warehouseId: this.warehouseId, status: this.status, page: p, size: 100 }));
        rows.push(...page.content);
        if (p + 1 >= page.totalPages) break;
      }
      downloadCsv(`stock-${new Date().toISOString().slice(0, 10)}.csv`,
        ['SKU', 'Produit', 'Catégorie', 'Entrepôt', 'Quantité', 'Unité', 'Seuil', 'Valeur', 'Statut'],
        rows.map(s => [s.sku, s.productName, s.categoryName, s.warehouseCode, s.quantityOnHand, UNIT_LABELS[s.unitOfMeasure], s.reorderPoint, s.stockValue, STOCK_STATUS[s.status].label]));
    } catch (err) {
      this.ui.error(errorMessage(err));
    }
  }

  private loadWarehouses(): void {
    this.api.warehouses().subscribe(w => {
      this.warehouses.set(w.filter(x => x.active));
      this.totalUnits.set(w.reduce((sum, x) => sum + x.totalUnits, 0));
    });
  }
}
