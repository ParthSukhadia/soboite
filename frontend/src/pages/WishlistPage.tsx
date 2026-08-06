import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { Bookmark, Star, MapPin } from 'lucide-react';
import CachedImage from '../components/CachedImage';
import { getCuisineColor } from '../lib/instagramProcessing';

export default function WishlistPage() {
  const { wishlist, restaurants } = useStore();

  const wishlistRestaurants = restaurants.filter((r) => wishlist.includes(r.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
          <Bookmark className="text-amber-500" size={32} />
          Your Wishlist
        </h1>
        <p className="mt-2 text-gray-600">Restaurants you want to visit sometime.</p>
      </div>

      {wishlistRestaurants.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <Bookmark size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h2>
          <p className="text-gray-500 mb-6">Start exploring restaurants and add them to your wishlist to keep track of where you want to go.</p>
          <Link to="/" className="inline-flex items-center justify-center rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition">
            Explore Restaurants
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wishlistRestaurants.map((r) => {
            const primaryPhoto = r.photos?.find((p) => p.id === r.primaryPhotoId) || r.photos?.[0];
            const imgUrl = r.imageStorageUrl || primaryPhoto?.url;
            const cuisineColor = getCuisineColor(r.cuisine);

            return (
              <Link key={r.id} to={`/restaurant/${r.id}`} className="group relative block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                <div className="aspect-[4/3] w-full bg-gray-100 relative">
                  {imgUrl ? (
                    <CachedImage src={imgUrl} alt={r.name} className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                  )}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                    <Star size={14} className="text-yellow-500 fill-current" />
                    <span className="text-sm font-bold text-gray-900">{r.rating ? r.rating.toFixed(1) : 'New'}</span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{r.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1 truncate">
                      <MapPin size={14} className="shrink-0" />
                      <span className="truncate">{r.locationName}</span>
                    </div>
                  </div>
                  {r.cuisine && (
                    <div className="mt-4 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cuisineColor }} />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{r.cuisine}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
