import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CATEGORY_COLORS } from '../../core/labels';
import { Category } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Catégories</h1>
        <p class="page-subtitle">Organisez votre catalogue par familles de produits.</p>
      </div>
      @if (auth.canManage) {
        <div class="page-actions"><button class="btn btn-primary" (click)="open(null)"><app-icon name="plus" /> Nouvelle catégorie</button></div>
      }
    </div>

    <div class="cats">
      @for (c of categories(); track c.id) {
        <article class="cat card">
          <div class="cat-top">
            <span class="cat-icon" [style.background]="c.color ?? '#94a3b8'"><app-icon name="tag" /></span>
            @if (auth.canManage) {
              <div class="cat-actions">
                <button class="btn btn-ghost btn-icon btn-sm" (click)="open(c)" aria-label="Modifier"><app-icon name="edit" /></button>
                <button class="btn btn-ghost btn-icon btn-sm" (click)="remove(c)" aria-label="Supprimer"><app-icon name="trash" /></button>
              </div>
            }
          </div>
          <h3>{{ c.name }}</h3>
          @if (c.parentName) { <span class="parent"><app-icon name="chevron-right" /> dans {{ c.parentName }}</span> }
          <p>{{ c.description || 'Aucune description.' }}</p>
          <span class="count"><b>{{ c.productCount }}</b> produit{{ c.productCount > 1 ? 's' : '' }}</span>
        </article>
      } @empty {
        @if (!loading()) {
          <div class="card empty full"><app-icon name="tag" /><h4>Aucune catégorie</h4><p>Créez des catégories pour structurer votre catalogue.</p></div>
        }
      }
    </div>

    @if (editing() !== undefined) {
      <app-modal [title]="editing() ? 'Modifier la catégorie' : 'Nouvelle catégorie'" (closed)="editing.set(undefined)">
        <form id="cat-form" class="form-grid" (ngSubmit)="save()">
          <div class="field span-2">
            <label for="c-name">Nom *</label>
            <input id="c-name" class="input" name="name" [(ngModel)]="form.name" required maxlength="120" placeholder="ex. Électronique">
          </div>
          <div class="field span-2">
            <label for="c-parent">Catégorie parente</label>
            <select id="c-parent" class="select" name="parent" [(ngModel)]="form.parentId">
              <option [ngValue]="null">— Aucune —</option>
              @for (c of categories(); track c.id) {
                @if (c.id !== editing()?.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              }
            </select>
          </div>
          <div class="field span-2">
            <span class="label">Couleur</span>
            <div class="swatches">
              @for (color of colors; track color) {
                <button type="button" class="swatch" [style.background]="color" [class.active]="form.color === color" (click)="form.color = color" [attr.aria-label]="'Couleur ' + color"></button>
              }
            </div>
          </div>
          <div class="field span-2">
            <label for="c-desc">Description</label>
            <textarea id="c-desc" class="textarea" name="description" [(ngModel)]="form.description" rows="3"></textarea>
          </div>
          @if (error()) { <div class="alert-box danger span-2"><app-icon name="alert" /> {{ error() }}</div> }
        </form>
        <ng-container modal-footer>
          <button class="btn btn-secondary" (click)="editing.set(undefined)">Annuler</button>
          <button type="submit" form="cat-form" class="btn btn-primary" [disabled]="saving() || !form.name.trim()">Enregistrer</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: [`
    .cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
    .cat { padding: 20px; display: flex; flex-direction: column; gap: 8px; transition: transform .2s, box-shadow .2s; }
    .cat:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
    .cat-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .cat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; }
    .cat h3 { font-size: 17px; }
    .parent { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; color: var(--text-muted); }
    .parent app-icon { width: 14px; height: 14px; }
    .cat p { font-size: 14px; flex: 1; }
    .count { font-size: 13px; color: var(--text-muted); padding-top: 10px; border-top: 1px solid var(--border); cursor: default; }
    .count b { color: var(--text); font-size: 16px; }
    .full { grid-column: 1 / -1; }
    .swatches { display: flex; gap: 10px; flex-wrap: wrap; }
    .swatch { width: 32px; height: 32px; border-radius: 10px; border: 3px solid transparent; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
    .swatch.active { border-color: var(--surface); box-shadow: 0 0 0 2px var(--text); }
  `],
})
export class CategoriesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);

  protected readonly colors = CATEGORY_COLORS;
  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly editing = signal<Category | null | undefined>(undefined);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected form = { name: '', description: '', color: CATEGORY_COLORS[0], parentId: null as number | null };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.categories().subscribe({
      next: c => {
        this.categories.set(c);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  open(category: Category | null): void {
    this.error.set(null);
    this.saving.set(false);
    this.form = category
      ? { name: category.name, description: category.description ?? '', color: category.color ?? CATEGORY_COLORS[0], parentId: category.parentId }
      : { name: '', description: '', color: CATEGORY_COLORS[this.categories().length % CATEGORY_COLORS.length], parentId: null };
    this.editing.set(category);
  }

  save(): void {
    this.saving.set(true);
    this.api.saveCategory(this.editing()?.id ?? null, {
      name: this.form.name.trim(), description: this.form.description.trim() || null, color: this.form.color, parentId: this.form.parentId,
    }).subscribe({
      next: () => {
        this.ui.success('Catégorie enregistrée');
        this.editing.set(undefined);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  async remove(category: Category): Promise<void> {
    if (!await this.ui.confirm({ title: 'Supprimer la catégorie ?', message: `« ${category.name} » sera supprimée. Elle ne doit plus contenir de produits.`, confirmLabel: 'Supprimer', danger: true })) return;
    this.api.deleteCategory(category.id).subscribe({
      next: () => {
        this.ui.success('Catégorie supprimée');
        this.load();
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }
}
