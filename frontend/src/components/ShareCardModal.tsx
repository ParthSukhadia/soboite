import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, X } from 'lucide-react';
import { Dish, Restaurant } from '../types';
import { useStore } from '../store/useStore';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: Restaurant | Dish | null;
  type: 'restaurant' | 'dish' | null;
}

export default function ShareCardModal({ isOpen, onClose, target, type }: ShareCardModalProps) {
  const restaurants = useStore((state) => state.restaurants);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !target || !type || !canvasRef.current) return;
    
    setIsDrawing(true);
    setPreviewUrl(null);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Determine image URL
    const photos = target.photos || [];
    const primaryId = target.primaryPhotoId;
    let imageUrl = target.imageStorageUrl;
    
    if (primaryId && photos.length > 0) {
      const p = photos.find((p: any) => p.id === primaryId);
      if (p) imageUrl = p.url;
    }
    if (!imageUrl && photos.length > 0) {
      imageUrl = photos[0].url;
    }

    if (!imageUrl) {
      // Fallback if no image
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawOverlays(ctx, canvas, target, type);
      setIsDrawing(false);
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous"; // Important for CORS
    img.onload = () => {
      // Draw image (cover mode)
      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = img.width / img.height;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > canvasRatio) {
        drawWidth = img.width * (canvas.height / img.height);
        offsetX = (canvas.width - drawWidth) / 2;
      } else {
        drawHeight = img.height * (canvas.width / img.width);
        offsetY = (canvas.height - drawHeight) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      
      drawOverlays(ctx, canvas, target, type);
      
      setIsDrawing(false);
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
    };
    
    img.onerror = () => {
      console.error('Failed to load image for canvas');
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      ctx.font = '30px Arial';
      ctx.fillText('Image could not be loaded', 50, 50);
      drawOverlays(ctx, canvas, target, type);
      setIsDrawing(false);
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
    };

    img.src = imageUrl;

  }, [isOpen, target, type]);

  const drawOverlays = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, target: any, type: string) => {
    const getCuisineColor = (cuisine?: string) => {
      if (!cuisine) return '#16a34a'; // Soboite green
      const c = cuisine.toLowerCase();
      if (c.includes('italian')) return '#ffffff';
      if (c.includes('chinese') || c.includes('asian')) return '#ef4444';
      if (c.includes('indian')) return '#f97316';
      if (c.includes('cafe') || c.includes('coffee')) return '#8b4513';
      if (c.includes('mexican')) return '#166534'; // Dark green
      if (c.includes('japanese') || c.includes('sushi')) return '#ec4899';
      if (c.includes('dessert') || c.includes('bakery')) return '#f472b6';
      if (c.includes('healthy') || c.includes('salad')) return '#84cc16';
      if (c.includes('american') || c.includes('burger')) return '#3b82f6';
      return '#16a34a'; // Soboite green
    };

    const getScale = (totalWidth: number) => {
      const maxWidth = canvas.width - 120;
      return totalWidth > maxWidth ? maxWidth / totalWidth : 1;
    };

    let targetCuisine = target?.cuisine;
    if (type === 'dish') {
      const dish = target as Dish;
      const restaurant = restaurants.find(r => r.id === dish.restaurantId);
      targetCuisine = restaurant?.cuisine;
    }
    const borderColor = getCuisineColor(targetCuisine);
    const borderWidth = 24;

    // 2. Draw Top Horizontal Fade
    const gradientTop = ctx.createLinearGradient(0, 0, 0, 450);
    gradientTop.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    gradientTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradientTop;
    ctx.fillRect(0, 0, canvas.width, 450);

    // 3. Draw Bottom Horizontal Fade (stops at the top of the border)
    const fadeHeight = 450;
    const fadeStartY = canvas.height - borderWidth;
    const gradientBottom = ctx.createLinearGradient(0, fadeStartY, 0, fadeStartY - fadeHeight);
    gradientBottom.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    gradientBottom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradientBottom;
    ctx.fillRect(0, fadeStartY - fadeHeight, canvas.width, fadeHeight);

    // 1. Draw Border (Bottom only) - Drawn after fade so it's fully crisp
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, fadeStartY, canvas.width, borderWidth);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const modernFont = '"Inter", "Outfit", "Segoe UI", sans-serif';

    if (type === 'restaurant') {
      const rest = target as Restaurant;
      const name = (rest.name || '').toUpperCase();
      const rating = rest.ambienceRating ? rest.ambienceRating.toFixed(1) : 'New';
      const locText = (rest.locationName || '').toUpperCase();
      const cuisineText = (rest.cuisine || '').toUpperCase();

      // --- Top: RATING | NAME OF RESTO ---
      const ratingStr = `${rating} ⭐`;
      ctx.font = `bold 72px ${modernFont}`;
      let ratingWidth = ctx.measureText(ratingStr).width;
      
      const sepStr = '  |  ';
      ctx.font = `300 72px ${modernFont}`;
      let sepWidth = name ? ctx.measureText(sepStr).width : 0;
      
      ctx.font = `italic normal 72px ${modernFont}`;
      let nameWidth = name ? ctx.measureText(name).width : 0;

      let totalTopWidth = ratingWidth + sepWidth + nameWidth;
      let topFontSize = 72;
      const topScale = getScale(totalTopWidth);
      
      if (topScale < 1) {
        topFontSize = Math.floor(72 * topScale);
        ctx.font = `bold ${topFontSize}px ${modernFont}`;
        ratingWidth = ctx.measureText(ratingStr).width;
        ctx.font = `300 ${topFontSize}px ${modernFont}`;
        sepWidth = name ? ctx.measureText(sepStr).width : 0;
        ctx.font = `italic normal ${topFontSize}px ${modernFont}`;
        nameWidth = name ? ctx.measureText(name).width : 0;
        totalTopWidth = ratingWidth + sepWidth + nameWidth;
      }

      let startX = (canvas.width - totalTopWidth) / 2;
      const topY = 60;
      
      // Draw Rating
      ctx.font = `bold ${topFontSize}px ${modernFont}`;
      ctx.fillStyle = '#fbbf24'; // yellow
      ctx.fillText(ratingStr, startX, topY);
      startX += ratingWidth;

      if (name) {
        // Draw Separator
        ctx.font = `300 ${topFontSize}px ${modernFont}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(sepStr, startX, topY);
        startX += sepWidth;

        // Draw Name
        ctx.font = `italic normal ${topFontSize}px ${modernFont}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, startX, topY);
      }

      // --- Bottom: LOCATION | CUISINE ---
      ctx.font = `italic normal 64px ${modernFont}`;
      let locWidth = locText ? ctx.measureText(locText).width : 0;
      
      ctx.font = `300 64px ${modernFont}`;
      let sep2Width = (locText && cuisineText) ? ctx.measureText(sepStr).width : 0;

      ctx.font = `bold 64px ${modernFont}`;
      let cuisineWidth = cuisineText ? ctx.measureText(cuisineText).width : 0;

      let totalBottomWidth = locWidth + sep2Width + cuisineWidth;
      let bottomFontSize = 64;
      const bottomScale = getScale(totalBottomWidth);

      if (bottomScale < 1) {
        bottomFontSize = Math.floor(64 * bottomScale);
        ctx.font = `italic normal ${bottomFontSize}px ${modernFont}`;
        locWidth = locText ? ctx.measureText(locText).width : 0;
        ctx.font = `300 ${bottomFontSize}px ${modernFont}`;
        sep2Width = (locText && cuisineText) ? ctx.measureText(sepStr).width : 0;
        ctx.font = `bold ${bottomFontSize}px ${modernFont}`;
        cuisineWidth = cuisineText ? ctx.measureText(cuisineText).width : 0;
        totalBottomWidth = locWidth + sep2Width + cuisineWidth;
      }

      let bottomStartX = (canvas.width - totalBottomWidth) / 2;
      const bottomY = fadeStartY - bottomFontSize - 40; // Ensure dynamic bottom spacing

      if (locText) {
        // Draw Location
        ctx.font = `italic normal ${bottomFontSize}px ${modernFont}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(locText, bottomStartX, bottomY);
        bottomStartX += locWidth;
      }

      if (locText && cuisineText) {
        // Draw Separator
        ctx.font = `300 ${bottomFontSize}px ${modernFont}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(sepStr, bottomStartX, bottomY);
        bottomStartX += sep2Width;
      }

      if (cuisineText) {
        // Draw Cuisine
        ctx.font = `bold ${bottomFontSize}px ${modernFont}`;
        ctx.fillStyle = borderColor; 
        ctx.fillText(cuisineText, bottomStartX, bottomY);
      }

    } else {
      const dish = target as Dish;
      const name = (dish.name || '').toUpperCase();
      const rating = dish.rating ? dish.rating.toFixed(1) : 'New';
      const cost = dish.actualPrice ? `₹${dish.actualPrice}` : Array(dish.priceLevel || 1).fill('₹').join('');
      const cuisineText = (dish.cuisine || '').toUpperCase();

      // --- Top: RATING | NAME ---
      const ratingStr = `${rating} ⭐`;
      ctx.font = `bold 72px ${modernFont}`;
      let ratingWidth = ctx.measureText(ratingStr).width;
      
      const sepStr = '  |  ';
      ctx.font = `300 72px ${modernFont}`;
      let sepWidth = name ? ctx.measureText(sepStr).width : 0;
      
      ctx.font = `italic normal 72px ${modernFont}`;
      let nameWidth = name ? ctx.measureText(name).width : 0;

      let totalTopWidth = ratingWidth + sepWidth + nameWidth;
      let topFontSize = 72;
      const topScale = getScale(totalTopWidth);
      
      if (topScale < 1) {
        topFontSize = Math.floor(72 * topScale);
        ctx.font = `bold ${topFontSize}px ${modernFont}`;
        ratingWidth = ctx.measureText(ratingStr).width;
        ctx.font = `300 ${topFontSize}px ${modernFont}`;
        sepWidth = name ? ctx.measureText(sepStr).width : 0;
        ctx.font = `italic normal ${topFontSize}px ${modernFont}`;
        nameWidth = name ? ctx.measureText(name).width : 0;
        totalTopWidth = ratingWidth + sepWidth + nameWidth;
      }

      let startX = (canvas.width - totalTopWidth) / 2;
      const topY = 60;
      
      ctx.font = `bold ${topFontSize}px ${modernFont}`;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(ratingStr, startX, topY);
      startX += ratingWidth;

      if (name) {
        ctx.font = `300 ${topFontSize}px ${modernFont}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(sepStr, startX, topY);
        startX += sepWidth;

        ctx.font = `italic normal ${topFontSize}px ${modernFont}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, startX, topY);
      }

      // --- Bottom: COST | CUISINE ---
      ctx.font = `bold 64px ${modernFont}`;
      let costWidth = cost ? ctx.measureText(cost).width : 0;
      
      ctx.font = `300 64px ${modernFont}`;
      let sep2Width = (cost && cuisineText) ? ctx.measureText(sepStr).width : 0;

      ctx.font = `bold 64px ${modernFont}`;
      let cuisineWidth = cuisineText ? ctx.measureText(cuisineText).width : 0;

      let totalBottomWidth = costWidth + sep2Width + cuisineWidth;
      let bottomFontSize = 64;
      const bottomScale = getScale(totalBottomWidth);

      if (bottomScale < 1) {
        bottomFontSize = Math.floor(64 * bottomScale);
        ctx.font = `bold ${bottomFontSize}px ${modernFont}`;
        costWidth = cost ? ctx.measureText(cost).width : 0;
        ctx.font = `300 ${bottomFontSize}px ${modernFont}`;
        sep2Width = (cost && cuisineText) ? ctx.measureText(sepStr).width : 0;
        ctx.font = `bold ${bottomFontSize}px ${modernFont}`;
        cuisineWidth = cuisineText ? ctx.measureText(cuisineText).width : 0;
        totalBottomWidth = costWidth + sep2Width + cuisineWidth;
      }

      let bottomStartX = (canvas.width - totalBottomWidth) / 2;
      const bottomY = fadeStartY - bottomFontSize - 40; // Ensure dynamic bottom spacing

      if (cost) {
        ctx.font = `bold ${bottomFontSize}px ${modernFont}`;
        ctx.fillStyle = '#4ade80'; // green for money
        ctx.fillText(cost, bottomStartX, bottomY);
        bottomStartX += costWidth;
      }

      if (cost && cuisineText) {
        ctx.font = `300 ${bottomFontSize}px ${modernFont}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(sepStr, bottomStartX, bottomY);
        bottomStartX += sep2Width;
      }

      if (cuisineText) {
        ctx.font = `bold ${bottomFontSize}px ${modernFont}`;
        ctx.fillStyle = borderColor;
        ctx.fillText(cuisineText, bottomStartX, bottomY);
      }
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.download = `${target?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'share'}_soboite.jpg`;
    link.href = previewUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-lg">Share Card Preview</h3>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 bg-slate-50 flex-1 flex flex-col items-center justify-center">
            {/* Hidden canvas used for drawing */}
            <canvas 
              ref={canvasRef} 
              width={1080} 
              height={1080} 
              className="hidden" 
            />
            
            {isDrawing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 size={32} className="animate-spin text-orange-500" />
                <p className="text-sm font-medium text-slate-500 tracking-wide">Generating image...</p>
              </div>
            ) : previewUrl ? (
              <div className="relative group rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5">
                <img 
                  src={previewUrl} 
                  alt="Share Preview" 
                  className="w-full max-w-[320px] aspect-square object-cover" 
                />
              </div>
            ) : (
              <p className="text-sm text-red-500">Failed to generate image preview.</p>
            )}
          </div>
          
          <div className="p-6 bg-white border-t border-gray-100">
            <button
              onClick={handleDownload}
              disabled={isDrawing || !previewUrl}
              className="w-full py-3.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-orange-500/20"
            >
              <Download size={20} />
              Download Image
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
