import { Outlet, Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

export default function MainLayout() {
  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <header className="bg-white border-b border-gray-200 shadow-sm z-50 px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-800">
          <MapPin className="text-red-500" />
          <span>Soboite</span>
        </Link>
      </header>
      <main className="flex-1 min-h-0 relative overflow-hidden bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
