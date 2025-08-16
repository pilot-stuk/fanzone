# 🗄️ FanZone Database Documentation

## Overview

This directory contains the complete database implementation for the FanZone Telegram Mini App MVP. The database is built on Supabase (PostgreSQL) with real-time capabilities, optimized for performance and scalability.

## 📁 Files Structure

```
database/
├── setup.sql              # Complete database schema and setup
├── test-operations.js     # Comprehensive testing suite
├── realtime-config.js     # Real-time subscriptions manager
└── README.md             # This documentation
```

## 🚀 Quick Setup

### 1. Initialize Database

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Run the complete `setup.sql` script
4. Verify all tables and functions are created

### 2. Test Implementation

```javascript
// In browser console (with app loaded)
await window.runDatabaseTests();
```

### 3. Enable Real-time

Real-time subscriptions are automatically initialized when the app loads. No additional setup required.

## 📊 Database Schema

### Core Tables

#### `users`
- **Purpose**: Store user profiles and points
- **Key Fields**: `telegram_id`, `username`, `points`, `total_gifts`
- **Indexes**: Optimized for leaderboard queries

#### `gifts`
- **Purpose**: Available digital gifts catalog
- **Key Fields**: `name`, `price_points`, `max_supply`, `current_supply`
- **Indexes**: Optimized for browsing and filtering

#### `user_gifts`
- **Purpose**: Track gift ownership
- **Key Fields**: `user_id`, `gift_id`, `obtained_at`
- **Constraints**: Prevents duplicate ownership

### Views

#### `leaderboard_view`
- **Purpose**: Real-time leaderboard with rankings
- **Features**: Points ranking, dense ranking, performance optimized
- **Usage**: Direct SELECT for leaderboard display

## 🔧 Database Functions

### `purchase_gift(p_user_telegram_id, p_gift_id)`

Atomic gift purchase transaction with comprehensive validation:

```sql
SELECT purchase_gift(123456789, 'gift-uuid-here');
```

**Returns**: JSON with success/error details

**Validations**:
- ✅ User exists and has sufficient points
- ✅ Gift is active and in stock
- ✅ User doesn't already own the gift
- ✅ Atomic transaction (all-or-nothing)

### `get_user_leaderboard_position(p_telegram_id)`

Get user's current leaderboard position:

```sql
SELECT get_user_leaderboard_position(123456789);
```

**Returns**: JSON with rank, points, and stats

## 🔄 Real-time Features

### Subscription Types

1. **Leaderboard Updates**: Live ranking changes
2. **Gift Inventory**: Stock level updates
3. **User Points**: Personal points changes
4. **Gift Acquisitions**: New purchases

### Usage Example

```javascript
// Subscribe to leaderboard changes
window.FanZoneRealtime.getManager().subscribeToLeaderboard((data) => {
    console.log('Leaderboard updated:', data);
    // Update UI automatically
});
```

## 🔒 Security (Row Level Security)

### Policies Applied

- **Users**: Can view all, update own profile
- **Gifts**: Public read for active gifts
- **User Gifts**: Can view all, insert own purchases

### MVP Security Notes

- RLS policies are permissive for testing
- Production deployment should tighten policies
- Telegram authentication provides user validation

## ⚡ Performance Optimizations

### Indexes Created

```sql
-- Users table
idx_users_telegram_id     -- Primary lookups
idx_users_points_desc     -- Leaderboard queries
idx_users_total_gifts_desc -- Alternative ranking

-- Gifts table  
idx_gifts_active_category  -- Browsing and filtering
idx_gifts_price_points     -- Price range queries
idx_gifts_supply          -- Stock checking

-- User gifts table
idx_user_gifts_user_id    -- User collection queries
idx_user_gifts_gift_id    -- Gift popularity queries
```

### Query Performance Targets

- **Leaderboard**: < 100ms for top 50 users
- **Gift browsing**: < 50ms for filtered results
- **Purchase transaction**: < 200ms end-to-end
- **Real-time updates**: < 500ms propagation

## 🧪 Testing Suite

### Automated Tests

Run comprehensive database tests:

```javascript
// Full test suite
await window.runDatabaseTests();

// Individual test categories
await tester.testUserOperations();
await tester.testGiftOperations();
await tester.testPurchaseFunction();
await tester.testLeaderboardOperations();
await tester.testRealTimeSubscriptions();
await tester.testPerformance();
```

### Test Coverage

- ✅ CRUD operations for all tables
- ✅ Database function correctness
- ✅ Real-time subscription functionality
- ✅ Performance benchmarks
- ✅ Data integrity constraints
- ✅ Error handling scenarios

## 📈 Sample Data

The setup script includes 10 sample gifts:

- Various categories (match, trophy, player, special)
- Different rarities (common, rare, epic, legendary)
- Price range: 25-200 points
- Supply variations: 15-1000 items

## 🔍 Monitoring & Debugging

### Debug Mode Features

- Real-time event logging
- Performance timing
- Subscription status tracking
- Query execution details

### Health Checks

```javascript
// Check database connectivity
const status = await window.FanZoneRealtime.getManager().getSubscriptionStatus();
console.log('Real-time status:', status);
```

## 🚀 Production Considerations

### Before Launch

1. **Review RLS Policies**: Tighten security for production
2. **Monitor Performance**: Set up query monitoring
3. **Backup Strategy**: Configure automated backups
4. **Scaling**: Consider connection pooling
5. **Analytics**: Add query performance tracking

### Supabase Limits (Free Tier)

- **Database Size**: 500MB
- **Bandwidth**: 5GB/month
- **Real-time Connections**: 200 concurrent
- **Auth Users**: 50,000

### Scaling Recommendations

- Monitor active connections
- Implement connection pooling for high traffic
- Consider read replicas for global deployment
- Optimize queries based on usage patterns

## 🆘 Troubleshooting

### Common Issues

1. **Real-time not working**
   - Check Supabase RLS policies
   - Verify WebSocket connectivity
   - Ensure proper subscription setup

2. **Performance issues**
   - Check query execution plans
   - Verify indexes are being used
   - Monitor connection pool usage

3. **Function errors**
   - Check function permissions
   - Verify parameter types
   - Review transaction isolation

### Debug Commands

```javascript
// Check real-time status
window.FanZoneRealtime.getManager().debug();

// Test database connection
await window.runDatabaseTests();

// Monitor subscriptions
console.log(window.FanZoneRealtime.getManager().getActiveSubscriptions());
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Last Updated**: August 16, 2025  
**Version**: 1.0.0-mvp  
**Author**: FanZone Development Team