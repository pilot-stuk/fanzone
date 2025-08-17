// Gift Service following Single Responsibility and Open/Closed Principles
// Handles all gift-related business logic

class GiftService extends window.Interfaces.IGiftService {
    constructor(repository, userService, logger) {
        super();
        this.repository = repository;
        this.userService = userService;
        this.logger = logger;
        this.giftsCache = null;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCacheTime = 0;
    }
    
    /**
     * Get available gifts with optional filters
     */
    async getAvailableGifts(filters = {}) {
        try {
            // Check cache first
            if (this.isCacheValid() && !Object.keys(filters).length) {
                return this.giftsCache;
            }
            
            const queryFilters = {
                is_active: true,
                ...filters
            };
            
            const options = {
                orderBy: 'sort_order',
                ascending: true
            };
            
            const gifts = await this.repository.query('gifts', queryFilters, options);
            
            if (!gifts) {
                throw new Error('Failed to load gifts');
            }
            
            // Update cache if no filters
            if (!Object.keys(filters).length) {
                this.giftsCache = gifts;
                this.lastCacheTime = Date.now();
            }
            
            this.logger.debug('Loaded gifts', { count: gifts.length, filters });
            
            return gifts;
            
        } catch (error) {
            this.logger.error('Failed to get available gifts', error, { filters });
            
            // Return sample gifts as fallback
            if (error.code === 'RLS_ERROR' || error.message.includes('network')) {
                return this.getSampleGifts();
            }
            
            throw error;
        }
    }
    
    /**
     * Purchase a gift for a user
     */
    async purchaseGift(userId, giftId) {
        try {
            this.logger.info('Processing gift purchase', { userId, giftId });
            
            // Validate purchase first
            const validation = await this.validatePurchase(userId, giftId);
            
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            // Try database purchase first
            try {
                const result = await this.processDatabasePurchase(userId, giftId);
                
                if (result.success) {
                    // Emit purchase event
                    window.EventBus?.emit('gift:purchased', {
                        userId,
                        giftId,
                        giftName: result.gift_name,
                        pointsSpent: result.price_paid
                    });
                    
                    return result;
                }
            } catch (dbError) {
                this.logger.warn('Database purchase failed, trying local fallback', {
                    error: dbError.message
                });
                
                // Fallback to local purchase
                return await this.processLocalPurchase(userId, giftId);
            }
            
        } catch (error) {
            this.logger.error('Gift purchase failed', error, { userId, giftId });
            
            // Transform error for user-friendly message
            const userError = this.transformPurchaseError(error);
            throw userError;
        }
    }
    
    /**
     * Process purchase through database
     */
    async processDatabasePurchase(userId, giftId) {
        // Get user's telegram_id
        const user = await this.userService.getUserProfile(userId);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // Execute purchase function
        const result = await this.repository.execute('purchase_gift', {
            p_user_telegram_id: user.telegram_id,
            p_gift_id: giftId
        });
        
        if (!result || !result.success) {
            throw new Error(result?.message || 'Purchase failed');
        }
        
        // Update user's local state
        await this.userService.updatePoints(userId, -(result.price_paid || 0));
        
        this.logger.info('Gift purchased successfully', {
            userId,
            giftId,
            giftName: result.gift_name,
            pointsSpent: result.price_paid
        });
        
        return result;
    }
    
    /**
     * Process purchase locally (fallback)
     */
    async processLocalPurchase(userId, giftId) {
        const user = await this.userService.getUserProfile(userId);
        const gift = await this.getGiftById(giftId);
        
        if (!user || !gift) {
            throw new Error('User or gift not found');
        }
        
        // Deduct points
        const newPoints = user.points - gift.price_points;
        await this.userService.updatePoints(userId, -gift.price_points);
        
        // Store purchase locally
        const userGifts = this.getLocalUserGifts(userId);
        userGifts.push({
            gift_id: giftId,
            obtained_at: new Date().toISOString(),
            purchase_price: gift.price_points
        });
        
        localStorage.setItem(`user_gifts_${userId}`, JSON.stringify(userGifts));
        
        // Update gift supply locally
        const localGifts = JSON.parse(localStorage.getItem('gifts_data') || '[]');
        const giftIndex = localGifts.findIndex(g => g.id === giftId);
        
        if (giftIndex !== -1) {
            localGifts[giftIndex].current_supply += 1;
            localStorage.setItem('gifts_data', JSON.stringify(localGifts));
        }
        
        this.logger.info('Gift purchased locally', {
            userId,
            giftId,
            giftName: gift.name,
            pointsSpent: gift.price_points
        });
        
        return {
            success: true,
            gift_name: gift.name,
            price_paid: gift.price_points,
            remaining_points: newPoints
        };
    }
    
    /**
     * Get a specific gift by ID
     */
    async getGiftById(giftId) {
        try {
            // Check cache first
            if (this.giftsCache) {
                const cachedGift = this.giftsCache.find(g => g.id === giftId);
                if (cachedGift) return cachedGift;
            }
            
            return await this.repository.read('gifts', giftId);
            
        } catch (error) {
            this.logger.error('Failed to get gift by ID', error, { giftId });
            
            // Check local storage fallback
            const localGifts = this.getSampleGifts();
            return localGifts.find(g => g.id === giftId) || null;
        }
    }
    
    /**
     * Get user's gift collection
     */
    async getUserGifts(userId) {
        try {
            const user = await this.userService.getUserProfile(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // Try database first
            try {
                const userGifts = await this.repository.query('user_gifts', {
                    user_id: user.id
                }, {
                    select: `
                        id,
                        gift_id,
                        obtained_at,
                        purchase_price,
                        gifts!inner(
                            id,
                            name,
                            description,
                            image_url,
                            price_points,
                            category,
                            rarity
                        )
                    `,
                    orderBy: 'obtained_at',
                    ascending: false
                });
                
                // Transform data structure
                const transformedGifts = userGifts.map(ug => ({
                    ...ug,
                    gift: ug.gifts
                }));
                
                this.logger.debug('Loaded user gifts', { 
                    userId, 
                    count: transformedGifts.length 
                });
                
                return transformedGifts;
                
            } catch (dbError) {
                this.logger.warn('Failed to load gifts from database', {
                    error: dbError.message
                });
                
                // Fallback to local storage
                return this.getLocalUserGifts(userId);
            }
            
        } catch (error) {
            this.logger.error('Failed to get user gifts', error, { userId });
            return [];
        }
    }
    
    /**
     * Get user gifts from local storage
     */
    getLocalUserGifts(userId) {
        try {
            const stored = localStorage.getItem(`user_gifts_${userId}`);
            
            if (!stored) {
                return [];
            }
            
            const giftIds = JSON.parse(stored);
            const allGifts = this.getSampleGifts();
            
            return giftIds.map(item => {
                const gift = allGifts.find(g => g.id === item.gift_id);
                return {
                    ...item,
                    gift: gift || { id: item.gift_id, name: 'Unknown Gift' }
                };
            });
            
        } catch (error) {
            this.logger.error('Failed to get local user gifts', error);
            return [];
        }
    }
    
    /**
     * Validate if a purchase can be made
     */
    async validatePurchase(userId, giftId) {
        try {
            // Get user and gift data
            const [user, gift, userGifts] = await Promise.all([
                this.userService.getUserProfile(userId),
                this.getGiftById(giftId),
                this.getUserGifts(userId)
            ]);
            
            if (!user) {
                return { valid: false, message: 'User not found' };
            }
            
            // Check if user has completed registration process
            const registrationState = this.checkUserRegistrationState();
            if (!registrationState.isRegistered) {
                this.logger.info('Purchase blocked - user not registered', {
                    userId,
                    registrationState
                });
                return { 
                    valid: false, 
                    message: 'Please click "Start Collecting" to enable gift purchases',
                    requiresRegistration: true
                };
            }
            
            if (!gift) {
                return { valid: false, message: 'Gift not found' };
            }
            
            // Check if already owned
            const alreadyOwned = userGifts.some(ug => 
                ug.gift_id === giftId || ug.gift?.id === giftId
            );
            
            if (alreadyOwned) {
                return { valid: false, message: 'You already own this gift' };
            }
            
            // Check stock
            if (gift.current_supply >= gift.max_supply) {
                return { valid: false, message: 'Gift is out of stock' };
            }
            
            // Check points
            if (user.points < gift.price_points) {
                const needed = gift.price_points - user.points;
                return { 
                    valid: false, 
                    message: `You need ${needed} more points` 
                };
            }
            
            return { valid: true };
            
        } catch (error) {
            this.logger.error('Failed to validate purchase', error, { userId, giftId });
            return { valid: false, message: 'Validation failed' };
        }
    }
    
    /**
     * Check user registration state to prevent purchase bypass
     */
    checkUserRegistrationState() {
        try {
            // Try to get registration state from global app instance
            if (window.FanZoneApp && window.FanZoneApp.isUserFullyRegistered) {
                const isRegistered = window.FanZoneApp.isUserFullyRegistered();
                return { isRegistered, source: 'app_instance' };
            }
            
            // Fallback to localStorage check
            const saved = localStorage.getItem('fanzone_registration_state');
            if (saved) {
                const state = JSON.parse(saved);
                const isRegistered = state.hasClickedStart && state.isFullyRegistered;
                return { isRegistered, source: 'localStorage' };
            }
            
            // Default to not registered
            return { isRegistered: false, source: 'default' };
            
        } catch (error) {
            this.logger.warn('Failed to check registration state', error);
            return { isRegistered: false, source: 'error' };
        }
    }
    
    /**
     * Transform purchase error for user display
     */
    transformPurchaseError(error) {
        const errorMap = {
            'INSUFFICIENT_POINTS': 'Not enough points for this gift',
            'OUT_OF_STOCK': 'This gift is out of stock',
            'ALREADY_OWNED': 'You already own this gift',
            'USER_NOT_FOUND': 'User not found. Please login again',
            'GIFT_NOT_FOUND': 'Gift not found'
        };
        
        // Check for known error codes
        for (const [code, message] of Object.entries(errorMap)) {
            if (error.message?.includes(code) || error.code === code) {
                const userError = new Error(message);
                userError.code = code;
                return userError;
            }
        }
        
        // Generic error
        const userError = new Error('Purchase failed. Please try again.');
        userError.originalError = error;
        return userError;
    }
    
    /**
     * Check if cache is valid
     */
    isCacheValid() {
        return this.giftsCache && 
               (Date.now() - this.lastCacheTime) < this.cacheExpiry;
    }
    
    /**
     * Clear gifts cache
     */
    clearCache() {
        this.giftsCache = null;
        this.lastCacheTime = 0;
    }
    
    /**
     * Get sample gifts for development/fallback
     */
    getSampleGifts() {
        return [
            {
                id: 'gift-1',
                name: '⚽ Match Ball',
                description: 'Official match ball from today\'s game',
                image_url: 'https://via.placeholder.com/150x100/3390ec/ffffff?text=⚽',
                price_points: 50,
                max_supply: 100,
                current_supply: 23,
                category: 'match',
                is_active: true,
                rarity: 'common'
            },
            {
                id: 'gift-2',
                name: '🏆 Victory Trophy',
                description: 'Celebrate the team\'s amazing victory!',
                image_url: 'https://via.placeholder.com/150x100/FFD700/000000?text=🏆',
                price_points: 100,
                max_supply: 50,
                current_supply: 12,
                category: 'trophy',
                is_active: true,
                rarity: 'rare'
            },
            {
                id: 'gift-3',
                name: '👕 Team Jersey',
                description: 'Limited edition digital jersey',
                image_url: 'https://via.placeholder.com/150x100/FF4444/ffffff?text=👕',
                price_points: 75,
                max_supply: 200,
                current_supply: 87,
                category: 'player',
                is_active: true,
                rarity: 'common'
            },
            {
                id: 'gift-4',
                name: '⭐ Star Player Card',
                description: 'Exclusive star player digital card',
                image_url: 'https://via.placeholder.com/150x100/9C27B0/ffffff?text=⭐',
                price_points: 150,
                max_supply: 25,
                current_supply: 3,
                category: 'special',
                is_active: true,
                rarity: 'legendary'
            }
        ];
    }
    
    /**
     * Get gift statistics
     */
    async getGiftStats() {
        try {
            const gifts = await this.getAvailableGifts();
            
            return {
                total: gifts.length,
                available: gifts.filter(g => g.current_supply < g.max_supply).length,
                outOfStock: gifts.filter(g => g.current_supply >= g.max_supply).length,
                categories: [...new Set(gifts.map(g => g.category))],
                averagePrice: Math.round(
                    gifts.reduce((sum, g) => sum + g.price_points, 0) / gifts.length
                )
            };
            
        } catch (error) {
            this.logger.error('Failed to get gift stats', error);
            return null;
        }
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GiftService;
}

// Global access
window.GiftService = GiftService;