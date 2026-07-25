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

const drawStarPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
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
    const fadeStartY = CANVAS_HEIGHT - 24;
    ctx.fillStyle = getCuisineColor(cuisineName);
    ctx.fillRect(0, fadeStartY, CANVAS_WIDTH, 24);

    const overallRatingStr = restaurantContext?.overallRating;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // Overall ratings in stars in middle
    if (overallRatingStr) {
      const rating = parseFloat(overallRatingStr);
      const starSize = 35;
      const spacing = 12;
      const maxStars = 5;
      const totalWidth = maxStars * (starSize * 2 + spacing) - spacing;
      
      const cy = fadeStartY - 130 - starSize;
      let currentX = (CANVAS_WIDTH / 2) - (totalWidth / 2) + starSize;

      // Draw empty/disabled stars
      for (let i = 0; i < maxStars; i++) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        drawStarPath(ctx, currentX, cy, 5, starSize, starSize / 2.2);
        ctx.fill();
        currentX += (starSize * 2 + spacing);
      }

      // Draw highlighted stars with clipping
      ctx.save();
      ctx.beginPath();
      const clipWidth = totalWidth * (rating / maxStars);
      ctx.rect((CANVAS_WIDTH / 2) - (totalWidth / 2), cy - starSize * 2, clipWidth, starSize * 4);
      ctx.clip();

      currentX = (CANVAS_WIDTH / 2) - (totalWidth / 2) + starSize;
      for (let i = 0; i < maxStars; i++) {
        ctx.fillStyle = '#fbbf24';
        drawStarPath(ctx, currentX, cy, 5, starSize, starSize / 2.2);
        ctx.fill();
        currentX += (starSize * 2 + spacing);
      }
      ctx.restore();
    }
    
    // Pin icon Location | Cuisine
    ctx.font = `bold 56px ${modernFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`📍 ${locName.toUpperCase()}  |  ${cuisineName.toUpperCase()}`, CANVAS_WIDTH / 2, fadeStartY - 40);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};

export interface ProcessCategoryOptions {
  backgroundUrl?: string | null;
  topText?: string;
  categoryText?: string;
  subText?: string;
}

export const processInstagramCategory = async (
  categoryName: string,
  restaurants: any[],
  theme: 'light' | 'dark' | 'gold' = 'light',
  options?: ProcessCategoryOptions
): Promise<string> => {
  const canvas = document.createElement('canvas');
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  const modernFont = '"Inter", "Outfit", "Segoe UI", sans-serif';
  const top3 = restaurants.slice(0, 3);
  if (top3.length === 0) return canvas.toDataURL('image/jpeg', 0.9);

  // Background
  try {
    if (options?.backgroundUrl) {
      const bgImg = await loadImage(options.backgroundUrl);
      const imgRatio = bgImg.width / bgImg.height;
      const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
      let drawW, drawH, drawX, drawY;
      
      if (imgRatio > canvasRatio) {
        drawH = CANVAS_HEIGHT;
        drawW = CANVAS_HEIGHT * imgRatio;
        drawX = (CANVAS_WIDTH - drawW) / 2;
        drawY = 0;
      } else {
        drawW = CANVAS_WIDTH;
        drawH = CANVAS_WIDTH / imgRatio;
        drawX = 0;
        drawY = (CANVAS_HEIGHT - drawH) / 2;
      }
      ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
    } else {
      const bgImgUrl = `/${theme}.png`;
      const bgImg = await loadImage(bgImgUrl);
      ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  } catch (e) {
    console.error("Failed to load background image, falling back to solid color", e);
    if (theme === 'light') {
      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#020617');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  const headerYOffset = 150;

  const topText = options?.topText || "TOP 3";
  const catText = options?.categoryText ? options.categoryText.toUpperCase() : categoryName.toUpperCase();
  const subText = options?.subText !== undefined ? options.subText : "in South Mumbai";

  if (theme === 'light' || theme === 'dark') {
    ctx.font = `900 140px ${modernFont}`;
    ctx.fillStyle = theme === 'light' ? '#111827' : '#ffffff';
    ctx.fillText(topText, CANVAS_WIDTH / 2, headerYOffset);

    ctx.font = `900 48px ${modernFont}`;
    ctx.fillStyle = '#22c55e';
    ctx.fillText(catText, CANVAS_WIDTH / 2, headerYOffset + 150);

    if (subText) {
      ctx.font = `italic bold 32px Georgia, serif`;
      ctx.fillStyle = '#22c55e';
      const subTextWidth = ctx.measureText(subText).width + 60;
      drawRoundedRect(ctx, CANVAS_WIDTH / 2 - subTextWidth / 2, headerYOffset + 210, subTextWidth, 50, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(subText, CANVAS_WIDTH / 2, headerYOffset + 218);
    }
  } else {
    ctx.font = `900 120px ${modernFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(topText, CANVAS_WIDTH / 2, headerYOffset);

    ctx.font = `900 40px ${modernFont}`;
    ctx.fillStyle = '#22c55e';
    ctx.fillText(catText, CANVAS_WIDTH / 2, headerYOffset + 120);
    
    if (subText) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `italic bold 28px Georgia, serif`;
      ctx.fillText(subText, CANVAS_WIDTH / 2, headerYOffset + 170);
    }
  }

  const drawCardImage = async (imgUrl: string, ix: number, iy: number, iw: number, ih: number, radius: number) => {
    try {
      const img = await loadImage(imgUrl);
      ctx.save();
      drawRoundedRect(ctx, ix, iy, iw, ih, radius);
      ctx.clip();
      
      const imgRatio = img.width / img.height;
      const boxRatio = iw / ih;
      let drawW, drawH, drawX, drawY;
      
      if (imgRatio > boxRatio) {
        drawH = ih;
        drawW = ih * imgRatio;
        drawX = ix - (drawW - iw) / 2;
        drawY = iy;
      } else {
        drawW = iw;
        drawH = iw / imgRatio;
        drawX = ix;
        drawY = iy - (drawH - ih) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      drawRoundedRect(ctx, ix + 2, iy + 2, iw - 4, ih - 4, radius);
      ctx.stroke();
      
      ctx.restore();
    } catch (e) {
      console.error(e);
    }
  };

  const drawTextFit = (text: string, x: number, y: number, maxWidth: number, initialFontSize: number, align: CanvasTextAlign = 'left') => {
    let fontSize = initialFontSize;
    ctx.font = `900 ${fontSize}px ${modernFont}`;
    while (ctx.measureText(text).width > maxWidth && fontSize > 20) {
      fontSize -= 2;
      ctx.font = `900 ${fontSize}px ${modernFont}`;
    }
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  const startY = headerYOffset + 290;
  const availableHeight = CANVAS_HEIGHT - 60 - startY;

  if (theme === 'light' || theme === 'dark') {
    let cardY = startY;
    const cardWidth = 960;
    const cardX = 60;
    
    let cardHeight = 240;
    let cardGap = 40;
    if (top3.length === 1) {
      cardHeight = availableHeight;
    } else if (top3.length === 2) {
      cardGap = 60;
      cardHeight = (availableHeight - cardGap) / 2;
    } else {
      cardGap = 40;
      cardHeight = (availableHeight - 2 * cardGap) / 3;
    }

    for (let i = 0; i < top3.length; i++) {
      const r = top3[i];
      const imgUrl = r.imageStorageUrl || (r.photos && r.photos.length > 0 ? r.photos[0].url : null);
      
      ctx.fillStyle = theme === 'light' ? '#ffffff' : '#111827';
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 24);
      ctx.fill();

      if (theme === 'dark') {
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const imgWidth = 520;
      const textX = cardX + imgWidth + 50;
      if (imgUrl) {
        await drawCardImage(imgUrl, cardX + 20, cardY + 20, imgWidth, cardHeight - 40, 16);
      }

      const ribbonColor = i === 0 ? '#ca8a04' : '#15803d';
      ctx.fillStyle = ribbonColor;
      
      const ribbonX = cardX + 30;
      ctx.beginPath();
      ctx.moveTo(ribbonX, cardY - 10);
      ctx.lineTo(ribbonX + 60, cardY - 10);
      ctx.lineTo(ribbonX + 60, cardY + 90);
      ctx.lineTo(ribbonX + 30, cardY + 70);
      ctx.lineTo(ribbonX, cardY + 90);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ribbonX + 4, cardY - 6);
      ctx.lineTo(ribbonX + 56, cardY - 6);
      ctx.lineTo(ribbonX + 56, cardY + 84);
      ctx.lineTo(ribbonX + 30, cardY + 66);
      ctx.lineTo(ribbonX + 4, cardY + 84);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 36px ${modernFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`0${i + 1}`, ribbonX + 30, cardY + 45);

      ctx.textBaseline = 'middle';
      const textCenterY = cardY + (cardHeight / 2);
      const textGap = 50;
      
      ctx.fillStyle = theme === 'light' ? '#111827' : '#ffffff';
      drawTextFit(r.name.toUpperCase(), textX, textCenterY - textGap, cardWidth - imgWidth - 70, 44);

      ctx.fillStyle = '#fbbf24';
      ctx.font = `900 30px ${modernFont}`;
      const ratingStr = r.rating ? r.rating.toFixed(1) : '4.5';
      ctx.fillText(`⭐ ${ratingStr}/5`, textX, textCenterY);

      ctx.fillStyle = theme === 'light' ? '#4b5563' : '#9ca3af';
      ctx.font = `bold 24px ${modernFont}`;
      const loc = r.locationName || 'Mumbai';
      const cuisine = r.cuisine || 'Restaurant';
      ctx.fillText(`📍 ${loc}  |  🍃 ${cuisine}`, textX, textCenterY + textGap);

      cardY += cardHeight + cardGap;
    }
  } else if (theme === 'gold') {
    const cardX = 40;
    const fullWidth = 1000;
    
    let c1Height = availableHeight;
    let c2Height = 0;
    if (top3.length === 2) {
      c1Height = (availableHeight - 40) / 2;
      c2Height = c1Height;
    } else if (top3.length === 3) {
      c1Height = 500;
      c2Height = availableHeight - 500 - 40;
    }

    const drawGoldCardFull = async (r: any, rank: number, cy: number, ch: number) => {
      const imgUrl = r.imageStorageUrl || (r.photos && r.photos.length > 0 ? r.photos[0].url : null);
      
      ctx.fillStyle = '#111827';
      drawRoundedRect(ctx, cardX, cy, fullWidth, ch, 24);
      ctx.fill();

      const rColor = rank === 1 ? '#ca8a04' : (rank === 2 ? '#9ca3af' : '#b45309');
      ctx.strokeStyle = rColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      const imgH = ch - 140;
      if (imgUrl) {
        await drawCardImage(imgUrl, cardX + 3, cy + 3, fullWidth - 6, imgH, 20);
        ctx.fillStyle = '#111827';
        ctx.fillRect(cardX + 3, cy + imgH, fullWidth - 6, 137);
      }

      ctx.fillStyle = rColor;
      const rx = cardX + 40;
      const ry = cy - 20;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 80, ry);
      ctx.lineTo(rx + 80, ry + 130);
      ctx.lineTo(rx + 40, ry + 90);
      ctx.lineTo(rx, ry + 130);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + 4, ry + 4);
      ctx.lineTo(rx + 76, ry + 4);
      ctx.lineTo(rx + 76, ry + 122);
      ctx.lineTo(rx + 40, ry + 86);
      ctx.lineTo(rx + 4, ry + 122);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 56px ${modernFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rank.toString(), rx + 40, ry + 60);

      const textY = cy + imgH + 70;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'bottom';
      drawTextFit(r.name.toUpperCase(), cardX + 40, textY - 10, 700, 56);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 48px ${modernFont}`;
      const ratingStr = r.rating ? r.rating.toFixed(1) : '4.8';
      ctx.fillText(ratingStr + "/5", cardX + fullWidth - 10, textY - 10);
      
      ctx.fillStyle = '#fbbf24';
      ctx.fillText("⭐ ", cardX + fullWidth - 10 - ctx.measureText(ratingStr + "/5").width, textY - 10);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#9ca3af';
      ctx.textBaseline = 'top';
      ctx.font = `bold 28px ${modernFont}`;
      ctx.fillText(`📍 ${r.locationName || 'Mumbai'}  |  🍃 ${r.cuisine || 'Restaurant'}`, cardX + 40, textY + 10);
    };

    const drawGoldCardSmall = async (r: any, ix: number, iy: number, iw: number, ih: number, rank: number) => {
      if (!r) return;
      const imgUrl = r.imageStorageUrl || (r.photos && r.photos.length > 0 ? r.photos[0].url : null);
      
      ctx.fillStyle = '#111827';
      drawRoundedRect(ctx, ix, iy, iw, ih, 20);
      ctx.fill();
      
      const borderColor = rank === 2 ? '#9ca3af' : '#b45309';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      const imgH = ih - 120;
      if (imgUrl) {
        await drawCardImage(imgUrl, ix+3, iy+3, iw-6, imgH, 16);
        ctx.fillStyle = '#111827';
        ctx.fillRect(ix+3, iy+imgH, iw-6, 117);
      }

      ctx.fillStyle = borderColor;
      const srx = ix + 30;
      const sry = iy - 10;
      ctx.beginPath();
      ctx.moveTo(srx, sry);
      ctx.lineTo(srx + 60, sry);
      ctx.lineTo(srx + 60, sry + 100);
      ctx.lineTo(srx + 30, sry + 80);
      ctx.lineTo(srx, sry + 100);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(srx + 4, sry + 4);
      ctx.lineTo(srx + 56, sry + 4);
      ctx.lineTo(srx + 56, sry + 92);
      ctx.lineTo(srx + 30, sry + 74);
      ctx.lineTo(srx + 4, sry + 92);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 42px ${modernFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rank.toString(), srx + 30, sry + 50);

      const textY = iy + imgH + 60;
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'bottom';
      drawTextFit(r.name.toUpperCase(), ix+30, textY - 10, iw - 150, 36);

      const ratingStr = r.rating ? r.rating.toFixed(1) : '4.5';
      ctx.textAlign = 'right';
      ctx.font = `900 32px ${modernFont}`;
      ctx.fillText(ratingStr + "/5", ix+iw-30, textY - 10);
      
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9ca3af';
      ctx.textBaseline = 'top';
      ctx.font = `bold 22px ${modernFont}`;
      ctx.fillText(`📍 ${r.locationName || 'Mumbai'}`, ix+30, textY + 10);
    };

    if (top3.length === 1) {
      await drawGoldCardFull(top3[0], 1, startY, c1Height);
    } else if (top3.length === 2) {
      await drawGoldCardFull(top3[0], 1, startY, c1Height);
      await drawGoldCardFull(top3[1], 2, startY + c1Height + 40, c2Height);
    } else if (top3.length === 3) {
      await drawGoldCardFull(top3[0], 1, startY, c1Height);
      await drawGoldCardSmall(top3[1], 40, startY + c1Height + 40, 480, c2Height, 2);
      await drawGoldCardSmall(top3[2], 560, startY + c1Height + 40, 480, c2Height, 3);
    }
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};


