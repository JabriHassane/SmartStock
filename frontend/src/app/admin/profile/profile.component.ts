import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ROLE_BADGE, ROLE_LABELS } from '../../core/labels';
import { UiService, strongPassword } from '../../core/ui.service';
import { FrDatePipe } from '../../shared/format.pipes';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, IconComponent, FrDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Mon profil</h1>
        <p class="page-subtitle">Vos informations personnelles et votre sécurité.</p>
      </div>
    </div>

    @if (auth.user(); as u) {
      <div class="hero card">
        <span class="avatar big">{{ auth.initials() }}</span>
        <div>
          <h2>{{ auth.displayName() }}</h2>
          <p>&#64;{{ u.username }} · membre depuis le {{ u.createdAt | frDate }}</p>
          <div class="roles">@for (r of u.roles; track r) { <span class="badge" [class]="'badge ' + ROLE_BADGE[r]">{{ ROLE_LABELS[r] }}</span> }</div>
        </div>
        <button class="btn btn-secondary theme" (click)="ui.toggleTheme()">
          <app-icon [name]="ui.theme() === 'dark' ? 'sun' : 'moon'" /> Thème {{ ui.theme() === 'dark' ? 'clair' : 'sombre' }}
        </button>
      </div>

      <div class="grid grid-2 mt-6">
        <section class="card">
          <div class="card-header"><div><div class="card-title">Informations</div><div class="card-subtitle">Visibles par les administrateurs.</div></div></div>
          <form class="card-body form-grid" (ngSubmit)="saveProfile()">
            <div class="field"><label for="pf-first">Prénom</label><input id="pf-first" class="input" name="first" [(ngModel)]="profile.firstName" maxlength="100"></div>
            <div class="field"><label for="pf-last">Nom</label><input id="pf-last" class="input" name="last" [(ngModel)]="profile.lastName" maxlength="100"></div>
            <div class="field span-2"><label for="pf-email">E-mail *</label><input id="pf-email" class="input" type="email" name="email" [(ngModel)]="profile.email" required email></div>
            <div class="span-2 right"><button class="btn btn-primary" [disabled]="savingProfile() || !profile.email.trim()">Enregistrer</button></div>
          </form>
        </section>

        <section class="card">
          <div class="card-header"><div><div class="card-title">Mot de passe</div><div class="card-subtitle">Vos autres sessions seront déconnectées.</div></div></div>
          <form class="card-body form-grid" (ngSubmit)="changePassword()">
            <div class="field span-2"><label for="pw-cur">Mot de passe actuel</label><input id="pw-cur" class="input" type="password" name="cur" [(ngModel)]="pw.current" autocomplete="current-password"></div>
            <div class="field"><label for="pw-new">Nouveau mot de passe</label><input id="pw-new" class="input" type="password" name="new" [(ngModel)]="pw.next" autocomplete="new-password"></div>
            <div class="field"><label for="pw-conf">Confirmation</label><input id="pw-conf" class="input" type="password" name="conf" [(ngModel)]="pw.confirm" autocomplete="new-password"></div>
            <div class="span-2">
              <div class="strength"><span [style.width.%]="strength().pct" [style.background]="strength().color"></span></div>
              <small class="muted">{{ strength().label }}</small>
              @if (pw.next && !isStrong()) { <small class="text-warning"> · 10 caractères min. avec majuscule, minuscule et chiffre</small> }
              @if (pw.confirm && pw.confirm !== pw.next) { <small class="text-danger"> · Les mots de passe ne correspondent pas</small> }
            </div>
            <div class="span-2 right"><button class="btn btn-primary" [disabled]="savingPassword() || !canChange()">Changer le mot de passe</button></div>
          </form>
        </section>
      </div>
    }
  `,
  styles: [`
    .hero { display: flex; align-items: center; gap: 20px; padding: 24px; flex-wrap: wrap; }
    .avatar.big { width: 72px; height: 72px; font-size: 24px; }
    .hero h2 { font-size: 22px; }
    .hero p { font-size: 14px; margin: 2px 0 8px; }
    .roles { display: flex; gap: 6px; }
    .theme { margin-left: auto; }
    .right { display: flex; justify-content: flex-end; }
    .strength { height: 6px; border-radius: 99px; background: var(--surface-2); overflow: hidden; margin-bottom: 6px; }
    .strength span { display: block; height: 100%; border-radius: 99px; transition: width .2s; }
  `],
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly ui = inject(UiService);
  protected readonly auth = inject(AuthService);

  protected readonly ROLE_LABELS = ROLE_LABELS;
  protected readonly ROLE_BADGE = ROLE_BADGE;
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected profile = { firstName: '', lastName: '', email: '' };
  protected pw = { current: '', next: '', confirm: '' };
  // Méthode (pas un computed) : les champs du formulaire ne sont pas des signaux.
  protected strength() {
    const p = this.pw.next;
    let score = 0;
    if (p.length >= 10) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const levels = [
      { label: '10 caractères min., avec majuscule, minuscule et chiffre', color: 'var(--border-strong)' },
      { label: 'Faible', color: 'var(--danger)' },
      { label: 'Moyen', color: 'var(--warning)' },
      { label: 'Bon', color: 'var(--info)' },
      { label: 'Fort', color: 'var(--success)' },
      { label: 'Très fort', color: 'var(--success)' },
    ];
    return { ...levels[p ? score : 0], pct: (score / 5) * 100 };
  }

  ngOnInit(): void {
    const u = this.auth.user();
    if (u) this.profile = { firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email };
  }

  isStrong(): boolean {
    return strongPassword(this.pw.next);
  }

  canChange(): boolean {
    return !!this.pw.current && strongPassword(this.pw.next) && this.pw.next === this.pw.confirm;
  }

  saveProfile(): void {
    this.savingProfile.set(true);
    this.api.updateProfile({ email: this.profile.email.trim(), firstName: this.profile.firstName.trim() || null, lastName: this.profile.lastName.trim() || null }).subscribe({
      next: u => {
        this.auth.user.set(u);
        this.savingProfile.set(false);
        this.ui.success('Profil mis à jour');
      },
      error: err => {
        this.savingProfile.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }

  changePassword(): void {
    if (!this.canChange()) return;
    this.savingPassword.set(true);
    this.api.changePassword(this.pw.current, this.pw.next).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.pw = { current: '', next: '', confirm: '' };
        this.ui.success('Mot de passe modifié');
      },
      error: err => {
        this.savingPassword.set(false);
        this.ui.error(errorMessage(err));
      },
    });
  }
}
