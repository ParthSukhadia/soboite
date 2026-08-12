import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Series, staticFile, useVideoConfig, interpolate, useCurrentFrame } from 'remotion';
import { RestaurantReelProps } from './types';
import { HookScene } from './scenes/HookScene';
import { DishScene } from './scenes/DishScene';
import { OutroScene } from './scenes/OutroScene';

export const TopPicksReel: React.FC<RestaurantReelProps> = ({
  restaurantName,
  cuisine,
  restaurantImage,
  dishes,
  logoUrl,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Data processing
  const topDishes = useMemo(() => {
    return [...(dishes || [])].sort((a, b) => b.rating - a.rating).slice(0, 3);
  }, [dishes]);

  const hookText = cuisine 
    ? `My Top 3 ${cuisine} dishes at ${restaurantName}` 
    : `3 dishes I'd order again at ${restaurantName}`;

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
          <HookScene hookText={hookText} image={topDishes[0]?.image || restaurantImage} />
        </Series.Sequence>

        {/* Dish Scenes */}
        {topDishes.map((dish, index) => (
          <Series.Sequence key={index} durationInFrames={90}>
            <DishScene
              rank={index + 1}
              name={dish.name}
              rating={dish.rating}
              price={dish.price}
              image={dish.image || restaurantImage}
              proText={dish.pros?.[0] || dish.review}
            />
          </Series.Sequence>
        ))}

        {/* Outro */}
        <Series.Sequence durationInFrames={90}>
          <OutroScene logoUrl={logoUrl} image={restaurantImage} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
