import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Restaurant, TopPickCategory } from '../types';
import { ChevronDown, ChevronRight, Plus, Edit2, Trash2, Loader2, Award, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

type ModalState = 
  | { type: 'add_category' }
  | { type: 'edit_category', categoryId: string, initialName: string }
  | { type: 'delete_category', categoryId: string }
  | { type: 'add_restaurant', categoryId: string }
  | { type: 'remove_restaurant', categoryId: string, restaurantId: string }
  | null;

export default function TopPicksPage() {
  const navigate = useNavigate();
  const {
    restaurants, dishes, loading, fetchData, editMode,
    topPickCategories, topPickRestaurants,
    createTopPickCategory, updateTopPickCategory, deleteTopPickCategory,
    updateTopPickRestaurants
  } = useStore();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const [modal, setModal] = useState<ModalState>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (restaurants.length === 0 || dishes.length === 0 || topPickCategories.length === 0) {
      void fetchData();
    }
  }, [restaurants.length, dishes.length, topPickCategories.length, fetchData]);

  const toggleCategory = (id: string) => {
    const willExpand = !expandedCategories[id];
    setExpandedCategories(prev => ({ ...prev, [id]: willExpand }));
    if (willExpand) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6']
      });
    }
  };

  const handleModalSubmit = async () => {
    if (!modal) return;
    
    setIsSaving(true);
    try {
      if (modal.type === 'add_category') {
        if (!inputValue.trim()) return;
        await createTopPickCategory(inputValue.trim());
      } else if (modal.type === 'edit_category') {
        if (!inputValue.trim() || inputValue.trim() === modal.initialName) return;
        await updateTopPickCategory(modal.categoryId, inputValue.trim());
      } else if (modal.type === 'delete_category') {
        await deleteTopPickCategory(modal.categoryId);
      } else if (modal.type === 'remove_restaurant') {
        const currentRests = topPickRestaurants.filter(r => r.category_id === modal.categoryId).sort((a, b) => a.position - b.position).map(r => r.restaurant_id);
        const newRestIds = currentRests.filter(id => id !== modal.restaurantId);
        await updateTopPickRestaurants(modal.categoryId, newRestIds);
      } else if (modal.type === 'add_restaurant') {
        const currentRests = topPickRestaurants.filter(r => r.category_id === modal.categoryId).sort((a, b) => a.position - b.position).map(r => r.restaurant_id);
        const newRestIds = [...currentRests, inputValue];
        await updateTopPickRestaurants(modal.categoryId, newRestIds);
      }
      setModal(null);
      setInputValue('');
    } catch (error) {
      alert("An error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 pt-6 relative">
      {isSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
            <Loader2 className="h-8 w-8 animate-spin text-black" />
            <p className="text-sm font-semibold text-gray-700">Saving changes...</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900">
                  {modal.type === 'add_category' && 'Add Category'}
                  {modal.type === 'edit_category' && 'Edit Category'}
                  {modal.type === 'delete_category' && 'Delete Category'}
                  {modal.type === 'add_restaurant' && 'Add Restaurant'}
                  {modal.type === 'remove_restaurant' && 'Remove Restaurant'}
                </h3>
                <button onClick={() => setModal(null)} className="p-1 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                {(modal.type === 'add_category' || modal.type === 'edit_category') && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category Name</label>
                    <input 
                      type="text" autoFocus required value={inputValue} 
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="e.g. Best Pizza"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-black focus:outline-none transition"
                    />
                  </div>
                )}
                
                {modal.type === 'delete_category' && (
                  <p className="text-gray-600 font-medium">Are you sure you want to delete this category? This action cannot be undone.</p>
                )}

                {modal.type === 'remove_restaurant' && (
                  <p className="text-gray-600 font-medium">Are you sure you want to remove this restaurant from the top picks?</p>
                )}

                {modal.type === 'add_restaurant' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Restaurant</label>
                    <select
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-black focus:outline-none transition"
                    >
                      <option value="">-- Choose --</option>
                      {restaurants
                        .filter(r => !topPickRestaurants.filter(tr => tr.category_id === modal.categoryId).map(tr => tr.restaurant_id).includes(r.id))
                        .map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="mt-8 flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition active:scale-95">Cancel</button>
                  <button onClick={handleModalSubmit} disabled={!inputValue && (modal.type === 'add_category' || modal.type === 'edit_category' || modal.type === 'add_restaurant')} className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white transition active:scale-95 ${modal.type.includes('delete') || modal.type.includes('remove') ? 'bg-red-500 hover:bg-red-600' : 'bg-black hover:bg-gray-800'} disabled:opacity-50`}>
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Top Picks</h1>
            <p className="mt-1 text-sm text-gray-500">Curated top restaurant picks by category.</p>
          </div>
          {editMode && (
            <button
              onClick={() => { setInputValue(''); setModal({ type: 'add_category' }); }}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Category
            </button>
          )}
        </div>

        {loading && topPickCategories.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            <div className="flex justify-center items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              Loading top picks...
            </div>
          </div>
        ) : topPickCategories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            No categories created yet. {editMode && "Click 'Add Category' to get started."}
          </div>
        ) : (
          <div className="space-y-4">
            {topPickCategories.map((category: TopPickCategory) => {
              const isExpanded = expandedCategories[category.id];
              const categoryRests = topPickRestaurants
                .filter(tr => tr.category_id === category.id)
                .sort((a, b) => a.position - b.position)
                .map(tr => restaurants.find(r => r.id === tr.restaurant_id))
                .filter((r): r is Restaurant => Boolean(r));

              return (
                <div key={category.id} className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-200">
                  <div 
                    className="flex cursor-pointer items-center justify-between bg-white p-4 hover:bg-gray-50 transition-colors"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                      <h2 className="text-xl font-bold">{category.name}</h2>
                    </div>
                    {editMode && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setInputValue(category.name); setModal({ type: 'edit_category', categoryId: category.id, initialName: category.name }); }}
                          className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setModal({ type: 'delete_category', categoryId: category.id }); }}
                          className="rounded-full p-2 text-red-400 hover:bg-red-50 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="p-4 space-y-3 bg-gray-50 border-t border-gray-100">
                      {categoryRests.length === 0 ? (
                        <div className="text-sm text-gray-500 pb-2">No restaurants added yet.</div>
                      ) : (
                        categoryRests.map((restaurant, idx) => (
                          <div 
                            key={restaurant.id} 
                            onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-300 cursor-pointer transition-all duration-200"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center shrink-0">
                                {idx === 0 && (
                                  <Award className="h-8 w-8 text-yellow-500 fill-yellow-400 drop-shadow-[0_3px_5px_rgba(234,179,8,0.5)] transform transition-transform hover:scale-110" strokeWidth={1.5} />
                                )}
                                {idx === 1 && (
                                  <Award className="h-8 w-8 text-gray-400 fill-gray-200 drop-shadow-[0_3px_5px_rgba(156,163,175,0.5)] transform transition-transform hover:scale-110" strokeWidth={1.5} />
                                )}
                                {idx === 2 && (
                                  <Award className="h-8 w-8 text-amber-700 fill-amber-600 drop-shadow-[0_3px_5px_rgba(217,119,6,0.5)] transform transition-transform hover:scale-110" strokeWidth={1.5} />
                                )}
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900">{restaurant.name}</h3>
                            </div>
                            <div className="flex items-center gap-4">
                              {editMode && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setModal({ type: 'remove_restaurant', categoryId: category.id, restaurantId: restaurant.id }); }}
                                  className="rounded-full bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                              <div className="hidden sm:flex items-center text-sm font-semibold text-gray-500">
                                <ChevronRight className="h-5 w-5" />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      {editMode && categoryRests.length < 3 && (
                        <button
                          onClick={() => { setInputValue(''); setModal({ type: 'add_restaurant', categoryId: category.id }); }}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-white py-4 text-sm font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        >
                          <Plus className="h-5 w-5" /> Add Restaurant (Max 3)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
