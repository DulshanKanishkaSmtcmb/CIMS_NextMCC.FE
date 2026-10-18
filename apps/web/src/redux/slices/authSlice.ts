import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Tenant } from '@cims/ui';
import type { SessionInfo, UserProfile } from '../../auth/profile';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

/** Profile and allowed tenants only. Tokens stay inside oidc-client-ts and never enter Redux. */
export interface AuthState {
  status: AuthStatus;
  profile: UserProfile | null;
  allowedTenants: Tenant[];
}

const initialState: AuthState = {
  status: 'initializing',
  profile: null,
  allowedTenants: [],
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<SessionInfo>) {
      state.status = 'authenticated';
      state.profile = action.payload.profile;
      state.allowedTenants = action.payload.allowedTenants;
    },
    signedOut(state) {
      state.status = 'unauthenticated';
      state.profile = null;
      state.allowedTenants = [];
    },
  },
});

export const { signedIn, signedOut } = authSlice.actions;
export default authSlice.reducer;
