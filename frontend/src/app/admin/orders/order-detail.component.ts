import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ORDER_STATUS, ORDER_TYPE } from '../../core/labels';
import { Order } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { FrDatePipe, MoneyPipe, NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, MoneyPipe, NumPipe, FrDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/app/orders" class="back no-print"><app-icon name="chevron-left" /> Commandes</a>

    @if (order(); as o) {
      <div class="page-header no-print">
        <div>
          <h1 class="page-title">{{ o.orderNumber }}</h1>
          <p class="page-subtitle">
            <span class="type" [class.sale]="o.type === 'SALE'"><app-icon [name]="o.type === 'SALE' ? 'cart' : 'truck'" /> {{ o.type === 'SALE' ? 'Bon de vente' : 'Bon d\\'achat' }}</span>
            <span class="badge" [class]="'badge ' + STATUS[o.status].badge">{{ o.status === 'COMPLETED' ? TYPE[o.type].completed : STATUS[o.status].label }}</span>
          </p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" (click)="print()"><app-icon name="printer" /> Imprimer</button>
          @if (auth.canManage && (o.status === 'DRAFT' || o.status === 'CANCELLED')) {
            <button class="btn btn-ghost" (click)="remove()"><app-icon name="trash" /> Supprimer</button>
          }
          @if (auth.canManage && (o.status === 'DRAFT' || o.status === 'CONFIRMED')) {
            <button class="btn btn-secondary" (click)="act('cancel')" [disabled]="busy()"><app-icon name="ban" /> Annuler</button>
          }
          @if (auth.canManage && o.status === 'DRAFT') {
            <a class="btn btn-secondary" [routerLink]="['/app/orders', o.id, 'edit']"><app-icon name="edit" /> Modifier</a>
            <button class="btn btn-primary" (click)="act('confirm')" [disabled]="busy()"><app-icon name="check" /> Confirmer</button>
          }
          @if (o.status === 'CONFIRMED') {
            <button class="btn btn-success" (click)="act('complete')" [disabled]="busy()">
              @if (busy()) { <span class="spinner"></span> } @else { <app-icon [name]="o.type === 'SALE' ? 'send' : 'arrow-down'" /> }
              {{ TYPE[o.type].complete }}
            </button>
          }
        </div>
      </div>

      <!-- Suivi d'avancement -->
      <div class="card steps no-print">
        @for (s of steps(); track s.label; let last = $last) {
          <div class="step" [class.done]="s.done" [class.cancelled]="s.cancelled">
            <span class="dot"><app-icon [name]="s.cancelled ? 'x' : s.done ? 'check' : s.icon" /></span>
            <div><b>{{ s.label }}</b><small>{{ s.date ? (s.date | frDate:true) : '—' }}</small></div>
          </div>
          @if (!last) { <span class="connector" [class.done]="s.done"></span> }
        }
      </div>

      <!-- Document imprimable -->
      <div class="card doc mt-6">
        <div class="doc-head">
          <div class="doc-brand"><img src="favicon.svg" alt="" width="40" height="40"><div><b>SmartStock</b><small>{{ o.type === 'SALE' ? 'Bon de vente' : 'Bon de commande fournisseur' }}</small></div></div>
          <div class="doc-meta">
            <b>{{ o.orderNumber }}</b>
            <small>Date : {{ o.orderDate | frDate }}</small>
            @if (o.expectedDate) { <small>{{ o.type === 'SALE' ? 'Expédition prévue' : 'Livraison prévue' }} : {{ o.expectedDate | frDate }}</small> }
          </div>
        </div>

        <div class="parties">
          <div><small>{{ TYPE[o.type].partner }}</small><b>{{ o.partnerName }}</b></div>
          <div><small>Entrepôt</small><b>{{ o.warehouseName }}</b></div>
          <div><small>Créée par</small><b>{{ o.createdBy }}</b></div>
          @if (o.completedBy) { <div><small>{{ TYPE[o.type].completed }} par</small><b>{{ o.completedBy }}</b></div> }
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>#</th><th>Produit</th><th>SKU</th><th class="num">Quantité</th><th class="num">Prix unitaire HT</th><th class="num">Total HT</th></tr></thead>
            <tbody>
              @for (l of o.lines; track l.id; let i = $index) {
                <tr>
                  <td class="muted">{{ i + 1 }}</td>
                  <td class="strong">{{ l.productName }}</td>
                  <td class="mono muted">{{ l.sku }}</td>
                  <td class="num">{{ l.quantity | num }}</td>
                  <td class="num">{{ l.unitPrice | money }}</td>
                  <td class="num strong">{{ l.lineTotal | money }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="doc-foot">
          <div class="notes">
            @if (o.notes) { <small>Notes</small><p>{{ o.notes }}</p> }
          </div>
          <div class="totals">
            <div><span>Total HT</span><b>{{ o.totalHt | money }}</b></div>
            <div><span>TVA ({{ o.taxRate }} %)</span><b>{{ o.totalTax | money }}</b></div>
            <div class="grand"><span>Total TTC</span><strong>{{ o.totalTtc | money }}</strong></div>
          </div>
        </div>
      </div>
    } @else if (error()) {
      <div class="alert-box danger"><app-icon name="alert" /> {{ error() }}</div>
    } @else {
      <div class="skeleton" style="height: 420px"></div>
    }
  `,
  styles: [`
    .back { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: var(--text-body); margin-bottom: 14px; }
    .back app-icon { width: 18px; height: 18px; }
    .page-subtitle { display: flex; align-items: center; gap: 10px; }
    .type { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: #d97706; }
    .type.sale { color: var(--primary); }
    .type app-icon { width: 18px; height: 18px; }
    .steps { display: flex; align-items: center; gap: 12px; padding: 20px 24px; overflow-x: auto; }
    .step { display: flex; align-items: center; gap: 12px; flex: none; }
    .step b { display: block; font-size: 14px; color: var(--text-muted); }
    .step small { font-size: 12px; color: var(--text-muted); }
    .step .dot { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--text-muted); border: 2px solid var(--border); }
    .step .dot app-icon { width: 16px; height: 16px; }
    .step.done .dot { background: var(--success); border-color: var(--success); color: #fff; }
    .step.done b { color: var(--text); }
    .step.cancelled .dot { background: var(--danger); border-color: var(--danger); color: #fff; }
    .step.cancelled b { color: var(--danger); }
    .connector { flex: 1; min-width: 40px; height: 2px; background: var(--border); }
    .connector.done { background: var(--success); }
    .doc { padding: 28px; }
    .doc-head { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
    .doc-brand { display: flex; align-items: center; gap: 12px; }
    .doc-brand img { border-radius: 10px; }
    .doc-brand b { display: block; font-size: 20px; color: var(--text); }
    .doc-brand small, .doc-meta small { color: var(--text-muted); font-size: 13px; }
    .doc-meta { display: flex; flex-direction: column; text-align: right; }
    .doc-meta b { font-size: 18px; color: var(--text); font-family: ui-monospace, monospace; }
    .parties { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
    .parties > div { padding: 12px 14px; border-radius: 12px; background: var(--surface-2); display: flex; flex-direction: column; }
    .parties small { font-size: 12px; color: var(--text-muted); }
    .parties b { color: var(--text); }
    .doc-foot { display: flex; justify-content: space-between; gap: 24px; margin-top: 20px; flex-wrap: wrap; }
    .notes { flex: 1; min-width: 220px; }
    .notes small { font-size: 12px; color: var(--text-muted); }
    .notes p { white-space: pre-line; font-size: 14px; }
    .totals { width: 300px; display: flex; flex-direction: column; gap: 8px; }
    .totals > div { display: flex; justify-content: space-between; font-size: 14px; }
    .totals b { color: var(--text); }
    .grand { padding-top: 12px; border-top: 2px solid var(--text); }
    .grand strong { font-size: 20px; color: var(--text); }
    @media print {
      .doc { padding: 0; }
      .table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `],
})
export class OrderDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly STATUS = ORDER_STATUS;
  protected readonly TYPE = ORDER_TYPE;
  protected readonly order = signal<Order | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly steps = computed(() => {
    const o = this.order();
    if (!o) return [];
    const cancelled = o.status === 'CANCELLED';
    return [
      { label: 'Brouillon', icon: 'file', date: o.createdAt, done: true, cancelled: false },
      { label: 'Confirmée', icon: 'check', date: o.confirmedAt, done: !!o.confirmedAt, cancelled: false },
      cancelled
        ? { label: 'Annulée', icon: 'x', date: o.cancelledAt, done: false, cancelled: true }
        : { label: ORDER_TYPE[o.type].completed, icon: o.type === 'SALE' ? 'send' : 'package', date: o.completedAt, done: o.status === 'COMPLETED', cancelled: false },
    ];
  });

  ngOnInit(): void {
    this.api.order(Number(this.id())).subscribe({
      next: o => this.order.set(o),
      error: err => this.error.set(errorMessage(err)),
    });
  }

  async act(action: 'confirm' | 'complete' | 'cancel'): Promise<void> {
    const o = this.order()!;
    const messages = {
      confirm: { title: 'Confirmer la commande ?', message: 'La commande ne pourra plus être modifiée.', label: 'Confirmer', danger: false },
      complete: {
        title: `${ORDER_TYPE[o.type].complete} la commande ?`,
        message: o.type === 'PURCHASE'
          ? `Les quantités seront ajoutées au stock de ${o.warehouseName}.`
          : `Les quantités seront retirées du stock de ${o.warehouseName}. L'opération échoue si le stock est insuffisant.`,
        label: ORDER_TYPE[o.type].complete, danger: false,
      },
      cancel: { title: 'Annuler la commande ?', message: 'Cette action est définitive.', label: 'Annuler la commande', danger: true },
    }[action];
    if (!await this.ui.confirm({ title: messages.title, message: messages.message, confirmLabel: messages.label, danger: messages.danger })) return;

    this.busy.set(true);
    this.api.orderAction(o.id, action).subscribe({
      next: updated => {
        this.order.set(updated);
        this.busy.set(false);
        this.ui.success({ confirm: 'Commande confirmée', complete: `Commande ${ORDER_TYPE[o.type].completed.toLowerCase()} — stock mis à jour`, cancel: 'Commande annulée' }[action]);
      },
      error: err => {
        this.busy.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  async remove(): Promise<void> {
    const o = this.order()!;
    if (!await this.ui.confirm({ title: 'Supprimer la commande ?', message: `${o.orderNumber} sera définitivement supprimée.`, confirmLabel: 'Supprimer', danger: true })) return;
    this.api.deleteOrder(o.id).subscribe({
      next: () => {
        this.ui.success('Commande supprimée');
        this.router.navigate(['/app/orders']);
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }

  print(): void {
    window.print();
  }
}
