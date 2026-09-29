import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, interval, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ROLE_LABELS } from '../../core/labels';
import { UiService } from '../../core/ui.service';
import { IconComponent } from '../../shared/icon.component';
import { CommandPaletteComponent } from './command-palette.component';
import { NAV } from './nav';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, CommandPaletteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly ui = inject(UiService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly mobileOpen = signal(false);
  protected readonly userMenu = signal(false);
  protected readonly palette = signal(false);
  protected readonly alertCount = signal(0);
  protected readonly isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  protected readonly sections = computed(() => {
    this.auth.roles();
    return NAV.map(s => ({ ...s, items: s.items.filter(i => !i.roles || this.auth.hasRole(...i.roles)) }))
      .filter(s => s.items.length > 0);
  });

  protected readonly roleLabel = computed(() => {
    const roles = this.auth.roles();
    const main = (['SUPERADMIN', 'GESTIONNAIRE', 'MAGASINIER'] as const).find(r => roles.includes(r));
    return main ? ROLE_LABELS[main] : '';
  });

  ngOnInit(): void {
    this.ui.applyTheme(this.ui.theme());

    // Compteur d'alertes du menu, rafraîchi toutes les 2 minutes.
    interval(120_000).pipe(
      startWith(0),
      switchMap(() => this.api.alerts()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({ next: alerts => this.alertCount.set(alerts.length), error: () => undefined });

    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.mobileOpen.set(false);
        this.userMenu.set(false);
      });
  }

  toggleCollapsed(): void {
    this.collapsed.update(v => !v);
    try { localStorage.setItem('smartstock.sidebar', this.collapsed() ? 'collapsed' : 'open'); } catch { /* ignoré */ }
  }

  toggleTheme(): void {
    this.ui.toggleTheme();
  }

  logout(): void {
    this.ui.applyTheme('light', false);
    this.auth.logout();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.set(!this.palette());
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.userMenu() && !(event.target as HTMLElement).closest('.user-menu')) {
      this.userMenu.set(false);
    }
  }

  private readCollapsed(): boolean {
    try { return localStorage.getItem('smartstock.sidebar') === 'collapsed'; } catch { return false; }
  }
}
