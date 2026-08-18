# Feature: Hide Empty Restaurants from Regular Users

## Overview
Restaurants with no dishes are now hidden from regular users but remain visible to admin users. This ensures that incomplete restaurant entries don't clutter the user experience.

## Implementation Details

### Backend Changes
**File**: `backend/src/index.ts`

Modified the `/api/restaurants` GET endpoint to:
1. Check for the `x-admin-access: true` header
2. If admin: Return all restaurants (unfiltered)
3. If not admin: 
   - Fetch all dishes from the database
   - Extract restaurant IDs that have at least one dish
   - Filter the restaurants list to only include those with dishes

**Code Logic**:
```typescript
app.get('/api/restaurants', async (c) => {
  const isAdmin = c.req.header('x-admin-access') === 'true';
  
  // Fetch restaurants
  const { data, error } = await querySupabaseOrProxy(c, (supabase) =>
    supabase.from('restaurants_with_likes').select(...)
  );
  
  // If not admin, filter restaurants without dishes
  if (!isAdmin && data) {
    const { data: allDishes } = await querySupabaseOrProxy(c, (supabase) =>
      supabase.from('dishes').select('restaurant_id')
    );
    
    const restaurantIdsWithDishes = new Set(
      allDishes.map((d) => d.restaurant_id)
    );
    
    return c.json(data.filter((r) => restaurantIdsWithDishes.has(r.id)));
  }
  
  return c.json(data);
});
```

### Frontend Changes
**No changes required** - The frontend already has the authentication system in place:

- **File**: `frontend/src/api.ts`
- The `getHeaders()` function automatically includes `X-Admin-Access: true` when `editMode` is true
- All GET requests use this header, so admins automatically see all restaurants
- Regular users make requests without the header, so they only see restaurants with dishes

### Database
**No schema changes required** - The implementation uses existing tables:
- `restaurants` table (unchanged)
- `dishes` table (unchanged)
- `restaurants_with_likes` view (unchanged)

## User Experience

### Regular Users
- See only restaurants that have at least one dish
- Cannot access incomplete restaurant entries
- Cleaner, more curated experience

### Admin Users
- Continue to see all restaurants in the dashboard
- Can add dishes to empty restaurants
- Can manage and edit restaurants with no dishes
- Full visibility for content management

## Testing Checklist

- [ ] Create a new restaurant without adding any dishes
- [ ] Logout/switch to regular user account
- [ ] Verify the empty restaurant does NOT appear in the restaurant list
- [ ] Login as admin
- [ ] Verify the empty restaurant APPEARS in the admin dashboard
- [ ] Add a dish to the empty restaurant
- [ ] Logout/switch to regular user account
- [ ] Verify the restaurant NOW appears in the restaurant list
- [ ] Test on MapPage, RecommendedDishesPage, and other restaurant list views

## Performance Considerations

The implementation makes an additional database query for the dish list when fetching restaurants for non-admin users. For optimization, consider:
1. Creating a database view that includes dish count per restaurant
2. Caching the dish list on the backend
3. Adding a `dish_count` column to restaurants table

Example optimized query:
```sql
CREATE OR REPLACE VIEW restaurants_with_dishes_count AS
SELECT r.*,
       (SELECT COUNT(*) FROM dishes d WHERE d.restaurant_id = r.id) AS dish_count
FROM restaurants r;
```

Then filter: `WHERE dish_count > 0` in the query instead of post-processing.

## Related Files
- Backend: `/backend/src/index.ts` - Lines 120-155
- Frontend: `/frontend/src/api.ts` - Uses existing `getHeaders()` function
- Database: No changes (uses existing schema)
