import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Series, staticFile, useVideoConfig, interpolate, useCurrentFrame } from 'remotion';
import { RestaurantReelProps } from './types';
import { HookScene } from './scenes/HookScene';
import { RestaurantScene } from './scenes/RestaurantScene';
import { DishScene } from './scenes/DishScene';
import { VerdictScene } from './scenes/VerdictScene';
import { OutroScene } from './scenes/OutroScene';

export const ShouldYouEatHereReel: React.FC<RestaurantReelProps> = ({
  restaurantName,
  area,
  cuisine,
  restaurantRating,
  restaurantImage,
  dishes,
  restaurantPros,
  customHookText,
  customVerdictTitle,
  customVerdictText,
  logoUrl,
  musicFile,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Data processing
  const sortedDishes = useMemo(() => {
    return [...(dishes || [])].sort((a, b) => b.rating - a.rating);
  }, [dishes]);

  const bestDish = sortedDishes[0];
  const secondDish = sortedDishes[1];

  const hookText = useMemo(() => {
    if (customHookText) return customHookText;
    if (sortedDishes.length > 1) return `${sortedDishes.length} dishes I tried at ${restaurantName} 👀`;
    if (bestDish && bestDish.rating >= 4.5) return `This is what I'd order at ${restaurantName} 👀`;
    if (restaurantRating >= 4.5) return `Is ${restaurantName} worth the hype? 👀`;
    return `Honest review of ${restaurantName} 👀`;
  }, [sortedDishes, bestDish, restaurantRating, restaurantName, customHookText]);

  const verdict = useMemo(() => {
    if (customVerdictTitle || customVerdictText) {
      return { title: customVerdictTitle || 'Verdict:', text: customVerdictText || '' };
    }
    if (bestDish) {
      return { title: 'My pick:', text: bestDish.name };
    }
    if (restaurantPros && restaurantPros.length > 0) {
      return { title: 'Standout:', text: restaurantPros[0] };
    }
    return { title: 'Would I go back?', text: restaurantRating >= 4.0 ? 'YES ✅' : 'MAYBE 🤔' };
  }, [bestDish, restaurantPros, restaurantRating, customVerdictTitle, customVerdictText]);

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
          <HookScene hookText={hookText} image={restaurantImage} />
        </Series.Sequence>

        {/* Scene 2: Restaurant Info */}
        <Series.Sequence durationInFrames={90} offset={-45}>
          <RestaurantScene
            restaurantName={restaurantName}
            area={area}
            cuisine={cuisine}
            rating={restaurantRating}
            image={restaurantImage}
          />
        </Series.Sequence>

        {/* Scene 3: Best Dish */}
        {bestDish && (
          <Series.Sequence durationInFrames={90} offset={-45}>
            <DishScene
              rank={1}
              name={bestDish.name}
              rating={bestDish.rating}
              price={bestDish.price}
              image={bestDish.image || restaurantImage}
              proText={bestDish.pros?.[0] || bestDish.review}
            />
          </Series.Sequence>
        )}

        {/* Scene 4: Second Dish (Optional) */}
        {secondDish && (
          <Series.Sequence durationInFrames={90} offset={-45}>
            <DishScene
              rank={2}
              name={secondDish.name}
              rating={secondDish.rating}
              price={secondDish.price}
              image={secondDish.image || restaurantImage}
              proText={secondDish.pros?.[0] || secondDish.review}
            />
          </Series.Sequence>
        )}

        {/* Scene 5: Verdict */}
        <Series.Sequence durationInFrames={90} offset={-45}>
          <VerdictScene
            verdictTitle={verdict.title}
            verdictText={verdict.text}
            image={bestDish?.image || restaurantImage}
          />
        </Series.Sequence>

        {/* Scene 6: Outro */}
        <Series.Sequence durationInFrames={90} offset={-45}>
          <OutroScene logoUrl={logoUrl} image={restaurantImage} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
