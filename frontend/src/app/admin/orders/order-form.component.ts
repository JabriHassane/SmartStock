import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { ORDER_TYPE } from '../../core/labels';
import { OrderType, Partner, ProductOption, Warehouse } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { MoneyPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';

interface LineDraft {
  key: number;
  productId: number | null;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="id() ? ['/app/orders', id()] : '/app/orders'" class="back"><app-icon name="chevron-left" /> {{ id() ? 'Retour à la commande' : 'Commandes' }}</a>

    <div class="page-header">
      <div>
        <h1 class="page-title">{{ id() ? 'Modifier ' + (orderNumber() ?? 'la commande') : (orderType() === 'PURCHASE' ? 'Nouveau bon d\\'achat' : 'Nouveau bon de vente') }}</h1>
        <p class="page-subtitle">La commande est créée en brouillon ; confirmez-la puis {{ orderType() === 'PURCHASE' ? 'réceptionnez-la' : 'expédiez-la' }} pour mettre le stock à jour.</p>
      </div>
    </div>

    @if (!id()) {
      <div class="type-switch">
        <button [class.active]="orderType() === 'PURCHASE'" (click)="setType('PURCHASE')">
          <app-icon name="truck" /><span><b>Achat fournisseur</b><small>Fait entrer du stock</small></span>
        </button>
        <button [class.active]="orderType() === 'SALE'" (click)="setType('SALE')">
          <app-icon name="cart" /><span><b>Vente client</b><small>Fait sortir du stock</small></span>
        </button>
      </div>
    }

    <div class="layout">
      <div class="col">
        <section class="card">
          <div class="card-header"><div class="card-title">Informations</div></div>
          <div class="card-body form-grid">
            <div class="field">
              <label for="o-partner">{{ TYPE[orderType()].partner }} *</label>
              <select id="o-partner" class="select" [(ngModel)]="partnerId" name="partner">
                <option [ngValue]="null" disabled>Choisir…</option>
                @for (p of partners(); track p.id) { <option [ngValue]="p.id">{{ p.name }}{{ p.city ? ' — ' + p.city : '' }}</option> }
              </select>
              @if (partners().length === 0 && loaded()) {
                <span class="hint">Aucun {{ TYPE[orderType()].partner.toLowerCase() }} actif — <a [routerLink]="orderType() === 'PURCHASE' ? '/app/suppliers' : '/app/customers'">en créer un</a>.</span>
              }
            </div>
            <div class="field">
              <label for="o-wh">Entrepôt *</label>
              <select id="o-wh" class="select" [(ngModel)]="warehouseId" name="warehouse">
                <option [ngValue]="null" disabled>Choisir…</option>
                @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.code }} · {{ w.name }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="o-date">Date de commande</label>
              <input id="o-date" class="input" type="date" [(ngModel)]="orderDate" name="orderDate">
            </div>
            <div class="field">
              <label for="o-exp">{{ orderType() === 'PURCHASE' ? 'Livraison prévue' : 'Expédition prévue' }}</label>
              <input id="o-exp" class="input" type="date" [(ngModel)]="expectedDate" name="expectedDate">
            </div>
            <div class="field span-2">
              <label for="o-notes">Notes</label>
              <textarea id="o-notes" class="textarea" rows="2" [(ngModel)]="notes" name="notes" placeholder="Conditions, instructions de livraison…"></textarea>
            </div>
          </div>
        </section>

        <section class="card mt-6">
          <div class="card-header">
            <div class="card-title">Lignes de commande</div>
            <button class="btn btn-secondary btn-sm" (click)="addLine()"><app-icon name="plus" /> Ajouter une ligne</button>
          </div>
          <div class="table-wrap">
            <table class="table lines">
              <thead><tr><th>Produit</th><th class="num">Quantité</th><th class="num">Prix unitaire HT</th><th class="num">Total HT</th><th></th></tr></thead>
              <tbody>
                @for (line of lines(); track line.key) {
                  <tr>
                    <td>
                      <select class="select" [ngModel]="line.productId" (ngModelChange)="setProduct(line, $event)" [attr.aria-label]="'Produit ligne ' + ($index + 1)">
                        <option [ngValue]="null" disabled>Choisir un produit…</option>
                        @for (p of products(); track p.id) { <option [ngValue]="p.id">{{ p.name }} — {{ p.sku }}</option> }
                      </select>
                    </td>
                    <td class="num"><input class="input qty" type="number" min="1" step="1" [ngModel]="line.quantity" (ngModelChange)="update(line, 'quantity', $event)" aria-label="Quantité"></td>
                    <td class="num"><input class="input price" type="number" min="0" step="0.01" [ngModel]="line.unitPrice" (ngModelChange)="update(line, 'unitPrice', $event)" aria-label="Prix unitaire"></td>
                    <td class="num strong">{{ line.quantity * line.unitPrice | money }}</td>
                    <td class="actions"><button class="btn btn-ghost btn-icon btn-sm" (click)="removeLine(line)" [disabled]="lines().length === 1" aria-label="Supprimer la ligne"><app-icon name="trash" /></button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside class="summary card">
        <div class="card-header"><div class="card-title">Récapitulatif</div></div>
        <div class="card-body">
          <div class="sum-line"><span>Articles</span><b>{{ itemCount() }}</b></div>
          <div class="sum-line"><span>Total HT</span><b>{{ totalHt() | money }}</b></div>
          <div class="sum-line tax">
            <label for="o-tax">TVA</label>
            <span class="tax-input"><input id="o-tax" class="input" type="number" min="0" max="100" step="0.5" [(ngModel)]="taxRate" name="tax"> %</span>
            <b>{{ totalTax() | money }}</b>
          </div>
          <div class="sum-total"><span>Total TTC</span><strong>{{ totalHt() + totalTax() | money }}</strong></div>
          @if (error()) { <div class="alert-box danger mt-4"><app-icon name="alert" /> {{ error() }}</div> }
          <button class="btn btn-primary btn-lg full" (click)="save()" [disabled]="saving() || !valid()">
            @if (saving()) { <span class="spinner"></span> } {{ id() ? 'Enregistrer les modifications' : 'Créer le brouillon' }}
          </button>
          <p class="hint center">Le stock n'est modifié qu'à la {{ orderType() === 'PURCHASE' ? 'réception' : 'l\\'expédition' }}.</p>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .back { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: var(--text-body); margin-bottom: 14px; }
    .back app-icon { width: 18px; height: 18px; }
    .type-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 560px; margin-bottom: 20px; }
    .type-switch button { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; text-align: left; color: var(--text-body); }
    .type-switch button span { display: flex; flex-direction: column; }
    .type-switch b { color: var(--text); }
    .type-switch small { font-size: 12px; color: var(--text-muted); }
    .type-switch button.active { border-color: var(--primary); background: var(--primary-soft); box-shadow: var(--ring); }
    .type-switch button.active app-icon { color: var(--primary); }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
    .summary { position: sticky; top: calc(var(--topbar-h) + 20px); }
    .lines td { vertical-align: middle; }
    .lines .select { min-width: 220px; }
    .qty { width: 90px; text-align: right; }
    .price { width: 130px; text-align: right; }
    .sum-line { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; font-size: 14px; }
    .sum-line b { color: var(--text); }
    .tax label { font-weight: 400; color: var(--text-body); font-size: 14px; }
    .tax-input { display: inline-flex; align-items: center; gap: 4px; margin-right: auto; }
    .tax-input .input { width: 72px; height: 32px; text-align: right; }
    .sum-total { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 14px; border-top: 1px solid var(--border); }
    .sum-total strong { font-size: 22px; color: var(--text); }
    .full { width: 100%; margin-top: 18px; }
    .center { text-align: center; display: block; margin-top: 10px; font-size: 12px; color: var(--text-muted); }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .summary { position: static; } }
  `],
})
export class OrderFormComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly typeParam = input<string | undefined>(undefined, { alias: 'type' });
  readonly productIdParam = input<string | undefined>(undefined, { alias: 'productId' });
  readonly quantityParam = input<string | undefined>(undefined, { alias: 'quantity' });

  protected readonly TYPE = ORDER_TYPE;
  protected readonly orderType = signal<OrderType>('PURCHASE');
  protected readonly orderNumber = signal<string | null>(null);
  protected readonly partners = signal<Partner[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly lines = signal<LineDraft[]>([]);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected partnerId: number | null = null;
  protected warehouseId: number | null = null;
  protected orderDate = new Date().toISOString().slice(0, 10);
  protected expectedDate = '';
  protected notes = '';
  protected taxRate = 20;
  private nextKey = 1;

  protected readonly totalHt = computed(() => this.lines().reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0));
  protected readonly itemCount = computed(() => this.lines().reduce((sum, l) => sum + (Number(l.quantity) || 0), 0));

  totalTax(): number {
    return Math.round(this.totalHt() * (Number(this.taxRate) || 0)) / 100;
  }

  ngOnInit(): void {
    const t = this.typeParam();
    if (t === 'SALE' || t === 'PURCHASE') this.orderType.set(t);

    forkJoin({ products: this.api.productOptions(), warehouses: this.api.warehouses() }).subscribe({
      next: ({ products, warehouses }) => {
        this.products.set(products);
        const active = warehouses.filter(w => w.active);
        this.warehouses.set(active);
        if (this.id()) {
          this.loadOrder(Number(this.id()));
        } else {
          if (active.length === 1) this.warehouseId = active[0].id;
          const productId = Number(this.productIdParam());
          const quantity = Number(this.quantityParam()) || 1;
          const product = products.find(p => p.id === productId);
          this.lines.set([this.newLine(product ?? null, product ? quantity : 1)]);
          this.loadPartners();
        }
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }

  setType(type: OrderType): void {
    if (type === this.orderType()) return;
    this.orderType.set(type);
    this.partnerId = null;
    // Prix par défaut : coût d'achat pour un achat, prix de vente pour une vente.
    this.lines.update(lines => lines.map(l => {
      const p = this.products().find(x => x.id === l.productId);
      return p ? { ...l, unitPrice: this.defaultPrice(p) } : l;
    }));
    this.loadPartners();
  }

  addLine(): void {
    this.lines.update(lines => [...lines, this.newLine(null, 1)]);
  }

  removeLine(line: LineDraft): void {
    this.lines.update(lines => lines.filter(l => l.key !== line.key));
  }

  setProduct(line: LineDraft, productId: number): void {
    const p = this.products().find(x => x.id === productId);
    this.lines.update(lines => lines.map(l => l.key === line.key ? { ...l, productId, unitPrice: p ? this.defaultPrice(p) : l.unitPrice } : l));
  }

  update(line: LineDraft, field: 'quantity' | 'unitPrice', value: number): void {
    this.lines.update(lines => lines.map(l => l.key === line.key ? { ...l, [field]: Number(value) } : l));
  }

  valid(): boolean {
    return !!this.partnerId && !!this.warehouseId && this.lines().length > 0
      && this.lines().every(l => l.productId && Number.isInteger(Number(l.quantity)) && l.quantity > 0 && l.unitPrice >= 0)
      && this.taxRate >= 0 && this.taxRate <= 100;
  }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.saveOrder(this.id() ? Number(this.id()) : null, {
      type: this.orderType(),
      partnerId: this.partnerId!,
      warehouseId: this.warehouseId!,
      orderDate: this.orderDate || null,
      expectedDate: this.expectedDate || null,
      taxRate: Number(this.taxRate),
      notes: this.notes.trim() || null,
      lines: this.lines().map(l => ({ productId: l.productId!, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    }).subscribe({
      next: order => {
        this.ui.success(this.id() ? 'Commande mise à jour' : `Brouillon ${order.orderNumber} créé`);
        this.router.navigate(['/app/orders', order.id]);
      },
      error: err => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  private loadOrder(id: number): void {
    this.api.order(id).subscribe({
      next: order => {
        if (order.status !== 'DRAFT') {
          this.ui.info('Seuls les brouillons peuvent être modifiés.');
          this.router.navigate(['/app/orders', id]);
          return;
        }
        this.orderType.set(order.type);
        this.orderNumber.set(order.orderNumber);
        this.partnerId = order.partnerId;
        this.warehouseId = order.warehouseId;
        this.orderDate = order.orderDate;
        this.expectedDate = order.expectedDate ?? '';
        this.notes = order.notes ?? '';
        this.taxRate = Number(order.taxRate);
        this.lines.set(order.lines.map(l => ({ key: this.nextKey++, productId: l.productId, quantity: l.quantity, unitPrice: Number(l.unitPrice) })));
        this.loadPartners();
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }

  private loadPartners(): void {
    this.loaded.set(false);
    this.api.partners(this.orderType() === 'PURCHASE' ? 'suppliers' : 'customers').subscribe(p => {
      this.partners.set(p.filter(x => x.active || x.id === this.partnerId));
      this.loaded.set(true);
    });
  }

  private newLine(product: ProductOption | null, quantity: number): LineDraft {
    return { key: this.nextKey++, productId: product?.id ?? null, quantity, unitPrice: product ? this.defaultPrice(product) : 0 };
  }

  private defaultPrice(p: ProductOption): number {
    return Number(this.orderType() === 'PURCHASE' ? p.costPrice : p.unitPrice);
  }
}
