import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { signedIn, signedOut } from './authSlice';

/**
 * The tenant the user is working in. It is sent as the X-Tenant header; the API must still check it
 * against the tenants allowed by the token (tenancy is enforced server side, never trusted from here).
 */
export interface TenantState {
  selectedTenantId: string | null;
}

const initialState: TenantState = { selectedTenantId: null };

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    tenantSelected(state, action: PayloadAction<string>) {
      state.selectedTenantId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signedIn, (state, action) => {
        const allowed = action.payload.allowedTenants;
        const stillAllowed = allowed.some((tenant) => tenant.id === state.selectedTenantId);
        if (!stillAllowed) {
          state.selectedTenantId = allowed[0]?.id ?? null;
        }
      })
      .addCase(signedOut, (state) => {
        state.selectedTenantId = null;
      });
  },
});

export const { tenantSelected } = tenantSlice.actions;
export default tenantSlice.reducer;
