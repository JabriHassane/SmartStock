import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { UNIT_LABELS } from '../../core/labels';
import { Category, Product, UnitOfMeasure } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="product() ? 'Modifier le produit' : 'Nouveau produit'" [subtitle]="product()?.sku ?? 'Ajoutez un article à votre catalogue'" [width]="720" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()" id="product-form" class="form-grid">
        <div class="field">
          <label for="sku">SKU *</label>
          <input id="sku" class="input mono" formControlName="sku" placeholder="ex. LAP-001" maxlength="64">
        </div>
        <div class="field">
          <label for="barcode">Code-barres</label>
          <div class="input-group"><app-icon name="scan" /><input id="barcode" class="input" formControlName="barcode" placeholder="EAN / UPC" maxlength="64"></div>
        </div>
        <div class="field span-2">
          <label for="name">Nom du produit *</label>
          <input id="name" class="input" formControlName="name" placeholder="ex. Laptop Pro 14 pouces" maxlength="200">
        </div>
        <div class="field">
          <label for="category">Catégorie</label>
          <select id="category" class="select" formControlName="categoryId">
            <option [ngValue]="null">— Sans catégorie —</option>
            @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="unit">Unité *</label>
          <select id="unit" class="select" formControlName="unitOfMeasure">
            @for (u of units; track u) { <option [value]="u">{{ UNIT[u] }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="cost">Prix d'achat (HT) *</label>
          <input id="cost" class="input" type="number" min="0" step="0.01" formControlName="costPrice">
        </div>
        <div class="field">
          <label for="price">Prix de vente (HT) *</label>
          <input id="price" class="input" type="number" min="0" step="0.01" formControlName="unitPrice">
          @if (margin() !== null) { <span class="hint">Marge : <b [class.text-success]="margin()! >= 0" [class.text-danger]="margin()! < 0">{{ margin() }} %</b></span> }
        </div>
        <div class="field">
          <label for="reorderPoint">Seuil d'alerte</label>
          <input id="reorderPoint" class="input" type="number" min="0" step="1" formControlName="reorderPoint">
          <span class="hint">Alerte « stock bas » à partir de cette quantité.</span>
        </div>
        <div class="field">
          <label for="reorderQuantity">Quantité de réapprovisionnement</label>
          <input id="reorderQuantity" class="input" type="number" min="0" step="1" formControlName="reorderQuantity">
          <span class="hint">Quantité commandée habituellement.</span>
        </div>
        <div class="field span-2">
          <label for="description">Description</label>
          <textarea id="description" class="textarea" formControlName="description" rows="3" placeholder="Caractéristiques, emplacement, remarques…"></textarea>
        </div>
        <div class="span-2">
          <label class="switch"><input type="checkbox" formControlName="active"><span class="track"></span> Produit actif (décochez pour l'archiver)</label>
        </div>
        @if (error()) { <div class="alert-box danger span-2"><app-icon name="alert" /> {{ error() }}</div> }
      </form>
      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Annuler</button>
        <button type="submit" form="product-form" class="btn btn-primary" [disabled]="saving() || form.invalid">
          @if (saving()) { <span class="spinner"></span> } Enregistrer
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class ProductFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);

  readonly product = input<Product | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Product>();

  protected readonly UNIT = UNIT_LABELS;
  protected readonly units = Object.keys(UNIT_LABELS) as UnitOfMeasure[];
  protected readonly categories = signal<Category[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly margin = signal<number | null>(null);

  protected readonly form = this.fb.group({
    sku: ['', [Validators.required, Validators.maxLength(64)]],
    barcode: [''],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    categoryId: [null as number | null],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    costPrice: [0, [Validators.required, Validators.min(0)]],
    unitOfMeasure: ['PIECE' as UnitOfMeasure, Validators.required],
    reorderPoint: [0, [Validators.required, Validators.min(0)]],
    reorderQuantity: [0, [Validators.required, Validators.min(0)]],
    active: [true],
  });

  ngOnInit(): void {
    this.api.categories().subscribe(c => this.categories.set(c));
    const p = this.product();
    if (p) {
      this.form.patchValue({ ...p, barcode: p.barcode ?? '', description: p.description ?? '' });
    }
    this.updateMargin();
    this.form.valueChanges.subscribe(() => this.updateMargin());
  }

  save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api.saveProduct(this.product()?.id ?? null, {
      sku: v.sku!.trim(),
      barcode: v.barcode?.trim() || null,
      name: v.name!.trim(),
      description: v.description?.trim() || null,
      categoryId: v.categoryId ?? null,
      unitPrice: Number(v.unitPrice),
      costPrice: Number(v.costPrice),
      unitOfMeasure: v.unitOfMeasure!,
      reorderPoint: Number(v.reorderPoint),
      reorderQuantity: Number(v.reorderQuantity),
      active: !!v.active,
    }).subscribe({
      next: product => {
        this.ui.success(this.product() ? 'Produit mis à jour' : 'Produit créé');
        this.saved.emit(product);
      },
      error: err => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  private updateMargin(): void {
    const cost = Number(this.form.value.costPrice);
    const price = Number(this.form.value.unitPrice);
    this.margin.set(price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null);
  }
}
