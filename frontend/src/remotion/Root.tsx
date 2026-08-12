import { Composition } from 'remotion';
import { RestaurantStory, RestaurantStoryProps } from './RestaurantStory';
import { ShouldYouEatHereReel } from './ShouldYouEatHereReel';
import { WhatShouldYouOrderReel } from './WhatShouldYouOrderReel';
import { OneDishReel } from './OneDishReel';
import { PriceValueReel } from './PriceValueReel';
import { TopPicksReel } from './TopPicksReel';

// This is the default data used when previewing in the Remotion Studio
const defaultProps: RestaurantStoryProps = {
  restaurantName: "The Bombay Canteen",
  area: "Lower Parel",
  cuisine: "Modern Indian",
  rating: 4.8,
  imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1080&auto=format&fit=crop",
  logoUrl: "", // Blank to test default 'S' fallback
};

const defaultReelProps = {
  restaurantName: 'The Bombay Canteen',
  area: 'Lower Parel',
  cuisine: 'Modern Indian',
  restaurantRating: 4.8,
  restaurantPrice: '2000',
  restaurantImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
  dishes: [
    {
      name: 'Keema Pao',
      rating: 4.9,
      price: 650,
      image: 'https://images.unsplash.com/photo-1544025162-8315ea07f440',
      pros: ['Incredible spices', 'Soft bread'],
      cons: [],
      review: 'Must try!'
    }
  ],
  restaurantPros: ['Great ambiance'],
  restaurantCons: [],
  restaurantReview: 'Amazing experience.',
  logoUrl: '/soboite-icon.svg',
  musicFile: 'mixkit-latin-lovers-39.mp3',
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RestaurantStory"
        component={RestaurantStory as any}
        durationInFrames={210} // 7 seconds @ 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
      <Composition
        id="ShouldYouEatHereReel"
        component={ShouldYouEatHereReel as any}
        durationInFrames={540}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps as any}
      />
      <Composition
        id="WhatShouldYouOrderReel"
        component={WhatShouldYouOrderReel as any}
        durationInFrames={540}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps as any}
      />
      <Composition
        id="OneDishReel"
        component={OneDishReel as any}
        durationInFrames={360}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps as any}
      />
      <Composition
        id="PriceValueReel"
        component={PriceValueReel as any}
        durationInFrames={540}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps as any}
      />
      <Composition
        id="TopPicksReel"
        component={TopPicksReel as any}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultReelProps as any}
      />

    </>
  );
};
