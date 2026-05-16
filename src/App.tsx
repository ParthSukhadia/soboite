import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import MapPage from './pages/MapPage';
import RestaurantDetails from './pages/RestaurantDetails';
import RestaurantFormPage from './pages/RestaurantFormPage';
import { useStore } from './store/useStore';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const editMode = useStore((state) => state.editMode);
  if (!editMode) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<MapPage />} />
          <Route path="/restaurant/new" element={<ProtectedRoute><RestaurantFormPage /></ProtectedRoute>} />
          <Route path="/restaurant/:id/edit" element={<ProtectedRoute><RestaurantFormPage /></ProtectedRoute>} />
          <Route path="/restaurant/:id" element={<RestaurantDetails />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}