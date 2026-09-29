import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ROLE_BADGE, ROLE_LABELS } from '../../core/labels';
import { RoleName, User } from '../../core/models';
import { UiService, strongPassword } from '../../core/ui.service';
import { FrDatePipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

const ROLE_INFO: Record<RoleName, { icon: string; text: string }> = {
  SUPERADMIN: { icon: 'shield', text: 'Accès total, gestion des comptes' },
  GESTIONNAIRE: { icon: 'chart', text: 'Catalogue, commandes, partenaires' },
  MAGASINIER: { icon: 'package', text: 'Mouvements, réceptions, expéditions' },
};

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, FrDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Utilisateurs</h1>
        <p class="page-subtitle">Les membres de l'équipe et leurs droits d'accès.</p>
      </div>
      @if (auth.isSuperAdmin) {
        <div class="page-actions"><button class="btn btn-primary" (click)="openCreate()"><app-icon name="plus" /> Nouvel utilisateur</button></div>
      }
    </div>

    <div class="grid grid-3">
      @for (r of roleNames; track r) {
        <button class="role-card" [class.active]="roleFilter() === r" (click)="roleFilter.set(roleFilter() === r ? null : r)">
          <span class="r-icon" [class]="'r-icon r-' + r"><app-icon [name]="ROLE_INFO[r].icon" /></span>
          <span class="r-text"><b>{{ ROLE_LABELS[r] }}</b><small>{{ ROLE_INFO[r].text }}</small></span>
          <strong>{{ counts()[r] }}</strong>
        </button>
      }
    </div>

    <div class="card mt-6">
      <div class="toolbar">
        <div class="input-group">
          <app-icon name="search" />
          <input class="input" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Nom, identifiant, e-mail…" aria-label="Rechercher">
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôles</th><th>Statut</th><th>Créé le</th>@if (auth.isSuperAdmin) { <th class="actions"></th> }</tr></thead>
          <tbody>
            @for (u of visible(); track u.id) {
              <tr>
                <td>
                  <div class="user">
                    <span class="avatar">{{ initials(u) }}</span>
                    <div>
                      <span class="strong">{{ fullName(u) }}</span>
                      <small class="muted">&#64;{{ u.username }} @if (u.username === auth.user()?.username) { <span class="me">vous</span> }</small>
                    </div>
                  </div>
                </td>
                <td>{{ u.email }}</td>
                <td><div class="roles">@for (r of u.roles; track r) { <span class="badge" [class]="'badge ' + ROLE_BADGE[r]">{{ ROLE_LABELS[r] }}</span> }</div></td>
                <td>@if (u.enabled) { <span class="badge badge-success">Actif</span> } @else { <span class="badge badge-danger">Désactivé</span> }</td>
                <td class="muted nowrap">{{ u.createdAt | frDate }}</td>
                @if (auth.isSuperAdmin) {
                  <td class="actions">
                    <button class="btn btn-ghost btn-icon btn-sm" (click)="openEdit(u)" title="Modifier" aria-label="Modifier"><app-icon name="edit" /></button>
                    <button class="btn btn-ghost btn-icon btn-sm" (click)="openReset(u)" title="Réinitialiser le mot de passe" aria-label="Réinitialiser le mot de passe"><app-icon name="key" /></button>
                    @if (u.username !== auth.user()?.username) {
                      <button class="btn btn-ghost btn-icon btn-sm" (click)="remove(u)" title="Supprimer" aria-label="Supprimer"><app-icon name="trash" /></button>
                    }
                  </td>
                }
              </tr>
            } @empty {
              @if (!loading()) { <tr><td colspan="6"><div class="empty"><app-icon name="users" /><h4>Aucun utilisateur</h4></div></td></tr> }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (mode(); as m) {
      <app-modal [title]="m === 'create' ? 'Nouvel utilisateur' : m === 'edit' ? 'Modifier ' + fullName(selected()!) : 'Réinitialiser le mot de passe'"
        [subtitle]="m === 'reset' ? '@' + selected()!.username + ' devra se reconnecter partout.' : ''" [width]="m === 'reset' ? 460 : 620" (closed)="close()">
        <form id="user-form" class="form-grid" (ngSubmit)="save()">
          @if (m === 'create') {
            <div class="field"><label for="u-username">Identifiant *</label><input id="u-username" class="input" name="username" [(ngModel)]="form.username" required minlength="3" maxlength="100" autocomplete="off"></div>
          }
          @if (m !== 'reset') {
            <div class="field" [class.span-2]="m === 'edit'"><label for="u-email">E-mail *</label><input id="u-email" class="input" type="email" name="email" [(ngModel)]="form.email" required email></div>
            <div class="field"><label for="u-first">Prénom</label><input id="u-first" class="input" name="firstName" [(ngModel)]="form.firstName" maxlength="100"></div>
            <div class="field"><label for="u-last">Nom</label><input id="u-last" class="input" name="lastName" [(ngModel)]="form.lastName" maxlength="100"></div>
          }
          @if (m !== 'edit') {
            <div class="field span-2">
              <label for="u-pass">Mot de passe * <span class="muted">(10 caractères min., majuscule, minuscule, chiffre)</span></label>
              <div class="pass">
                <input id="u-pass" class="input mono" type="text" name="password" [(ngModel)]="form.password" required minlength="8" autocomplete="new-password">
                <button type="button" class="btn btn-secondary" (click)="generate()"><app-icon name="refresh" /> Générer</button>
              </div>
              <span class="hint">Communiquez-le de façon sécurisée ; l'utilisateur pourra le changer depuis son profil.</span>
            </div>
          }
          @if (m !== 'reset') {
            <div class="field span-2">
              <span class="label">Rôles *</span>
              <div class="role-picks">
                @for (r of roleNames; track r) {
                  <label class="pick" [class.on]="form.roles.includes(r)">
                    <input type="checkbox" [checked]="form.roles.includes(r)" (change)="toggleRole(r)">
                    <app-icon [name]="ROLE_INFO[r].icon" />
                    <span><b>{{ ROLE_LABELS[r] }}</b><small>{{ ROLE_INFO[r].text }}</small></span>
                  </label>
                }
              </div>
            </div>
          }
          @if (m === 'edit') {
            <div class="span-2"><label class="switch"><input type="checkbox" name="enabled" [(ngModel)]="form.enabled"><span class="track"></span> Compte actif</label></div>
          }
          @if (error()) { <div class="alert-box danger span-2"><app-icon name="alert" /> {{ error() }}</div> }
        </form>
        <ng-container modal-footer>
          <button class="btn btn-secondary" (click)="close()">Annuler</button>
          <button type="submit" form="user-form" class="btn btn-primary" [disabled]="saving() || !valid()">Enregistrer</button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: [`
    .role-card { display: flex; align-items: center; gap: 14px; padding: 18px; border-radius: var(--radius-lg); border: 1.5px solid var(--border); background: var(--surface);
      cursor: pointer; text-align: left; color: var(--text-body); transition: .15s; }
    .role-card:hover { box-shadow: var(--shadow); }
    .role-card.active { border-color: var(--primary); }
    .r-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex: none; }
    .r-SUPERADMIN { background: var(--violet-soft); color: #7c3aed; }
    .r-GESTIONNAIRE { background: var(--primary-soft); color: var(--primary); }
    .r-MAGASINIER { background: var(--info-soft); color: #0284c7; }
    .r-text { flex: 1; display: flex; flex-direction: column; }
    .r-text b { color: var(--text); }
    .r-text small { font-size: 12px; color: var(--text-muted); }
    .role-card strong { font-size: 26px; color: var(--text); }
    .user { display: flex; align-items: center; gap: 12px; }
    .user > div { display: flex; flex-direction: column; }
    .user small { font-size: 12px; }
    .me { margin-left: 4px; padding: 1px 6px; border-radius: 6px; background: var(--primary-soft); color: var(--primary); font-weight: 600; font-size: 11px; }
    .roles { display: flex; gap: 6px; flex-wrap: wrap; }
    .pass { display: flex; gap: 8px; }
    .pass .btn { flex: none; height: 42px; }
    .role-picks { display: grid; gap: 8px; }
    .pick { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1.5px solid var(--border); cursor: pointer; transition: .15s; }
    .pick input { width: 18px; height: 18px; accent-color: var(--primary); }
    .pick app-icon { color: var(--text-muted); }
    .pick span { display: flex; flex-direction: column; }
    .pick b { color: var(--text); font-size: 14px; }
    .pick small { font-size: 12px; color: var(--text-muted); }
    .pick.on { border-color: var(--primary); background: var(--primary-soft); }
    .pick.on app-icon { color: var(--primary); }
  `],
})
export class UsersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);

  protected readonly ROLE_LABELS = ROLE_LABELS;
  protected readonly ROLE_BADGE = ROLE_BADGE;
  protected readonly ROLE_INFO = ROLE_INFO;
  protected readonly roleNames: RoleName[] = ['SUPERADMIN', 'GESTIONNAIRE', 'MAGASINIER'];

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly roleFilter = signal<RoleName | null>(null);
  protected readonly mode = signal<'create' | 'edit' | 'reset' | null>(null);
  protected readonly selected = signal<User | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected form = { username: '', email: '', firstName: '', lastName: '', password: '', roles: [] as RoleName[], enabled: true };

  protected readonly counts = computed(() => {
    const c: Record<RoleName, number> = { SUPERADMIN: 0, GESTIONNAIRE: 0, MAGASINIER: 0 };
    this.users().forEach(u => u.roles.forEach(r => c[r]++));
    return c;
  });

  protected readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    return this.users()
      .filter(u => !role || u.roles.includes(role))
      .filter(u => !q || [u.username, u.email, u.firstName, u.lastName].some(v => v?.toLowerCase().includes(q)));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.users().subscribe({
      next: u => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  fullName(u: User): string {
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
  }

  initials(u: User): string {
    return this.fullName(u).split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  openCreate(): void {
    this.form = { username: '', email: '', firstName: '', lastName: '', password: '', roles: ['MAGASINIER'], enabled: true };
    this.generate();
    this.openModal('create', null);
  }

  openEdit(u: User): void {
    this.form = { username: u.username, email: u.email, firstName: u.firstName ?? '', lastName: u.lastName ?? '', password: '', roles: [...u.roles], enabled: u.enabled };
    this.openModal('edit', u);
  }

  openReset(u: User): void {
    this.form = { ...this.form, password: '' };
    this.generate();
    this.openModal('reset', u);
  }

  close(): void {
    this.mode.set(null);
  }

  toggleRole(r: RoleName): void {
    this.form.roles = this.form.roles.includes(r) ? this.form.roles.filter(x => x !== r) : [...this.form.roles, r];
  }

  /** Mot de passe aléatoire lisible (sans caractères ambigus), via l'API crypto du navigateur. */
  generate(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    do {
      const bytes = crypto.getRandomValues(new Uint32Array(16));
      this.form.password = Array.from(bytes, b => chars[b % chars.length]).join('');
    } while (!strongPassword(this.form.password));
  }

  valid(): boolean {
    const m = this.mode();
    if (m === 'reset') return strongPassword(this.form.password);
    const base = !!this.form.email.trim() && this.form.roles.length > 0;
    return m === 'create' ? base && /^[A-Za-z0-9._-]{3,100}$/.test(this.form.username.trim()) && strongPassword(this.form.password) : base;
  }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    this.error.set(null);
    const m = this.mode();
    const f = this.form;
    const names = { firstName: f.firstName.trim() || null, lastName: f.lastName.trim() || null };
    const request: Observable<unknown> = m === 'create'
      ? this.api.createUser({ username: f.username.trim(), email: f.email.trim(), password: f.password, roles: f.roles, ...names })
      : m === 'edit'
        ? this.api.updateUser(this.selected()!.id, { email: f.email.trim(), roles: f.roles, enabled: f.enabled, ...names })
        : this.api.resetPassword(this.selected()!.id, f.password);
    request.subscribe({
      next: () => {
        this.ui.success(m === 'create' ? 'Utilisateur créé' : m === 'edit' ? 'Utilisateur mis à jour' : 'Mot de passe réinitialisé');
        this.close();
        this.load();
        if (m === 'edit' && this.selected()!.username === this.auth.user()?.username) this.auth.loadCurrentUser().subscribe();
      },
      error: err => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  async remove(u: User): Promise<void> {
    if (!await this.ui.confirm({ title: 'Supprimer l\'utilisateur ?', message: `Le compte @${u.username} sera définitivement supprimé. Pour suspendre un accès temporairement, désactivez-le plutôt.`, confirmLabel: 'Supprimer', danger: true })) return;
    this.api.deleteUser(u.id).subscribe({
      next: () => {
        this.ui.success('Utilisateur supprimé');
        this.load();
      },
      error: err => this.ui.error(errorMessage(err)),
    });
  }

  private openModal(mode: 'create' | 'edit' | 'reset', user: User | null): void {
    this.error.set(null);
    this.saving.set(false);
    this.selected.set(user);
    this.mode.set(mode);
  }
}
