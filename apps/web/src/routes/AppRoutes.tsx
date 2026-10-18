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
const CountryPage = lazy(() =>
  import('../pages/File/CountryPage').then((m) => ({ default: m.CountryPage })),
);
const PortsPage = lazy(() =>
  import('../pages/File/PortsPage').then((m) => ({ default: m.PortsPage })),
);
const DcPage = lazy(() => import('../pages/File/DcPage').then((m) => ({ default: m.DcPage })));
const PmMasterPage = lazy(() =>
  import('../pages/File/PmMasterPage').then((m) => ({ default: m.PmMasterPage })),
);
const ProductCategoryPage = lazy(() =>
  import('../pages/File/ProductCategoryPage').then((m) => ({ default: m.ProductCategoryPage })),
);
const SupplierPage = lazy(() =>
  import('../pages/File/SupplierPage').then((m) => ({ default: m.SupplierPage })),
);
const PmSupplierPage = lazy(() =>
  import('../pages/File/PmSupplierPage').then((m) => ({ default: m.PmSupplierPage })),
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
          <Route path={PATHS.country} element={<CountryPage />} />
          <Route path={PATHS.ports} element={<PortsPage />} />
          <Route path={PATHS.dc} element={<DcPage />} />
          <Route path={PATHS.pmMaster} element={<PmMasterPage />} />
          <Route path={PATHS.productCategory} element={<ProductCategoryPage />} />
          <Route path={PATHS.supplier} element={<SupplierPage />} />
          <Route path={PATHS.pmSupplier} element={<PmSupplierPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
