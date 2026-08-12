import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Series, staticFile, useVideoConfig, interpolate, useCurrentFrame } from 'remotion';
import { RestaurantReelProps } from './types';
import { HookScene } from './scenes/HookScene';
import { DishScene } from './scenes/DishScene';
import { VerdictScene } from './scenes/VerdictScene';
import { OutroScene } from './scenes/OutroScene';

export const PriceValueReel: React.FC<RestaurantReelProps> = ({
  restaurantName,
  restaurantImage,
  dishes,
  logoUrl,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Data processing
  const pricedDishes = useMemo(() => {
    return [...(dishes || [])]
      .filter(d => typeof d.price === 'number' && d.price > 0)
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
  }, [dishes]);

  const totalPrice = pricedDishes.reduce((sum, d) => sum + (d.price || 0), 0);
  const roundedPrice = Math.ceil(totalPrice / 100) * 100;
  
  const hookText = pricedDishes.length > 1
    ? `What ₹${roundedPrice || 1000} gets you at ${restaurantName}`
    : (pricedDishes.length === 1 ? `Is ${pricedDishes[0].name} worth ₹${pricedDishes[0].price}?` : `Is ${restaurantName} worth it?`);

  // Audio interpolation for fade in/out
  const audioVolume = interpolate(
    frame,
    [0, 30, durationInFrames - 30, durationInFrames],
    [0, 0.4, 0.4, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f11' }}>
      {musicFile && <Audio src={staticFile(musicFile)} volume={audioVolume} />}
      
      <Series>
        {/* Scene 1: Hook */}
        <Series.Sequence durationInFrames={90}>
          <HookScene hookText={hookText} image={pricedDishes[0]?.image || restaurantImage} />
        </Series.Sequence>

        {/* Dish Scenes */}
        {pricedDishes.map((dish, index) => (
          <Series.Sequence key={index} durationInFrames={90}>
            <DishScene
              name={dish.name}
              rating={dish.rating}
              price={dish.price}
              image={dish.image || restaurantImage}
              proText={dish.pros?.[0] || dish.review}
            />
          </Series.Sequence>
        ))}

        {/* Verdict */}
        <Series.Sequence durationInFrames={90}>
          <VerdictScene
            verdictTitle="Soboite verdict"
            verdictText={pricedDishes.some(d => d.rating >= 4.5) ? 'WORTH IT' : 'A BIT PRICEY'}
            image={pricedDishes[0]?.image || restaurantImage}
          />
        </Series.Sequence>

        {/* Outro */}
        <Series.Sequence durationInFrames={90}>
          <OutroScene logoUrl={logoUrl} image={restaurantImage} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
