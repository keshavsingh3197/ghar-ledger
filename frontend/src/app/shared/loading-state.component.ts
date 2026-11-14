import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type LoadingStateMode = 'cards' | 'list' | 'table' | 'inline';

@Component({
  selector: 'app-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'inline') {
      <div class="gl-inline" [class.compact]="compact()" role="status" aria-live="polite">
        <span class="gl-spinner" aria-hidden="true"></span>
        <span>{{ title() }}</span>
      </div>
    } @else {
      <div class="gl-state" [class.compact]="compact()" role="status" aria-live="polite">
        <div class="gl-head">
          <span class="gl-spinner" aria-hidden="true"></span>
          <div class="gl-copy">
            <strong>{{ title() }}</strong>
            @if (subtitle()) {
              <span>{{ subtitle() }}</span>
            }
          </div>
        </div>

        @if (mode() === 'cards') {
          <div class="gl-cards">
            @for (item of items(); track item) {
              <div class="gl-card">
                <div class="gl-line w55 gl-shimmer"></div>
                <div class="gl-line w35 gl-shimmer"></div>
              </div>
            }
          </div>
        } @else if (mode() === 'table') {
          <div class="gl-table">
            <div class="gl-row head">
              <span class="gl-cell w30 gl-shimmer"></span>
              <span class="gl-cell w40 gl-shimmer"></span>
              <span class="gl-cell w20 gl-shimmer"></span>
            </div>
            @for (item of items(); track item) {
              <div class="gl-row">
                <span class="gl-cell w30 gl-shimmer"></span>
                <span class="gl-cell w40 gl-shimmer"></span>
                <span class="gl-cell w20 gl-shimmer"></span>
              </div>
            }
          </div>
        } @else {
          <div class="gl-list">
            @for (item of items(); track item) {
              <div class="gl-list-row gl-shimmer"></div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .gl-inline {
      display: inline-flex;
      align-items: center;
      gap: .55rem;
      color: var(--muted);
      font-size: .85rem;
      padding: .5rem 0;
    }
    .gl-inline.compact { padding: .25rem 0; font-size: .8rem; }
    .gl-state {
      display: flex;
      flex-direction: column;
      gap: .85rem;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      margin: .5rem 0 1rem;
    }
    .gl-state.compact { padding: .75rem; gap: .6rem; }
    .gl-head {
      display: flex;
      align-items: center;
      gap: .65rem;
    }
    .gl-copy {
      display: flex;
      flex-direction: column;
      gap: .15rem;
    }
    .gl-copy strong { font-size: .88rem; color: var(--text); }
    .gl-copy span { font-size: .78rem; color: var(--muted); }
    .gl-spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, var(--brand) 24%, transparent);
      border-top-color: var(--brand);
      flex-shrink: 0;
      animation: glSpin .75s linear infinite;
    }
    .gl-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: .85rem;
    }
    .gl-card {
      padding: 1rem;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      gap: .55rem;
    }
    .gl-table, .gl-list {
      display: flex;
      flex-direction: column;
      gap: .5rem;
    }
    .gl-row {
      display: flex;
      gap: .65rem;
      padding: .35rem 0;
    }
    .gl-row.head { opacity: .65; }
    .gl-line, .gl-cell, .gl-list-row {
      height: 12px;
      border-radius: 6px;
      display: block;
    }
    .gl-list-row { height: 34px; }
    .w20 { width: 20%; }
    .w30 { width: 30%; }
    .w35 { width: 35%; }
    .w40 { width: 40%; }
    .w55 { width: 55%; }
    .gl-shimmer {
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--border) 60%, var(--surface)) 25%,
        color-mix(in srgb, var(--border) 95%, var(--surface)) 50%,
        color-mix(in srgb, var(--border) 60%, var(--surface)) 75%
      );
      background-size: 200% 100%;
      animation: glShimmer 1.35s ease-in-out infinite;
    }
  `],
})
export class LoadingStateComponent {
  readonly mode = input<LoadingStateMode>('list');
  readonly count = input<number>(3);
  readonly title = input<string>('Loading…');
  readonly subtitle = input<string>('');
  readonly compact = input<boolean>(false);

  readonly items = computed(() =>
    Array.from({ length: Math.max(1, this.count()) }, (_, idx) => idx),
  );
}
