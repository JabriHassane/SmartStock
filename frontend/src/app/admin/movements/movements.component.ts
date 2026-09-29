import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { downloadCsv } from '../../core/csv';
import { MOVEMENT_LABELS } from '../../core/labels';
import { Movement, MovementType, Page, ReferenceType, Warehouse } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { FrDatePipe, MoneyPipe, NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';
import { PaginationComponent } from '../../shared/pagination.component';

const REFERENCE_LABELS: Record<ReferenceType, string> = {
  MANUAL: 'Manuel',
  INVENTORY_COUNT: 'Inventaire',
  TRANSFER: 'Transfert',
  PURCHASE_ORDER: 'Bon d\'achat',
  SALES_ORDER: 'Bon de vente',
};

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, PaginationComponent, FrDatePipe, MoneyPipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Mouvements de stock</h1>
        <p class="page-subtitle">Journal complet et horodaté de toutes les opérations.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" (click)="exportCsv()"><app-icon name="download" /> Exporter</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="input-group">
          <app-icon name="search" />
          <input class="input" [(ngModel)]="search" (ngModelChange)="search$.next()" placeholder="Produit, SKU, référence, motif…" aria-label="Rechercher">
        </div>
        <select class="select" [(ngModel)]="type" (ngModelChange)="reload()" aria-label="Type">
          <option [ngValue]="null">Tous les types</option>
          @for (t of types; track t) { <option [value]="t">{{ MOVEMENT[t].label }}</option> }
        </select>
        <select class="select" [(ngModel)]="warehouseId" (ngModelChange)="reload()" aria-label="Entrepôt">
          <option [ngValue]="null">Tous les entrepôts</option>
          @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.code }} · {{ w.name }}</option> }
        </select>
        <input class="input date" type="date" [(ngModel)]="from" (ngModelChange)="reload()" aria-label="Du">
        <input class="input date" type="date" [(ngModel)]="to" (ngModelChange)="reload()" aria-label="Au">
        @if (productId() || search || type || warehouseId || from || to) {
          <button class="btn btn-ghost btn-sm" (click)="clear()"><app-icon name="x" /> Effacer</button>
        }
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Produit</th><th>Entrepôt</th><th class="num">Quantité</th><th class="num">Stock après</th><th>Référence</th><th>Par</th></tr>
          </thead>
          <tbody>
            @for (m of page()?.content; track m.id) {
              <tr>
                <td class="nowrap">{{ m.createdAt | frDate:true }}</td>
                <td><span class="badge" [class]="'badge ' + MOVEMENT[m.type].badge">{{ MOVEMENT[m.type].label }}</span></td>
                <td>
                  <a [routerLink]="['/app/products', m.productId]" class="strong">{{ m.productName }}</a>
                  <div class="mono muted small">{{ m.sku }}</div>
                </td>
                <td><span class="badge badge-muted no-dot">{{ m.warehouseCode }}</span></td>
                <td class="num strong" [class.text-success]="m.quantity > 0" [class.text-danger]="m.quantity < 0">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity | num }}</td>
                <td class="num">{{ m.quantityAfter | num }}</td>
                <td>
                  <div class="small">{{ REF[m.referenceType] }} @if (m.referenceId) { · <span class="mono">{{ m.referenceId }}</span> }</div>
                  @if (m.reason) { <div class="muted small reason" [title]="m.reason">{{ m.reason }}</div> }
                </td>
                <td><span class="who"><span class="avatar xs">{{ m.createdBy.charAt(0) }}</span>{{ m.createdBy }}</span></td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="8"><div class="empty"><app-icon name="history" /><h4>Aucun mouvement</h4><p>Aucune opération ne correspond à ces filtres.</p></div></td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (page(); as pg) {
        <app-pagination [page]="pg.page" [size]="pg.size" [total]="pg.totalElements" [totalPages]="pg.totalPages" (changed)="goTo($event)" />
      }
    </div>
  `,
  styles: [`
    .small { font-size: 12px; }
    .date { width: 150px; }
    .reason { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
    .avatar.xs { width: 24px; height: 24px; font-size: 11px; text-transform: uppercase; }
  `],
})
export class MovementsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);

  /** ?productId=… depuis la fiche produit. */
  readonly productId = input<string>();

  protected readonly MOVEMENT = MOVEMENT_LABELS;
  protected readonly REF = REFERENCE_LABELS;
  protected readonly types = Object.keys(MOVEMENT_LABELS) as MovementType[];
  protected readonly page = signal<Page<Movement> | null>(null);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly loading = signal(false);

  protected search = '';
  protected type: MovementType | null = null;
  protected warehouseId: number | null = null;
  protected from = '';
  protected to = '';
  private pageIndex = 0;
  private product: number | null = null;
  protected readonly search$ = new Subject<void>();

  ngOnInit(): void {
    this.product = this.productId() ? Number(this.productId()) : null;
    this.api.warehouses().subscribe(w => this.warehouses.set(w));
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.load();
  }

  clear(): void {
    this.search = '';
    this.type = null;
    this.warehouseId = null;
    this.from = '';
    this.to = '';
    this.product = null;
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
    this.api.movements(this.filters(this.pageIndex, 20)).subscribe({
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

  async exportCsv(): Promise<void> {
    try {
      const rows: Movement[] = [];
      for (let p = 0; p < 50; p++) {
        const page = await firstValueFrom(this.api.movements(this.filters(p, 100)));
        rows.push(...page.content);
        if (p + 1 >= page.totalPages) break;
      }
      downloadCsv(`mouvements-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Date', 'Type', 'SKU', 'Produit', 'Entrepôt', 'Quantité', 'Stock après', 'Coût unitaire', 'Origine', 'Référence', 'Motif', 'Utilisateur'],
        rows.map(m => [m.createdAt, MOVEMENT_LABELS[m.type].label, m.sku, m.productName, m.warehouseCode, m.quantity, m.quantityAfter, m.unitCost,
          REFERENCE_LABELS[m.referenceType], m.referenceId, m.reason, m.createdBy]));
    } catch (err) {
      this.ui.error(errorMessage(err));
    }
  }

  private filters(page: number, size: number) {
    return { productId: this.product, warehouseId: this.warehouseId, type: this.type, from: this.from || null, to: this.to || null, search: this.search, page, size };
  }
}
