import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { errorMessage } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <aside class="brand-panel">
        <div class="glow" aria-hidden="true"></div>
        <a routerLink="/" class="brand"><img src="favicon.svg" alt="" width="36" height="36"><span>Smart<b>Stock</b></span></a>
        <div class="pitch">
          <h1>Votre stock, <span>sous contrôle.</span></h1>
          <p>Suivi multi-entrepôts, commandes et alertes prédictives dans une seule interface.</p>
          <ul>
            <li><app-icon name="sparkles" /> Prévision des ruptures sur 30 jours</li>
            <li><app-icon name="transfer" /> Transferts entre entrepôts tracés</li>
            <li><app-icon name="shield" /> Accès sécurisés par rôle</li>
          </ul>
        </div>
        <div class="card-preview" aria-hidden="true">
          <div class="cp-icon"><app-icon name="alert" /></div>
          <div><b>3 produits à réapprovisionner</b><small>Quantités suggérées prêtes</small></div>
        </div>
      </aside>

      <main class="form-panel">
        <a routerLink="/" class="back"><app-icon name="chevron-left" /> Retour au site</a>
        <form [formGroup]="form" (ngSubmit)="submit()" class="form" novalidate>
          <div class="head">
            <h2>Connexion</h2>
            <p>Accédez à votre espace SmartStock.</p>
          </div>

          @if (expired()) {
            <div class="alert-box info"><app-icon name="info" /> Votre session a expiré, reconnectez-vous.</div>
          }
          @if (error()) {
            <div class="alert-box danger"><app-icon name="alert" /> {{ error() }}</div>
          }

          <div class="field">
            <label for="username">Nom d'utilisateur</label>
            <div class="input-group">
              <app-icon name="user" />
              <input id="username" class="input" formControlName="username" autocomplete="username" placeholder="ex. admin" autofocus>
            </div>
          </div>

          <div class="field">
            <label for="password">Mot de passe</label>
            <div class="input-group">
              <app-icon name="lock" />
              <input id="password" class="input" [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" placeholder="••••••••">
              <button type="button" class="toggle" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                <app-icon [name]="showPassword() ? 'ban' : 'eye'" />
              </button>
            </div>
          </div>

          <label class="check"><input type="checkbox" formControlName="remember"> Rester connecté sur cet appareil</label>

          <button class="btn btn-primary btn-lg submit" [disabled]="loading() || form.invalid">
            @if (loading()) { <span class="spinner"></span> Connexion… } @else { Se connecter <app-icon name="arrow-right" /> }
          </button>

          <p class="help">Pas de compte ? Demandez à votre administrateur SmartStock de vous en créer un.</p>
        </form>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; background: #fff; }
    .brand-panel { position: relative; overflow: hidden; isolation: isolate; padding: 40px 56px; display: flex; flex-direction: column; justify-content: space-between;
      background: radial-gradient(900px 500px at 80% 0%, #133c7a 0%, transparent 60%), linear-gradient(180deg, #081738, #0a1e35); color: rgba(255,255,255,.75); }
    .glow { position: absolute; width: 460px; height: 460px; border-radius: 50%; background: #2f73f2; filter: blur(100px); opacity: .4; bottom: -180px; left: -120px; z-index: -1; }
    .brand { display: inline-flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 700; color: #fff; }
    .brand b { color: var(--primary-light); }
    .brand img { border-radius: 10px; }
    .pitch h1 { color: #fff; font-size: clamp(32px, 3.6vw, 46px); font-weight: 800; letter-spacing: -.03em; line-height: 1.1; }
    .pitch h1 span { background: linear-gradient(100deg, #6ea8ff, #38bdf8); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .pitch p { margin: 16px 0 28px; font-size: 17px; max-width: 440px; }
    .pitch ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
    .pitch li { display: flex; gap: 12px; align-items: center; color: #fff; }
    .pitch li app-icon { width: 34px; height: 34px; padding: 8px; border-radius: 10px; background: rgba(255,255,255,.08); color: var(--primary-light); }
    .card-preview { align-self: flex-start; display: flex; gap: 12px; align-items: center; padding: 14px 18px; border-radius: 16px;
      background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); backdrop-filter: blur(8px); color: #fff; }
    .card-preview small { display: block; color: rgba(255,255,255,.6); font-size: 13px; }
    .cp-icon { width: 38px; height: 38px; border-radius: 10px; background: rgba(245,158,11,.18); color: #fbbf24; display: flex; align-items: center; justify-content: center; }

    .form-panel { position: relative; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
    .back { position: absolute; top: 28px; left: 32px; display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: var(--text-body); }
    .back app-icon { width: 18px; height: 18px; }
    .form { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 18px; }
    .head h2 { font-size: 30px; font-weight: 800; color: var(--navy); letter-spacing: -.02em; }
    .head p { margin-top: 6px; }
    .input-group .toggle { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border: none; background: transparent;
      color: var(--text-muted); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .input-group .toggle:hover { color: var(--primary); background: var(--primary-soft); }
    .input-group .toggle app-icon { width: 18px; height: 18px; }
    .input { height: 48px; }
    .submit { width: 100%; margin-top: 6px; }
    .help { font-size: 13px; color: var(--text-muted); text-align: center; }
    @media (max-width: 900px) {
      .page { grid-template-columns: 1fr; }
      .brand-panel { display: none; }
    }
  `],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  readonly redirect = input<string>();
  readonly expired = input<string>();

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [false],
  });

  ngOnInit(): void {
    this.ui.applyTheme('light', false);
  }

  submit(): void {
    if (this.form.invalid) return;
    const { username, password, remember } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(username.trim(), password, remember).pipe(
      switchMap(() => this.auth.loadCurrentUser()),
    ).subscribe({
      next: () => {
        const target = this.redirect();
        this.router.navigateByUrl(target && target.startsWith('/app') ? target : '/app');
      },
      error: err => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
