import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/** Opts background or silent requests out of the global loading bar. */
export const SILENT_HTTP = new HttpContextToken<boolean>(() => false);

export function silentHttpContext(): HttpContext {
  return new HttpContext().set(SILENT_HTTP, true);
}

const EXCLUDED_PATH_FRAGMENTS = ['/assets/'];

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SILENT_HTTP) || EXCLUDED_PATH_FRAGMENTS.some((p) => req.url.includes(p))) {
    return next(req);
  }

  const loading = inject(LoadingService);
  const done = loading.beginHttp();
  return next(req).pipe(finalize(done));
};
