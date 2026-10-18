import { TenantSwitcher } from '@cims/ui';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { tenantSelected } from '../redux/slices/tenantSlice';
import { referenceApi } from '../services/referenceApi';

/**
 * Tenant switcher for the toolbar. Placeholder behaviour: it changes the X-Tenant header and drops
 * cached server data so nothing from the previous tenant stays on screen.
 * TODO: decide with the API team whether a switch needs a re-authorisation (plan section 4.2, item 6).
 */
export function TenantSwitcherContainer() {
  const dispatch = useAppDispatch();
  const tenants = useAppSelector((state) => state.auth.allowedTenants);
  const selected = useAppSelector((state) => state.tenant.selectedTenantId);

  return (
    <TenantSwitcher
      tenants={tenants}
      value={selected}
      onChange={(tenantId) => {
        dispatch(tenantSelected(tenantId));
        dispatch(referenceApi.util.resetApiState());
      }}
    />
  );
}
