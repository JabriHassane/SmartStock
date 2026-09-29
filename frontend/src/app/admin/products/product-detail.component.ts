import { LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MOVEMENT_LABELS, STOCK_STATUS, UNIT_LABELS } from '../../core/labels';
import { Movement, ProductDetail } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { FrDatePipe, MoneyPipe, NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';
import { MovementAction, MovementFormComponent } from '../stock/movement-form.component';
import { ProductFormComponent } from './product-form.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, LowerCasePipe, IconComponent, ProductFormComponent, MovementFormComponent, MoneyPipe, NumPipe, FrDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/app/products" class="back"><app-icon name="chevron-left" /> Produits</a>

    @if (detail(); as d) {
      <div class="page-header">
        <div class="title-row">
          <span class="thumb" [style.background]="d.product.categoryColor ?? '#94a3b8'">{{ d.product.name.charAt(0) }}</span>
          <div>
            <h1 class="page-title">{{ d.product.name }}</h1>
            <p class="page-subtitle">
              <span class="mono">{{ d.product.sku }}</span>
              @if (d.product.categoryName) { · {{ d.product.categoryName }} }
              · @if (!d.product.active) { <span class="badge badge-muted">Archivé</span> }
              @else { <span class="badge" [class]="'badge ' + STATUS[d.product.stockStatus].badge">{{ STATUS[d.product.stockStatus].label }}</span> }
            </p>
          </div>
        </div>
        <div class="page-actions">
          @if (d.product.active) {
            <button class="btn btn-secondary" (click)="openMovement('OUT')"><app-icon name="arrow-up" /> Sortie</button>
            <button class="btn btn-secondary" (click)="openMovement('IN')"><app-icon name="arrow-down" /> Entrée</button>
          }
          @if (auth.canManage) {
            <button class="btn btn-primary" (click)="editing.set(true)"><app-icon name="edit" /> Modifier</button>
          }
        </div>
      </div>

      <div class="grid grid-4">
        <div class="stat"><small>Stock total</small><strong>{{ d.product.totalQuantity | num }} <span>{{ UNIT[d.product.unitOfMeasure] }}</span></strong></div>
        <div class="stat"><small>Valeur au coût</small><strong>{{ d.product.totalQuantity * d.product.costPrice | money }}</strong></div>
        <div class="stat"><small>Sorties moyennes / jour</small><strong>{{ d.insight.avgDailyOut | num }}</strong></div>
        <div class="stat" [class.warn]="d.insight.daysOfCover !== null && d.insight.daysOfCover < 14">
          <small>Couverture estimée</small>
          <strong>{{ d.insight.daysOfCover === null ? '—' : d.insight.daysOfCover + ' j' }}</strong>
        </div>
      </div>

      @if (d.insight.suggestedReorder > 0) {
        <div class="suggest mt-4">
          <app-icon name="sparkles" />
          <div>
            <b>Réapprovisionnement conseillé : {{ d.insight.suggestedReorder | num }} {{ UNIT[d.product.unitOfMeasure] | lowercase }}</b>
            <small>Calculé à partir de la vélocité sur 30 jours et du seuil d'alerte ({{ d.product.reorderPoint }}).</small>
          </div>
          @if (auth.canManage) {
            <a class="btn btn-sm btn-white" routerLink="/app/orders/new" [queryParams]="{ type: 'PURCHASE', productId: d.product.id, quantity: d.insight.suggestedReorder }">Créer un bon d'achat</a>
          }
        </div>
      }

      <div class="grid grid-3 mt-6">
        <section class="card">
          <div class="card-header"><div class="card-title">Informations</div></div>
          <dl class="info">
            <div><dt>Prix de vente HT</dt><dd>{{ d.product.unitPrice | money }}</dd></div>
            <div><dt>Prix d'achat HT</dt><dd>{{ d.product.costPrice | money }}</dd></div>
            <div><dt>Marge</dt><dd [class.text-success]="margin() >= 0" [class.text-danger]="margin() < 0">{{ margin() }} %</dd></div>
            <div><dt>Unité</dt><dd>{{ UNIT[d.product.unitOfMeasure] }}</dd></div>
            <div><dt>Seuil d'alerte</dt><dd>{{ d.product.reorderPoint | num }}</dd></div>
            <div><dt>Qté de réappro.</dt><dd>{{ d.product.reorderQuantity | num }}</dd></div>
            <div><dt>Code-barres</dt><dd class="mono">{{ d.product.barcode ?? '—' }}</dd></div>
            <div><dt>Créé le</dt><dd>{{ d.product.createdAt | frDate }}</dd></div>
          </dl>
          @if (d.product.description) { <p class="desc">{{ d.product.description }}</p> }
        </section>

        <section class="card">
          <div class="card-header"><div class="card-title">Stock par entrepôt</div></div>
          <ul class="wh-list">
            @for (s of d.stock; track s.warehouseId) {
              <li>
                <div class="wh-line"><span><b>{{ s.warehouseCode }}</b> {{ s.warehouseName }}</span><strong>{{ s.quantityOnHand | num }}</strong></div>
                <div class="bar"><span [style.width.%]="share(s.quantityOnHand)"></span></div>
              </li>
            } @empty {
              <li class="muted">Aucun stock enregistré pour ce produit.</li>
            }
          </ul>
        </section>

        <section class="card">
          <div class="card-header">
            <div class="card-title">Derniers mouvements</div>
            <a routerLink="/app/movements" [queryParams]="{ productId: d.product.id }" class="btn btn-ghost btn-sm">Tout voir</a>
          </div>
          <ul class="mv-list">
            @for (m of movements(); track m.id) {
              <li>
                <span class="badge" [class]="'badge ' + MOVEMENT[m.type].badge">{{ MOVEMENT[m.type].label }}</span>
                <span class="mv-main"><small>{{ m.warehouseCode }} · {{ m.createdBy }} · {{ m.createdAt | frDate:true }}</small></span>
                <b [class.text-success]="m.quantity > 0" [class.text-danger]="m.quantity < 0">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</b>
              </li>
            } @empty {
              <li class="muted">Aucun mouvement.</li>
            }
          </ul>
        </section>
      </div>

      @if (editing()) {
        <app-product-form [product]="d.product" (closed)="editing.set(false)" (saved)="editing.set(false); load()" />
      }
      @if (movementType(); as t) {
        <app-movement-form [initialType]="t" [initialProductId]="d.product.id" [initialWarehouseId]="d.stock.length === 1 ? d.stock[0].warehouseId : null"
          (closed)="movementType.set(null)" (saved)="movementType.set(null); load()" />
      }
    } @else if (!error()) {
      <div class="skeleton" style="height: 80px"></div>
      <div class="grid grid-4 mt-6">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton" style="height: 96px"></div> }</div>
    } @else {
      <div class="alert-box danger"><app-icon name="alert" /> {{ error() }}</div>
    }
  `,
  styles: [`
    .back { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: var(--text-body); margin-bottom: 14px; }
    .back app-icon { width: 18px; height: 18px; }
    .title-row { display: flex; align-items: center; gap: 16px; }
    .thumb { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 800; text-transform: uppercase; flex: none; }
    .page-subtitle { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .stat { padding: 18px 20px; border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; }
    .stat small { font-size: 13px; color: var(--text-muted); font-weight: 600; }
    .stat strong { font-size: 24px; color: var(--text); font-weight: 800; }
    .stat strong span { font-size: 14px; color: var(--text-muted); font-weight: 500; }
    .stat.warn strong { color: #d97706; }
    .suggest { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 16px; background: linear-gradient(120deg, #0a1e35, #1a4aa6); color: #fff; flex-wrap: wrap; }
    .suggest app-icon { width: 26px; height: 26px; color: #fbbf24; }
    .suggest div { flex: 1; min-width: 200px; display: flex; flex-direction: column; }
    .suggest small { color: rgba(255, 255, 255, .7); }
    .btn-white { background: #fff; color: var(--primary); }
    .info { margin: 0; padding: 8px 20px; }
    .info > div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--border); font-size: 14px; }
    .info > div:last-child { border-bottom: none; }
    .info dt { color: var(--text-muted); }
    .info dd { margin: 0; color: var(--text); font-weight: 600; text-align: right; }
    .desc { padding: 0 20px 20px; font-size: 14px; white-space: pre-line; }
    .wh-list, .mv-list { list-style: none; margin: 0; padding: 12px 20px 20px; display: flex; flex-direction: column; gap: 14px; }
    .wh-line { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
    .wh-line b { color: var(--text); margin-right: 4px; }
    .wh-line strong { color: var(--text); }
    .bar { height: 8px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #2f73f2, #6ea8ff); }
    .mv-list li { display: flex; align-items: center; gap: 10px; }
    .mv-main { flex: 1; min-width: 0; }
    .mv-main small { font-size: 12px; color: var(--text-muted); }
  `],
})
export class ProductDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly STATUS = STOCK_STATUS;
  protected readonly UNIT = UNIT_LABELS;
  protected readonly MOVEMENT = MOVEMENT_LABELS;
  protected readonly detail = signal<ProductDetail | null>(null);
  protected readonly movements = signal<Movement[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly movementType = signal<MovementAction | null>(null);

  protected readonly margin = computed(() => {
    const p = this.detail()?.product;
    return p && p.unitPrice > 0 ? Math.round(((p.unitPrice - p.costPrice) / p.unitPrice) * 1000) / 10 : 0;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = Number(this.id());
    this.api.product(id).subscribe({
      next: d => this.detail.set(d),
      error: err => this.error.set(errorMessage(err)),
    });
    this.api.movements({ productId: id, size: 8 }).subscribe({ next: p => this.movements.set(p.content), error: () => undefined });
  }

  openMovement(type: MovementAction): void {
    this.movementType.set(type);
  }

  share(quantity: number): number {
    const total = this.detail()?.product.totalQuantity ?? 0;
    return total > 0 ? (quantity / total) * 100 : 0;
  }
}
