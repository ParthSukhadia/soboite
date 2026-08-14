import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, Loader2, Play, Pause } from 'lucide-react';
import { Restaurant } from '../types';
import { Player } from '@remotion/player';
import { RestaurantStory, RestaurantStoryProps } from '../remotion/RestaurantStory';
import { generateStoryVideo } from '../lib/generateStory';
import { musicLibrary, getRecommendedMusic } from '../lib/musicLibrary';

interface StoryGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: Restaurant | null;
}

export const StoryGeneratorModal: React.FC<StoryGeneratorModalProps> = ({
  isOpen,
  onClose,
  restaurant,
}) => {
  const [formData, setFormData] = useState<RestaurantStoryProps>({
    restaurantName: '',
    area: '',
    cuisine: '',
    rating: 0,
    imageUrl: '',
    videoUrl: '',
    musicFile: '',
    mediaType: 'image',
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && restaurant) {
      const videoPhoto = restaurant.photos?.find(p => p.url.match(/\.(mp4|mov|webm)$/i) || (p as any).fileType?.startsWith('video/'));
      
      setFormData({
        restaurantName: restaurant.name || '',
        area: restaurant.locationName || '',
        cuisine: restaurant.cuisine || '',
        rating: restaurant.ambienceRating || 0,
        imageUrl: restaurant.imageStorageUrl || (restaurant.photos?.[0]?.url) || '',
        videoUrl: videoPhoto?.url || '',
        musicFile: getRecommendedMusic(restaurant.type, restaurant.cuisine),
        mediaType: videoPhoto?.url ? 'video' : 'image',
      });
      setShowPreview(false);
      setIsPlayingAudio(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [isOpen, restaurant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'rating' ? parseFloat(value) : (value === 'undefined' ? '' : value) 
    }));
    
    if (name === 'musicFile' && isPlayingAudio && audioRef.current) {
      audioRef.current.src = `/${value}`;
      audioRef.current.play().catch(console.error);
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      if (audioRef.current.src !== window.location.origin + `/${formData.musicFile}` && (!formData.musicFile || !audioRef.current.src.endsWith(formData.musicFile))) {
        audioRef.current.src = `/${formData.musicFile}`;
      }
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(err => {
        console.error("Audio play failed:", err);
        alert("Could not play audio. Please ensure the file exists and browser allows autoplay.");
      });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    // Pause audio if exporting
    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
    try {
      const url = await generateStoryVideo(formData);
      if (url.startsWith('#mock')) {
        alert('Video rendering is simulated. This would export an MP4 in a real app.');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `soboite-story-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate story.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen || !restaurant) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-[28px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row my-auto max-h-[90vh]"
        >
          {/* Left Side: Form */}
          <div className="flex-1 p-6 md:p-8 flex flex-col overflow-y-auto border-r border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-gray-900 text-xl">Generate Story Video</h3>
                <p className="text-sm text-gray-500 mt-1">Review and customize the video content.</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 md:hidden rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Restaurant Name</label>
                <input
                  type="text"
                  name="restaurantName"
                  value={formData.restaurantName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Area / Location</label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cuisine</label>
                <input
                  type="text"
                  name="cuisine"
                  value={formData.cuisine}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rating (out of 5)</label>
                <input
                  type="number"
                  name="rating"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Media Selection</label>
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="mediaType"
                      value="image"
                      checked={formData.mediaType === 'image'}
                      onChange={handleChange}
                      className="text-slate-900 focus:ring-slate-900"
                    />
                    Use Photo
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="mediaType"
                      value="video"
                      checked={formData.mediaType === 'video'}
                      onChange={handleChange}
                      className="text-slate-900 focus:ring-slate-900"
                    />
                    Use Video
                  </label>
                </div>
              </div>

              {formData.mediaType === 'image' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Image URL</label>
                  <input
                    type="text"
                    name="imageUrl"
                    value={formData.imageUrl || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Video URL</label>
                  <input
                    type="text"
                    name="videoUrl"
                    value={formData.videoUrl || ''}
                    placeholder="Enter URL to .mp4 file"
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Background Music</label>
                <div className="flex gap-2">
                  <select
                    name="musicFile"
                    value={formData.musicFile}
                    onChange={handleChange}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white"
                  >
                    {musicLibrary.map(track => (
                      <option key={track.id} value={track.file}>
                        {track.title} - {track.artist}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={toggleAudio}
                    className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${isPlayingAudio ? 'bg-orange-100 border-orange-200 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    title="Preview Audio"
                  >
                    {isPlayingAudio ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                </div>
                <audio ref={audioRef} onEnded={() => setIsPlayingAudio(false)} className="hidden" />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
              <button
                onClick={() => setShowPreview(true)}
                className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Video size={20} />
                {showPreview ? 'Update Preview' : 'Generate Preview'}
              </button>
            </div>
          </div>

          {/* Right Side: Player Preview */}
          <div className="w-full md:w-[400px] bg-slate-50 p-6 md:p-8 flex flex-col items-center justify-center relative border-t md:border-t-0 border-gray-100 shrink-0">
             <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hidden md:block rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-100 text-gray-500 transition-colors z-10"
              >
                <X size={20} />
              </button>

            {showPreview ? (
              <div className="w-full flex flex-col items-center gap-6">
                <div className="relative group rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10 w-full max-w-[280px] aspect-[9/16] bg-black">
                  <Player
                    component={RestaurantStory}
                    inputProps={{
                      ...formData,
                      videoUrl: formData.mediaType === 'video' ? (formData.videoUrl || undefined) : undefined,
                    }}
                    durationInFrames={210}
                    fps={30}
                    compositionWidth={1080}
                    compositionHeight={1920}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                    controls
                    autoPlay
                    loop
                  />
                </div>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full max-w-[280px] py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="animate-spin" size={18} /> : null}
                  {isExporting ? 'Exporting MP4...' : 'Export MP4'}
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-400 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <Video size={32} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium">Click "Generate Preview" to see the video</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
