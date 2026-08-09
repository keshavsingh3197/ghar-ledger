import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HouseholdsService } from '../../core/services/households.service';
import { Household } from '../../core/models/household.models';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="dashboard">
      <header class="head">
        <div>
          <h1>Your households</h1>
          <p class="subtitle">Pick a household to log deliveries, or start a new one.</p>
        </div>
      </header>

      @if (loading()) {
        <p class="loading">Loading…</p>
      } @else if (households().length === 0) {
        <p class="empty">No households yet — create your first one below.</p>
      } @else {
        <div class="grid">
          @for (h of households(); track h.id) {
            <button class="card household-card" type="button" (click)="open(h)">
              <h3>{{ h.name }}</h3>
              <p class="muted">{{ h.memberUserIds.length }} member{{ h.memberUserIds.length === 1 ? '' : 's' }}</p>
            </button>
          }
        </div>
      }

      <div class="create-card">
        <label class="field"><span>New household name</span>
          <input class="input" placeholder="e.g. Sharma Family" [(ngModel)]="newName" />
        </label>
        <button class="btn-primary" type="button" [disabled]="!newName.trim() || creating()" (click)="create()">
          {{ creating() ? 'Creating…' : '+ Create household' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 720px; margin: 0 auto; }
    .head { margin-bottom: 1.5rem; }
    .head h1 { margin: 0; font-size: 1.4rem; }
    .subtitle { margin: 0.2rem 0 0; color: var(--muted); font-size: 0.9rem; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.1rem; box-shadow: var(--shadow-sm); cursor: pointer; text-align: left;
      font: inherit; color: inherit; transition: transform .15s, box-shadow .15s;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(19, 35, 58, 0.16); }
    .household-card h3 { margin: 0 0 0.3rem; }
    .muted { color: var(--muted); font-size: 0.85rem; margin: 0; }

    .create-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.25rem; box-shadow: var(--shadow-sm); max-width: 380px;
    }
    .field { display: block; margin-bottom: 0.85rem; }
    .field span { display: block; margin-bottom: 0.3rem; font-size: 0.85rem; color: var(--muted); }
    .input {
      display: block; width: 100%; padding: 0.5rem 0.75rem;
      border: 1px solid var(--border); background: var(--surface); color: var(--text);
      border-radius: 6px; font-size: 1rem; box-sizing: border-box;
    }
    .btn-primary { background: var(--brand); color: var(--brand-text); border: none; padding: 0.55rem 1.1rem; border-radius: 6px; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .loading, .empty { color: var(--muted); margin-bottom: 1rem; }
  `]
})
export class DashboardComponent implements OnInit {
  households = signal<Household[]>([]);
  loading = signal(false);
  creating = signal(false);
  newName = '';

  constructor(private householdsApi: HouseholdsService, private router: Router) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.householdsApi.getMine().subscribe({
      next: (data) => {
        this.households.set(data);
        this.loading.set(false);
        if (data.length === 1) this.open(data[0]);
      },
      error: () => this.loading.set(false),
    });
  }

  open(h: Household) {
    this.router.navigate(['/h', h.id]);
  }

  create() {
    const name = this.newName.trim();
    if (!name) return;
    this.creating.set(true);
    this.householdsApi.create(name).subscribe({
      next: (created) => { this.creating.set(false); this.open(created); },
      error: () => this.creating.set(false),
    });
  }
}
