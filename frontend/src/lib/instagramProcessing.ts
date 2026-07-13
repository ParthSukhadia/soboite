import { DishGeminiAnalysis } from '../types';

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const paragraphs = text.split('\n');
  let lines: string[] = [];
  paragraphs.forEach(paragraph => {
    if (!paragraph.trim()) {
       lines.push('');
       return;
    }
    const words = paragraph.split(' ');
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = context.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  });
  return lines;
};

export const getCuisineColor = (cuisine?: string) => {
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

export const processInstagramImage = async (
  target: any,
  type: 'restaurant' | 'dish',
  restaurantContext?: any,
  analysis?: DishGeminiAnalysis | null
): Promise<string> => {
  const photos = target.photos || [];
  const primaryId = target.primaryPhotoId;
  let imgUrl = target.imageStorageUrl;
  
  if (primaryId && photos.length > 0) {
    const p = photos.find((p: any) => p.id === primaryId);
    if (p) imgUrl = p.url;
  }
  if (!imgUrl && photos.length > 0) {
    imgUrl = photos[0].url;
  }
  if (!imgUrl) throw new Error('No image');

  const img = await loadImage(imgUrl);
  const canvas = document.createElement('canvas');
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350; // 4:5 ratio
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  const imgRatio = img.width / img.height;
  const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
  
  let bgWidth, bgHeight, bgOffsetX, bgOffsetY;
  if (imgRatio > canvasRatio) {
    bgHeight = CANVAS_HEIGHT;
    bgWidth = bgHeight * imgRatio;
    bgOffsetX = (CANVAS_WIDTH - bgWidth) / 2;
    bgOffsetY = 0;
  } else {
    bgWidth = CANVAS_WIDTH;
    bgHeight = bgWidth / imgRatio;
    bgOffsetX = 0;
    bgOffsetY = (CANVAS_HEIGHT - bgHeight) / 2;
  }

  // Draw blurred background
  ctx.filter = 'blur(40px)';
  const scale = 1.1;
  ctx.drawImage(
    img, 
    bgOffsetX - (bgWidth * (scale - 1)) / 2, 
    bgOffsetY - (bgHeight * (scale - 1)) / 2, 
    bgWidth * scale, 
    bgHeight * scale
  );
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw sharp image
  let drawWidth = CANVAS_WIDTH;
  let drawHeight = CANVAS_HEIGHT;
  let offsetX = 0;
  let offsetY = 0;
  if (imgRatio > canvasRatio) {
    drawHeight = CANVAS_WIDTH / imgRatio;
    offsetY = (CANVAS_HEIGHT - drawHeight) / 2;
  } else {
    drawWidth = CANVAS_HEIGHT * imgRatio;
    offsetX = (CANVAS_WIDTH - drawWidth) / 2;
  }
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

  // Fonts
  const modernFont = '"Inter", "Outfit", "Segoe UI", sans-serif';

  // Gradient Top
  const gradientTop = ctx.createLinearGradient(0, 0, 0, 350);
  gradientTop.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
  gradientTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradientTop;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 350);

  // Determine Names & properties based on type
  let restName = '';
  let locName = '';
  let cuisineName = '';
  if (type === 'restaurant') {
    restName = target.name || '';
    locName = target.locationName || '';
    cuisineName = target.cuisine || '';
  } else {
    restName = target.name || '';
    locName = '';
    cuisineName = restaurantContext?.cuisine || '';
  }

  // --- DRAW TOP LEFT (SOBO.ITE, RESTAURANT NAME, LOC/CUISINE) ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let topY = 60;
  const topX = 50;

  // SOBO.ITE
  ctx.font = `bold 28px ${modernFont}`;
  ctx.fillStyle = '#9ca3af';
  ctx.fillText("SOBO.ITE", topX, topY);
  
  topY += 40;
  
  // Restaurant Name
  ctx.font = `bold 96px ${modernFont}`;
  ctx.fillStyle = '#ffffff';
  const nameLines = wrapText(ctx, restName.toUpperCase(), CANVAS_WIDTH - topX - 50);
  nameLines.forEach((line) => {
    ctx.fillText(line, topX, topY);
    topY += 100;
  });
  topY += 10;

  // Location | Cuisine
  ctx.font = `normal 32px ${modernFont}`;
  
  let currentX = topX;
  if (locName) {
    ctx.fillStyle = '#fbbf24'; // Yellow pin
    ctx.fillText("📍", currentX, topY);
    currentX += 45;
    
    ctx.fillStyle = '#d1d5db'; // Light gray
    ctx.fillText(locName, currentX, topY);
  }


  // Gradient Bottom
  const gradientBottom = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, CANVAS_HEIGHT - 600);
  gradientBottom.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
  gradientBottom.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradientBottom;
  ctx.fillRect(0, CANVAS_HEIGHT - 600, CANVAS_WIDTH, 600);

  if (type === 'dish' && analysis) {
    // --- DRAW BOTTOM DISH OVERLAY ---
    const boxX = 40;
    const boxY = CANVAS_HEIGHT - 440;
    const boxW = CANVAS_WIDTH - 80;
    const boxH = 400;

    ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const leftColX = boxX + 40;
    const rightColX = boxX + boxW - 380;
    let startY = boxY + 50;

    // Left Column (Pros & Cons)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top'; // better for wrapped text
    ctx.font = `normal 34px ${modernFont}`;
    
    // Draw Pros
    if (analysis.pros && analysis.pros.length > 0) {
      analysis.pros.slice(0, 3).forEach((pro: string) => {
        ctx.fillStyle = '#10b981'; // Aesthetic green
        ctx.fillText("✔", leftColX, startY);
        ctx.fillStyle = '#f3f4f6';
        const lines = wrapText(ctx, pro, rightColX - leftColX - 80);
        lines.forEach(line => {
          ctx.fillText(line, leftColX + 45, startY);
          startY += 45;
        });
        startY += 10; // extra spacing between items
      });
    }

    // Draw Cons
    if (analysis.cons && analysis.cons.length > 0) {
      analysis.cons.slice(0, 2).forEach((con: string) => {
        ctx.fillStyle = '#f43f5e'; // Aesthetic red
        ctx.fillText("✖", leftColX, startY);
        ctx.fillStyle = '#d1d5db';
        const lines = wrapText(ctx, con, rightColX - leftColX - 80);
        lines.forEach(line => {
          ctx.fillText(line, leftColX + 45, startY);
          startY += 45;
        });
        startY += 10;
      });
    }

    // Divider line between columns
    ctx.beginPath();
    ctx.moveTo(rightColX - 40, boxY + 40);
    ctx.lineTo(rightColX - 40, boxY + boxH - 120);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Right Column (Rating & Summary)
    const rightY = boxY + 70;
    
    // Star rating
    ctx.font = `bold 56px ${modernFont}`;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText("⭐", rightColX, rightY);
    
    const dishRatingStr = target.rating ? target.rating.toFixed(1) : 'New';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dishRatingStr, rightColX + 70, rightY);
    
    ctx.font = `normal 36px ${modernFont}`;
    ctx.fillStyle = '#9ca3af';
    ctx.fillText("/ 5", rightColX + 160, rightY);
    
    ctx.fillStyle = '#fbbf24';
    let label = target.rating >= 4.5 ? "Excellent" : (target.rating >= 4.0 ? "Good" : (target.rating >= 3.0 ? "Average" : "Poor"));
    if (!target.rating) label = "Unrated";
    ctx.fillText(label, rightColX + 220, rightY);

    let nextY = rightY + 80;
    
    let verdictStr = analysis.verdict || (target.isRecommended || target.is_recommended ? "Must try" : "Okayish");
    let verdictColor = '#ef4444'; // Red
    let verdictText = "😋 Must try";
    
    if (verdictStr === "Okayish") {
      verdictColor = '#f59e0b'; // Orange
      verdictText = "😐 Okayish";
    } else if (verdictStr === "Skip") {
      verdictColor = '#6b7280'; // Gray
      verdictText = "🚫 Skip";
    }
    
    ctx.font = `bold 28px ${modernFont}`;
    ctx.fillStyle = verdictColor;
    ctx.fillText(verdictText, rightColX, nextY);
    nextY += 40;
    
    const servesText = target.serves || '2';
    ctx.font = `normal 28px ${modernFont}`;
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`👥 Serves: ${servesText}`, rightColX, nextY);
    nextY += 40;

    const actualPrice = target.actualPrice || target.actual_price;
    if (actualPrice) {
      ctx.font = `normal 28px ${modernFont}`;
      ctx.fillStyle = '#f3f4f6';
      ctx.fillText(`💵 ₹${actualPrice}`, rightColX, nextY);
      // nextY += 40; // not strictly needed since it's the last item, but good practice
    }

    // Divider for bottom row
    ctx.beginPath();
    ctx.moveTo(boxX + 40, boxY + boxH - 100);
    ctx.lineTo(boxX + boxW - 40, boxY + boxH - 100);
    ctx.stroke();

    // Bottom Row
    const btmY = boxY + boxH - 50;
    ctx.textBaseline = 'middle';
    ctx.font = `normal 32px ${modernFont}`;
    
    if (locName) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText("📍", leftColX, btmY);
      ctx.fillStyle = '#d1d5db';
      ctx.fillText(locName, leftColX + 40, btmY);
    }



    // Cuisine
    ctx.textAlign = 'right';
    const cuisineX = boxX + boxW - 40;
    ctx.fillStyle = '#d1d5db';
    ctx.fillText(cuisineName, cuisineX, btmY);
    ctx.fillStyle = '#22c55e'; // Green dot
    ctx.fillText("🟢 ", cuisineX - ctx.measureText(cuisineName).width - 10, btmY);

    if (analysis.rank) {
      // Position inside the rectangle, bottom left
      const badgeX = boxX + 150;
      const badgeY = boxY + boxH - 85;
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Sparkles
      ctx.font = '25px Arial';
      ctx.fillText('✨', badgeX - 40, badgeY - 25);
      ctx.fillText('✨', badgeX + 40, badgeY - 5);
      ctx.fillText('✨', badgeX - 15, badgeY + 30);

      // Apply filter for silver and bronze
      if (analysis.rank === 2) {
        ctx.filter = 'grayscale(100%) brightness(120%)';
      } else if (analysis.rank === 3) {
        ctx.filter = 'sepia(100%) hue-rotate(330deg) saturate(150%) brightness(80%)';
      }

      // Crown (half size)
      ctx.font = '110px Arial';
      ctx.fillText('👑', badgeX, badgeY);

      // Reset filter
      ctx.filter = 'none';

      // Restore
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }

  } else if (type === 'restaurant') {
    // OLD RESTAURANT STYLE BUT MIGRATED TO BOTTOM
    // The previous implementation for restaurant drew borders, loc text at bottom, we'll keep it simple here
    // or just use the same box style? We'll leave restaurant styling as mostly unchanged from previous or simple text
    const fadeStartY = CANVAS_HEIGHT - 24;
    ctx.fillStyle = getCuisineColor(cuisineName);
    ctx.fillRect(0, fadeStartY, CANVAS_WIDTH, 24);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `bold 64px ${modernFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cuisineName.toUpperCase(), CANVAS_WIDTH / 2, fadeStartY - 60);
    
    ctx.font = `italic normal 48px ${modernFont}`;
    ctx.fillStyle = '#d1d5db';
    ctx.fillText(locName.toUpperCase(), CANVAS_WIDTH / 2, fadeStartY - 140);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};
