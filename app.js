// Main application logic for FanZone Telegram Mini App
// This file handles app initialization, navigation, and core functionality

class FanZoneApp {
    constructor() {
        this.currentPage = 'gifts';
        this.user = null;
        this.supabase = null;
        this.isInitialized = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.initTelegram = this.initTelegram.bind(this);
        this.initSupabase = this.initSupabase.bind(this);
        this.authenticateUser = this.authenticateUser.bind(this);
        this.setupNavigation = this.setupNavigation.bind(this);
        this.navigateToPage = this.navigateToPage.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            Utils.showLoading('Initializing FanZone...');
            
            // Wait minimum time for better UX
            await Utils.sleep(CONFIG.UI.LOADING_MIN_TIME);
            
            // Initialize Telegram Web App
            await this.initTelegram();
            
            // Initialize Supabase (when credentials are available)
            await this.initSupabase();
            
            // Authenticate user
            await this.authenticateUser();
            
            // Setup UI
            this.setupNavigation();
            this.setupErrorHandling();
            this.applyTelegramTheme();
            
            // Initialize pages
            this.initializePages();
            
            // Show main app
            Utils.hideLoading();
            Utils.showElement('main-app');
            
            // Track page view
            this.trackEvent('app_initialized');
            
            this.isInitialized = true;
            
            Utils.showToast(CONFIG.MESSAGES.INFO.WELCOME, 'success');
            
        } catch (error) {
            Utils.logError(error, 'App initialization');
            this.handleInitializationError(error);
        }
    }
    
    async initTelegram() {
        if (!Utils.isTelegramWebApp()) {
            // Development mode - create mock user
            CONFIG.TELEGRAM.USER_DATA = {
                id: 12345,
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser'
            };
            
            if (CONFIG.DEBUG) {
                console.log('Running in development mode with mock user');
            }
            return;
        }
        
        try {
            // Initialize Telegram Web App
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
            
            // Get user data
            CONFIG.TELEGRAM.USER_DATA = window.Telegram.WebApp.initDataUnsafe?.user;
            
            if (!CONFIG.TELEGRAM.USER_DATA) {
                throw new Error('Unable to get Telegram user data');
            }
            
            // Set up Telegram Web App handlers
            window.Telegram.WebApp.onEvent('viewportChanged', () => {
                this.handleViewportChange();
            });
            
            // Enable closing confirmation
            window.Telegram.WebApp.enableClosingConfirmation();
        } catch (error) {
            // Fallback to development mode if Telegram API fails
            CONFIG.TELEGRAM.USER_DATA = {
                id: 12345,
                first_name: 'Demo',
                last_name: 'User',
                username: 'demouser'
            };
            
            console.warn('Telegram Web App initialization failed, using fallback mode:', error);
        }
    }
    
    async initSupabase() {
        // Check if Supabase credentials are configured
        if (!CONFIG.SUPABASE.URL || !CONFIG.SUPABASE.ANON_KEY) {
            console.warn('Supabase credentials not configured. Some features will be limited.');
            return;
        }
        
        try {
            // Initialize Supabase client
            this.supabase = window.supabase.createClient(
                CONFIG.SUPABASE.URL,
                CONFIG.SUPABASE.ANON_KEY
            );
            
            // Test connection
            const { error } = await this.supabase.from(CONFIG.TABLES.USERS).select('count').limit(1);
            
            if (error) {
                throw error;
            }
            
            if (CONFIG.DEBUG) {
                console.log('Supabase connected successfully');
            }
            
        } catch (error) {
            Utils.logError(error, 'Supabase initialization');
            throw new Error('Failed to connect to database');
        }
    }
    
    async authenticateUser() {
        const telegramUser = CONFIG.TELEGRAM.USER_DATA;
        
        if (!telegramUser) {
            throw new Error('No Telegram user data available');
        }
        
        try {
            // For MVP without Supabase, create local user
            if (!this.supabase) {
                this.user = {
                    id: telegramUser.id,
                    telegram_id: telegramUser.id,
                    username: telegramUser.username || `${telegramUser.first_name} ${telegramUser.last_name}`,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name,
                    points: Utils.getStorage(CONFIG.STORAGE_KEYS.USER_DATA, {}).points || CONFIG.POINTS.INITIAL_POINTS,
                    total_gifts: 0,
                    created_at: new Date().toISOString()
                };
                
                // Save to localStorage for MVP
                Utils.setStorage(CONFIG.STORAGE_KEYS.USER_DATA, this.user);
                
                this.updateUserDisplay();
                return;
            }
            
            // Check if user exists in database
            const { data: existingUser, error: fetchError } = await this.supabase
                .from(CONFIG.TABLES.USERS)
                .select('*')
                .eq('telegram_id', telegramUser.id)
                .single();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }
            
            if (existingUser) {
                // Update last login
                const { error: updateError } = await this.supabase
                    .from(CONFIG.TABLES.USERS)
                    .update({ last_login: new Date().toISOString() })
                    .eq('telegram_id', telegramUser.id);
                
                if (updateError) {
                    Utils.logError(updateError, 'Update last login');
                }
                
                this.user = existingUser;
            } else {
                // Create new user
                const newUser = {
                    telegram_id: telegramUser.id,
                    username: telegramUser.username || `${telegramUser.first_name} ${telegramUser.last_name}`,
                    points: CONFIG.POINTS.INITIAL_POINTS,
                    total_gifts: 0
                };
                
                const { data: createdUser, error: createError } = await this.supabase
                    .from(CONFIG.TABLES.USERS)
                    .insert([newUser])
                    .select()
                    .single();
                
                if (createError) {
                    throw createError;
                }
                
                this.user = createdUser;
                
                // Track new user
                this.trackEvent('user_registered');
            }
            
            this.updateUserDisplay();
            
        } catch (error) {
            Utils.logError(error, 'User authentication');
            throw new Error('Authentication failed');
        }
    }
    
    // ======================
    // UI Setup
    // ======================
    
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this.navigateToPage(page);
                Utils.hapticFeedback('light');
            });
        });
    }
    
    navigateToPage(page) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        document.getElementById(`${page}-page`).classList.add('active');
        
        this.currentPage = page;
        
        // Track page view
        this.trackEvent('page_view', { page });
        
        // Trigger page-specific initialization
        this.initializePage(page);
    }
    
    initializePage(page) {
        switch (page) {
            case 'gifts':
                if (window.GiftsManager) {
                    window.GiftsManager.init();
                }
                break;
            case 'leaderboard':
                if (window.LeaderboardManager) {
                    window.LeaderboardManager.init();
                }
                break;
            case 'profile':
                if (window.ProfileManager) {
                    window.ProfileManager.init();
                }
                break;
        }
    }
    
    initializePages() {
        // Initialize all page managers
        if (window.GiftsManager) {
            window.GiftsManager.init();
        }
        if (window.LeaderboardManager) {
            window.LeaderboardManager.init();
        }
        if (window.ProfileManager) {
            window.ProfileManager.init();
        }
    }
    
    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            Utils.logError(event.error, 'Global error');
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            Utils.logError(event.reason, 'Unhandled promise rejection');
        });
    }
    
    applyTelegramTheme() {
        if (!Utils.isTelegramWebApp()) return;
        
        const themeParams = window.Telegram.WebApp.themeParams;
        
        if (themeParams) {
            const root = document.documentElement;
            
            // Apply Telegram theme colors
            Object.keys(themeParams).forEach(key => {
                root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, themeParams[key]);
            });
            
            // Add theme class
            if (themeParams.bg_color && this.isColorDark(themeParams.bg_color)) {
                document.body.classList.add('theme-dark');
            }
        }
    }
    
    isColorDark(color) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return brightness < 128;
    }
    
    // ======================
    // User Management
    // ======================
    
    updateUserDisplay() {
        if (!this.user) return;
        
        const userNameElement = Utils.getElementById('user-name');
        const userPointsElement = Utils.getElementById('user-points');
        const appModeElement = Utils.getElementById('app-mode');
        
        if (userNameElement) {
            userNameElement.textContent = Utils.truncateText(this.user.username || 'User', 15);
        }
        
        if (userPointsElement) {
            userPointsElement.textContent = `${Utils.formatPoints(this.user.points)} pts`;
        }
        
        // Show mode indicator
        if (appModeElement) {
            if (Utils.isTelegramWebApp()) {
                appModeElement.textContent = 'Telegram';
                appModeElement.style.background = 'var(--success-color)';
                if (CONFIG.DEBUG) {
                    appModeElement.style.display = 'inline-block';
                }
            } else {
                appModeElement.textContent = 'Demo';
                appModeElement.style.background = 'var(--warning-color)';
                appModeElement.style.display = 'inline-block';
            }
        }
    }
    
    async updateUserPoints(change) {
        if (!this.user) return false;
        
        const newPoints = this.user.points + change;
        
        if (newPoints < 0 || newPoints > CONFIG.POINTS.MAX_POINTS) {
            return false;
        }
        
        try {
            if (this.supabase) {
                const { error } = await this.supabase
                    .from(CONFIG.TABLES.USERS)
                    .update({ points: newPoints })
                    .eq('telegram_id', this.user.telegram_id);
                
                if (error) throw error;
            }
            
            this.user.points = newPoints;
            
            // Update localStorage for MVP
            Utils.setStorage(CONFIG.STORAGE_KEYS.USER_DATA, this.user);
            
            this.updateUserDisplay();
            
            return true;
            
        } catch (error) {
            Utils.logError(error, 'Update user points');
            return false;
        }
    }
    
    // ======================
    // Event Tracking
    // ======================
    
    trackEvent(eventName, parameters = {}) {
        if (!CONFIG.FEATURES.ANALYTICS) return;
        
        try {
            // For MVP, just log to console
            if (CONFIG.DEBUG) {
                console.log('Event:', eventName, parameters);
            }
            
            // In production, you would send to Google Analytics
            if (window.gtag && CONFIG.ANALYTICS.GA4_ID) {
                window.gtag('event', eventName, {
                    ...parameters,
                    user_id: this.user?.telegram_id
                });
            }
            
        } catch (error) {
            Utils.logError(error, 'Event tracking');
        }
    }
    
    // ======================
    // Error Handling
    // ======================
    
    handleInitializationError(error) {
        Utils.hideLoading();
        
        let message = CONFIG.MESSAGES.ERRORS.GENERIC;
        
        if (error.message.includes('Telegram')) {
            message = CONFIG.MESSAGES.ERRORS.AUTH;
        } else if (error.message.includes('database') || error.message.includes('Supabase')) {
            message = CONFIG.MESSAGES.ERRORS.NETWORK;
        }
        
        Utils.showError(message, () => {
            window.location.reload();
        });
    }
    
    handleViewportChange() {
        // Handle Telegram viewport changes if needed
        if (CONFIG.DEBUG) {
            console.log('Viewport changed:', window.Telegram.WebApp.viewportHeight);
        }
    }
    
    // ======================
    // Public API
    // ======================
    
    getUser() {
        return this.user;
    }
    
    getSupabase() {
        return this.supabase;
    }
    
    isReady() {
        return this.isInitialized;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.FanZoneApp = new FanZoneApp();
    window.FanZoneApp.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FanZoneApp;
}