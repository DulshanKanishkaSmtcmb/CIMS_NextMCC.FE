import { Suspense, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { ReactRouterAppProvider } from '@toolpad/core/react-router';
import type { Authentication, Branding, Session } from '@toolpad/core/AppProvider';
import { cimsTheme, PageLoading, Stack, ThemeModeToggle } from '@cims/ui';
import { userManager } from '../auth/userManager';
import { TenantSwitcherContainer } from '../components/TenantSwitcherContainer';
import { buildNavigation } from '../navigation/buildNavigation';
import { MENU_STUB } from '../navigation/menuStub';
import { useAppSelector } from '../redux/hooks';
import { PATHS } from '../routes/paths';

const BRANDING: Branding = { title: 'CIMS NextMCC', homeUrl: PATHS.home };

const AUTHENTICATION: Authentication = {
  signIn: () => {
    void userManager.signinRedirect();
  },
  signOut: () => {
    // TODO: also clear the legacy cookie (plan section 4.3, item 3) once the bridge has a sign-out endpoint.
    void userManager.signoutRedirect();
  },
};

/** App bar actions: light/dark/system theme (kept per signed-in user) and the tenant switcher. */
function ToolbarActions() {
  const userId = useAppSelector((state) => state.auth.profile?.sub);
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <ThemeModeToggle userId={userId} />
      <TenantSwitcherContainer />
    </Stack>
  );
}

/** Application shell: Toolpad dashboard layout with the legacy-shaped menu and the tenant switcher. */
export function AppLayout() {
  const profile = useAppSelector((state) => state.auth.profile);

  // TODO: fetch the user's menu from the API instead of the static stub.
  const navigation = useMemo(() => buildNavigation(MENU_STUB), []);

  const session = useMemo<Session | null>(
    () =>
      profile
        ? { user: { id: profile.sub, name: profile.name, email: profile.email ?? undefined } }
        : null,
    [profile],
  );

  return (
    <ReactRouterAppProvider
      navigation={navigation}
      branding={BRANDING}
      theme={cimsTheme}
      session={session}
      authentication={AUTHENTICATION}
    >
      <DashboardLayout slots={{ toolbarActions: ToolbarActions }}>
        {/* Pages load lazily; keep the shell on screen while the next page downloads. */}
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </DashboardLayout>
    </ReactRouterAppProvider>
  );
}
