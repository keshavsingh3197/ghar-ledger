import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Blocks a route unless a session is active. If the in-memory session is empty (e.g. after a full
 * page reload), it tries a single silent SSO exchange of the shared cookie first, so a user who is
 * already signed in at any *.keshavsingh.in site lands here without a second login. On failure it
 * sends the browser to the central IdP's login page — there is no local login route in this app.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  if (auth.isAuthenticated()) return of(true);

  return auth.refresh().pipe(
    map(() => true),
    catchError(() => {
      auth.forceClear();
      auth.loginRedirect();
      return of(false);
    })
  );
};
