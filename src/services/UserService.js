// User Service following Single Responsibility Principle
// Handles all user-related business logic

class UserService extends window.Interfaces.IUserService {
    constructor(repository, logger) {
        super();
        this.repository = repository;
        this.logger = logger;
        this.userCache = new Map();
        this.cacheExpiry = 2 * 60 * 1000; // 2 minutes
    }
    
    /**
     * Get user profile by ID
     */
    async getUserProfile(userId) {
        try {
            // Check cache first
            const cached = this.getCachedUser(userId);
            if (cached) {
                return cached;
            }
            
            let user = null;
            
            // Convert userId to string for string operations
            const userIdStr = String(userId);
            
            // Try different ID formats
            if (userIdStr.startsWith('local_')) {
                // Local user
                user = this.getLocalUser(userId);
            } else if (typeof userId === 'number' || !isNaN(userId)) {
                // Telegram ID
                user = await this.getUserByTelegramId(userId);
            } else {
                // Database ID
                user = await this.repository.read('users', userId);
            }
            
            if (user) {
                this.cacheUser(user);
            }
            
            return user;
            
        } catch (error) {
            this.logger.error('Failed to get user profile', error, { userId });
            
            // Try local fallback
            return this.getLocalUser(userId);
        }
    }
    
    /**
     * Get user by Telegram ID
     */
    async getUserByTelegramId(telegramId) {
        try {
            const users = await this.repository.query('users', {
                telegram_id: telegramId
            }, { single: true });
            
            return users;
            
        } catch (error) {
            this.logger.error('Failed to get user by Telegram ID', error, { telegramId });
            return null;
        }
    }
    
    /**
     * Get local user from storage
     */
    getLocalUser(userId) {
        try {
            const keys = [
                userId,
                `user_${userId}`,
                `local_${userId}`
            ];
            
            for (const key of keys) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    return JSON.parse(stored);
                }
            }
            
            return null;
            
        } catch (error) {
            this.logger.error('Failed to get local user', error, { userId });
            return null;
        }
    }
    
    /**
     * Update user points
     */
    async updatePoints(userId, pointChange) {
        try {
            const user = await this.getUserProfile(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            const newPoints = user.points + pointChange;
            
            // Validate points
            if (newPoints < 0) {
                throw new Error('Insufficient points');
            }
            
            if (newPoints > CONFIG.POINTS.MAX_POINTS) {
                throw new Error('Maximum points exceeded');
            }
            
            // Update in database or local storage
            if (user.is_local) {
                return this.updateLocalUserPoints(userId, newPoints);
            } else {
                return await this.updateDatabaseUserPoints(user, newPoints);
            }
            
        } catch (error) {
            this.logger.error('Failed to update user points', error, { userId, pointChange });
            throw error;
        }
    }
    
    /**
     * Update points in database
     */
    async updateDatabaseUserPoints(user, newPoints) {
        try {
            const updated = await this.repository.update('users', user.id, {
                points: newPoints
            });
            
            // Update cache
            this.cacheUser({ ...user, points: newPoints });
            
            // Emit event
            window.EventBus?.emit('user:points:updated', {
                userId: user.id,
                oldPoints: user.points,
                newPoints: newPoints
            });
            
            this.logger.info('User points updated', {
                userId: user.id,
                oldPoints: user.points,
                newPoints: newPoints
            });
            
            return updated;
            
        } catch (error) {
            // Fallback to local update
            if (error.code === 'RLS_ERROR' || error.message.includes('network')) {
                return this.updateLocalUserPoints(user.telegram_id || user.id, newPoints);
            }
            throw error;
        }
    }
    
    /**
     * Update points in local storage
     */
    updateLocalUserPoints(userId, newPoints) {
        const user = this.getLocalUser(userId);
        
        if (!user) {
            throw new Error('Local user not found');
        }
        
        user.points = newPoints;
        user.updated_at = new Date().toISOString();
        
        // Save to local storage
        const key = user.id || `user_${userId}`;
        localStorage.setItem(key, JSON.stringify(user));
        
        // Update cache
        this.cacheUser(user);
        
        // Emit event
        window.EventBus?.emit('user:points:updated', {
            userId: user.id || userId,
            newPoints: newPoints
        });
        
        return user;
    }
    
    /**
     * Get leaderboard
     */
    async getLeaderboard(limit = 10) {
        try {
            // Try database view first
            try {
                const leaderboard = await this.repository.query('leaderboard_view', {}, {
                    limit: limit,
                    orderBy: 'rank',
                    ascending: true
                });
                
                if (leaderboard && leaderboard.length > 0) {
                    return leaderboard;
                }
            } catch (viewError) {
                this.logger.warn('Leaderboard view not available, using fallback query');
            }
            
            // Fallback to direct query
            const users = await this.repository.query('users', {}, {
                limit: limit,
                orderBy: 'points',
                ascending: false
            });
            
            // Add rank to users
            const leaderboard = users.map((user, index) => ({
                ...user,
                rank: index + 1
            }));
            
            this.logger.debug('Loaded leaderboard', { count: leaderboard.length });
            
            return leaderboard;
            
        } catch (error) {
            this.logger.error('Failed to get leaderboard', error, { limit });
            
            // Return sample leaderboard as fallback
            return this.getSampleLeaderboard(limit);
        }
    }
    
    /**
     * Get user's rank in leaderboard
     */
    async getUserRank(userId) {
        try {
            const user = await this.getUserProfile(userId);
            
            if (!user) {
                return null;
            }
            
            // Try database function first
            try {
                const result = await this.repository.execute('get_user_leaderboard_position', {
                    p_user_telegram_id: user.telegram_id
                });
                
                if (result && result.position) {
                    return result.position;
                }
            } catch (fnError) {
                this.logger.warn('Rank function not available, using fallback');
            }
            
            // Fallback: count users with more points
            const betterUsers = await this.repository.query('users', {}, {
                select: 'count'
            });
            
            // Filter users with more points
            const usersWithMorePoints = await this.repository.query('users', {}, {});
            const rank = usersWithMorePoints.filter(u => u.points > user.points).length + 1;
            
            return rank;
            
        } catch (error) {
            this.logger.error('Failed to get user rank', error, { userId });
            return null;
        }
    }
    
    /**
     * Update user profile
     */
    async updateProfile(userId, updates) {
        try {
            const user = await this.getUserProfile(userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            const allowedUpdates = ['username', 'first_name', 'last_name'];
            const filteredUpdates = {};
            
            // Filter allowed updates
            Object.keys(updates).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    filteredUpdates[key] = updates[key];
                }
            });
            
            if (Object.keys(filteredUpdates).length === 0) {
                return user; // No valid updates
            }
            
            // Update in database or local storage
            let updated;
            if (user.is_local) {
                updated = this.updateLocalUser(userId, filteredUpdates);
            } else {
                updated = await this.repository.update('users', user.id, filteredUpdates);
            }
            
            // Update cache
            this.cacheUser(updated);
            
            // Emit event
            window.EventBus?.emit('user:profile:updated', { userId, updates: filteredUpdates });
            
            return updated;
            
        } catch (error) {
            this.logger.error('Failed to update user profile', error, { userId, updates });
            throw error;
        }
    }
    
    /**
     * Update local user
     */
    updateLocalUser(userId, updates) {
        const user = this.getLocalUser(userId);
        
        if (!user) {
            throw new Error('Local user not found');
        }
        
        const updated = {
            ...user,
            ...updates,
            updated_at: new Date().toISOString()
        };
        
        const key = user.id || `user_${userId}`;
        localStorage.setItem(key, JSON.stringify(updated));
        
        return updated;
    }
    
    /**
     * Get user statistics
     */
    async getUserStats(userId) {
        try {
            const user = await this.getUserProfile(userId);
            
            if (!user) {
                return null;
            }
            
            const rank = await this.getUserRank(userId);
            
            // Get user's gifts count
            let giftsCount = 0;
            try {
                const userGifts = await this.repository.query('user_gifts', {
                    user_id: user.id
                }, { select: 'count' });
                
                giftsCount = userGifts?.length || 0;
            } catch (error) {
                giftsCount = user.total_gifts || 0;
            }
            
            return {
                userId: user.id,
                username: user.username,
                points: user.points,
                totalGifts: giftsCount,
                rank: rank,
                joinDate: user.created_at,
                lastActive: user.last_login
            };
            
        } catch (error) {
            this.logger.error('Failed to get user stats', error, { userId });
            return null;
        }
    }
    
    /**
     * Cache user data
     */
    cacheUser(user) {
        if (!user) return;
        
        const cacheEntry = {
            data: user,
            timestamp: Date.now()
        };
        
        // Cache by multiple keys for flexibility
        if (user.id) {
            this.userCache.set(user.id, cacheEntry);
        }
        if (user.telegram_id) {
            this.userCache.set(`telegram_${user.telegram_id}`, cacheEntry);
        }
    }
    
    /**
     * Get cached user
     */
    getCachedUser(userId) {
        // Try different key formats
        const keys = [
            userId,
            `telegram_${userId}`,
            `local_${userId}`
        ];
        
        for (const key of keys) {
            const cached = this.userCache.get(key);
            
            if (cached) {
                const age = Date.now() - cached.timestamp;
                
                if (age < this.cacheExpiry) {
                    return cached.data;
                } else {
                    // Remove expired cache
                    this.userCache.delete(key);
                }
            }
        }
        
        return null;
    }
    
    /**
     * Clear user cache
     */
    clearCache(userId = null) {
        if (userId) {
            this.userCache.delete(userId);
            this.userCache.delete(`telegram_${userId}`);
            this.userCache.delete(`local_${userId}`);
        } else {
            this.userCache.clear();
        }
    }
    
    /**
     * Get sample leaderboard for fallback
     */
    getSampleLeaderboard(limit) {
        const sampleUsers = [
            { username: 'Champion', points: 950, total_gifts: 15, rank: 1 },
            { username: 'StarPlayer', points: 875, total_gifts: 12, rank: 2 },
            { username: 'GoalMaster', points: 800, total_gifts: 10, rank: 3 },
            { username: 'FanHero', points: 750, total_gifts: 9, rank: 4 },
            { username: 'TopSupporter', points: 700, total_gifts: 8, rank: 5 },
            { username: 'ClubLegend', points: 650, total_gifts: 7, rank: 6 },
            { username: 'UltraFan', points: 600, total_gifts: 6, rank: 7 },
            { username: 'Devoted', points: 550, total_gifts: 5, rank: 8 },
            { username: 'Faithful', points: 500, total_gifts: 4, rank: 9 },
            { username: 'Rookie', points: 450, total_gifts: 3, rank: 10 }
        ];
        
        return sampleUsers.slice(0, limit);
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserService;
}

// Global access
window.UserService = UserService;