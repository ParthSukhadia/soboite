import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Series, staticFile, useVideoConfig, interpolate, useCurrentFrame } from 'remotion';
import { RestaurantReelProps } from './types';
import { HookScene } from './scenes/HookScene';
import { DishScene } from './scenes/DishScene';
import { VerdictScene } from './scenes/VerdictScene';
import { OutroScene } from './scenes/OutroScene';

export const OneDishReel: React.FC<RestaurantReelProps> = ({
  area,
  restaurantImage,
  dishes,
  logoUrl,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Data processing
  const bestDish = useMemo(() => {
    return [...(dishes || [])].sort((a, b) => b.rating - a.rating)[0];
  }, [dishes]);

  const hookText = bestDish?.rating >= 4.5 
    ? `5★ dish in ${area || 'South Mumbai'} 👀` 
    : `This might be the best thing I ate this week 👀`;

  const verdictText = bestDish?.rating >= 4.5 ? 'MUST TRY' : (bestDish?.rating >= 4.0 ? 'GOOD' : 'SKIP');

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
          <HookScene hookText={hookText} image={bestDish?.image || restaurantImage} />
        </Series.Sequence>

        {/* Dish Scene */}
        {bestDish && (
          <Series.Sequence durationInFrames={90}>
            <DishScene
              name={bestDish.name}
              rating={bestDish.rating}
              price={bestDish.price}
              image={bestDish.image || restaurantImage}
              proText={bestDish.pros?.[0] || bestDish.review}
            />
          </Series.Sequence>
        )}

        {/* Verdict */}
        <Series.Sequence durationInFrames={90}>
          <VerdictScene
            verdictTitle="Soboite verdict"
            verdictText={verdictText}
            image={bestDish?.image || restaurantImage}
          />
        </Series.Sequence>

        {/* Outro */}
        <Series.Sequence durationInFrames={90}>
          <OutroScene logoUrl={logoUrl} image={bestDish?.image || restaurantImage} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
