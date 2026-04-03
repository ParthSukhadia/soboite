export interface PhotoEntry {
  id: string;
  url: string;
  uploadedAt: string;
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
  imageUrl?: string;
  photos?: PhotoEntry[];
  primaryPhotoId?: string;
  type?: string;
  cuisine?: string;
  costForTwo?: number;
  ambienceRating?: number;
  serviceRating?: number;
  createdAt?: number;
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
  imageUrl?: string;
  photos?: PhotoEntry[];
  primaryPhotoId?: string;
  isRecommended?: boolean;
  cuisine?: string;
  flavorTags?: string[];
}
