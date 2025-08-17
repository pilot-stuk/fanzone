// Authentication Service following Single Responsibility Principle
// Handles all authentication logic with proper error handling

class AuthService extends window.Interfaces.IAuthProvider {
    constructor(dataRepository, platformAdapter, logger) {
        super();
        this.repository = dataRepository;
        this.platform = platformAdapter;
        this.logger = logger;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authToken = null;
    }
    
    /**
     * Authenticate user from Telegram data
     */
    async authenticate(userData = null) {
        try {
            // Get user data from platform if not provided
            if (!userData) {
                userData = this.platform.getUserData();
            }
            
            if (!userData || !userData.id) {
                throw new Error('No user data available for authentication');
            }
            
            this.logger.info('Authenticating user', { userId: userData.id });
            
            // Try to get existing user or create new one
            let user = await this.getOrCreateUser(userData);
            
            if (!user) {
                throw new Error('Failed to authenticate user');
            }
            
            // NEW: Add explicit validation after user creation
            if (!user.id || user.is_local) {
                this.logger.warn('User creation may have failed, attempting retry', { 
                    userId: user.telegram_id,
                    hasId: !!user.id,
                    isLocal: !!user.is_local 
                });
                user = await this.retryUserCreation(userData);
            }
            
            // NEW: Verify user can perform gift operations
            const hasGiftPermissions = await this.validateUserGiftPermissions(user);
            this.logger.debug('User gift permissions validation result', { 
                userId: user.telegram_id,
                hasPermissions: hasGiftPermissions,
                isLocal: !!user.is_local 
            });
            
            // Update last login
            await this.updateLastLogin(user.id);
            
            // Set authentication state
            this.currentUser = user;
            this.isAuthenticated = true;
            this.authToken = this.generateToken(user);
            
            // Store in local storage for persistence
            this.storeAuthData();
            
            // Emit authentication event
            window.EventBus?.emit('auth:success', { user });
            
            this.logger.info('User authenticated successfully', { 
                userId: user.telegram_id,
                username: user.username,
                hasDbAccess: !user.is_local
            });
            
            return user;
            
        } catch (error) {
            this.logger.error('Authentication failed', error, { userData });
            window.EventBus?.emit('auth:failed', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Get existing user or create new one
     */
    async getOrCreateUser(userData) {
        try {
            // First, try to get existing user
            const existingUser = await this.getUserByTelegramId(userData.id);
            
            if (existingUser) {
                this.logger.debug('Found existing user', { userId: existingUser.telegram_id });
                return existingUser;
            }
            
            // Create new user
            this.logger.info('Creating new user', { telegramId: userData.id });
            return await this.createUser(userData);
            
        } catch (error) {
            this.logger.error('Failed to get or create user', error, { userData });
            
            // If database fails, try local fallback
            if (error.message.includes('permission') || error.message.includes('RLS')) {
                return await this.createLocalUser(userData);
            }
            
            throw error;
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
            if (error.code === 'PGRST116') {
                // No user found
                return null;
            }
            throw error;
        }
    }
    
    /**
     * Create new user in database
     */
    async createUser(userData) {
        try {
            const newUser = {
                telegram_id: userData.id,
                username: this.extractUsername(userData),
                first_name: userData.firstName || userData.first_name || null,
                last_name: userData.lastName || userData.last_name || null,
                points: CONFIG.POINTS.INITIAL_POINTS,
                total_gifts: 0,
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
            };
            
            this.logger.debug('Creating user with data', newUser);
            
            // Try RPC function first (if it exists)
            try {
                this.logger.debug('Attempting to create user via RPC function', { 
                    telegram_id: newUser.telegram_id,
                    username: newUser.username 
                });
                
                const result = await this.repository.execute('create_user', {
                    p_telegram_id: newUser.telegram_id,
                    p_username: newUser.username,
                    p_first_name: newUser.first_name,
                    p_last_name: newUser.last_name
                });
                
                this.logger.debug('RPC create_user result', { result });
                
                if (result && result.success) {
                    const createdUser = result.user || newUser;
                    
                    this.logger.info('User created successfully via RPC function', { 
                        userId: createdUser.telegram_id,
                        isNew: result.is_new,
                        created: result.is_new || result.created  // Support both formats
                    });
                    
                    // Track user registration
                    window.EventBus?.emit('user:registered', { 
                        user: createdUser,
                        method: 'rpc',
                        created: result.is_new || result.created,
                        isNew: result.is_new
                    });
                    
                    return createdUser;
                } else if (result) {
                    this.logger.warn('RPC create_user returned unsuccessful result', { 
                        result,
                        telegram_id: newUser.telegram_id 
                    });
                }
            } catch (rpcError) {
                this.logger.debug('RPC function failed, trying direct insert', { 
                    error: rpcError.message,
                    telegram_id: newUser.telegram_id 
                });
            }
            
            // Fallback to direct insert
            this.logger.debug('Attempting direct user insert', { 
                telegram_id: newUser.telegram_id 
            });
            
            const createdUser = await this.repository.create('users', newUser);
            
            if (!createdUser) {
                throw new Error('Failed to create user in database');
            }
            
            this.logger.debug('Direct insert successful, verifying user', { 
                userId: createdUser.telegram_id || createdUser.id 
            });
            
            // Verify the user was actually created and can be retrieved
            const verifiedUser = await this.getUserByTelegramId(userData.id);
            if (verifiedUser) {
                this.logger.info('User creation verified successfully', { 
                    userId: verifiedUser.telegram_id 
                });
                
                // Track user registration
                window.EventBus?.emit('user:registered', { 
                    user: verifiedUser,
                    method: 'direct_insert',
                    verified: true 
                });
                return verifiedUser;
            }
            
            this.logger.warn('User creation succeeded but verification failed', { 
                createdUser: createdUser.telegram_id || createdUser.id,
                telegram_id: userData.id 
            });
            
            return createdUser;
            
        } catch (error) {
            this.logger.error('Failed to create user in database', error, { userData });
            
            // Check for specific errors
            if (error.message.includes('duplicate') || error.message.includes('unique')) {
                // User might already exist, try to fetch
                const existingUser = await this.getUserByTelegramId(userData.id);
                if (existingUser) {
                    this.logger.info('Found existing user after duplicate error', { userId: existingUser.telegram_id });
                    return existingUser;
                }
            }
            
            if (error.message.includes('permission') || error.message.includes('RLS') || error.code === 'RLS_ERROR') {
                this.logger.warn('Database permission issue, falling back to local storage');
                return await this.createLocalUser(userData);
            }
            
            throw error;
        }
    }
    
    /**
     * Create user in local storage (fallback)
     */
    async createLocalUser(userData) {
        const localUser = {
            id: `local_${userData.id}`,
            telegram_id: userData.id,
            username: this.extractUsername(userData),
            first_name: userData.firstName || userData.first_name || null,
            last_name: userData.lastName || userData.last_name || null,
            points: CONFIG.POINTS.INITIAL_POINTS,
            total_gifts: 0,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            is_local: true
        };
        
        // Store in local storage
        localStorage.setItem(`user_${userData.id}`, JSON.stringify(localUser));
        
        this.logger.warn('Created local user due to database issues', { userId: localUser.telegram_id });
        
        return localUser;
    }
    
    /**
     * Update user in database
     */
    async updateUser(userId, updates) {
        try {
            // Check if local user
            if (this.currentUser?.is_local) {
                return this.updateLocalUser(userId, updates);
            }
            
            const updatedUser = await this.repository.update('users', userId, {
                ...updates,
                updated_at: new Date().toISOString()
            });
            
            // Update current user if it's the same
            if (this.currentUser && this.currentUser.id === userId) {
                this.currentUser = { ...this.currentUser, ...updatedUser };
                this.storeAuthData();
            }
            
            return updatedUser;
            
        } catch (error) {
            this.logger.error('Failed to update user', error, { userId, updates });
            
            // Fallback to local update
            if (error.message.includes('permission') || error.message.includes('network')) {
                return this.updateLocalUser(userId, updates);
            }
            
            throw error;
        }
    }
    
    /**
     * Update local user
     */
    updateLocalUser(userId, updates) {
        const key = userId.startsWith('local_') ? userId : `user_${userId}`;
        const stored = localStorage.getItem(key);
        
        if (stored) {
            const user = JSON.parse(stored);
            const updatedUser = { ...user, ...updates, updated_at: new Date().toISOString() };
            localStorage.setItem(key, JSON.stringify(updatedUser));
            
            if (this.currentUser && (this.currentUser.id === userId || this.currentUser.telegram_id === userId)) {
                this.currentUser = updatedUser;
                this.storeAuthData();
            }
            
            return updatedUser;
        }
        
        return null;
    }
    
    /**
     * Get user by ID
     */
    async getUser(userId) {
        try {
            // Check current user first
            if (this.currentUser && (this.currentUser.id === userId || this.currentUser.telegram_id === userId)) {
                return this.currentUser;
            }
            
            // Check if local user
            const localKey = userId.startsWith('local_') ? userId : `user_${userId}`;
            const localUser = localStorage.getItem(localKey);
            
            if (localUser) {
                return JSON.parse(localUser);
            }
            
            // Get from database
            return await this.repository.read('users', userId);
            
        } catch (error) {
            this.logger.error('Failed to get user', error, { userId });
            return null;
        }
    }
    
    /**
     * Update last login time
     */
    async updateLastLogin(userId) {
        try {
            await this.updateUser(userId, {
                last_login: new Date().toISOString()
            });
        } catch (error) {
            this.logger.warn('Failed to update last login', { userId, error: error.message });
        }
    }
    
    /**
     * Extract username from user data
     */
    extractUsername(userData) {
        if (userData.username) {
            return userData.username;
        }
        
        const firstName = userData.firstName || userData.first_name || '';
        const lastName = userData.lastName || userData.last_name || '';
        const name = `${firstName} ${lastName}`.trim();
        
        return name || `User${userData.id}`;
    }
    
    /**
     * Generate authentication token
     */
    generateToken(user) {
        // Simple token for MVP
        // In production, use proper JWT
        return btoa(JSON.stringify({
            user_id: user.telegram_id,
            timestamp: Date.now(),
            session: Math.random().toString(36).substring(2, 11)
        }));
    }
    
    /**
     * Store authentication data in local storage
     */
    storeAuthData() {
        if (this.currentUser) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(this.currentUser));
            localStorage.setItem('auth_token', this.authToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_VISIT, new Date().toISOString());
        }
    }
    
    /**
     * Load stored authentication data
     */
    loadStoredAuth() {
        try {
            const storedUser = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);
            const storedToken = localStorage.getItem('auth_token');
            
            if (storedUser && storedToken) {
                this.currentUser = JSON.parse(storedUser);
                this.authToken = storedToken;
                this.isAuthenticated = true;
                
                return true;
            }
        } catch (error) {
            this.logger.error('Failed to load stored auth', error);
        }
        
        return false;
    }
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.isAuthenticated && this.currentUser !== null;
    }
    
    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }
    
    /**
     * Get authentication token
     */
    getAuthToken() {
        return this.authToken;
    }
    
    /**
     * Logout user
     */
    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.authToken = null;
        
        // Clear storage
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
        localStorage.removeItem('auth_token');
        
        // Emit logout event
        window.EventBus?.emit('auth:logout');
        
        this.logger.info('User logged out');
    }
    
    /**
     * Refresh user data
     */
    async refreshUser() {
        if (!this.currentUser) {
            throw new Error('No user to refresh');
        }
        
        try {
            const refreshedUser = await this.getUser(this.currentUser.telegram_id);
            
            if (refreshedUser) {
                this.currentUser = refreshedUser;
                this.storeAuthData();
                
                window.EventBus?.emit('user:refreshed', { user: refreshedUser });
            }
            
            return refreshedUser;
            
        } catch (error) {
            this.logger.error('Failed to refresh user', error);
            throw error;
        }
    }
    
    /**
     * Retry user creation with enhanced error handling
     */
    async retryUserCreation(userData, maxRetries = 3) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.debug(`User creation retry attempt ${attempt}/${maxRetries}`, { 
                    userId: userData.id 
                });
                
                // First, check if user was actually created but not detected
                const existingUser = await this.getUserByTelegramId(userData.id);
                if (existingUser && !existingUser.is_local) {
                    this.logger.info('Found existing database user on retry', { 
                        userId: existingUser.telegram_id,
                        attempt 
                    });
                    return existingUser;
                }
                
                // Try creating user again
                const newUser = await this.createUser(userData);
                
                // Verify creation was successful
                if (newUser && !newUser.is_local) {
                    this.logger.info('User creation successful on retry', { 
                        userId: newUser.telegram_id,
                        attempt 
                    });
                    return newUser;
                }
                
                // If still local user, continue retrying
                if (newUser && newUser.is_local && attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                    continue;
                }
                
                return newUser; // Return local user if all retries failed
                
            } catch (error) {
                lastError = error;
                this.logger.warn(`User creation retry ${attempt} failed`, { 
                    error: error.message,
                    userId: userData.id 
                });
                
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                } else {
                    // Final attempt failed, fall back to local user
                    this.logger.error('All user creation retries failed, using local fallback', { 
                        error: error.message,
                        userId: userData.id 
                    });
                    return await this.createLocalUser(userData);
                }
            }
        }
        
        throw lastError || new Error('Failed to create user after retries');
    }
    
    /**
     * Validate that user can perform gift operations
     */
    async validateUserGiftPermissions(user) {
        try {
            // Check if user has proper database access
            if (user.is_local) {
                this.logger.warn('User is in local mode - gift purchases may not work', { 
                    userId: user.telegram_id 
                });
                // Don't throw error, just log warning for now
                return false;
            }
            
            // Try to verify user can access gifts table by getting gift count
            // This will test if the user permissions are working correctly
            const giftService = window.DIContainer?.get('giftService');
            if (giftService) {
                try {
                    await giftService.getAvailableGifts();
                    this.logger.debug('User gift permissions validated successfully', { 
                        userId: user.telegram_id 
                    });
                    return true;
                } catch (giftError) {
                    this.logger.warn('User may not have proper gift access permissions', { 
                        userId: user.telegram_id,
                        error: giftError.message 
                    });
                    return false;
                }
            }
            
            return true; // Assume permissions are OK if we can't test
            
        } catch (error) {
            this.logger.error('Failed to validate user gift permissions', error, { 
                userId: user.telegram_id 
            });
            return false;
        }
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthService;
}

// Global access
window.AuthService = AuthService;