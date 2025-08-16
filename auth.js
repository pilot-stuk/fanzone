// Authentication module for FanZone Telegram Mini App
// Handles Telegram Web App authentication and user management

class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.telegramUser = null;
        this.authToken = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.authenticateUser = this.authenticateUser.bind(this);
        this.validateTelegramData = this.validateTelegramData.bind(this);
        this.createOrUpdateUser = this.createOrUpdateUser.bind(this);
        this.logout = this.logout.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            // Check if user is already authenticated
            const savedUser = Utils.getStorage(CONFIG.STORAGE_KEYS.USER_DATA);
            if (savedUser && this.isValidUserData(savedUser)) {
                this.currentUser = savedUser;
                this.isAuthenticated = true;
                
                if (CONFIG.DEBUG) {
                    console.log('Restored authenticated user:', this.currentUser.username);
                }
            }
            
            // Initialize Telegram authentication
            await this.initTelegramAuth();
            
            // Authenticate or re-authenticate
            if (!this.isAuthenticated || this.shouldReauthenticate()) {
                await this.authenticateUser();
            }
            
            return this.isAuthenticated;
            
        } catch (error) {
            Utils.logError(error, 'Auth initialization');
            throw new Error('Authentication failed during initialization');
        }
    }
    
    async initTelegramAuth() {
        try {
            // Check if running in Telegram Web App
            if (Utils.isTelegramWebApp()) {
                // Initialize Telegram Web App
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.expand();
                
                // Get user data from Telegram
                this.telegramUser = window.Telegram.WebApp.initDataUnsafe?.user;
                
                if (!this.telegramUser) {
                    throw new Error('No Telegram user data available');
                }
                
                // Validate Telegram data integrity
                if (!this.validateTelegramData()) {
                    throw new Error('Invalid Telegram data');
                }
                
                if (CONFIG.DEBUG) {
                    console.log('Telegram user data:', this.telegramUser);
                }
                
            } else {
                // Development mode - create mock user
                this.telegramUser = {
                    id: 12345,
                    first_name: 'Demo',
                    last_name: 'User',
                    username: 'demouser',
                    language_code: 'en',
                    is_mock: true
                };
                
                if (CONFIG.DEBUG) {
                    console.log('Running in development mode with mock user');
                }
            }
            
        } catch (error) {
            // Fallback to demo mode if Telegram initialization fails
            this.telegramUser = {
                id: Date.now(),
                first_name: 'Guest',
                last_name: 'User',
                username: 'guest_' + Date.now(),
                language_code: 'en',
                is_fallback: true
            };
            
            Utils.logError(error, 'Telegram auth initialization');
            
            if (CONFIG.DEBUG) {
                console.warn('Telegram initialization failed, using fallback user');
            }
        }
    }
    
    // ======================
    // Authentication Logic
    // ======================
    
    async authenticateUser() {
        if (!this.telegramUser) {
            throw new Error('No Telegram user data available for authentication');
        }
        
        try {
            // Create or update user in database
            const user = await this.createOrUpdateUser(this.telegramUser);
            
            if (!user) {
                throw new Error('Failed to create or retrieve user');
            }
            
            // Set authentication state
            this.currentUser = user;
            this.isAuthenticated = true;
            
            // Generate auth token for session
            this.authToken = this.generateAuthToken(user);
            
            // Save to local storage
            Utils.setStorage(CONFIG.STORAGE_KEYS.USER_DATA, user);
            Utils.setStorage('auth_token', this.authToken);
            Utils.setStorage(CONFIG.STORAGE_KEYS.LAST_VISIT, new Date().toISOString());
            
            // Track authentication
            if (window.FanZoneApp) {
                window.FanZoneApp.trackEvent('user_login', {
                    user_id: user.telegram_id,
                    is_new_user: !user.last_login,
                    auth_method: Utils.isTelegramWebApp() ? 'telegram' : 'demo'
                });
            }
            
            if (CONFIG.DEBUG) {
                console.log('User authenticated successfully:', user.username);
            }
            
            return user;
            
        } catch (error) {
            Utils.logError(error, 'User authentication');
            throw error;
        }
    }
    
    async createOrUpdateUser(telegramUser) {
        const app = window.FanZoneApp;
        const supabase = app?.getSupabase();
        
        try {
            if (supabase) {
                // Database mode - use Supabase
                return await this.createOrUpdateUserDB(telegramUser, supabase);
            } else {
                // MVP mode - use localStorage
                return await this.createOrUpdateUserLocal(telegramUser);
            }
        } catch (error) {
            Utils.logError(error, 'Create or update user');
            throw error;
        }
    }
    
    async createOrUpdateUserDB(telegramUser, supabase) {
        try {
            // Check if user exists
            const { data: existingUser, error: fetchError } = await supabase
                .from(CONFIG.TABLES.USERS)
                .select('*')
                .eq('telegram_id', telegramUser.id)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }
            
            if (existingUser) {
                // Update existing user
                const updateData = {
                    username: this.extractUsername(telegramUser),
                    last_login: new Date().toISOString()
                };
                
                const { data: updatedUser, error: updateError } = await supabase
                    .from(CONFIG.TABLES.USERS)
                    .update(updateData)
                    .eq('telegram_id', telegramUser.id)
                    .select()
                    .single();
                
                if (updateError) throw updateError;
                
                return updatedUser;
                
            } else {
                // Create new user
                const newUser = {
                    telegram_id: telegramUser.id,
                    username: this.extractUsername(telegramUser),
                    points: CONFIG.POINTS.INITIAL_POINTS,
                    total_gifts: 0
                };
                
                const { data: createdUser, error: createError } = await supabase
                    .from(CONFIG.TABLES.USERS)
                    .insert([newUser])
                    .select()
                    .single();
                
                if (createError) throw createError;
                
                // Track new user
                if (window.FanZoneApp) {
                    window.FanZoneApp.trackEvent('user_registered', {
                        user_id: createdUser.telegram_id,
                        registration_method: 'telegram'
                    });
                }
                
                return createdUser;
            }
            
        } catch (error) {
            Utils.logError(error, 'Database user operations');
            throw error;
        }
    }
    
    async createOrUpdateUserLocal(telegramUser) {
        const userId = `user_${telegramUser.id}`;
        let user = Utils.getStorage(userId);
        
        if (user && this.isValidUserData(user)) {
            // Update existing user
            user.username = this.extractUsername(telegramUser);
            user.last_login = new Date().toISOString();
            
            Utils.setStorage(userId, user);
            
        } else {
            // Create new user
            user = {
                id: userId,
                telegram_id: telegramUser.id,
                username: this.extractUsername(telegramUser),
                points: CONFIG.POINTS.INITIAL_POINTS,
                total_gifts: 0,
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
            };
            
            Utils.setStorage(userId, user);
            
            // Track new user
            if (window.FanZoneApp) {
                window.FanZoneApp.trackEvent('user_registered', {
                    user_id: user.telegram_id,
                    registration_method: 'local'
                });
            }
        }
        
        return user;
    }
    
    // ======================
    // Validation & Utilities
    // ======================
    
    validateTelegramData() {
        if (!this.telegramUser) return false;
        
        // Basic validation
        if (!this.telegramUser.id || !this.telegramUser.first_name) {
            return false;
        }
        
        // In production, you would validate the hash from Telegram
        // For MVP, we'll skip cryptographic validation
        
        return true;
    }
    
    extractUsername(telegramUser) {
        if (telegramUser.username) {
            return telegramUser.username;
        }
        
        // Fallback to name
        const name = [telegramUser.first_name, telegramUser.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();
            
        return name || `User${telegramUser.id}`;
    }
    
    isValidUserData(userData) {
        return userData && 
               userData.telegram_id && 
               userData.username && 
               typeof userData.points === 'number';
    }
    
    shouldReauthenticate() {
        if (!this.currentUser) return true;
        
        // Check if user data is stale (older than 24 hours)
        const lastVisit = Utils.getStorage(CONFIG.STORAGE_KEYS.LAST_VISIT);
        if (lastVisit) {
            const lastVisitTime = new Date(lastVisit);
            const now = new Date();
            const hoursSinceLastVisit = (now - lastVisitTime) / (1000 * 60 * 60);
            
            if (hoursSinceLastVisit > 24) {
                return true;
            }
        }
        
        // Check if Telegram user has changed
        if (this.telegramUser && this.currentUser.telegram_id !== this.telegramUser.id) {
            return true;
        }
        
        return false;
    }
    
    generateAuthToken(user) {
        // Simple token generation for MVP
        // In production, use proper JWT or session tokens
        return btoa(JSON.stringify({
            user_id: user.telegram_id,
            timestamp: Date.now(),
            random: Math.random()
        }));
    }
    
    // ======================
    // Public API
    // ======================
    
    getUser() {
        return this.currentUser;
    }
    
    getTelegramUser() {
        return this.telegramUser;
    }
    
    isUserAuthenticated() {
        return this.isAuthenticated && this.currentUser;
    }
    
    getAuthToken() {
        return this.authToken;
    }
    
    async refreshUser() {
        if (this.isAuthenticated) {
            try {
                await this.authenticateUser();
                return this.currentUser;
            } catch (error) {
                Utils.logError(error, 'User refresh');
                return null;
            }
        }
        return null;
    }
    
    logout() {
        // Clear authentication state
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authToken = null;
        
        // Clear storage
        Utils.removeStorage(CONFIG.STORAGE_KEYS.USER_DATA);
        Utils.removeStorage('auth_token');
        
        // Track logout
        if (window.FanZoneApp) {
            window.FanZoneApp.trackEvent('user_logout');
        }
        
        if (CONFIG.DEBUG) {
            console.log('User logged out');
        }
    }
    
    // ======================
    // Telegram Web App Integration
    // ======================
    
    setupTelegramHandlers() {
        if (!Utils.isTelegramWebApp()) return;
        
        try {
            // Set up main button if needed
            window.Telegram.WebApp.MainButton.setText('Start Collecting!');
            window.Telegram.WebApp.MainButton.onClick(() => {
                // Navigate to gifts page and ensure it's loaded
                if (window.FanZoneApp) {
                    window.FanZoneApp.navigateToPage('gifts');
                    // Hide main button after starting
                    window.Telegram.WebApp.MainButton.hide();
                }
            });
            window.Telegram.WebApp.MainButton.show();
            
            // Set up back button handler
            window.Telegram.WebApp.BackButton.onClick(() => {
                // Handle back navigation
                if (window.FanZoneApp && window.FanZoneApp.currentPage !== 'gifts') {
                    window.FanZoneApp.navigateToPage('gifts');
                } else {
                    window.Telegram.WebApp.close();
                }
            });
            
            // Handle theme changes
            window.Telegram.WebApp.onEvent('themeChanged', () => {
                if (window.FanZoneApp) {
                    window.FanZoneApp.applyTelegramTheme();
                }
            });
            
            // Handle viewport changes
            window.Telegram.WebApp.onEvent('viewportChanged', () => {
                // Adjust UI for viewport changes
                document.documentElement.style.setProperty(
                    '--tg-viewport-height', 
                    window.Telegram.WebApp.viewportHeight + 'px'
                );
            });
            
        } catch (error) {
            Utils.logError(error, 'Telegram handlers setup');
        }
    }
    
    sendDataToTelegram(data) {
        if (Utils.isTelegramWebApp()) {
            try {
                window.Telegram.WebApp.sendData(JSON.stringify(data));
            } catch (error) {
                Utils.logError(error, 'Send data to Telegram');
            }
        }
    }
}

// Create global instance
window.AuthManager = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}