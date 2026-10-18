import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoading } from '@cims/ui';
import { PATHS } from './paths';
import { ProtectedRoute } from './ProtectedRoute';

// Every page and the application shell load on demand, so the entry chunk stays small and the
// sign-in page does not download the dashboard layout, the data grid or the date pickers.
const AppLayout = lazy(() =>
  import('../layouts/AppLayout').then((m) => ({ default: m.AppLayout })),
);
const LoginPage = lazy(() =>
  import('../pages/Login/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const AuthCallbackPage = lazy(() =>
  import('../pages/AuthCallback/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
);
const HomePage = lazy(() =>
  import('../pages/Home/HomePage').then((m) => ({ default: m.HomePage })),
);
const FieldCaptionsPage = lazy(() =>
  import('../pages/Reference/FieldCaptionsPage').then((m) => ({ default: m.FieldCaptionsPage })),
);
const ConfirmArrivalPage = lazy(() =>
  import('../pages/Data/ConfirmArrivalPage').then((m) => ({ default: m.ConfirmArrivalPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFound/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

/** One route per legacy page path (matching is case-insensitive, like the legacy MVC routes). */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading fullScreen />}>
      <Routes>
        <Route path={PATHS.login} element={<LoginPage />} />
        <Route path={PATHS.legacyLogin} element={<LoginPage />} />
        <Route path={PATHS.authCallback} element={<AuthCallbackPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to={PATHS.home} replace />} />
          <Route path={PATHS.home} element={<HomePage />} />
          <Route path={PATHS.fieldCaptions} element={<FieldCaptionsPage />} />
          <Route path={PATHS.confirmArrival} element={<ConfirmArrivalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
