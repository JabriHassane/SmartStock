import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiService } from './core/ui.service';
import { IconComponent } from './shared/icon.component';
import { ModalComponent } from './shared/modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, IconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />

    <div class="toasts" aria-live="polite">
      @for (t of ui.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.kind" (click)="ui.dismiss(t.id)">
          <app-icon [name]="t.kind === 'success' ? 'check-circle' : t.kind === 'error' ? 'alert' : 'info'" />
          <span>{{ t.message }}</span>
        </div>
      }
    </div>

    @if (ui.confirmation(); as c) {
      <app-modal [title]="c.title" [width]="440" (closed)="ui.answer(false)">
        <p class="confirm-msg">{{ c.message }}</p>
        <ng-container modal-footer>
          <button class="btn btn-secondary" (click)="ui.answer(false)">Annuler</button>
          <button class="btn" [class.btn-danger]="c.danger" [class.btn-primary]="!c.danger" (click)="ui.answer(true)">
            {{ c.confirmLabel ?? 'Confirmer' }}
          </button>
        </ng-container>
      </app-modal>
    }
  `,
  styles: [`
    .toasts { position: fixed; right: 20px; bottom: 20px; z-index: 200; display: flex; flex-direction: column; gap: 10px; max-width: min(420px, calc(100vw - 40px)); }
    .toast { display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px; border-radius: 12px; background: var(--navy-deep); color: #fff;
      box-shadow: var(--shadow-lg); font-size: 14px; cursor: pointer; animation: slide .2s ease; border-left: 4px solid var(--primary); }
    .toast.success { border-left-color: var(--success); }
    .toast.success app-icon { color: var(--success); }
    .toast.error { border-left-color: var(--danger); }
    .toast.error app-icon { color: #f87171; }
    .toast.info app-icon { color: var(--primary-light); }
    .confirm-msg { color: var(--text-body); }
    @keyframes slide { from { opacity: 0; transform: translateY(10px); } }
  `],
})
export class AppComponent {
  protected readonly ui = inject(UiService);
}
