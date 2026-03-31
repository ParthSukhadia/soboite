export interface Restaurant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  imageUrl?: string;
  type?: string;
  cuisine?: string;
  costForTwo?: number;
  createdAt?: number;
}

export interface Dish {
  id: string;
  restaurantId: string;
  name: string;
  rating: number; // 1-5
  priceLevel: 1 | 2 | 3 | 4;
  review?: string;
  imageUrl?: string;
  cuisine?: string;
  flavorTags?: string[];
}
