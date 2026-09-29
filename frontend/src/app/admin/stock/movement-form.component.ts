import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { UNIT_LABELS } from '../../core/labels';
import { ProductOption, Warehouse } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

export type MovementAction = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';

const ACTIONS: { value: MovementAction; label: string; icon: string; hint: string }[] = [
  { value: 'IN', label: 'Entrée', icon: 'arrow-down', hint: 'Réception, retour client, stock initial…' },
  { value: 'OUT', label: 'Sortie', icon: 'arrow-up', hint: 'Vente comptoir, consommation, casse…' },
  { value: 'ADJUSTMENT', label: 'Inventaire', icon: 'clipboard', hint: 'Saisissez la quantité réellement comptée.' },
  { value: 'TRANSFER', label: 'Transfert', icon: 'transfer', hint: 'Déplacer du stock entre deux entrepôts.' },
];

/** Enregistrement d'un mouvement manuel ou d'un transfert, depuis n'importe quelle page. */
@Component({
  selector: 'app-movement-form',
  standalone: true,
  imports: [FormsModule, ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Mouvement de stock" subtitle="Chaque opération est tracée à votre nom." [width]="600" (closed)="closed.emit()">
      <div class="types" role="radiogroup" aria-label="Type de mouvement">
        @for (a of actions; track a.value) {
          <button type="button" role="radio" [attr.aria-checked]="type() === a.value" [class.active]="type() === a.value" [class]="'type t-' + a.value" (click)="type.set(a.value)">
            <app-icon [name]="a.icon" /> {{ a.label }}
          </button>
        }
      </div>
      <p class="type-hint">{{ current().hint }}</p>

      <form id="movement-form" class="form-grid" (ngSubmit)="save()">
        <div class="field span-2">
          <label for="mv-product">Produit *</label>
          <select id="mv-product" class="select" name="product" [(ngModel)]="productId" required>
            <option [ngValue]="null" disabled>Choisir un produit…</option>
            @for (p of products(); track p.id) { <option [ngValue]="p.id">{{ p.name }} — {{ p.sku }}</option> }
          </select>
        </div>

        @if (type() === 'TRANSFER') {
          <div class="field">
            <label for="mv-from">Depuis *</label>
            <select id="mv-from" class="select" name="from" [(ngModel)]="warehouseId" required>
              <option [ngValue]="null" disabled>Entrepôt source…</option>
              @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.code }} · {{ w.name }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="mv-to">Vers *</label>
            <select id="mv-to" class="select" name="to" [(ngModel)]="toWarehouseId" required>
              <option [ngValue]="null" disabled>Entrepôt destination…</option>
              @for (w of warehouses(); track w.id) { <option [ngValue]="w.id" [disabled]="w.id === warehouseId">{{ w.code }} · {{ w.name }}</option> }
            </select>
          </div>
        } @else {
          <div class="field span-2">
            <label for="mv-wh">Entrepôt *</label>
            <select id="mv-wh" class="select" name="warehouse" [(ngModel)]="warehouseId" required>
              <option [ngValue]="null" disabled>Choisir un entrepôt…</option>
              @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.code }} · {{ w.name }}</option> }
            </select>
          </div>
        }

        <div class="field">
          <label for="mv-qty">{{ type() === 'ADJUSTMENT' ? 'Quantité comptée *' : 'Quantité *' }}</label>
          <div class="qty">
            <button type="button" class="btn btn-secondary btn-icon" (click)="quantity = Math.max(0, (quantity || 0) - 1)" aria-label="Moins"><app-icon name="minus" /></button>
            <input id="mv-qty" class="input" type="number" name="quantity" [(ngModel)]="quantity" [min]="type() === 'ADJUSTMENT' ? 0 : 1" step="1" required>
            <button type="button" class="btn btn-secondary btn-icon" (click)="quantity = (quantity || 0) + 1" aria-label="Plus"><app-icon name="plus" /></button>
          </div>
          @if (selectedUnit()) { <span class="hint">Unité : {{ selectedUnit() }}</span> }
        </div>

        @if (type() === 'IN') {
          <div class="field">
            <label for="mv-cost">Coût unitaire</label>
            <input id="mv-cost" class="input" type="number" name="unitCost" [(ngModel)]="unitCost" min="0" step="0.01" placeholder="Optionnel">
          </div>
        } @else if (type() !== 'TRANSFER') {
          <div class="field">
            <label for="mv-ref">Référence</label>
            <input id="mv-ref" class="input" name="reference" [(ngModel)]="reference" maxlength="64" placeholder="N° de ticket, bon…">
          </div>
        }

        <div class="field span-2">
          <label for="mv-reason">Motif</label>
          <input id="mv-reason" class="input" name="reason" [(ngModel)]="reason" maxlength="255" [placeholder]="reasonPlaceholder()">
        </div>

        @if (error()) { <div class="alert-box danger span-2"><app-icon name="alert" /> {{ error() }}</div> }
      </form>

      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Annuler</button>
        <button type="submit" form="movement-form" class="btn btn-primary" [disabled]="saving() || !valid()">
          @if (saving()) { <span class="spinner"></span> } Enregistrer
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    .types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .type { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px; border-radius: 12px; border: 1.5px solid var(--border);
      background: var(--surface); color: var(--text-body); font-weight: 600; font-size: 13px; cursor: pointer; transition: .15s; }
    .type:hover { border-color: var(--border-strong); }
    .type.active.t-IN { border-color: var(--success); background: var(--success-soft); color: #059669; }
    .type.active.t-OUT { border-color: var(--danger); background: var(--danger-soft); color: #dc2626; }
    .type.active.t-ADJUSTMENT { border-color: var(--warning); background: var(--warning-soft); color: #c27803; }
    .type.active.t-TRANSFER { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
    .type-hint { font-size: 13px; color: var(--text-muted); margin: 10px 0 18px; }
    .qty { display: flex; gap: 6px; }
    .qty .input { text-align: center; font-weight: 700; }
    .qty .btn-icon { height: 42px; width: 42px; flex: none; }
    @media (max-width: 520px) { .types { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class MovementFormComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);

  readonly initialType = input<MovementAction>('IN');
  readonly initialProductId = input<number | null>(null);
  readonly initialWarehouseId = input<number | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly Math = Math;
  protected readonly actions = ACTIONS;
  protected readonly type = signal<MovementAction>('IN');
  protected readonly current = computed(() => ACTIONS.find(a => a.value === this.type())!);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected productId: number | null = null;
  protected warehouseId: number | null = null;
  protected toWarehouseId: number | null = null;
  protected quantity: number | null = 1;
  protected unitCost: number | null = null;
  protected reference = '';
  protected reason = '';

  protected readonly reasonPlaceholder = computed(() => ({
    IN: 'ex. Réception fournisseur, retour client',
    OUT: 'ex. Vente comptoir, casse, échantillon',
    ADJUSTMENT: 'ex. Inventaire mensuel',
    TRANSFER: 'ex. Rééquilibrage entre sites',
  })[this.type()]);

  ngOnInit(): void {
    this.type.set(this.initialType());
    this.productId = this.initialProductId();
    this.warehouseId = this.initialWarehouseId();
    this.api.productOptions().subscribe(p => this.products.set(p));
    this.api.warehouses().subscribe(w => {
      const active = w.filter(x => x.active);
      this.warehouses.set(active);
      if (this.warehouseId === null && active.length === 1) this.warehouseId = active[0].id;
    });
  }

  selectedUnit(): string | null {
    const p = this.products().find(x => x.id === this.productId);
    return p ? UNIT_LABELS[p.unitOfMeasure] : null;
  }

  valid(): boolean {
    const qty = Number(this.quantity);
    if (!this.productId || !this.warehouseId || !Number.isInteger(qty)) return false;
    if (this.type() === 'TRANSFER') return !!this.toWarehouseId && this.toWarehouseId !== this.warehouseId && qty > 0;
    return this.type() === 'ADJUSTMENT' ? qty >= 0 : qty > 0;
  }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    const reason = this.reason.trim() || null;
    const request: Observable<unknown> = this.type() === 'TRANSFER'
      ? this.api.transfer({ productId: this.productId!, fromWarehouseId: this.warehouseId!, toWarehouseId: this.toWarehouseId!, quantity: Number(this.quantity), reason })
      : this.api.recordMovement({
        productId: this.productId!, warehouseId: this.warehouseId!, type: this.type() as 'IN' | 'OUT' | 'ADJUSTMENT', quantity: Number(this.quantity),
        unitCost: this.type() === 'IN' && this.unitCost !== null ? Number(this.unitCost) : null, reason, reference: this.reference.trim() || null,
      });
    request.subscribe({
      next: () => {
        this.ui.success(this.type() === 'TRANSFER' ? 'Transfert enregistré' : 'Mouvement enregistré');
        this.saved.emit();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
