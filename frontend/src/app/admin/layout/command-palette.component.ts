import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, computed, inject, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Product } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';
import { NAV } from './nav';

interface PaletteItem {
  group: string;
  label: string;
  hint?: string;
  icon: string;
  link: string;
  queryParams?: Record<string, string>;
}

/** Recherche globale (Ctrl/⌘ + K) : pages, actions rapides et produits. */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <div class="palette" role="dialog" aria-label="Recherche rapide">
      <div class="search">
        <app-icon name="search" />
        <input #field [value]="query()" (input)="onInput($any($event.target).value)" placeholder="Rechercher une page, une action ou un produit…" aria-label="Rechercher">
        <kbd>Échap</kbd>
      </div>
      <ul class="results">
        @for (item of items(); track item.group + item.label; let i = $index) {
          @if (i === 0 || items()[i - 1].group !== item.group) {
            <li class="group">{{ item.group }}</li>
          }
          <li>
            <button type="button" [class.active]="i === active()" (mouseenter)="active.set(i)" (click)="go(item)">
              <app-icon [name]="item.icon" />
              <span class="label">{{ item.label }}</span>
              @if (item.hint) { <span class="hint">{{ item.hint }}</span> }
            </button>
          </li>
        } @empty {
          <li class="none">Aucun résultat pour « {{ query() }} »</li>
        }
      </ul>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span></footer>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 150; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 16px; }
    .backdrop { position: absolute; inset: 0; background: rgba(8, 23, 56, .5); backdrop-filter: blur(3px); }
    .palette { position: relative; width: 100%; max-width: 620px; background: var(--surface); border: 1px solid var(--border); border-radius: 18px; box-shadow: var(--shadow-lg); overflow: hidden; animation: pop .15s ease; }
    .search { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
    .search app-icon { color: var(--text-muted); }
    .search input { flex: 1; border: none; outline: none; background: transparent; font: inherit; font-size: 16px; color: var(--text); }
    kbd { font: 600 11px var(--font); padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border-strong); color: var(--text-muted); background: var(--surface-2); }
    .results { list-style: none; margin: 0; padding: 8px; max-height: 50vh; overflow-y: auto; }
    .group { padding: 10px 10px 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
    .results button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: none; border-radius: 10px; background: transparent; color: var(--text); cursor: pointer; text-align: left; }
    .results button app-icon { color: var(--text-muted); }
    .results button.active { background: var(--primary-soft); color: var(--primary); }
    .results button.active app-icon { color: var(--primary); }
    .label { flex: 1; font-weight: 500; }
    .hint { font-size: 12px; color: var(--text-muted); }
    .none { padding: 28px; text-align: center; color: var(--text-muted); }
    footer { display: flex; gap: 16px; padding: 10px 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
    footer span { display: inline-flex; gap: 4px; align-items: center; }
    @keyframes pop { from { opacity: 0; transform: scale(.98); } }
  `],
})
export class CommandPaletteComponent implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly closed = output<void>();

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  protected readonly query = signal('');
  protected readonly active = signal(0);
  private readonly products = signal<Product[]>([]);
  private readonly search$ = new Subject<string>();

  private readonly pages: PaletteItem[] = NAV.flatMap(section => section.items
    .filter(item => !item.roles || this.auth.hasRole(...item.roles))
    .map(item => ({ group: 'Pages', label: item.label, icon: item.icon, link: item.link, hint: item.keywords })));

  private readonly actions: PaletteItem[] = [
    { group: 'Actions rapides', label: 'Enregistrer une entrée de stock', icon: 'arrow-down', link: '/app/stock', queryParams: { action: 'IN' } },
    { group: 'Actions rapides', label: 'Enregistrer une sortie de stock', icon: 'arrow-up', link: '/app/stock', queryParams: { action: 'OUT' } },
    { group: 'Actions rapides', label: 'Transférer entre entrepôts', icon: 'transfer', link: '/app/stock', queryParams: { action: 'TRANSFER' } },
    ...(this.auth.canManage ? [
      { group: 'Actions rapides', label: 'Nouvelle commande d\'achat', icon: 'truck', link: '/app/orders/new', queryParams: { type: 'PURCHASE' } },
      { group: 'Actions rapides', label: 'Nouvelle commande de vente', icon: 'cart', link: '/app/orders/new', queryParams: { type: 'SALE' } },
      { group: 'Actions rapides', label: 'Ajouter un produit', icon: 'plus', link: '/app/products', queryParams: { action: 'new' } },
    ] : []),
  ];

  protected readonly items = computed<PaletteItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const match = (i: PaletteItem) => !q || `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(q);
    const productItems: PaletteItem[] = this.products().map(p => ({
      group: 'Produits', label: p.name, hint: `${p.sku} · ${p.totalQuantity} en stock`, icon: 'package', link: `/app/products/${p.id}`,
    }));
    // Les mots-clés des pages servent à la recherche mais ne sont pas affichés.
    return [...this.pages.filter(match).map(i => ({ ...i, hint: undefined })), ...this.actions.filter(match), ...productItems];
  });

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => (q.trim().length >= 2 ? this.api.products({ search: q.trim(), size: 6 }) : of(null))),
    ).subscribe({ next: page => this.products.set(page?.content ?? []), error: () => this.products.set([]) });
  }

  ngAfterViewInit(): void {
    this.field()?.nativeElement.focus();
  }

  onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.search$.next(value);
  }

  go(item: PaletteItem): void {
    this.router.navigate([item.link], { queryParams: item.queryParams });
    this.closed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const count = this.items().length;
    if (event.key === 'Escape') {
      this.closed.emit();
    } else if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.active.set((this.active() + 1) % count);
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.active.set((this.active() - 1 + count) % count);
    } else if (event.key === 'Enter' && count) {
      event.preventDefault();
      this.go(this.items()[this.active()]);
    }
  }
}
