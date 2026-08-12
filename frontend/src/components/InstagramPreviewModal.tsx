import React, { useEffect, useState } from 'react';
import { processInstagramImage } from '../lib/instagramProcessing';
import { api } from '../api';
import { Restaurant, Dish } from '../types';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';

interface InstagramPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (payload: { restaurantImage?: string, dishImages?: Record<string, string>, caption?: string, dishAnalyses?: any[], customMediaSequence?: { url: string, type: string }[] }) => Promise<void>;
  restaurant: Restaurant;
  dishes: Dish[];
}

type Step = 'choose_generation' | 'loading' | 'review' | 'generating' | 'preview';

const getMediaType = (media: any): 'image'|'video' => {
  if (media.type === 'video') return 'video';
  if (typeof media.url === 'string') {
    if (media.url.startsWith('data:video/')) return 'video';
    if (media.url.match(/\.(mp4|mov|webm)(\?.*)?$/i)) return 'video';
  }
  return 'image';
};

const getPrimaryImageUrl = (target: any) => {
  const photos = target.photos || [];
  let imgUrl = target.imageStorageUrl;
  if (imgUrl && getMediaType({ url: imgUrl }) === 'video') {
    imgUrl = undefined;
  }
  if (target.primaryPhotoId && photos.length > 0) {
    const p = photos.find((p: any) => p.id === target.primaryPhotoId);
    if (p && getMediaType(p) !== 'video') imgUrl = p.url;
  }
  if (!imgUrl && photos.length > 0) {
    const firstImg = photos.find((p: any) => getMediaType(p) !== 'video');
    if (firstImg) imgUrl = firstImg.url;
  }
  return imgUrl;
};

export const InstagramPreviewModal: React.FC<InstagramPreviewModalProps> = ({
  isOpen,
  onClose,
  onPublish,
  restaurant,
  dishes
}) => {
  const { editMode } = useStore();
  const [step, setStep] = useState<Step>('loading');
  const [previews, setPreviews] = useState<{ type: 'restaurant' | 'dish' | 'b-roll', mediaType: 'image' | 'video', id: string, url: string, selected: boolean }[]>([]);
  const navigate = useNavigate();
  const [isPublishing, setIsPublishing] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [dishAnalyses, setDishAnalyses] = useState<Map<string, { id: string, pros: string[], cons: string[], summary: string, verdict?: string, rank?: 1 | 2 | 3 | null }>>(new Map());
  const [isCached, setIsCached] = useState(false);
  const hasExistingImages = !!restaurant.instaEditedPhotoUrl || dishes.some(d => !!d.instaEditedPhotoUrl);

  useEffect(() => {
    if (isOpen) {
      setStep('choose_generation');
      setCaptionText('');
      setPreviews([]);
      setIsCached(false);
    }
  }, [isOpen]);

  const setupManualAnalysis = () => {
    const map = new Map<string, any>();
    dishes.forEach(d => map.set(d.id, {
      id: d.id,
      pros: d.pros || [],
      cons: d.cons || [],
      summary: d.summary || '',
      verdict: d.verdict || (d.isRecommended ? "Must try" : "Okayish"),
      rank: d.rank ?? null
    }));
    setDishAnalyses(map);
    setCaptionText(restaurant.instaCaption || '');
    setStep('review');
  };

  const fetchAnalysis = async (forceRegenerate = false) => {
    try {
      const analysisData = await api.analyzeRestaurantWithGemini(restaurant, dishes, forceRegenerate);
      if (analysisData.caption) {
        setCaptionText(analysisData.caption);
      }
      if (analysisData.isCached) {
        setIsCached(true);
      }
      const map = new Map<string, { id: string, pros: string[], cons: string[], summary: string, verdict?: string, rank?: 1 | 2 | 3 | null }>();
      if (analysisData.dishes && Array.isArray(analysisData.dishes)) {
        analysisData.dishes.forEach(d => {
          map.set(d.id, d);
        });
      }
      
      const dishesToAnalyze = dishes.filter(d => {
        const existing = map.get(d.id) || {} as any;
        const hasPros = (existing.pros && existing.pros.length > 0) || (d.pros && d.pros.length > 0);
        return forceRegenerate || !hasPros;
      });

      if (dishesToAnalyze.length > 0) {
        try {
          const res = await api.analyzeDishes(dishesToAnalyze);
          if (res.dishes && Array.isArray(res.dishes)) {
            res.dishes.forEach((d: any) => {
              const current = map.get(d.id) || {} as any;
              map.set(d.id, { ...current, ...d });
            });
          }
        } catch (e) {
          console.warn("Failed to analyze dishes:", e);
        }
      }

      // Ensure all dishes have an entry initialized with their existing table values
      dishes.forEach(d => {
        const existing = map.get(d.id) || {} as any;
        map.set(d.id, {
          id: d.id,
          pros: existing.pros?.length ? existing.pros : (d.pros || []),
          cons: existing.cons?.length ? existing.cons : (d.cons || []),
          summary: existing.summary || d.summary || '',
          verdict: existing.verdict || d.verdict || (d.isRecommended ? "Must try" : "Okayish"),
          rank: existing.rank ?? (d.rank ?? null)
        });
      });
      
      setDishAnalyses(map);
      setStep('review');
    } catch (err) {
      console.warn("Failed to fetch gemini analysis from backend:", err);
      setupManualAnalysis();
    }
  };

  const generateImages = async () => {
    setStep('generating');
    try {
      try {
        const dishAnalysesPayload = dishes.map(d => {
          const analysis = dishAnalyses.get(d.id);
          return {
            id: d.id,
            pros: analysis?.pros || [],
            cons: analysis?.cons || [],
            summary: analysis?.summary || '',
            verdict: analysis?.verdict || (d.isRecommended ? "Must try" : "Okayish"),
            rank: analysis?.rank ?? (d.rank ?? null)
          };
        });
        await api.saveInsights(restaurant.id, captionText, dishAnalysesPayload);
        dishAnalysesPayload.forEach(p => {
          useStore.getState().updateDish(p.id, {
            pros: p.pros,
            cons: p.cons,
            summary: p.summary,
            verdict: p.verdict,
            rank: p.rank
          });
        });
      } catch (e) {
        console.warn("Could not save insights to DB:", e);
      }

      const fullSequence: typeof previews = [];
      let currentSelectedCount = 0;

      // Helper to add if under limit
      const addMedia = (item: Omit<typeof previews[0], 'selected'>) => {
        const selected = currentSelectedCount < 10;
        if (selected) currentSelectedCount++;
        fullSequence.push({ ...item, selected });
      };

      // Process Restaurant Image
      let restaurantDataUrl: string | undefined;
      let addedEditedResto = false;
      try {
        const dishAverage = dishes.length > 0 ? (dishes.reduce((sum, d) => sum + (d.rating || 0), 0) / dishes.length) : 0;
        const validRatings = [restaurant.ambienceRating, restaurant.serviceRating, dishAverage].filter(r => typeof r === 'number' && r > 0) as number[];
        const overallRating = validRatings.length > 0 ? (validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1) : undefined;
        restaurantDataUrl = await processInstagramImage(restaurant, 'restaurant', { overallRating });
        addMedia({ type: 'restaurant', mediaType: 'image', id: restaurant.id, url: restaurantDataUrl });
        addedEditedResto = true;
      } catch (e) {
        console.warn("Could not generate restaurant image:", e);
      }

      if (addedEditedResto) {
        const primaryUrl = getPrimaryImageUrl(restaurant);
        if (restaurant.photos && restaurant.photos.length > 0) {
          restaurant.photos.forEach((media, idx) => {
            if (media.url !== primaryUrl) {
              const mType = getMediaType(media);
              addMedia({ type: mType === 'video' ? 'b-roll' : 'restaurant', mediaType: mType, id: `rest-raw-${idx}`, url: media.url });
            }
          });
        }
      } else if (restaurant.photos && restaurant.photos.length > 0) {
        restaurant.photos.forEach((media, idx) => {
            const mType = getMediaType(media);
            addMedia({ type: mType === 'video' ? 'b-roll' : 'restaurant', mediaType: mType, id: `rest-raw-${idx}`, url: media.url });
        });
      } else if (restaurant.imageStorageUrl) {
        addMedia({ type: 'restaurant', mediaType: 'image', id: `rest-raw`, url: restaurant.imageStorageUrl });
      }

      // Process Dish Images
      const sortedDishes = [...dishes].sort((a, b) => {
        const rankA = dishAnalyses.get(a.id)?.rank || 999;
        const rankB = dishAnalyses.get(b.id)?.rank || 999;
        return rankA - rankB;
      });

      for (const dish of sortedDishes) {
        let addedEdited = false;
        try {
          const analysis = dishAnalyses.get(dish.id);
          const dataUrl = await processInstagramImage(dish, 'dish', restaurant, analysis as any);
          addMedia({ type: 'dish', mediaType: 'image', id: dish.id, url: dataUrl });
          addedEdited = true;
        } catch (e) {
          console.warn("Could not generate dish image:", e);
        }

        if (addedEdited) {
          const primaryUrl = getPrimaryImageUrl(dish);
          if (dish.photos && dish.photos.length > 0) {
            dish.photos.forEach((media, idx) => {
               if (media.url !== primaryUrl) {
                 const mType = getMediaType(media);
                 addMedia({ type: mType === 'video' ? 'b-roll' : 'dish', mediaType: mType, id: `dish-${dish.id}-raw-${idx}`, url: media.url });
               }
            });
          }
        } else if (dish.photos && dish.photos.length > 0) {
          dish.photos.forEach((media, idx) => {
             const mType = getMediaType(media);
             addMedia({ type: mType === 'video' ? 'b-roll' : 'dish', mediaType: mType, id: `dish-${dish.id}-raw-${idx}`, url: media.url });
          });
        } else if (dish.imageStorageUrl) {
          addMedia({ type: 'dish', mediaType: 'image', id: `dish-${dish.id}-raw`, url: dish.imageStorageUrl });
        }
      }
      
      setPreviews(fullSequence);
      setStep('preview');
    } catch (error) {
      console.error("Error processing images:", error);
      alert("Failed to process images for Instagram preview.");
      onClose();
    }
  };

  const loadExistingImages = () => {
    const fullSequence: typeof previews = [];
    let currentSelectedCount = 0;

    const addMedia = (item: Omit<typeof previews[0], 'selected'>) => {
      const selected = currentSelectedCount < 10;
      if (selected) currentSelectedCount++;
      fullSequence.push({ ...item, selected });
    };

    let addedEditedResto = false;
    if (restaurant.instaEditedPhotoUrl) {
      addMedia({ type: 'restaurant', mediaType: 'image', id: restaurant.id, url: restaurant.instaEditedPhotoUrl });
      addedEditedResto = true;
    }
    
    if (addedEditedResto) {
      const primaryUrl = getPrimaryImageUrl(restaurant);
      if (restaurant.photos && restaurant.photos.length > 0) {
        restaurant.photos.forEach((media, idx) => {
          if (media.url !== primaryUrl) {
            const mType = getMediaType(media);
            addMedia({ type: mType === 'video' ? 'b-roll' : 'restaurant', mediaType: mType, id: `rest-raw-${idx}`, url: media.url });
          }
        });
      }
    } else if (restaurant.photos && restaurant.photos.length > 0) {
      restaurant.photos.forEach((media, idx) => {
          const mType = getMediaType(media);
          addMedia({ type: mType === 'video' ? 'b-roll' : 'restaurant', mediaType: mType, id: `rest-raw-${idx}`, url: media.url });
      });
    } else if (restaurant.imageStorageUrl) {
      addMedia({ type: 'restaurant', mediaType: 'image', id: `rest-raw`, url: restaurant.imageStorageUrl });
    }
    
    const sortedDishes = [...dishes].sort((a, b) => {
      const rankA = dishAnalyses.get(a.id)?.rank || 999;
      const rankB = dishAnalyses.get(b.id)?.rank || 999;
      return rankA - rankB;
    });

    for (const dish of sortedDishes) {
      let addedEdited = false;
      if (dish.instaEditedPhotoUrl) {
        addMedia({ type: 'dish', mediaType: 'image', id: dish.id, url: dish.instaEditedPhotoUrl });
        addedEdited = true;
      }

      if (addedEdited) {
        const primaryUrl = getPrimaryImageUrl(dish);
        if (dish.photos && dish.photos.length > 0) {
          dish.photos.forEach((media, idx) => {
            if (media.url !== primaryUrl) {
              const mType = getMediaType(media);
              addMedia({ type: mType === 'video' ? 'b-roll' : 'dish', mediaType: mType, id: `dish-${dish.id}-raw-${idx}`, url: media.url });
            }
          });
        }
      } else if (dish.photos && dish.photos.length > 0) {
        dish.photos.forEach((media, idx) => {
            const mType = getMediaType(media);
            addMedia({ type: mType === 'video' ? 'b-roll' : 'dish', mediaType: mType, id: `dish-${dish.id}-raw-${idx}`, url: media.url });
        });
      } else if (dish.imageStorageUrl) {
        addMedia({ type: 'dish', mediaType: 'image', id: `dish-${dish.id}-raw`, url: dish.imageStorageUrl });
      }
    }
    
    setPreviews(fullSequence);
    setStep('preview');
  };

  const handleDownloadAll = () => {
    previews.filter(p => p.selected && p.mediaType === 'image').forEach((p, index) => {
      const link = document.createElement('a');
      link.href = p.url;
      link.download = `instagram-ready-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const togglePreviewSelection = (index: number) => {
    setPreviews(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const updateDishAnalysis = (dishId: string, field: 'pros' | 'cons' | 'verdict' | 'rank', index: number | null, value: any) => {
    setDishAnalyses(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(dishId);
      if (item) {
        if (field === 'verdict') {
          newMap.set(dishId, { ...item, verdict: value });
        } else if (field === 'rank') {
          newMap.set(dishId, { ...item, rank: value });
        } else {
          const arr = [...item[field]];
          if (index !== null) arr[index] = value;
          newMap.set(dishId, { ...item, [field]: arr });
        }
      }
      return newMap;
    });
  };

  const addProCon = (dishId: string, field: 'pros' | 'cons') => {
    setDishAnalyses(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(dishId);
      if (item) {
        newMap.set(dishId, { ...item, [field]: [...item[field], ''] });
      }
      return newMap;
    });
  };

  const removeProCon = (dishId: string, field: 'pros' | 'cons', index: number) => {
    setDishAnalyses(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(dishId);
      if (item) {
        const arr = [...item[field]];
        arr.splice(index, 1);
        newMap.set(dishId, { ...item, [field]: arr });
      }
      return newMap;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 md:p-4">
      <div className="bg-white md:rounded-lg shadow-xl w-full h-full md:h-auto md:max-w-5xl flex flex-col max-h-screen md:max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-white md:rounded-t-lg shrink-0 z-10 shadow-sm md:shadow-none">
          <h2 className="text-lg md:text-xl font-bold truncate pr-2">
            {step === 'choose_generation' && 'Generate Insights'}
            {step === 'loading' && 'Analyzing with Gemini...'}
            {step === 'review' && 'Step 1: Review Content'}
            {step === 'generating' && 'Generating Overlays...'}
            {step === 'preview' && 'Step 2: Preview & Publish'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 'choose_generation' && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                <span className="text-3xl">✨</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Generate Insights with Gemini?</h3>
              <p className="text-gray-600 mb-8 max-w-md">
                Gemini can automatically read through all your dish reviews to generate Pros, Cons, and an Instagram caption for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setStep('loading');
                    fetchAnalysis(false);
                  }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                >
                  Yes, Use Gemini
                </button>
                <button
                  onClick={setupManualAnalysis}
                  className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  No, I'll Write Manually
                </button>
              </div>
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center h-full p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600">Gemini is analyzing the restaurant and dish reviews...</p>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center h-full p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600">Drawing Instagram overlays (4:5 ratio)...</p>
            </div>
          )}

          {step === 'review' && (
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
              <div className="w-full md:w-2/3 p-4 md:overflow-y-auto bg-gray-50 md:border-r border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Review & Edit Dish Overlays</h3>
                  <button 
                    onClick={() => {
                      setStep('loading');
                      fetchAnalysis(true);
                    }}
                    className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-200 transition-colors flex items-center gap-1"
                  >
                    <span>🔄</span> Regenerate AI Content
                  </button>
                </div>
                {isCached && (
                  <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg flex items-start gap-2 border border-blue-200">
                    <span className="text-xl">✨</span>
                    <div>
                      <p className="font-semibold text-sm">Gemini pros, cons, and caption were already present!</p>
                      <p className="text-xs">Loaded from cache. Click "Regenerate AI Content" to re-create the caption and insights from scratch.</p>
                    </div>
                  </div>
                )}
                {hasExistingImages && (
                  <div className="mb-6 p-3 bg-green-50 text-green-800 rounded-lg flex items-start gap-2 border border-green-200">
                    <span className="text-xl">🖼️</span>
                    <div>
                      <p className="font-semibold text-sm">Photo edits were already present!</p>
                      <p className="text-xs">You can proceed with existing images, or recreate them to pick up any new edits you make below.</p>
                    </div>
                  </div>
                )}
                <div className="space-y-6">
                  {dishes.map((dish) => {
                    const analysis = dishAnalyses.get(dish.id);
                    if (!analysis) return null;
                    return (
                      <div key={dish.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h4 className="font-bold text-lg mb-2">{dish.name}</h4>
                        <div className="mb-4 bg-gray-100 p-3 rounded text-sm text-gray-700 italic">
                          <p className="font-semibold text-xs text-gray-500 uppercase not-italic mb-1">Actual User Reviews:</p>
                          {dish.reviews && dish.reviews.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1">
                              {dish.reviews.map(r => <li key={r.id}>{r.text}</li>)}
                            </ul>
                          ) : (
                            <p>No reviews available.</p>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Pros */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-green-600">Pros (Max 3)</span>
                              <button onClick={() => addProCon(dish.id, 'pros')} disabled={analysis.pros.length >= 3} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 md:px-2 md:py-1 rounded hover:bg-green-200 disabled:opacity-50 whitespace-nowrap">
                                + Add Pro
                              </button>
                            </div>
                            {analysis.pros.map((pro, idx) => (
                              <div key={idx} className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  value={pro}
                                  onChange={(e) => updateDishAnalysis(dish.id, 'pros', idx, e.target.value)}
                                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                />
                                <button onClick={() => removeProCon(dish.id, 'pros', idx)} className="text-red-500 hover:text-red-700">
                                  &times;
                                </button>
                              </div>
                            ))}
                            {analysis.pros.length === 0 && <p className="text-xs text-gray-500">No pros added.</p>}
                          </div>

                          {/* Cons */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-red-600">Cons (Max 2)</span>
                              <button onClick={() => addProCon(dish.id, 'cons')} disabled={analysis.cons.length >= 2} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 md:px-2 md:py-1 rounded hover:bg-red-200 disabled:opacity-50 whitespace-nowrap">
                                + Add Con
                              </button>
                            </div>
                            {analysis.cons.map((con, idx) => (
                              <div key={idx} className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  value={con}
                                  onChange={(e) => updateDishAnalysis(dish.id, 'cons', idx, e.target.value)}
                                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 outline-none"
                                />
                                <button onClick={() => removeProCon(dish.id, 'cons', idx)} className="text-red-500 hover:text-red-700">
                                  &times;
                                </button>
                              </div>
                            ))}
                            {analysis.cons.length === 0 && <p className="text-xs text-gray-500">No cons added.</p>}
                          </div>
                        </div>

                        <div className="mt-4 border-t pt-4">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-semibold text-gray-700">Verdict:</span>
                            <select 
                              value={analysis.verdict || (dish.isRecommended ? "Must try" : "Okayish")}
                              onChange={(e) => updateDishAnalysis(dish.id, 'verdict', null, e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="Must try">😋 Must try</option>
                              <option value="Okayish">😐 Okayish</option>
                              <option value="Skip">🚫 Skip</option>
                            </select>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-purple-600">Rank (Crown)</span>
                            </div>
                            <select
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                              value={analysis.rank || ""}
                              onChange={(e) => {
                                const val = e.target.value ? parseInt(e.target.value) as 1|2|3 : null;
                                updateDishAnalysis(dish.id, 'rank', -1, val);
                              }}
                            >
                              <option value="">No Rank</option>
                              <option value="1">🥇 1st (Gold)</option>
                              <option value="2">🥈 2nd (Silver)</option>
                              <option value="3">🥉 3rd (Bronze)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="w-full md:w-1/3 p-4 flex flex-col bg-white md:overflow-y-auto min-h-[400px] border-t md:border-t-0 border-gray-200 shrink-0">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Edit Overall Caption</h3>
                <textarea
                  className="flex-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm leading-relaxed"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Your Instagram caption..."
                ></textarea>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
              <div className="w-full md:w-2/3 p-4 md:overflow-y-auto bg-gray-100 md:border-r border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider flex justify-between items-center">
                  <span>Photo & Video Sequence</span>
                  <span className="text-xs font-normal text-gray-500">
                    Selected: {previews.filter(p => p.selected).length}/10 Max
                  </span>
                </h3>
                {previews.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">No media available for publishing.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {previews.map((p, index) => (
                      <div key={index} className={`flex flex-col relative bg-white p-2 rounded shadow transition-all ${!p.selected ? 'opacity-60 grayscale' : 'ring-2 ring-indigo-500'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-gray-600 capitalize">
                            {index + 1}. {p.type} {p.mediaType === 'video' && '🎥'}
                          </span>
                          <input 
                            type="checkbox" 
                            checked={p.selected} 
                            onChange={() => togglePreviewSelection(index)}
                            disabled={!p.selected && previews.filter(x => x.selected).length >= 10}
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                        {p.mediaType === 'video' ? (
                          <video src={p.url} controls autoPlay muted loop playsInline preload="metadata" className="w-full object-contain rounded bg-black" style={{ aspectRatio: '4/5' }} />
                        ) : (
                          <img src={p.url} alt={`Preview ${index}`} className="w-full object-contain rounded" style={{ aspectRatio: '4/5' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="w-full md:w-1/3 p-4 flex flex-col min-h-[400px] bg-white md:overflow-y-auto border-t md:border-t-0 border-gray-200 shrink-0">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider flex justify-between items-center">
                  <span>Caption</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    onClick={() => navigator.clipboard.writeText(captionText)}
                  >
                    Copy
                  </button>
                </h3>
                <textarea
                  className="flex-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm leading-relaxed"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Your Instagram caption..."
                ></textarea>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex flex-wrap justify-end bg-gray-50 gap-2 sm:gap-4 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:shadow-none">
          {step === 'review' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors text-sm sm:text-base text-center"
              >
                Cancel
              </button>
              {hasExistingImages && (
                <button
                  onClick={loadExistingImages}
                  className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-medium transition-colors text-sm sm:text-base whitespace-nowrap text-center"
                >
                  Use Existing Images &rarr;
                </button>
              )}
              <button
                onClick={generateImages}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm sm:text-base whitespace-nowrap text-center"
              >
                {hasExistingImages ? 'Recreate Images \u2192' : 'Generate Images \u2192'}
              </button>
            </>
          )}

          {step === 'preview' && (
            <div className="w-full flex flex-wrap justify-end gap-2 sm:gap-4 items-center">
              <button
                onClick={() => setStep('review')}
                className="mr-auto px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors flex items-center justify-center border border-indigo-600 rounded-lg sm:border-0 sm:justify-start"
              >
                &larr; Back to Edit
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={previews.length === 0}
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 disabled:opacity-50 transition-colors text-sm sm:text-base text-center"
              >
                Download All Photos
              </button>
              {editMode && (
                <>
                  <button
                    onClick={() => {
                      if (!editMode) {
                        alert("Admin login required to publish to Instagram.");
                        return;
                      }
                      const dishAnalysesPayload = dishes.map(d => {
                        const analysis = dishAnalyses.get(d.id);
                        return {
                          dishId: d.id,
                          pros: analysis?.pros || [],
                          cons: analysis?.cons || [],
                          originalReviews: d.reviews || []
                        };
                      });
                      const payload = { 
                        restaurantImage: '', 
                        dishImages: {} as Record<string, string>, 
                        caption: captionText,
                        dishAnalyses: dishAnalysesPayload,
                        customMediaSequence: previews.filter(p => p.selected).map(p => ({ url: p.url, type: p.mediaType }))
                      };
                      previews.forEach(p => {
                        if (p.type === 'restaurant') payload.restaurantImage = p.url;
                        else if (p.type === 'dish') payload.dishImages[p.id] = p.url;
                      });
                      setIsPublishing(true);
                      onPublish(payload).finally(() => setIsPublishing(false));
                    }}
                    disabled={isPublishing || previews.length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors text-sm sm:text-base text-center"
                  >
                    {isPublishing ? 'Publishing...' : 'Approve & Publish'}
                  </button>
                  <button
                    onClick={() => {
                      if (!editMode) {
                        alert("Admin login required to publish to Instagram.");
                        return;
                      }
                      const dishAnalysesPayload = dishes.map(d => {
                        const analysis = dishAnalyses.get(d.id);
                        return {
                          dishId: d.id,
                          pros: analysis?.pros || [],
                          cons: analysis?.cons || [],
                          originalReviews: d.reviews || []
                        };
                      });
                      const payload = { 
                        restaurantImage: '', 
                        dishImages: {} as Record<string, string>, 
                        caption: captionText,
                        dishAnalyses: dishAnalysesPayload,
                        customMediaSequence: previews.filter(p => p.selected).map(p => ({ url: p.url, type: p.mediaType }))
                      };
                      previews.forEach(p => {
                        if (p.type === 'restaurant') payload.restaurantImage = p.url;
                        else if (p.type === 'dish') payload.dishImages[p.id] = p.url;
                      });
                      // Fire and forget
                      onPublish(payload).catch(console.error);
                      onClose();
                      navigate('/');
                    }}
                    disabled={isPublishing || previews.length === 0}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium transition-colors text-sm sm:text-base text-center"
                  >
                    Publish & Go to Map
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
