import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, PartnerKind, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { downloadCsv } from '../../core/csv';
import { Partner } from '../../core/models';
import { UiService } from '../../core/ui.service';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

type PartnerForm = Omit<Partner, 'id' | 'orderCount' | 'createdAt'>;

const EMPTY: PartnerForm = { name: '', contactName: '', email: '', phone: '', address: '', city: '', taxId: '', notes: '', active: true };

/** Fournisseurs et clients : même écran, choisi par `data.kind` dans les routes. */
@Component({
  selector: 'app-partners',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ supplier() ? 'Fournisseurs' : 'Clients' }}</h1>
        <p class="page-subtitle">{{ supplier() ? 'Vos sources d\\'approvisionnement.' : 'Les destinataires de vos bons de vente.' }}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" (click)="exportCsv()" [disabled]="!partners().length"><app-icon name="download" /> Exporter</button>
        @if (auth.canManage) {
          <button class="btn btn-primary" (click)="open(null)"><app-icon name="plus" /> {{ supplier() ? 'Nouveau fournisseur' : 'Nouveau client' }}</button>
        }
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="input-group">
          <app-icon name="search" />
          <input class="input" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Nom, ville, contact, e-mail…" aria-label="Rechercher">
        </div>
        <label class="switch"><input type="checkbox" [ngModel]="showInactive()" (ngModelChange)="showInactive.set($event)"><span class="track"></span> Afficher les inactifs</label>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>{{ supplier() ? 'Fournisseur' : 'Client' }}</th><th>Contact</th><th>Ville</th><th>ICE / N° fiscal</th><th class="num">Commandes</th><th>Statut</th>@if (auth.canManage) { <th class="actions"></th> }</tr></thead>
          <tbody>
            @for (p of visible(); track p.id) {
              <tr>
                <td>
                  <div class="partner">
                    <span class="avatar" [class.alt]="!supplier()">{{ initials(p.name) }}</span>
                    <div><span class="strong">{{ p.name }}</span>@if (p.contactName) { <small class="muted">{{ p.contactName }}</small> }</div>
                  </div>
                </td>
                <td>
                  @if (p.email) { <a [href]="'mailto:' + p.email" class="contact"><app-icon name="mail" /> {{ p.email }}</a> }
                  @if (p.phone) { <a [href]="'tel:' + p.phone" class="contact"><app-icon name="phone" /> {{ p.phone }}</a> }
                  @if (!p.email && !p.phone) { <span class="muted">—</span> }
                </td>
                <td>{{ p.city ?? '—' }}</td>
                <td class="mono">{{ p.taxId ?? '—' }}</td>
                <td class="num strong">{{ p.orderCount }}</td>
                <td>@if (p.active) { <span class="badge badge-success">Actif</span> } @else { <span class="badge badge-muted">Inactif</span> }</td>
                @if (auth.canManage) {
                  <td class="actions">
                    <button class="btn btn-ghost btn-icon btn-sm" (click)="open(p)" aria-label="Modifier"><app-icon name="edit" /></button>
                    <button class="btn btn-ghost btn-icon btn-sm" (click)="remove(p)" aria-label="Supprimer"><app-icon name="trash" /></button>
                  </td>
                }
              </tr>
            } @empty {
              @if (!loading()) {
                <tr><td colspan="7"><div class="empty"><app-icon [name]="supplier() ? 'truck' : 'building'" /><h4>Aucun {{ supplier() ? 'fournisseur' : 'client' }}</h4><p>Ajoutez-en un pour l'utiliser dans vos commandes.</p></div></td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (editing() !== undefined) {
      <app-modal [title]="(editing() ? 'Modifier ' : 'Nouveau ') + (supplier() ? 'fournisseur' : 'client')" [width]="640" (closed)="editing.set(undefined)">
        <form id="partner-form" class="form-grid" (ngSubmit)="save()">
          <div class="field span-2"><label for="p-name">Raison sociale *</label><input id="p-name" class="input" name="name" [(ngModel)]="form.name" required maxlength="160"></div>
          <div class="field"><label for="p-contact">Personne de contact</label><input id="p-contact" class="input" name="contact" [(ngModel)]="form.contactName" maxlength="120"></div>
          <div class="field"><label for="p-tax">ICE / N° fiscal</label><input id="p-tax" class="input mono" name="tax" [(ngModel)]="form.taxId" maxlength="40"></div>
          <div class="field"><label for="p-email">E-mail</label><input id="p-email" class="input" type="email" name="email" [(ngModel)]="form.email" maxlength="255" email></div>
          <div class="field"><label for="p-phone">Téléphone</label><input id="p-phone" class="input" type="tel" name="phone" [(ngModel)]="form.phone" maxlength="40"></div>
          <div class="field"><label for="p-addr">Adresse</label><input id="p-addr" class="input" name="address" [(ngModel)]="form.address" maxlength="255"></div>
          <div class="field"><label for="p-city">Ville</label><input id="p-city" class="input" name="city" [(ngModel)]="form.city" maxlength="120"></div>
          <div class="field span-2"><label for="p-notes">Notes</label><textarea id="p-notes" class="textarea" name="notes" [(ngModel)]="form.notes" rows="2"></textarea></div>
          <div class="span-2"><label class="switch"><input type="checkbox" name="active" [(ngModel)]="form.active"><span class="track"></span> Actif (sélectionnable dans les commandes)</label></div>
          @if (error()) { <div class="alert-box danger span-2"><app-icon name="alert" /> {{ error() }}</div> }
        </form>
        <ng-container modal-footer>
          <button class="btn btn-secondary" (click)="editing.set(undefined)">Annuler</button>
          <button type="submit" form="partner-form" class="btn btn-primary" [disabled]="saving() || !form.name.trim()">Enregistrer</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: [`
    .partner { display: flex; align-items: center; gap: 12px; }
    .partner > div { display: flex; flex-direction: column; }
    .partner small { font-size: 12px; }
    .avatar.alt { background: linear-gradient(135deg, #10b981, #34d399); }
    .contact { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-body); }
    .contact:hover { color: var(--primary); }
    .contact app-icon { width: 14px; height: 14px; color: var(--text-muted); }
  `],
})
export class PartnersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);

  readonly kind = input.required<PartnerKind>();
  protected readonly supplier = computed(() => this.kind() === 'suppliers');

  protected readonly partners = signal<Partner[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly showInactive = signal(false);
  protected readonly editing = signal<Partner | null | undefined>(undefined);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected form: PartnerForm = { ...EMPTY };

  protected readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.partners()
      .filter(p => this.showInactive() || p.active)
      .filter(p => !q || [p.name, p.city, p.contactName, p.email, p.taxId].some(v => v?.toLowerCase().includes(q)));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.partners(this.kind()).subscribe({
      next: p => {
        this.partners.set(p);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  initials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  open(p: Partner | null): void {
    this.error.set(null);
    this.saving.set(false);
    this.form = p
      ? { name: p.name, contactName: p.contactName ?? '', email: p.email ?? '', phone: p.phone ?? '', address: p.address ?? '', city: p.city ?? '', taxId: p.taxId ?? '', notes: p.notes ?? '', active: p.active }
      : { ...EMPTY };
    this.editing.set(p);
  }

  save(): void {
    this.saving.set(true);
    const clean = (v: string | null) => (v?.trim() ? v.trim() : null);
    this.api.savePartner(this.kind(), this.editing()?.id ?? null, {
      name: this.form.name.trim(), contactName: clean(this.form.contactName), email: clean(this.form.email), phone: clean(this.form.phone),
      address: clean(this.form.address), city: clean(this.form.city), taxId: clean(this.form.taxId), notes: clean(this.form.notes), active: this.form.active,
    }).subscribe({
      next: () => {
        this.ui.success(this.supplier() ? 'Fournisseur enregistré' : 'Client enregistré');
        this.editing.set(undefined);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  async remove(p: Partner): Promise<void> {
    if (!await this.ui.confirm({ title: 'Supprimer ?', message: `« ${p.name} » sera supprimé. S'il est lié à des commandes, désactivez-le plutôt.`, confirmLabel: 'Supprimer', danger: true })) return;
    this.api.deletePartner(this.kind(), p.id).subscribe({
      next: () => {
        this.ui.success('Supprimé');
        this.load();
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }

  exportCsv(): void {
    downloadCsv(`${this.kind() === 'suppliers' ? 'fournisseurs' : 'clients'}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Nom', 'Contact', 'E-mail', 'Téléphone', 'Adresse', 'Ville', 'ICE', 'Commandes', 'Actif'],
      this.visible().map(p => [p.name, p.contactName, p.email, p.phone, p.address, p.city, p.taxId, p.orderCount, p.active ? 'Oui' : 'Non']));
  }
}
