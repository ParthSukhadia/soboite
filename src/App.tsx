import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import MapPage from './pages/MapPage';
import RestaurantDetails from './pages/RestaurantDetails';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<MapPage />} />
          <Route path="/restaurant/:id" element={<RestaurantDetails />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}