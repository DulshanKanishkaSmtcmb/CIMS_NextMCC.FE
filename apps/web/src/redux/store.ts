import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { arrivalsApi } from '../services/arrivalsApi';
import { masterDataApi } from '../services/masterDataApi';
import { referenceApi } from '../services/referenceApi';
import authReducer from './slices/authSlice';
import tenantReducer from './slices/tenantSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  tenant: tenantReducer,
  [referenceApi.reducerPath]: referenceApi.reducer,
  [arrivalsApi.reducerPath]: arrivalsApi.reducer,
  [masterDataApi.reducerPath]: masterDataApi.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        referenceApi.middleware,
        arrivalsApi.middleware,
        masterDataApi.middleware,
      ),
  });
}

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
