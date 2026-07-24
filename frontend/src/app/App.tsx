import { BrowserRouter } from 'react-router-dom';
import { AppDataProvider } from '@/state/appData';
import { AppRoutes } from './router';

export default function App() {
  return (
    <BrowserRouter>
      <AppDataProvider>
        <AppRoutes />
      </AppDataProvider>
    </BrowserRouter>
  );
}