import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { RoleName } from './models';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
  }
  if (auth.user()) return true;
  // Profil introuvable malgré le renouvellement du token : la session est
  // morte, on la purge — sinon guestGuard renverrait vers /app en boucle.
  return auth.loadCurrentUser().pipe(
    map(user => {
      if (user) return true;
      auth.expire();
      return router.createUrlTree(['/login'], { queryParams: { expired: 1 } });
    }),
  );
};

/** Page de connexion : un utilisateur déjà connecté va directement au tableau de bord. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/app']) : true;
};

/** Restreint une route aux rôles listés dans `data.roles`. */
export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const roles = (route.data['roles'] ?? []) as RoleName[];
  return roles.length === 0 || auth.hasRole(...roles) ? true : inject(Router).createUrlTree(['/app']);
};
