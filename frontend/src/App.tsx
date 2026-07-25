import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import MapPage from './pages/MapPage';
import RestaurantDetails from './pages/RestaurantDetails';
import RestaurantFormPage from './pages/RestaurantFormPage';
import RecommendedDishesPage from './pages/RecommendedDishesPage';
import TopPicksPage from './pages/TopPicksPage';
import { useStore } from './store/useStore';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/Toast';
import { useEffect } from 'react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const editMode = useStore((state) => state.editMode);
  if (!editMode) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function GlobalErrorListener() {
  const { addToast } = useToast();

  useEffect(() => {
    const handleAppError = (e: Event) => {
      const msg = (e as CustomEvent).detail || 'Something went wrong';
      addToast(msg, 'error');
    };
    
    const handleWindowError = (e: ErrorEvent) => {
      addToast(`Something went wrong: ${e.message}`, 'error');
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || typeof e.reason === 'string' ? e.reason : 'Unknown error';
      addToast(`Something went wrong: ${msg}`, 'error');
    };

    window.addEventListener('app-error', handleAppError);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('app-error', handleAppError);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [addToast]);

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <GlobalErrorListener />
      <HashRouter>
        <Routes>
          <Route element={<ErrorBoundary><MainLayout /></ErrorBoundary>}>
            <Route path="/" element={<MapPage />} />
            <Route path="/recommended" element={<RecommendedDishesPage />} />
            <Route path="/top-picks" element={<TopPicksPage />} />
            <Route path="/restaurant/new" element={<ProtectedRoute><RestaurantFormPage /></ProtectedRoute>} />
            <Route path="/restaurant/:id/edit" element={<ProtectedRoute><RestaurantFormPage /></ProtectedRoute>} />
            <Route path="/restaurant/:id" element={<RestaurantDetails />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}