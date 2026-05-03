import { Restaurant, Dish } from '../types';

export const FALLBACK_RESTAURANTS: Restaurant[] = [
      {
            id: '56f9f13c-79af-4c45-bd27-74341c20292f',
            name: 'Anand Ashram',
            lat: 18.9485607726045,
            lng: 72.825531384442,
            locationName: 'Mumbai',
            address: 'South Mumbai',
            costForTwo: 400,
            imageUrl: 'https://picsum.photos/400/300?random=1',
            type: 'Cafe',
            cuisine: 'Indian',
            notes: 'Cafe'
      },
      {
            id: 'f1279547-0356-4fd0-b205-6ac544315e6a',
            name: 'Swagat',
            lat: 18.9492488586107,
            lng: 72.8251072601415,
            locationName: 'Mumbai',
            address: 'South Mumbai',
            costForTwo: 600,
            imageUrl: 'https://picsum.photos/400/300?random=2',
            type: 'Family',
            cuisine: 'Indian'
      },
      {
            id: 'dbc03b26-6609-46de-be21-d15ac2bb2ca1',
            name: 'Santosham',
            lat: 18.943482,
            lng: 72.8248432,
            locationName: 'Mumbai',
            address: 'South Mumbai',
            costForTwo: 500,
            imageUrl: 'https://picsum.photos/400/300?random=3',
            type: 'Casual',
            cuisine: 'South Indian'
      },
      {
            id: '99999999-9999-9999-9999-999999999999',
            name: 'Sunlight Restaurant',
            lat: 18.9216,
            lng: 72.8326,
            locationName: 'Mumbai',
            address: 'South Mumbai',
            costForTwo: 350,
            imageUrl: 'https://picsum.photos/400/300?random=4',
            type: 'Casual',
            cuisine: 'South Indian',
            notes: 'Old-school South Indian spot for dosas and filter coffee.'
      },
      {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Leopold Cafe',
            lat: 18.9221,
            lng: 72.831,
            locationName: 'Colaba',
            address: 'Colaba Causeway',
            costForTwo: 800,
            imageUrl: 'https://picsum.photos/400/300?random=5',
            type: 'Cafe',
            cuisine: 'Continental',
            notes: 'Iconic cafe-bar with continental comfort food.'
      },
      {
            id: '44508082-62d7-49c0-bef3-42170c9accc6',
            name: 'Devs Momos Hut',
            lat: 18.9638720617637,
            lng: 72.8102048439905,
            locationName: 'Mumbai',
            address: 'Mumbai',
            costForTwo: 300,
            imageUrl: 'https://picsum.photos/400/300?random=6',
            type: 'Casual',
            cuisine: 'Asian'
      }
      ,
      {
            id: 'nearby-1',
            name: 'Nearby Spot 1',
            lat: 18.949060,
            lng: 72.825931,
            locationName: 'South Mumbai',
            address: null,
            costForTwo: 350,
            imageUrl: 'https://picsum.photos/400/300?random=21',
            type: 'Casual',
            cuisine: 'Indian'
      },
      {
            id: 'nearby-2',
            name: 'Nearby Spot 2',
            lat: 18.947960,
            lng: 72.825031,
            locationName: 'South Mumbai',
            address: null,
            costForTwo: 400,
            imageUrl: 'https://picsum.photos/400/300?random=22',
            type: 'Casual',
            cuisine: 'Asian'
      },
      {
            id: 'nearby-3',
            name: 'Nearby Spot 3',
            lat: 18.949260,
            lng: 72.824931,
            locationName: 'South Mumbai',
            address: null,
            costForTwo: 450,
            imageUrl: 'https://picsum.photos/400/300?random=23',
            type: 'Casual',
            cuisine: 'Continental'
      },
      {
            id: 'nearby-4',
            name: 'Nearby Spot 4',
            lat: 18.947760,
            lng: 72.826231,
            locationName: 'South Mumbai',
            address: null,
            costForTwo: 300,
            imageUrl: 'https://picsum.photos/400/300?random=24',
            type: 'Casual',
            cuisine: 'Cafe'
      }
];

export const FALLBACK_DISHES: Dish[] = [
      {
            id: 'dish-1',
            name: 'Masala Dosa',
            restaurantId: '56f9f13c-79af-4c45-bd27-74341c20292f',
            rating: 5,
            priceLevel: 2,
            actualPrice: '120',
            review: 'Crispy and tasty',
            imageUrl: 'https://picsum.photos/400/300?random=11'
      },
      {
            id: 'dish-2',
            name: 'Paneer Butter Masala',
            restaurantId: 'f1279547-0356-4fd0-b205-6ac544315e6a',
            rating: 3,
            priceLevel: 2,
            actualPrice: '220',
            review: 'Rich gravy',
            imageUrl: 'https://picsum.photos/400/300?random=12'
      },
      {
            id: 'dish-3',
            name: 'Chicken Burger',
            restaurantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            rating: 4,
            priceLevel: 2,
            actualPrice: '350',
            review: 'Good portion',
            imageUrl: 'https://picsum.photos/400/300?random=13'
      },
      {
            id: 'dish-4',
            name: 'Idli & Sambar',
            restaurantId: 'dbc03b26-6609-46de-be21-d15ac2bb2ca1',
            rating: 4,
            priceLevel: 1,
            actualPrice: '60',
            review: 'Soft idlis, great sambar',
            imageUrl: 'https://picsum.photos/400/300?random=14'
      },
      {
            id: 'dish-5',
            name: 'Filter Coffee',
            restaurantId: '99999999-9999-9999-9999-999999999999',
            rating: 5,
            priceLevel: 1,
            actualPrice: '30',
            review: 'Authentic south Indian filter coffee',
            imageUrl: 'https://picsum.photos/400/300?random=15'
      },
      {
            id: 'dish-6',
            name: 'Momos',
            restaurantId: '44508082-62d7-49c0-bef3-42170c9accc6',
            rating: 4,
            priceLevel: 2,
            actualPrice: '150',
            review: 'Steamed perfection',
            imageUrl: 'https://picsum.photos/400/300?random=16'
      }
];
