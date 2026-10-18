import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthCallbackPage } from '../pages/AuthCallback/AuthCallbackPage';
import { ConfirmArrivalPage } from '../pages/Data/ConfirmArrivalPage';
import { HomePage } from '../pages/Home/HomePage';
import { LoginPage } from '../pages/Login/LoginPage';
import { NotFoundPage } from '../pages/NotFound/NotFoundPage';
import { FieldCaptionsPage } from '../pages/Reference/FieldCaptionsPage';
import { PATHS } from './paths';
import { ProtectedRoute } from './ProtectedRoute';

/** One route per legacy page path (matching is case-insensitive, like the legacy MVC routes). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={PATHS.login} element={<LoginPage />} />
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
  );
}
