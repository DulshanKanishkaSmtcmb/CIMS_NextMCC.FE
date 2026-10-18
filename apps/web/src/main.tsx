import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { App } from './App';
import { userManager } from './auth/userManager';
import { configureApi } from './services/configureApi';
import { PATHS } from './routes/paths';

configureApi();

// Silent token renewal loads the callback URL in a hidden iframe. Finish it there and skip the app.
const isSilentRenewFrame =
  window.location.pathname === PATHS.authCallback && window.self !== window.parent;

if (isSilentRenewFrame) {
  void userManager.signinCallback();
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
