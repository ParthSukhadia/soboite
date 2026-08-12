export interface MusicTrack {
  id: string;
  file: string;
  title: string;
  artist: string;
  source: string;
  style: string[];
  mood: string[];
  energy: string;
  tempo_feel: string;
  best_for: string[];
  avoid_for: string[];
  best_content: string[];
  priority: number;
  soboite_default: boolean;
}

export const musicLibrary: MusicTrack[] = [
  {
    id: "latin_lovers",
    file: "mixkit-latin-lovers-39.mp3",
    title: "Latin Lovers",
    artist: "Ahjay Stelino",
    source: "Mixkit",
    style: ["jazz", "bossa_nova", "lounge"],
    mood: ["romantic", "sensual", "relaxed", "sophisticated"],
    energy: "low",
    tempo_feel: "slow_medium",
    best_for: ["cafe", "brunch", "fine_dining", "premium_restaurant", "italian", "dessert", "romantic_restaurant", "aesthetic_restaurant"],
    avoid_for: ["fast_food", "street_food", "very_high_energy_content"],
    best_content: ["restaurant_carousel", "restaurant_reel", "dish_reel", "restaurant_intro", "premium_recommendation"],
    priority: 10,
    soboite_default: true
  },
  {
    id: "beautiful_dream",
    file: "mixkit-beautiful-dream-493.mp3",
    title: "Beautiful Dream",
    artist: "Diego Nava",
    source: "Mixkit",
    style: ["jazz", "acoustic", "soft_jazz"],
    mood: ["calm", "romantic", "relaxing", "warm", "emotional"],
    energy: "low",
    tempo_feel: "slow",
    best_for: ["cafe", "bakery", "dessert", "brunch", "fine_dining", "aesthetic_restaurant", "quiet_restaurant", "beautiful_food_photography"],
    avoid_for: ["fast_food", "street_food", "high_energy_content"],
    best_content: ["dish_carousel", "restaurant_carousel", "slow_reel", "food_closeup", "beautiful_dish"],
    priority: 9,
    soboite_default: true
  },
  {
    id: "chill_bro",
    file: "mixkit-chill-bro-494.mp3",
    title: "Chill Bro",
    artist: "Diego Nava",
    source: "Mixkit",
    style: ["jazz", "jazz_fusion", "lounge"],
    mood: ["relaxed", "cool", "modern", "casual", "sophisticated"],
    energy: "low_medium",
    tempo_feel: "medium",
    best_for: ["casual_restaurant", "cafe", "brunch", "modern_restaurant", "asian", "pan_asian", "continental", "casual_dining"],
    avoid_for: ["fine_dining", "very_traditional_restaurants", "very_high_energy_fast_food"],
    best_content: ["restaurant_reel", "dish_reel", "restaurant_carousel", "casual_food_content"],
    priority: 8,
    soboite_default: false
  },
  {
    id: "upbeat_jazz",
    file: "mixkit-upbeat-jazz-644.mp3",
    title: "Upbeat Jazz",
    artist: "Francisco Alvear",
    source: "Mixkit",
    style: ["jazz", "upbeat_jazz"],
    mood: ["lively", "playful", "positive", "fun", "energetic"],
    energy: "medium_high",
    tempo_feel: "medium_fast",
    best_for: ["street_food", "fast_food", "pizza", "burgers", "casual_food", "food_discovery", "fun_restaurant", "top_recommendation"],
    avoid_for: ["fine_dining", "quiet_cafe", "romantic_restaurant"],
    best_content: ["food_reel", "street_food_reel", "fast_food_reel", "top_3_recommendation", "best_of_soboite"],
    priority: 8,
    soboite_default: false
  },
  {
    id: "light_it_up_boy",
    file: "mixkit-light-it-up-boy-849.mp3",
    title: "Light it Up Boy",
    artist: "Michael Ramir C.",
    source: "Mixkit",
    style: ["funk", "jazz_funk"],
    mood: ["lively", "positive", "fun", "playful", "energetic"],
    energy: "high",
    tempo_feel: "fast",
    best_for: ["street_food", "fast_food", "burgers", "pizza", "sandwiches", "quick_bites", "food_stalls", "fun_food_content"],
    avoid_for: ["fine_dining", "quiet_cafe", "romantic_restaurant", "slow_food_photography"],
    best_content: ["fast_food_reel", "street_food_reel", "energetic_food_reel", "fun_restaurant_reel"],
    priority: 7,
    soboite_default: false
  },
  {
    id: "driving_ambition",
    file: "mixkit-driving-ambition-32.mp3",
    title: "Driving Ambition",
    artist: "Ahjay Stelino",
    source: "Mixkit",
    style: ["film_score", "cinematic", "uplifting"],
    mood: ["uplifting", "hopeful", "motivational", "triumphant"],
    energy: "medium_high",
    tempo_feel: "medium",
    best_for: ["best_restaurant", "best_dish", "top_3", "best_of_soboite", "special_recommendation", "milestone_content", "soboite_brand_content"],
    avoid_for: ["normal_restaurant_post", "cafe", "quiet_food_content", "soft_dish_photography"],
    best_content: ["best_restaurant_reel", "best_dish_reel", "top_3_reel", "soboite_intro", "soboite_outro", "special_announcement"],
    priority: 6,
    soboite_default: false
  }
];

const selectionRules: Record<string, string> = {
  "default": "latin_lovers",
  "cafe": "beautiful_dream",
  "fine_dining": "latin_lovers",
  "normal_restaurant": "chill_bro",
  "street_food": "upbeat_jazz",
  "fast_food": "light_it_up_boy",
  "pizza": "upbeat_jazz",
  "burger": "light_it_up_boy",
  "dessert": "beautiful_dream",
  "brunch": "latin_lovers",
  "italian": "latin_lovers",
  "asian": "chill_bro",
  "pan_asian": "chill_bro",
  "top_recommendation": "driving_ambition",
  "best_of_soboite": "driving_ambition"
};

/**
 * Given a cuisine string (e.g. "Asian", "Cafe", "Italian"), returns the best music file name.
 */
export function getRecommendedMusic(restaurantType?: string, cuisine?: string, isTopPicks?: boolean): string {
  if (isTopPicks) return musicLibrary.find(t => t.id === 'driving_ambition')?.file || musicLibrary[0].file;

  const t = (restaurantType || '').toLowerCase();
  const c = (cuisine || '').toLowerCase();

  let trackId = selectionRules["default"];

  // Prioritize Restaurant Type
  if (t.includes('fine dining') || t.includes('premium')) trackId = 'latin_lovers';
  else if (t.includes('cafe') || t.includes('bakery') || t.includes('brunch')) trackId = 'beautiful_dream';
  else if (t.includes('dessert')) trackId = 'beautiful_dream';
  else if (t.includes('street food')) trackId = 'upbeat_jazz';
  else if (t.includes('fast food') || t.includes('qsr')) trackId = 'light_it_up_boy';
  else if (t.includes('casual')) trackId = 'chill_bro';
  else if (t.includes('pub') || t.includes('bar')) trackId = 'upbeat_jazz';
  // Fallback to Cuisine
  else if (c.includes('pizza') || c.includes('burger')) trackId = 'upbeat_jazz';
  else if (c.includes('asian') || c.includes('chinese') || c.includes('japanese') || c.includes('thai')) trackId = 'chill_bro';
  else if (c.includes('dessert')) trackId = 'beautiful_dream';
  else if (c.includes('italian')) trackId = 'latin_lovers';

  const track = musicLibrary.find(t => t.id === trackId);
  return track ? track.file : musicLibrary[0].file;
}
