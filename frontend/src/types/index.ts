export interface PhotoEntry {
  id: string;
  url: string;
  uploadedAt: string;
  type?: 'image' | 'video';
}

export interface DishGeminiAnalysis {
  id?: string;
  pros: string[];
  cons: string[];
  summary: string;
  caption?: string;
  hashtags?: string[];
  verdict?: string;
  rank?: 1 | 2 | 3 | null;
}

export interface Restaurant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  locationName?: string;
  address?: string;
  vegOnly?: boolean;
  notes?: string;
  imageStorageUrl?: string;
  photos?: PhotoEntry[];
  primaryPhotoId?: string;
  type?: string;
  cuisine?: string;
  costForTwo?: number;
  ambienceRating?: number;
  serviceRating?: number;
  createdAt?: number;
  likeCount?: number;
  instaPublished?: boolean;
  instaPublishedAt?: string;
  instaEditedPhotoUrl?: string;
}

export interface DishReview {
  id: string;
  text: string;
  date: string;
  createdAt: number;
}

export interface Dish {
  id: string;
  restaurantId: string;
  name: string;
  rating: number; // 1-5
  priceLevel: 1 | 2 | 3;
  actualPrice?: number;
  review?: string;
  reviewDate?: string;
  reviews?: DishReview[];
  imageStorageUrl?: string;
  photos?: PhotoEntry[];
  primaryPhotoId?: string;
  isRecommended?: boolean;
  cuisine?: string;
  flavorTags?: string[];
  serves?: string;
  likeCount?: number;
  instaPublished?: boolean;
  instaPublishedAt?: string;
  instaEditedPhotoUrl?: string;
}

export interface TopPickCategory {
  id: string;
  name: string;
  created_at?: string;
}

export interface TopPickRestaurant {
  id: string;
  category_id: string;
  restaurant_id: string;
  position: number;
}

export interface AppEvent {
  id: string;
  type: string;
  message: string;
  link_url?: string;
  created_at: string;
  user_id?: string;
}
