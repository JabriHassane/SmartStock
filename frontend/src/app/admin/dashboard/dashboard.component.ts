import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CATEGORY_COLORS, MOVEMENT_LABELS, ORDER_STATUS, ORDER_TYPE, STOCK_STATUS } from '../../core/labels';
import { InventoryDashboard, OrderDashboard } from '../../core/models';
import { AreaChartComponent, BarChartComponent, DonutComponent } from '../../shared/charts.component';
import { AgoPipe, MoneyPipe, NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const moneyFmt = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 });

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent, AreaChartComponent, BarChartComponent, DonutComponent, MoneyPipe, NumPipe, AgoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);

  protected readonly days = signal(30);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly inventory = signal<InventoryDashboard | null>(null);
  protected readonly orders = signal<OrderDashboard | null>(null);

  protected readonly MOVEMENT = MOVEMENT_LABELS;
  protected readonly STATUS = STOCK_STATUS;
  protected readonly ORDER_STATUS = ORDER_STATUS;
  protected readonly ORDER_TYPE = ORDER_TYPE;
  protected readonly moneyFormat = (v: number) => moneyFmt.format(v);

  protected readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();
  protected readonly today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  protected readonly flowLabels = computed(() => (this.inventory()?.flows ?? []).map(f => shortDate.format(new Date(f.date))));
  protected readonly flowSeries = computed(() => {
    const flows = this.inventory()?.flows ?? [];
    return [
      { label: 'Entrées', color: '#2f73f2', values: flows.map(f => f.in) },
      { label: 'Sorties', color: '#10b981', values: flows.map(f => f.out) },
    ];
  });
  protected readonly flowTotals = computed(() => {
    const flows = this.inventory()?.flows ?? [];
    return { in: flows.reduce((s, f) => s + f.in, 0), out: flows.reduce((s, f) => s + f.out, 0) };
  });

  protected readonly categorySegments = computed(() => {
    const cats = this.inventory()?.categories ?? [];
    const top = cats.slice(0, 5).map((c, i) => ({ label: c.name, value: Number(c.value), color: c.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));
    const rest = cats.slice(5).reduce((s, c) => s + Number(c.value), 0);
    return rest > 0 ? [...top, { label: 'Autres', value: rest, color: '#94a3b8' }] : top;
  });

  protected readonly monthLabels = computed(() => (this.orders()?.monthly ?? []).map(m => monthFmt.format(new Date(m.month))));
  protected readonly monthSeries = computed(() => {
    const monthly = this.orders()?.monthly ?? [];
    return [
      { label: 'Ventes', color: '#2f73f2', values: monthly.map(m => Number(m.sales)) },
      { label: 'Achats', color: '#f59e0b', values: monthly.map(m => Number(m.purchases)) },
    ];
  });

  protected readonly topMax = computed(() => Math.max(1, ...(this.inventory()?.topProducts ?? []).map(p => p.outQuantity)));

  /** Part du stock en bonne santé (ni bas ni en rupture) pour l'indicateur de santé. */
  protected readonly health = computed(() => {
    const s = this.inventory()?.summary;
    if (!s || s.activeProducts === 0) return 100;
    return Math.round(((s.activeProducts - s.lowStock - s.outOfStock) / s.activeProducts) * 100);
  });

  ngOnInit(): void {
    this.load();
  }

  setDays(days: number): void {
    this.days.set(days);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      inventory: this.api.inventoryDashboard(this.days()),
      orders: this.api.orderDashboard().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ inventory, orders }) => {
        this.inventory.set(inventory);
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
