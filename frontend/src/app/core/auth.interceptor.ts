import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const withToken = (req: HttpRequest<unknown>, token: string) =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

/**
 * Ajoute le JWT à tous les appels /api (sauf /api/auth/*). Si le token a
 * expiré, le renouvelle avant l'appel ; sur un 401 inattendu, tente un seul
 * renouvellement puis rejoue la requête, sinon termine la session.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (!req.url.startsWith('/api/') || req.url.startsWith('/api/auth/') || !auth.accessToken) {
    return next(req);
  }

  const send = (token: string) =>
    next(withToken(req, token)).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status !== 401) return throwError(() => err);
        return auth.refresh().pipe(
          catchError(refreshErr => {
            auth.expire();
            return throwError(() => refreshErr);
          }),
          switchMap(fresh => next(withToken(req, fresh))),
        );
      }),
    );

  if (auth.accessTokenExpired) {
    return auth.refresh().pipe(
      catchError(err => {
        auth.expire();
        return throwError(() => err);
      }),
      switchMap(token => send(token)),
    );
  }
  return send(auth.accessToken);
};
