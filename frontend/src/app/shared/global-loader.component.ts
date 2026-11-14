import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LoadingService } from '../core/services/loading.service';

@Component({
  selector: 'app-global-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading.active()) {
      <div class="gl-top-bar" role="progressbar" aria-label="Loading in progress">
        <div class="gl-top-bar-fill"></div>
      </div>
    }

    @if (loading.slow()) {
      <aside class="gl-cold-banner" role="status" aria-live="polite">
        <span class="gl-cold-spinner" aria-hidden="true"></span>
        <div class="gl-cold-copy">
          <strong>
            {{ loading.reason() === 'route' ? 'Loading ledger view…' : 'Waking up Ghar Ledger…' }}
          </strong>
          <span>
            Connecting to the backend &amp; database ({{ loading.elapsedSec() }}s)
          </span>
        </div>
        <button
          type="button"
          class="gl-cold-close"
          title="Hide notice"
          aria-label="Hide loading notice"
          (click)="loading.dismissSlow()"
        >&times;</button>
      </aside>
    }
  `,
  styles: [`
    .gl-top-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 1200;
      overflow: hidden;
      background: color-mix(in srgb, var(--brand) 16%, transparent);
      pointer-events: none;
    }
    .gl-top-bar-fill {
      width: 38%;
      height: 100%;
      background: linear-gradient(90deg, transparent, var(--brand), transparent);
      animation: glIndeterminate 1.15s ease-in-out infinite;
    }
    .gl-cold-banner {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 1190;
      display: flex;
      align-items: center;
      gap: .75rem;
      max-width: min(390px, calc(100vw - 2rem));
      padding: .75rem .9rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      border-left: 3px solid var(--brand);
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 12px 32px rgba(15, 23, 42, .18);
      font-size: .82rem;
    }
    .gl-cold-spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, var(--brand) 25%, transparent);
      border-top-color: var(--brand);
      flex-shrink: 0;
      animation: glSpin .75s linear infinite;
    }
    .gl-cold-copy {
      display: flex;
      flex-direction: column;
      gap: .12rem;
    }
    .gl-cold-copy strong { font-size: .84rem; }
    .gl-cold-copy span { color: var(--muted); font-size: .76rem; }
    .gl-cold-close {
      margin-left: auto;
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 1.15rem;
      line-height: 1;
      cursor: pointer;
      padding: .15rem .3rem;
    }
    .gl-cold-close:hover { color: var(--text); }
    @keyframes glIndeterminate {
      0% { transform: translateX(-110%); }
      100% { transform: translateX(310%); }
    }
    @media (max-width: 600px) {
      .gl-cold-banner {
        left: .75rem;
        right: .75rem;
        bottom: .75rem;
        max-width: none;
      }
    }
  `],
})
export class GlobalLoaderComponent {
  readonly loading = inject(LoadingService);
}
