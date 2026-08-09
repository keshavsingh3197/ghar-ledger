import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { CONFIG_KEYS, RuntimeConfigService } from './core/services/runtime-config.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly config = inject(RuntimeConfigService);
  protected readonly keys = CONFIG_KEYS;

  constructor() {
    this.config.load().subscribe();
  }

  /** The brand icon/name are configured centrally; the literal here is only the pre-load fallback. */
  icon(key: string, fallback: string): string {
    return this.config.icon(key, fallback);
  }

  logout(): void {
    this.auth.logout().subscribe({ next: () => this.auth.loginRedirect(location.origin) });
  }
}
