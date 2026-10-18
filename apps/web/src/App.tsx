import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { CimsThemeProvider } from '@cims/ui';
import { AuthBootstrap } from './components/AuthBootstrap';
import { store } from './redux/store';
import { AppRoutes } from './routes/AppRoutes';

export function App() {
  return (
    <Provider store={store}>
      <CimsThemeProvider>
        <BrowserRouter>
          <AuthBootstrap>
            <AppRoutes />
          </AuthBootstrap>
        </BrowserRouter>
      </CimsThemeProvider>
    </Provider>
  );
}
