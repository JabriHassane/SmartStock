import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()" [style.max-width.px]="width()">
      <header>
        <div>
          <h3>{{ title() }}</h3>
          @if (subtitle()) { <p>{{ subtitle() }}</p> }
        </div>
        <button type="button" class="btn btn-ghost btn-icon" (click)="closed.emit()" aria-label="Fermer">
          <app-icon name="x" />
        </button>
      </header>
      <div class="body"><ng-content /></div>
      <footer><ng-content select="[modal-footer]" /></footer>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .backdrop { position: absolute; inset: 0; background: rgba(8, 23, 56, .55); backdrop-filter: blur(3px); animation: fade .15s ease; }
    .dialog { position: relative; width: 100%; max-height: calc(100vh - 40px); display: flex; flex-direction: column;
      background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow-lg); animation: pop .18s ease; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 20px 24px 12px; }
    h3 { font-size: 18px; }
    header p { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .body { padding: 8px 24px 20px; overflow-y: auto; }
    footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--border); }
    footer:empty { display: none; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.98); } }
  `],
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly width = input(560);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
