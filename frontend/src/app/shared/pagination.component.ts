import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="info">{{ from() }}–{{ to() }} sur {{ total() }}</span>
    <div class="pages">
      <button class="btn btn-secondary btn-icon btn-sm" [disabled]="page() === 0" (click)="changed.emit(page() - 1)" aria-label="Page précédente">
        <app-icon name="chevron-left" />
      </button>
      <span class="current">Page {{ page() + 1 }} / {{ totalPages() || 1 }}</span>
      <button class="btn btn-secondary btn-icon btn-sm" [disabled]="page() + 1 >= totalPages()" (click)="changed.emit(page() + 1)" aria-label="Page suivante">
        <app-icon name="chevron-right" />
      </button>
    </div>
  `,
  styles: [`
    :host { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-top: 1px solid var(--border); font-size: 13px; }
    .info { color: var(--text-muted); }
    .pages { display: flex; align-items: center; gap: 10px; }
    .current { color: var(--text); font-weight: 600; }
  `],
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly size = input.required<number>();
  readonly total = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly changed = output<number>();
  readonly from = computed(() => (this.total() === 0 ? 0 : this.page() * this.size() + 1));
  readonly to = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));
}
