import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { LoginResponse, RoleName, TokenPair, User } from './models';

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const STORAGE_KEY = 'smartstock.session';

/**
 * Session JWT : access token court (1 h) + refresh token opaque tourné à
 * chaque renouvellement par auth-service. Stockée en sessionStorage par
 * défaut (fermée avec l'onglet), en localStorage si "Rester connecté".
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(this.restore());
  private refreshInFlight: Observable<string> | null = null;

  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly roles = computed<RoleName[]>(() => {
    const token = this.session()?.accessToken;
    if (!token) return [];
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return Array.isArray(payload.roles) ? payload.roles : [];
    } catch {
      return [];
    }
  });
  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return full || u.username;
  });
  readonly initials = computed(() => {
    const name = this.displayName();
    return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  });

  get accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  get accessTokenExpired(): boolean {
    const s = this.session();
    return !s || Date.now() > s.expiresAt - 30_000;
  }

  hasRole(...roles: RoleName[]): boolean {
    const mine = this.roles();
    return roles.some(r => mine.includes(r));
  }

  /** Gestion du catalogue, des commandes et des partenaires. */
  get canManage(): boolean {
    return this.hasRole('SUPERADMIN', 'GESTIONNAIRE');
  }

  get isSuperAdmin(): boolean {
    return this.hasRole('SUPERADMIN');
  }

  login(username: string, password: string, remember: boolean): Observable<void> {
    return this.http.post<LoginResponse>('/api/auth/login', { username, password }).pipe(
      tap(res => this.store(res, remember)),
      map(() => undefined),
    );
  }

  loadCurrentUser(): Observable<User | null> {
    if (!this.session()) return of(null);
    return this.http.get<User>('/api/users/me').pipe(
      tap(u => this.user.set(u)),
      catchError(() => of(null)),
    );
  }

  /** Un seul renouvellement à la fois, partagé par toutes les requêtes en attente. */
  refresh(): Observable<string> {
    const refreshToken = this.session()?.refreshToken;
    if (!refreshToken) return throwError(() => new Error('no session'));
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http.post<TokenPair>('/api/auth/refresh', { refreshToken }).pipe(
        tap(res => this.store(res, this.remembered())),
        map(res => res.accessToken),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay(1),
      );
    }
    return this.refreshInFlight;
  }

  logout(redirect = true): void {
    const refreshToken = this.session()?.refreshToken;
    if (refreshToken) {
      this.http.post('/api/auth/logout', { refreshToken }).subscribe({ error: () => undefined });
    }
    this.clear();
    if (redirect) this.router.navigate(['/login']);
  }

  /** Session invalide côté serveur (refresh refusé) : on nettoie sans appeler logout. */
  expire(): void {
    this.clear();
    this.router.navigate(['/login'], { queryParams: { expired: 1 } });
  }

  private clear(): void {
    this.session.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* stockage indisponible */ }
  }

  private store(res: TokenPair, remember: boolean): void {
    const session: Session = {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: Date.now() + res.expiresInSeconds * 1000,
    };
    this.session.set(session);
    try {
      (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
      (remember ? sessionStorage : localStorage).removeItem(STORAGE_KEY);
    } catch { /* stockage indisponible : session en mémoire seulement */ }
  }

  private remembered(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  private restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }
}
