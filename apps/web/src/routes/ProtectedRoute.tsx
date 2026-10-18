import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { BlockingOverlay } from '@cims/ui';
import { useAppSelector } from '../redux/hooks';
import { PATHS } from './paths';

/** Renders children only for a signed-in user. Others go to the sign-in page and come back afterwards. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAppSelector((state) => state.auth.status);
  const location = useLocation();

  if (status === 'initializing') {
    return <BlockingOverlay open message="Checking your session..." />;
  }
  if (status === 'unauthenticated') {
    return (
      <Navigate
        to={PATHS.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return children;
}
