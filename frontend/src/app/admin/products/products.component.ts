import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { downloadCsv } from '../../core/csv';
import { STOCK_STATUS, UNIT_LABELS } from '../../core/labels';
import { Category, Page, Product, StockStatus } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { MoneyPipe, NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { ProductFormComponent } from './product-form.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, PaginationComponent, ProductFormComponent, MoneyPipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Produits</h1>
        <p class="page-subtitle">Votre catalogue, avec le stock total tous entrepôts confondus.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" (click)="exportCsv()" [disabled]="exporting()"><app-icon name="download" /> Exporter</button>
        @if (auth.canManage) {
          <button class="btn btn-primary" (click)="openForm(null)"><app-icon name="plus" /> Nouveau produit</button>
        }
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="input-group">
          <app-icon name="search" />
          <input class="input" [(ngModel)]="search" (ngModelChange)="search$.next()" placeholder="Nom, SKU ou code-barres…" aria-label="Rechercher">
        </div>
        <select class="select" [(ngModel)]="categoryId" (ngModelChange)="reload()" aria-label="Catégorie">
          <option [ngValue]="null">Toutes les catégories</option>
          @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
        </select>
        <select class="select" [(ngModel)]="status" (ngModelChange)="reload()" aria-label="Statut de stock">
          <option [ngValue]="null">Tous les statuts</option>
          <option value="IN_STOCK">En stock</option>
          <option value="LOW">Stock bas</option>
          <option value="OUT">Rupture</option>
        </select>
        <select class="select" [(ngModel)]="active" (ngModelChange)="reload()" aria-label="Actif">
          <option [ngValue]="true">Actifs</option>
          <option [ngValue]="false">Archivés</option>
          <option [ngValue]="null">Tous</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Produit</th><th>Catégorie</th><th class="num">Prix de vente</th><th class="num">Coût</th><th class="num">Stock</th><th>Statut</th>
              @if (auth.canManage) { <th class="actions"></th> }
            </tr>
          </thead>
          <tbody>
            @if (loading() && !page()) {
              @for (i of [1, 2, 3, 4, 5]; track i) { <tr><td colspan="7"><div class="skeleton" style="height: 22px"></div></td></tr> }
            }
            @for (p of page()?.content; track p.id) {
              <tr class="clickable" (click)="router.navigate(['/app/products', p.id])">
                <td>
                  <div class="product-cell">
                    <span class="thumb" [style.background]="p.categoryColor ?? '#94a3b8'">{{ p.name.charAt(0) }}</span>
                    <div><span class="strong">{{ p.name }}</span><small class="mono muted">{{ p.sku }}</small></div>
                  </div>
                </td>
                <td>{{ p.categoryName ?? '—' }}</td>
                <td class="num strong">{{ p.unitPrice | money }}</td>
                <td class="num">{{ p.costPrice | money }}</td>
                <td class="num"><span class="strong">{{ p.totalQuantity | num }}</span> <small class="muted">{{ UNIT[p.unitOfMeasure] }}</small></td>
                <td>
                  @if (!p.active) { <span class="badge badge-muted">Archivé</span> }
                  @else { <span class="badge" [class]="'badge ' + STATUS[p.stockStatus].badge">{{ STATUS[p.stockStatus].label }}</span> }
                </td>
                @if (auth.canManage) {
                  <td class="actions" (click)="$event.stopPropagation()">
                    <button class="btn btn-ghost btn-icon btn-sm" (click)="openForm(p)" title="Modifier" aria-label="Modifier"><app-icon name="edit" /></button>
                    <button class="btn btn-ghost btn-icon btn-sm" (click)="remove(p)" title="Supprimer" aria-label="Supprimer"><app-icon name="trash" /></button>
                  </td>
                }
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="7">
                  <div class="empty"><app-icon name="package" /><h4>Aucun produit</h4><p>Modifiez les filtres ou ajoutez votre premier produit.</p></div>
                </td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (page(); as pg) {
        <app-pagination [page]="pg.page" [size]="pg.size" [total]="pg.totalElements" [totalPages]="pg.totalPages" (changed)="goTo($event)" />
      }
    </div>

    @if (editing() !== undefined) {
      <app-product-form [product]="editing()!" (closed)="editing.set(undefined)" (saved)="onSaved()" />
    }
  `,
  styles: [`
    .product-cell { display: flex; align-items: center; gap: 12px; }
    .product-cell > div { display: flex; flex-direction: column; min-width: 0; }
    .thumb { width: 38px; height: 38px; border-radius: 10px; flex: none; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; text-transform: uppercase; }
  `],
})
export class ProductsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  /** ?action=new ouvre directement le formulaire (depuis la recherche rapide). */
  readonly action = input<string>();

  protected readonly STATUS = STOCK_STATUS;
  protected readonly UNIT = UNIT_LABELS;
  protected readonly page = signal<Page<Product> | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  /** undefined = fermé, null = création, Product = édition. */
  protected readonly editing = signal<Product | null | undefined>(undefined);

  protected search = '';
  protected categoryId: number | null = null;
  protected status: StockStatus | null = null;
  protected active: boolean | null = true;
  private pageIndex = 0;
  protected readonly search$ = new Subject<void>();

  ngOnInit(): void {
    this.api.categories().subscribe(c => this.categories.set(c));
    this.search$.pipe(debounceTime(300)).subscribe(() => this.reload());
    this.load();
    if (this.action() === 'new' && this.auth.canManage) this.openForm(null);
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
    this.api.products(this.filters(this.pageIndex, 15)).subscribe({
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

  openForm(product: Product | null): void {
    this.editing.set(product);
  }

  onSaved(): void {
    this.editing.set(undefined);
    this.load();
  }

  async remove(product: Product): Promise<void> {
    const ok = await this.ui.confirm({
      title: 'Supprimer le produit ?',
      message: `« ${product.name} » sera définitivement supprimé. Un produit avec un historique de mouvements ne peut pas être supprimé : archivez-le plutôt.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteProduct(product.id).subscribe({
      next: () => {
        this.ui.success('Produit supprimé');
        this.load();
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }

  async exportCsv(): Promise<void> {
    this.exporting.set(true);
    try {
      const rows: Product[] = [];
      for (let p = 0; ; p++) {
        const page = await firstValueFrom(this.api.products(this.filters(p, 100)));
        rows.push(...page.content);
        if (p + 1 >= page.totalPages) break;
      }
      downloadCsv(`produits-${new Date().toISOString().slice(0, 10)}.csv`,
        ['SKU', 'Nom', 'Catégorie', 'Code-barres', 'Unité', 'Prix de vente', 'Coût', 'Stock', 'Seuil', 'Statut', 'Actif'],
        rows.map(p => [p.sku, p.name, p.categoryName, p.barcode, UNIT_LABELS[p.unitOfMeasure], p.unitPrice, p.costPrice, p.totalQuantity,
          p.reorderPoint, STOCK_STATUS[p.stockStatus].label, p.active ? 'Oui' : 'Non']));
    } catch (err) {
      this.ui.error(errorMessage(err));
    } finally {
      this.exporting.set(false);
    }
  }

  private filters(page: number, size: number) {
    return { search: this.search, categoryId: this.categoryId, status: this.status, active: this.active, page, size };
  }
}
