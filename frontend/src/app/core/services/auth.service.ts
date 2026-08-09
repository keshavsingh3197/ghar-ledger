import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, SsoSession, UserProfile } from '../models/auth.models';

/**
 * This app is an SSO CONSUMER, not an identity provider: it never authenticates users itself.
 * Sessions come from the central IdP (admin.keshavsingh.in / id.keshavsingh.in) via the shared
 * HttpOnly cookie (domain .keshavsingh.in) — {@link refresh} silently exchanges that cookie for a
 * short-lived access token, kept in memory only (never localStorage, to limit XSS exposure).
 * Interactive sign-in happens by redirecting to the IdP; there is no local login page here.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private accessToken = signal<string | null>(null);
  readonly user = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => !!this.user() && !!this.accessToken());

  token(): string | null {
    return this.accessToken();
  }

  hasRole(...roles: Role[]): boolean {
    const u = this.user();
    return !!u && roles.some((r) => u.roles.includes(r));
  }

  /** Exchange the shared SSO cookie for a fresh access token. 401 => not signed in. */
  refresh(): Observable<SsoSession> {
    return this.http
      .post<SsoSession>(`${environment.idpUrl}/sso/session`, {}, { withCredentials: true })
      .pipe(tap((session) => this.setSession(session)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${environment.idpUrl}/sso/logout`, {}, { withCredentials: true })
      .pipe(tap({ next: () => this.clearSession(), error: () => this.clearSession() }));
  }

  /** Sends the browser to the central IdP to sign in, returning here afterwards. */
  loginRedirect(returnTo: string = location.href): void {
    location.href = `${environment.loginUrl}?return=${encodeURIComponent(returnTo)}`;
  }

  forceClear(): void {
    this.clearSession();
  }

  private setSession(session: SsoSession): void {
    this.accessToken.set(session.accessToken);
    this.user.set(session.user);
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.user.set(null);
  }
}
