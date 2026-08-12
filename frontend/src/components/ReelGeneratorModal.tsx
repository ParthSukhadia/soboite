import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { X, ArrowLeft, Download, Loader2, Send } from 'lucide-react';
import { ShouldYouEatHereReel } from '../remotion/ShouldYouEatHereReel';
import { WhatShouldYouOrderReel } from '../remotion/WhatShouldYouOrderReel';
import { OneDishReel } from '../remotion/OneDishReel';
import { PriceValueReel } from '../remotion/PriceValueReel';
import { TopPicksReel } from '../remotion/TopPicksReel';
import { RestaurantReelProps, DishData } from '../remotion/types';
import { musicLibrary, getRecommendedMusic } from '../lib/musicLibrary';
import { generateStoryVideo } from '../lib/generateStory';
import { api } from '../api';
import { useStore } from '../store/useStore';

interface ReelGeneratorModalProps {
  restaurant: any;
  dishes: any[];
  isOpen: boolean;
  onClose: () => void;
}

type TemplateType = 'Auto' | 'ShouldYouEatHereReel' | 'WhatShouldYouOrderReel' | 'OneDishReel' | 'PriceValueReel' | 'TopPicksReel';

export function ReelGeneratorModal({ restaurant, dishes: rawDishes, isOpen, onClose }: ReelGeneratorModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('Auto');
  const playerRef = useRef<PlayerRef>(null);

  // Parse dishes
  const dishes: DishData[] = (rawDishes || []).map((m: any) => ({
    name: m.name,
    rating: m.rating || 4.0,
    price: m.actualPrice || 0,
    image: m.imageStorageUrl || m.photos?.[0]?.url || restaurant?.imageStorageUrl || restaurant?.photos?.[0]?.url || '',
    pros: m.pros || [],
    cons: m.cons || [],
    review: m.review || ''
  }));

  const initialProps: RestaurantReelProps = {
    restaurantName: restaurant?.name || '',
    area: restaurant?.locationName || '',
    cuisine: restaurant?.cuisine || '',
    restaurantRating: restaurant?.ambienceRating || 4.0,
    restaurantPrice: restaurant?.costForTwo ? `₹${restaurant.costForTwo}` : '',
    restaurantImage: restaurant?.imageStorageUrl || restaurant?.photos?.[0]?.url || '',
    dishes,
    restaurantPros: [],
    restaurantCons: [],
    restaurantReview: restaurant?.notes || '',
    logoUrl: '/soboite-icon.svg',
    musicFile: getRecommendedMusic(restaurant?.type, restaurant?.cuisine),
  };

  const [formData, setFormData] = useState<RestaurantReelProps>(initialProps);

  useEffect(() => {
    if (isOpen && restaurant) {
      setFormData({
        ...initialProps,
        musicFile: getRecommendedMusic(restaurant.type, restaurant.cuisine)
      });
      setSelectedTemplate('Auto');
    }
  }, [isOpen, restaurant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDishChange = (index: number, field: keyof DishData, value: string | number) => {
    setFormData(prev => {
      const newDishes = [...prev.dishes];
      newDishes[index] = { ...newDishes[index], [field]: value };
      return { ...prev, dishes: newDishes };
    });
  };

  const activeTemplate = useMemo(() => {
    if (selectedTemplate !== 'Auto') return selectedTemplate;

    const wellRatedDishes = dishes.filter(d => d.rating >= 4.0);
    const exceptionallyRated = dishes.filter(d => d.rating >= 4.5);
    const pricedDishes = dishes.filter(d => (d.price || 0) > 0);

    if (wellRatedDishes.length >= 3) {
      return 'WhatShouldYouOrderReel';
    } else if (exceptionallyRated.length === 1 && dishes.length <= 2) {
      return 'OneDishReel';
    } else if (pricedDishes.length >= 2) {
      return 'PriceValueReel';
    } else {
      return 'ShouldYouEatHereReel';
    }
  }, [selectedTemplate, dishes]);

  const Component = {
    ShouldYouEatHereReel,
    WhatShouldYouOrderReel,
    OneDishReel,
    PriceValueReel,
    TopPicksReel
  }[activeTemplate];

  const duration = useMemo(() => {
    let sequences = 0;
    if (activeTemplate === 'ShouldYouEatHereReel') {
      const bestDish = dishes[0];
      const secondDish = dishes[1];
      sequences = 4 + (bestDish ? 1 : 0) + (secondDish ? 1 : 0);
    } else if (activeTemplate === 'WhatShouldYouOrderReel') {
      const sorted = [...dishes].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
      sequences = 3 + sorted.length;
    } else if (activeTemplate === 'OneDishReel') {
      const bestDish = dishes[0];
      sequences = 3 + (bestDish ? 1 : 0);
    } else if (activeTemplate === 'PriceValueReel') {
      const priced = dishes.filter(d => d.price > 0).sort((a, b) => a.price - b.price).slice(0, 3);
      sequences = 3 + priced.length;
    } else if (activeTemplate === 'TopPicksReel') {
      const top = dishes.filter(d => (d.rating || 0) >= 4.5).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
      sequences = 2 + top.length;
    }
    return sequences === 0 ? 90 : 90 + (sequences - 1) * 45;
  }, [activeTemplate, dishes]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = await generateStoryVideo({ ...formData, compositionId: activeTemplate } as any);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soboite-${activeTemplate}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Failed to generate reel.');
    } finally {
      setIsExporting(false);
    }
  };

  const { editMode } = useStore();

  const handlePublishZernio = async () => {
    if (!editMode) {
      alert('Admin login required to publish Reel to Instagram.');
      return;
    }
    setIsPublishing(true);
    try {
      const url = await generateStoryVideo({ ...formData, compositionId: activeTemplate } as any);
      const res = await fetch(url);
      const blob = await res.blob();
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const dataUrl = await base64Promise;
      const result = await api.publishToInstagram(restaurant.id, {
        customMediaSequence: [{ url: dataUrl, type: 'video' }]
      });
      if (result.success) {
        alert('Successfully published Reel to Instagram via Zernio!');
      } else {
        alert('Failed to publish Reel to Instagram.');
      }
    } catch (err) {
      console.error('Publish error:', err);
      alert('Error publishing to Zernio.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-900 flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 p-4 sm:p-6 border-b border-white/10 shrink-0">
        <button 
          onClick={onClose}
          className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Generate Reel</h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-1">Review details, preview, and generate</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-8 pb-12">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6">
            <h3 className="text-lg font-semibold text-white">1. Review & Edit Data</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Restaurant Name</label>
                <input
                  type="text"
                  name="restaurantName"
                  value={formData.restaurantName}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Area / Location</label>
                  <input
                    type="text"
                    name="area"
                    value={formData.area}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Cuisine</label>
                  <input
                    type="text"
                    name="cuisine"
                    value={formData.cuisine}
                    onChange={handleChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value as TemplateType)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Auto">Auto (Smart Selection)</option>
                  <option value="ShouldYouEatHereReel">Should You Eat Here?</option>
                  <option value="WhatShouldYouOrderReel">What Should You Order?</option>
                  <option value="OneDishReel">One Dish</option>
                  <option value="PriceValueReel">Price / Value</option>
                  <option value="TopPicksReel">Top Picks</option>
                </select>
                {selectedTemplate === 'Auto' && (
                  <p className="text-xs text-amber-500 mt-2">Auto-selected: {activeTemplate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Background Music</label>
                <select
                  name="musicFile"
                  value={formData.musicFile}
                  onChange={handleChange}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">No Music</option>
                  {musicLibrary.map(track => (
                    <option key={track.id} value={track.file}>
                      {track.title} - {track.artist}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4 border-t border-white/10">
                <h4 className="text-md font-medium text-white mb-4">Template Overrides (Optional)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Hook Text</label>
                    <input
                      type="text"
                      name="customHookText"
                      value={formData.customHookText || ''}
                      onChange={handleChange}
                      placeholder="e.g., Should you eat at [Name]?"
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Verdict Title</label>
                      <input
                        type="text"
                        name="customVerdictTitle"
                        value={formData.customVerdictTitle || ''}
                        onChange={handleChange}
                        placeholder="e.g., Would I go back?"
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Verdict Text</label>
                      <input
                        type="text"
                        name="customVerdictText"
                        value={formData.customVerdictText || ''}
                        onChange={handleChange}
                        placeholder="e.g., YES ✅"
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <h4 className="text-md font-medium text-white mb-4">Featured Dishes</h4>
              <div className="space-y-4">
                {formData.dishes.map((dish, i) => (
                  <div key={i} className="p-4 bg-black/30 rounded-xl border border-white/5 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Dish Name</label>
                      <input
                        type="text"
                        value={dish.name}
                        onChange={(e) => handleDishChange(i, 'name', e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Price</label>
                        <input
                          type="number"
                          value={dish.price}
                          onChange={(e) => handleDishChange(i, 'price', Number(e.target.value))}
                          className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Rating</label>
                        <input
                          type="number"
                          step="0.1"
                          value={dish.rating}
                          onChange={(e) => handleDishChange(i, 'rating', Number(e.target.value))}
                          className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Pro / Con / Review Text (shown on image)</label>
                      <textarea
                        value={dish.review}
                        onChange={(e) => handleDishChange(i, 'review', e.target.value)}
                        rows={2}
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 flex flex-col items-center">
            <h3 className="text-lg font-semibold text-white mb-6 w-full text-left">2. Preview & Generate</h3>
            <div className="w-full max-w-[300px] aspect-[9/16] rounded-3xl overflow-hidden shadow-2xl border border-white/20 relative group">
              <Player
                ref={playerRef}
                component={Component as any}
                durationInFrames={duration}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={30}
                inputProps={formData}
                style={{ width: '100%', height: '100%' }}
                autoPlay={false}
                loop
                controls={true}
              />
            </div>
            <p className="mt-4 text-sm text-zinc-500 font-mono">1080 x 1920 • 30 FPS • ~{Math.round(duration/30)}s</p>

            <div className="w-full flex flex-col gap-3 mt-8">
              <button
                onClick={handleExport}
                disabled={isExporting || isPublishing}
                className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-4 px-6 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                {isExporting ? 'Generating Video...' : 'Download MP4'}
              </button>

              {editMode && (
                <button
                  onClick={handlePublishZernio}
                  disabled={isExporting || isPublishing}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 px-6 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isPublishing ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                  {isPublishing ? 'Publishing...' : 'Publish via Zernio'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
