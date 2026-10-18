import { describe, expect, it } from 'vitest';
import authReducer, { signedIn, signedOut, type AuthState } from './authSlice';
import tenantReducer, { tenantSelected, type TenantState } from './tenantSlice';
import { createAppStore } from '../store';

const session = {
  profile: { sub: 'u1', name: 'Ann', username: 'ann', email: null },
  allowedTenants: [
    { id: 'MCC', name: 'Next MCC' },
    { id: 'CFS', name: 'Next CFS' },
  ],
};

describe('authSlice', () => {
  it('starts initializing with no profile', () => {
    const state = authReducer(undefined, { type: 'init' });
    expect(state).toEqual({ status: 'initializing', profile: null, allowedTenants: [] });
  });

  it('stores profile and allowed tenants on sign-in, and nothing token-like', () => {
    const state = authReducer(undefined, signedIn(session));
    expect(state.status).toBe('authenticated');
    expect(state.profile).toEqual(session.profile);
    expect(state.allowedTenants).toHaveLength(2);
    expect(Object.keys(state).sort()).toEqual(['allowedTenants', 'profile', 'status']);
  });

  it('clears everything on sign-out', () => {
    const signedInState: AuthState = authReducer(undefined, signedIn(session));
    expect(authReducer(signedInState, signedOut())).toEqual({
      status: 'unauthenticated',
      profile: null,
      allowedTenants: [],
    });
  });
});

describe('tenantSlice', () => {
  it('selects the first allowed tenant on sign-in', () => {
    const state = tenantReducer(undefined, signedIn(session));
    expect(state.selectedTenantId).toBe('MCC');
  });

  it('keeps the selection when it is still allowed', () => {
    const selected: TenantState = { selectedTenantId: 'CFS' };
    expect(tenantReducer(selected, signedIn(session)).selectedTenantId).toBe('CFS');
  });

  it('replaces a selection that is no longer allowed', () => {
    const selected: TenantState = { selectedTenantId: 'OLD' };
    expect(tenantReducer(selected, signedIn(session)).selectedTenantId).toBe('MCC');
  });

  it('has no selection when the user has no tenants', () => {
    const state = tenantReducer(undefined, signedIn({ ...session, allowedTenants: [] }));
    expect(state.selectedTenantId).toBeNull();
  });

  it('changes tenant and clears it on sign-out', () => {
    let state = tenantReducer(undefined, tenantSelected('CFS'));
    expect(state.selectedTenantId).toBe('CFS');
    state = tenantReducer(state, signedOut());
    expect(state.selectedTenantId).toBeNull();
  });
});

describe('store', () => {
  it('wires auth, tenant and the api slices', () => {
    const state = createAppStore().getState();
    expect(Object.keys(state).sort()).toEqual([
      'arrivalsApi',
      'auth',
      'masterDataApi',
      'referenceApi',
      'tenant',
    ]);
  });
});
