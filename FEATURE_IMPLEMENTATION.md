# Feature: Hide Empty Restaurants from Regular Users

## Overview

Restaurants without dishes remain available in the app's data so a newly created
restaurant cannot disappear during a refresh before its first dish is saved.
Regular users still do not see incomplete restaurants in public views.

## Implementation

The `/api/restaurants` endpoint returns the complete restaurant list regardless
of admin mode. Filtering the API response based on whether it has dishes could
replace the frontend's cached list with a partial list and hide a restaurant
while it is being created.

Public visibility is controlled by the frontend's `isRestaurantVisibleToUser`
helper in `frontend/src/types/index.ts`. It hides restaurants without dishes
from regular users, while admins can see and complete them.

## User Experience

- Regular users see restaurants only after at least one dish has been added.
- Admins can see and manage restaurants before adding the first dish.
- Refreshing the restaurant list does not discard restaurants without dishes.
