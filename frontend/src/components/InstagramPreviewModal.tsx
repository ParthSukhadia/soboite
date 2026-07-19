import React, { useEffect, useState } from 'react';
import { processInstagramImage } from '../lib/instagramProcessing';
import { api } from '../api';
import { Restaurant, Dish } from '../types';

interface InstagramPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (payload: { restaurantImage: string, dishImages: Record<string, string>, caption?: string, dishAnalyses?: any[] }) => Promise<void>;
  restaurant: Restaurant;
  dishes: Dish[];
}

type Step = 'loading' | 'review' | 'generating' | 'preview';

export const InstagramPreviewModal: React.FC<InstagramPreviewModalProps> = ({
  isOpen,
  onClose,
  onPublish,
  restaurant,
  dishes
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [previews, setPreviews] = useState<{ type: 'restaurant' | 'dish', id: string, url: string }[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [dishAnalyses, setDishAnalyses] = useState<Map<string, { id: string, pros: string[], cons: string[], summary: string, verdict?: string, rank?: 1 | 2 | 3 | null }>>(new Map());
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('loading');
      setCaptionText('');
      setPreviews([]);
      setIsCached(false);
      fetchAnalysis();
    }
  }, [isOpen]);

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
      
      // Ensure all dishes have an entry
      dishes.forEach(d => {
        if (!map.has(d.id)) {
           map.set(d.id, { id: d.id, pros: [], cons: [], summary: '' });
        }
      });
      
      setDishAnalyses(map);
      setStep('review');
    } catch (err) {
      console.warn("Failed to fetch gemini analysis from backend:", err);
      // Fallback
      const map = new Map<string, any>();
      dishes.forEach(d => map.set(d.id, { id: d.id, pros: [], cons: [], summary: '' }));
      setDishAnalyses(map);
      setStep('review');
    }
  };

  const generateImages = async () => {
    setStep('generating');
    try {
      const generatedPreviews: { type: 'restaurant' | 'dish', id: string, url: string }[] = [];
      
      try {
        const dishAnalysesPayload = dishes.map(d => {
          const analysis = dishAnalyses.get(d.id);
          return {
            id: d.id,
            pros: analysis?.pros || [],
            cons: analysis?.cons || [],
            summary: analysis?.summary || '',
            verdict: analysis?.verdict || (d.isRecommended ? "Must try" : "Okayish")
          };
        });
        await api.saveInsights(restaurant.id, captionText, dishAnalysesPayload);
      } catch (e) {
        console.warn("Could not save insights to DB:", e);
      }

      // Process Restaurant Image
      try {
        const dataUrl = await processInstagramImage(restaurant, 'restaurant');
        generatedPreviews.push({ type: 'restaurant', id: restaurant.id, url: dataUrl });
      } catch (e) {
        console.warn("Could not generate restaurant image:", e);
      }

      // Process Dish Images
      const sortedDishes = [...dishes].sort((a, b) => {
        const rankA = dishAnalyses.get(a.id)?.rank || 999;
        const rankB = dishAnalyses.get(b.id)?.rank || 999;
        return rankA - rankB;
      });

      for (const dish of sortedDishes) {
        try {
          const analysis = dishAnalyses.get(dish.id);
          const dataUrl = await processInstagramImage(dish, 'dish', restaurant, analysis as any);
          generatedPreviews.push({ type: 'dish', id: dish.id, url: dataUrl });
        } catch (e) {
          console.warn("Could not generate dish image:", e);
        }
      }
      
      // Slice to max 10 for Instagram Carousel
      setPreviews(generatedPreviews.slice(0, 10));
      setStep('preview');
    } catch (error) {
      console.error("Error processing images:", error);
      alert("Failed to process images for Instagram preview.");
      onClose();
    }
  };

  const handleDownloadAll = () => {
    previews.forEach((p, index) => {
      const link = document.createElement('a');
      link.href = p.url;
      link.download = `instagram-ready-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
                  <div className="mb-6 p-3 bg-blue-50 text-blue-800 rounded-lg flex items-start gap-2 border border-blue-200">
                    <span className="text-xl">✨</span>
                    <div>
                      <p className="font-semibold text-sm">Data loaded from cache</p>
                      <p className="text-xs">Click "Regenerate AI Content" to re-create the caption and insights from scratch.</p>
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
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Photo Previews</h3>
                {previews.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">No images available for publishing.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {previews.map((p, index) => (
                      <div key={index} className="flex flex-col items-center bg-white p-2 rounded shadow">
                        <span className="text-xs font-semibold mb-2 text-gray-500">Image {index + 1} ({p.type})</span>
                        <img src={p.url} alt={`Preview ${index}`} className="w-full object-contain rounded" style={{ aspectRatio: '4/5' }} />
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
              <button
                onClick={generateImages}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm sm:text-base whitespace-nowrap text-center"
              >
                Generate Images &rarr;
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
              <button
                onClick={async () => {
                  setIsPublishing(true);
                  try {
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
                    dishAnalyses: dishAnalysesPayload
                  };
                    previews.forEach(p => {
                      if (p.type === 'restaurant') payload.restaurantImage = p.url;
                      else payload.dishImages[p.id] = p.url;
                    });
                    await onPublish(payload);
                    onClose();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsPublishing(false);
                  }
                }}
                disabled={isPublishing || previews.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors text-sm sm:text-base text-center"
              >
                {isPublishing ? 'Publishing...' : 'Approve & Publish'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
