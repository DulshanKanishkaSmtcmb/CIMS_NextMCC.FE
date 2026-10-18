import { useEffect, type ReactNode } from 'react';
import type { User } from 'oidc-client-ts';
import { getDevToken, sessionFromDevToken } from '../auth/devToken';
import { sessionFromUser } from '../auth/profile';
import { userManager } from '../auth/userManager';
import { useAppDispatch } from '../redux/hooks';
import { signedIn, signedOut } from '../redux/slices/authSlice';

/** Restores the session from oidc-client-ts on start and keeps Redux in step with sign-in and sign-out events. */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Development only: a valid dev token signs in without CIMS Identity (auth/devToken.ts).
    const devToken = getDevToken();
    const devSession = devToken ? sessionFromDevToken(devToken) : null;
    if (devSession) {
      dispatch(signedIn(devSession));
      return undefined;
    }

    let cancelled = false;
    const onLoaded = (user: User): void => {
      dispatch(signedIn(sessionFromUser(user)));
    };
    const onGone = (): void => {
      dispatch(signedOut());
    };

    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onGone);
    userManager.events.addUserSignedOut(onGone);

    userManager
      .getUser()
      .then((user) => {
        if (cancelled) return;
        if (user && !user.expired) onLoaded(user);
        else onGone();
      })
      .catch(() => {
        if (!cancelled) onGone();
      });

    return () => {
      cancelled = true;
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onGone);
      userManager.events.removeUserSignedOut(onGone);
    };
  }, [dispatch]);

  return children;
}
