import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { referenceApi } from '../services/referenceApi';
import authReducer from './slices/authSlice';
import tenantReducer from './slices/tenantSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  tenant: tenantReducer,
  [referenceApi.reducerPath]: referenceApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(referenceApi.middleware),
  });
}

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
