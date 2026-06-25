import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Restaurant, TopPickCategory } from '../types';
import { ChevronDown, ChevronRight, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    if (restaurants.length === 0 || dishes.length === 0 || topPickCategories.length === 0) {
      void fetchData();
    }
  }, [restaurants.length, dishes.length, topPickCategories.length, fetchData]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddCategory = async () => {
    const name = prompt("Enter new category name (e.g. Best Pizza):");
    if (name) {
      setIsSaving(true);
      try {
        await createTopPickCategory(name);
      } catch (error) {
        alert("Error adding category.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleEditCategory = async (id: string, oldName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const name = prompt("Edit category name:", oldName);
    if (name && name !== oldName) {
      setIsSaving(true);
      try {
        await updateTopPickCategory(id, name);
      } catch (error) {
        alert("Error updating category.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDeleteCategory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this category?")) {
      setIsSaving(true);
      try {
        await deleteTopPickCategory(id);
      } catch (error) {
        alert("Error deleting category.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAddRestaurantToCategory = async (categoryId: string) => {
    const currentRests = topPickRestaurants.filter(r => r.category_id === categoryId).sort((a, b) => a.position - b.position).map(r => r.restaurant_id);
    if (currentRests.length >= 3) {
      alert("Maximum 3 restaurants allowed per category.");
      return;
    }
    const available = restaurants.filter(r => !currentRests.includes(r.id));
    if (available.length === 0) {
      alert("No more restaurants available to add.");
      return;
    }

    const selectionText = available.map((r, i) => `${i + 1}. ${r.name}`).join("\n");
    const choice = prompt(`Select a restaurant to add (enter number):\n${selectionText}`);
    const index = parseInt(choice || '', 10) - 1;
    
    if (!isNaN(index) && available[index]) {
      const newRestIds = [...currentRests, available[index].id];
      setIsSaving(true);
      try {
        await updateTopPickRestaurants(categoryId, newRestIds);
      } catch (error) {
        alert("Error adding restaurant.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleRemoveRestaurant = async (categoryId: string, restaurantIdToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Remove this restaurant from the category?")) {
      const currentRests = topPickRestaurants.filter(r => r.category_id === categoryId).sort((a, b) => a.position - b.position).map(r => r.restaurant_id);
      const newRestIds = currentRests.filter(id => id !== restaurantIdToRemove);
      setIsSaving(true);
      try {
        await updateTopPickRestaurants(categoryId, newRestIds);
      } catch (error) {
        alert("Error removing restaurant.");
      } finally {
        setIsSaving(false);
      }
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
      
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Top Picks</h1>
            <p className="mt-1 text-sm text-gray-500">Curated top restaurant picks by category.</p>
          </div>
          {editMode && (
            <button
              onClick={handleAddCategory}
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
                          onClick={(e) => handleEditCategory(category.id, category.name, e)}
                          className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteCategory(category.id, e)}
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
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-sm font-bold text-amber-700">
                                #{idx + 1}
                              </span>
                              <h3 className="text-lg font-semibold text-gray-900">{restaurant.name}</h3>
                            </div>
                            <div className="flex items-center gap-4">
                              {editMode && (
                                <button
                                  onClick={(e) => handleRemoveRestaurant(category.id, restaurant.id, e)}
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
                          onClick={() => handleAddRestaurantToCategory(category.id)}
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
