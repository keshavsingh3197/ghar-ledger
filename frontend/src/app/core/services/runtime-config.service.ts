import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, from } from 'rxjs';
import { RuntimeConfig, RuntimeConfigClient } from '@keshavsingh3197/web-config';
import { environment } from '../../../environments/environment';

export { CONFIG_KEYS } from '@keshavsingh3197/web-config';

/**
 * The Angular adapter over {@link RuntimeConfigClient} — the central runtime config served by the
 * identity provider (`GET {idpUrl}/config`), shared with admin/content-blog/portfolio so branding,
 * icons and flags live in one place instead of being duplicated per app. Nothing here throws: a
 * config outage just leaves the fallback glyphs/text in place.
 */
@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly client = new RuntimeConfigClient({ apiBase: environment.idpUrl });

  readonly config = signal<RuntimeConfig | null>(null);
  readonly loaded = computed(() => this.config() !== null);

  constructor() {
    const off = this.client.onChange((value) => this.config.set(value));
    inject(DestroyRef).onDestroy(off);
  }

  load(): Observable<RuntimeConfig | null> {
    return from(this.client.load());
  }

  text(key: string, fallback = ''): string {
    this.config();
    return this.client.text(key, fallback);
  }

  icon(key: string, fallback = ''): string {
    this.config();
    return this.client.icon(key, fallback);
  }
}
