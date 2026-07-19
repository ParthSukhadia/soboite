import sys

file_path = 'src/lib/instagramProcessing.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_index = content.find('export const processInstagramCategory = async (')
if start_index == -1:
    sys.exit('Function not found')

new_func = """export const processInstagramCategory = async (
  categoryName: string,
  restaurants: any[],
  theme: 'light' | 'dark' | 'gold' = 'light'
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
    const bgImgUrl = `/${theme}.png`;
    const bgImg = await loadImage(bgImgUrl);
    ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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

  if (theme === 'light' || theme === 'dark') {
    ctx.font = `900 140px ${modernFont}`;
    ctx.fillStyle = theme === 'light' ? '#111827' : '#ffffff';
    ctx.fillText("TOP 3", CANVAS_WIDTH / 2, headerYOffset);

    ctx.font = `900 48px ${modernFont}`;
    ctx.fillStyle = '#22c55e';
    ctx.fillText(categoryName.toUpperCase(), CANVAS_WIDTH / 2, headerYOffset + 150);

    ctx.fillStyle = '#22c55e';
    drawRoundedRect(ctx, CANVAS_WIDTH / 2 - 180, headerYOffset + 210, 360, 50, 10);
    ctx.fill();
    ctx.font = `italic bold 32px Georgia, serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText("in South Mumbai", CANVAS_WIDTH / 2, headerYOffset + 218);
  } else {
    ctx.font = `900 120px ${modernFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText("TOP 3", CANVAS_WIDTH / 2, headerYOffset);

    ctx.font = `900 40px ${modernFont}`;
    ctx.fillStyle = '#22c55e';
    ctx.fillText(categoryName.toUpperCase(), CANVAS_WIDTH / 2, headerYOffset + 120);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `italic bold 28px Georgia, serif`;
    ctx.fillText("in South Mumbai", CANVAS_WIDTH / 2, headerYOffset + 170);
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
"""

new_content = content[:start_index] + new_func
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
