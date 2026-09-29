import { Injectable, signal } from '@angular/core';

/** Même règle que le validateur @StrongPassword d'auth-service. */
export function strongPassword(p: string): boolean {
  return p.length >= 10 && p === p.trim() && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

/** Notifications (toasts), boîte de confirmation et thème clair/sombre. */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly toasts = signal<Toast[]>([]);
  readonly confirmation = signal<ConfirmRequest | null>(null);
  readonly theme = signal<'light' | 'dark'>(this.initialTheme());
  private nextId = 1;

  constructor() {
    this.applyTheme(this.theme());
  }

  success(message: string): void { this.push('success', message); }
  error(message: string): void { this.push('error', message); }
  info(message: string): void { this.push('info', message); }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  confirm(options: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    return new Promise(resolve => this.confirmation.set({ ...options, resolve }));
  }

  answer(ok: boolean): void {
    const request = this.confirmation();
    this.confirmation.set(null);
    request?.resolve(ok);
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.applyTheme(next);
    try { localStorage.setItem('smartstock.theme', next); } catch { /* ignoré */ }
  }

  /** Le thème sombre ne s'applique qu'à l'espace connecté ; la landing reste claire. */
  applyTheme(theme: 'light' | 'dark', enabled = true): void {
    document.documentElement.setAttribute('data-theme', enabled ? theme : 'light');
  }

  private push(kind: Toast['kind'], message: string): void {
    const id = this.nextId++;
    this.toasts.update(list => [...list.slice(-3), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3500);
  }

  private initialTheme(): 'light' | 'dark' {
    try {
      const saved = localStorage.getItem('smartstock.theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* ignoré */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
