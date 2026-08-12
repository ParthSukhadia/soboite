export interface DishData {
  name: string;
  rating: number;
  price: number;
  image: string;
  pros: string[];
  cons: string[];
  review: string;
}

export interface RestaurantReelProps {
  restaurantName: string;
  area: string;
  cuisine: string;
  restaurantRating: number;
  restaurantPrice: string;
  restaurantImage: string;
  
  dishes: DishData[];
  
  restaurantPros: string[];
  restaurantCons: string[];
  restaurantReview: string;
  
  // Custom text overrides for templates
  customHookText?: string;
  customVerdictTitle?: string;
  customVerdictText?: string;
  
  logoUrl?: string;
  musicFile?: string;
}
