import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ORDER_STATUS, ORDER_TYPE } from '../../core/labels';
import { OrderStatus, OrderSummary, OrderType, Page } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { FrDatePipe, MoneyPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';
import { PaginationComponent } from '../../shared/pagination.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, PaginationComponent, MoneyPipe, FrDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Commandes</h1>
        <p class="page-subtitle">Bons d'achat fournisseurs et bons de vente clients. La réception ou l'expédition met le stock à jour.</p>
      </div>
      @if (auth.canManage) {
        <div class="page-actions">
          <a class="btn btn-secondary" routerLink="/app/orders/new" [queryParams]="{ type: 'PURCHASE' }"><app-icon name="truck" /> Bon d'achat</a>
          <a class="btn btn-primary" routerLink="/app/orders/new" [queryParams]="{ type: 'SALE' }"><app-icon name="cart" /> Bon de vente</a>
        </div>
      }
    </div>

    <div class="card">
      <div class="tabs">
        <button [class.active]="type === null" (click)="setType(null)">Toutes</button>
        <button [class.active]="type === 'PURCHASE'" (click)="setType('PURCHASE')"><app-icon name="truck" /> Achats</button>
        <button [class.active]="type === 'SALE'" (click)="setType('SALE')"><app-icon name="cart" /> Ventes</button>
      </div>
      <div class="toolbar">
        <div class="input-group">
          <app-icon name="search" />
          <input class="input" [(ngModel)]="search" (ngModelChange)="search$.next()" placeholder="N° de commande, fournisseur, client…" aria-label="Rechercher">
        </div>
        <select class="select" [(ngModel)]="status" (ngModelChange)="reload()" aria-label="Statut">
          <option [ngValue]="null">Tous les statuts</option>
          @for (s of statuses; track s) { <option [value]="s">{{ STATUS[s].label }}</option> }
        </select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>N°</th><th>Type</th><th>Partenaire</th><th>Entrepôt</th><th>Date</th><th>Prévue</th><th class="num">Total TTC</th><th>Statut</th></tr>
          </thead>
          <tbody>
            @for (o of page()?.content; track o.id) {
              <tr class="clickable" (click)="router.navigate(['/app/orders', o.id])">
                <td class="strong mono">{{ o.orderNumber }}</td>
                <td>
                  <span class="type" [class.sale]="o.type === 'SALE'"><app-icon [name]="o.type === 'SALE' ? 'cart' : 'truck'" /> {{ TYPE[o.type].label }}</span>
                </td>
                <td class="strong">{{ o.partnerName }}</td>
                <td>{{ o.warehouseName }}</td>
                <td class="nowrap">{{ o.orderDate | frDate }}</td>
                <td class="nowrap muted">{{ o.expectedDate | frDate }}</td>
                <td class="num strong">{{ o.totalTtc | money }}</td>
                <td><span class="badge" [class]="'badge ' + STATUS[o.status].badge">{{ o.status === 'COMPLETED' ? TYPE[o.type].completed : STATUS[o.status].label }}</span></td>
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="8"><div class="empty"><app-icon name="file" /><h4>Aucune commande</h4><p>Créez un bon d'achat ou de vente pour commencer.</p></div></td></tr>
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
    .tabs { display: flex; gap: 4px; padding: 12px 16px 0; border-bottom: 1px solid var(--border); }
    .tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; border: none; background: none; font-weight: 600; font-size: 14px;
      color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
    .tabs button app-icon { width: 16px; height: 16px; }
    .tabs button.active { color: var(--primary); border-bottom-color: var(--primary); }
    .type { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #d97706; }
    .type.sale { color: var(--primary); }
    .type app-icon { width: 16px; height: 16px; }
  `],
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  readonly typeParam = input<string | undefined>(undefined, { alias: 'type' });

  protected readonly STATUS = ORDER_STATUS;
  protected readonly TYPE = ORDER_TYPE;
  protected readonly statuses = Object.keys(ORDER_STATUS) as OrderStatus[];
  protected readonly page = signal<Page<OrderSummary> | null>(null);
  protected readonly loading = signal(false);

  protected search = '';
  protected type: OrderType | null = null;
  protected status: OrderStatus | null = null;
  private pageIndex = 0;
  protected readonly search$ = new Subject<void>();

  ngOnInit(): void {
    const t = this.typeParam();
    if (t === 'PURCHASE' || t === 'SALE') this.type = t;
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.load();
  }

  setType(type: OrderType | null): void {
    this.type = type;
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
    this.api.orders({ type: this.type, status: this.status, search: this.search, page: this.pageIndex, size: 15 }).subscribe({
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
}
