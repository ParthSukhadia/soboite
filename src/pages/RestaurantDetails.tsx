import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Star, Plus, Trash2 } from 'lucide-react';
import { useForm as useRHForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import TagSelector from '../components/TagSelector';

const dishSchema = z.object({
  name: z.string().min(1, 'Dish name is required'),
  rating: z.number().min(1).max(5),
  priceLevel: z.number().min(1).max(4),
  review: z.string(),
  imageUrl: z.string().url('Enter a valid image URL').optional().or(z.literal('')),
  cuisine: z.string().optional()
});
type DishForm = z.infer<typeof dishSchema>;

export default function RestaurantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    restaurants,
    dishes,
    cuisines,
    flavorTags,
    editMode,
    addDish,
    deleteDish,
    deleteRestaurant,
    ensureCuisine,
    ensureFlavorTag
  } = useStore();
  const restaurant = restaurants.find(r => r.id === id);
  const restaurantDishes = dishes.filter(d => d.restaurantId === id);
  
  const [showAddDish, setShowAddDish] = useState(false);
  const [dishCuisineSelection, setDishCuisineSelection] = useState('');
  const [customDishCuisine, setCustomDishCuisine] = useState('');
  const [selectedDishTags, setSelectedDishTags] = useState<string[]>([]);
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useRHForm<DishForm>({
    resolver: zodResolver(dishSchema),
    defaultValues: { rating: 5, priceLevel: 2, review: '', imageUrl: '', cuisine: '' }
  });

  const rating = watch('rating');
  const priceLevel = watch('priceLevel');

  const cuisineOptions = useMemo(() => {
    const values = [
      ...cuisines,
      ...(restaurant?.cuisine ? [restaurant.cuisine] : []),
      ...restaurantDishes.map((dish) => dish.cuisine).filter((value): value is string => Boolean(value))
    ];
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [cuisines, restaurant?.cuisine, restaurantDishes]);

  const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  if (!restaurant) {
    return <div className="p-8 text-center text-gray-500">Restaurant not found.</div>;
  }

  const onSubmit = async (data: DishForm) => {
    const cuisineValue = (dishCuisineSelection === '__custom__' ? customDishCuisine : dishCuisineSelection).trim();
    if (cuisineValue) {
      await ensureCuisine(cuisineValue);
    }
    if (selectedDishTags.length > 0) {
      await Promise.all(selectedDishTags.map((tag) => ensureFlavorTag(tag)));
    }

    await addDish({
      id: createId(),
      restaurantId: restaurant.id,
      name: data.name,
      rating: data.rating,
      priceLevel: data.priceLevel as 1|2|3|4,
      review: data.review,
      imageUrl: data.imageUrl || undefined,
      cuisine: cuisineValue || undefined,
      flavorTags: selectedDishTags.length > 0 ? selectedDishTags : undefined
    });
    setShowAddDish(false);
    setDishCuisineSelection('');
    setCustomDishCuisine('');
    setSelectedDishTags([]);
    reset();
  };

  const handleDeleteRest = () => {
    if (confirm('Delete this restaurant and all its dishes?')) {
      deleteRestaurant(restaurant.id);
      navigate('/');
    }
  };

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto p-4 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 mb-6 hover:text-black mt-2">
        <ArrowLeft size={20} /> Back to map
      </button>

      {restaurant.imageUrl && (
        <div className="mb-6 rounded-2xl overflow-hidden h-64 shadow-sm border border-gray-100">
          <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 relative">
        {editMode && (
          <button onClick={handleDeleteRest} className="absolute top-4 right-4 text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-full">
            <Trash2 size={18} />
          </button>
        )}
        <h1 className="text-3xl font-extrabold text-gray-900">{restaurant.name}</h1>
        {restaurant.notes && <p className="text-gray-600 mt-2">{restaurant.notes}</p>}
      </div>

      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Recommended Dishes
          <span className="bg-gray-200 text-gray-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">{restaurantDishes.length}</span>
        </h2>
      </div>

      {restaurantDishes.length === 0 && !showAddDish && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No dishes added yet.</p>
          {editMode && (
            <button onClick={() => setShowAddDish(true)} className="text-red-500 font-medium hover:underline">
              + Add your first dish
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {restaurantDishes.map((dish) => (
          <motion.div layout key={dish.id} className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 relative group">
            {editMode && (
              <button onClick={() => deleteDish(dish.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 p-2 rounded-full">
                <Trash2 size={16} />
              </button>
            )}
            {dish.imageUrl && (
              <div className="mb-3 rounded-xl overflow-hidden h-36">
                <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex justify-between items-start mb-2 pr-8">
              <h3 className="text-lg font-bold text-gray-900">{dish.name}</h3>
              <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg text-sm tracking-widest">
                {'₹'.repeat(dish.priceLevel)}
              </span>
            </div>
            <div className="flex gap-1 mb-3 text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} fill={i < dish.rating ? 'currentColor' : 'none'} color={i < dish.rating ? 'currentColor' : '#e5e7eb'} />
              ))}
            </div>
            {(dish.cuisine || (dish.flavorTags && dish.flavorTags.length > 0)) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {dish.cuisine && (
                  <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">{dish.cuisine}</span>
                )}
                {dish.flavorTags?.map((tag) => (
                  <span key={tag} className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            )}
            {dish.review && <p className="text-gray-600 leading-relaxed text-sm">{dish.review}</p>}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showAddDish && editMode && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mt-4 bg-white rounded-2xl p-6 shadow-xl border border-gray-200 max-h-[80dvh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <h3 className="text-lg font-bold mb-4">Add New Dish</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Dish Name</label>
                <input {...register('name')} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" />
                {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button type="button" key={star} onClick={() => setValue('rating', star)} className={`${star <= rating ? 'text-yellow-400' : 'text-gray-300'} transition-colors`}>
                        <Star size={24} fill="currentColor" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Price Level</label>
                  <div className="flex gap-2 font-medium text-gray-400">
                    {[1, 2, 3, 4].map((level) => (
                      <button type="button" key={level} onClick={() => setValue('priceLevel', level)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${level === priceLevel ? 'bg-green-100 text-green-700 font-bold border border-green-300' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        {'₹'.repeat(level)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Review (optional)</label>
                <textarea {...register('review')} rows={3} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cuisine (optional)</label>
                  <select
                    value={dishCuisineSelection}
                    onChange={(event) => setDishCuisineSelection(event.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                  >
                    <option value="">Select cuisine</option>
                    {cuisineOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="__custom__">Add new cuisine...</option>
                  </select>
                  {dishCuisineSelection === '__custom__' && (
                    <input
                      value={customDishCuisine}
                      onChange={(event) => setCustomDishCuisine(event.target.value)}
                      className="mt-2 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
                      placeholder="Enter new cuisine"
                    />
                  )}
                </div>
                <div>
                  <TagSelector
                    label="Flavor Tags"
                    selectedTags={selectedDishTags}
                    availableTags={flavorTags}
                    onChange={setSelectedDishTags}
                    onCreateTag={ensureFlavorTag}
                    placeholder="Type to search or add"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Dish Image URL (optional)</label>
                <input {...register('imageUrl')} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="https://..." />
                {errors.imageUrl && <span className="text-red-500 text-sm">{errors.imageUrl.message}</span>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddDish(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-[2] py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 shadow-md">Save Dish</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {editMode && !showAddDish && (
        <button onClick={() => setShowAddDish(true)} className="fixed bottom-6 right-6 bg-black hover:bg-gray-800 text-white rounded-full p-4 shadow-2xl active:scale-95 transition-transform flex items-center justify-center">
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}