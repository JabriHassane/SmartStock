import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Warehouse } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { MoneyPipe, NumPipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, MoneyPipe, NumPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Entrepôts</h1>
        <p class="page-subtitle">Vos sites de stockage et leur contenu.</p>
      </div>
      @if (auth.canManage) {
        <div class="page-actions"><button class="btn btn-primary" (click)="open(null)"><app-icon name="plus" /> Nouvel entrepôt</button></div>
      }
    </div>

    <div class="whs">
      @for (w of warehouses(); track w.id) {
        <article class="wh card" [class.inactive]="!w.active">
          <div class="wh-head">
            <span class="wh-icon"><app-icon name="warehouse" /></span>
            <div class="wh-title">
              <h3>{{ w.name }}</h3>
              <span class="mono muted">{{ w.code }}</span>
            </div>
            @if (!w.active) { <span class="badge badge-muted">Désactivé</span> } @else { <span class="badge badge-success">Actif</span> }
          </div>
          @if (w.address || w.city) {
            <p class="addr"><app-icon name="pin" /> {{ address(w) }}</p>
          }
          <div class="wh-stats">
            <div><small>Produits</small><b>{{ w.productCount | num }}</b></div>
            <div><small>Unités</small><b>{{ w.totalUnits | num }}</b></div>
            <div><small>Valeur</small><b>{{ w.stockValue | money:true }}</b></div>
          </div>
          <div class="wh-actions">
            <a class="btn btn-secondary btn-sm" routerLink="/app/stock"><app-icon name="layers" /> Voir le stock</a>
            @if (auth.canManage) {
              <button class="btn btn-ghost btn-icon btn-sm" (click)="open(w)" aria-label="Modifier"><app-icon name="edit" /></button>
            }
            @if (auth.isSuperAdmin) {
              <button class="btn btn-ghost btn-icon btn-sm" (click)="remove(w)" aria-label="Supprimer"><app-icon name="trash" /></button>
            }
          </div>
        </article>
      } @empty {
        @if (!loading()) {
          <div class="card empty full"><app-icon name="warehouse" /><h4>Aucun entrepôt</h4><p>Créez votre premier entrepôt pour enregistrer du stock.</p></div>
        }
      }
    </div>

    @if (editing() !== undefined) {
      <app-modal [title]="editing() ? 'Modifier l\\'entrepôt' : 'Nouvel entrepôt'" (closed)="editing.set(undefined)">
        <form id="wh-form" class="form-grid" (ngSubmit)="save()">
          <div class="field">
            <label for="w-code">Code *</label>
            <input id="w-code" class="input mono" name="code" [(ngModel)]="form.code" required maxlength="20" placeholder="ex. CASA">
          </div>
          <div class="field">
            <label for="w-name">Nom *</label>
            <input id="w-name" class="input" name="name" [(ngModel)]="form.name" required maxlength="120" placeholder="ex. Entrepôt principal">
          </div>
          <div class="field span-2">
            <label for="w-addr">Adresse</label>
            <input id="w-addr" class="input" name="address" [(ngModel)]="form.address" maxlength="255">
          </div>
          <div class="field">
            <label for="w-city">Ville</label>
            <input id="w-city" class="input" name="city" [(ngModel)]="form.city" maxlength="120">
          </div>
          <div class="field" style="justify-content: flex-end">
            <label class="switch"><input type="checkbox" name="active" [(ngModel)]="form.active"><span class="track"></span> Actif</label>
          </div>
          @if (error()) { <div class="alert-box danger span-2"><app-icon name="alert" /> {{ error() }}</div> }
        </form>
        <ng-container modal-footer>
          <button class="btn btn-secondary" (click)="editing.set(undefined)">Annuler</button>
          <button type="submit" form="wh-form" class="btn btn-primary" [disabled]="saving() || !form.code.trim() || !form.name.trim()">Enregistrer</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: [`
    .whs { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .wh { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .wh.inactive { opacity: .7; }
    .wh-head { display: flex; align-items: center; gap: 12px; }
    .wh-icon { width: 46px; height: 46px; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #2f73f2, #6ea8ff); color: #fff; flex: none; }
    .wh-title { flex: 1; min-width: 0; }
    .wh-title h3 { font-size: 16px; }
    .addr { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .addr app-icon { width: 16px; height: 16px; color: var(--text-muted); }
    .wh-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .wh-stats div { padding: 10px 12px; border-radius: 12px; background: var(--surface-2); display: flex; flex-direction: column; }
    .wh-stats small { font-size: 12px; color: var(--text-muted); }
    .wh-stats b { color: var(--text); font-size: 15px; }
    .wh-actions { display: flex; gap: 6px; align-items: center; }
    .wh-actions .btn-secondary { margin-right: auto; }
    .full { grid-column: 1 / -1; }
  `],
})
export class WarehousesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);

  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly loading = signal(true);
  protected readonly editing = signal<Warehouse | null | undefined>(undefined);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected form = { code: '', name: '', address: '', city: '', active: true };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.warehouses().subscribe({
      next: w => {
        this.warehouses.set(w);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  address(w: Warehouse): string {
    return [w.address, w.city].filter(Boolean).join(', ');
  }

  open(w: Warehouse | null): void {
    this.error.set(null);
    this.saving.set(false);
    this.form = w ? { code: w.code, name: w.name, address: w.address ?? '', city: w.city ?? '', active: w.active } : { code: '', name: '', address: '', city: '', active: true };
    this.editing.set(w);
  }

  save(): void {
    this.saving.set(true);
    this.api.saveWarehouse(this.editing()?.id ?? null, {
      code: this.form.code.trim(), name: this.form.name.trim(), address: this.form.address.trim() || null, city: this.form.city.trim() || null, active: this.form.active,
    }).subscribe({
      next: () => {
        this.ui.success('Entrepôt enregistré');
        this.editing.set(undefined);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  async remove(w: Warehouse): Promise<void> {
    if (!await this.ui.confirm({ title: 'Supprimer l\'entrepôt ?', message: `« ${w.name} » sera supprimé. Un entrepôt avec un historique de mouvements doit être désactivé plutôt que supprimé.`, confirmLabel: 'Supprimer', danger: true })) return;
    this.api.deleteWarehouse(w.id).subscribe({
      next: () => {
        this.ui.success('Entrepôt supprimé');
        this.load();
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }
}
