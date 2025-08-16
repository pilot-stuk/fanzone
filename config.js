// Configuration constants for FanZone Telegram Mini App
// This file contains all configuration settings for the MVP

const CONFIG = {
    // App Information
    APP_NAME: 'FanZone',
    APP_VERSION: '1.0.0-mvp',
    
    // Supabase Configuration (to be filled with actual credentials)
    SUPABASE: {
        URL: 'https://dsqietzoxyjpslprhglg.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzcWlldHpveHlqcHNscHJoZ2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMzYwODQsImV4cCI6MjA3MDkxMjA4NH0.BWDR-R2slfTJbrpFvf9JlPmIf3FZRxolIZ7-Wyoqoe8',
    },
    
    // Points System
    POINTS: {
        INITIAL_POINTS: 100,
        DAILY_BONUS: 100,
        MAX_POINTS: 10000,
    },
    
    // Gift System
    GIFTS: {
        CATEGORIES: ['match', 'player', 'trophy', 'special'],
        DEFAULT_CATEGORY: 'general',
        MAX_SUPPLY_DEFAULT: 1000,
        MIN_PRICE: 10,
        MAX_PRICE: 500,
    },
    
    // Leaderboard
    LEADERBOARD: {
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 50,
        REFRESH_INTERVAL: 30000, // 30 seconds
    },
    
    // UI Settings
    UI: {
        ANIMATION_DURATION: 300,
        TOAST_DURATION: 3000,
        LOADING_MIN_TIME: 1000, // Minimum loading time for UX
        RETRY_ATTEMPTS: 3,
    },
    
    // Telegram Web App
    TELEGRAM: {
        // These will be auto-detected from Telegram Web App
        THEME_PARAMS: null,
        USER_DATA: null,
        VIEWPORT: null,
    },
    
    // Feature Flags for MVP
    FEATURES: {
        REAL_PAYMENTS: false, // MVP uses points only
        NFT_MINTING: false, // MVP uses database records
        ADMIN_PANEL: true,
        SHARING: true,
        NOTIFICATIONS: false, // Future feature
        ANALYTICS: true,
    },
    
    // API Endpoints (for future backend integration)
    API: {
        BASE_URL: '', // Not used in MVP (direct Supabase)
        TIMEOUT: 10000,
        RETRY_DELAY: 1000,
    },

    // Error Messages
    MESSAGES: {
        ERRORS: {
            NETWORK: 'Network error. Please check your connection.',
            AUTH: 'Authentication failed. Please restart the app.',
            INSUFFICIENT_POINTS: 'Not enough points for this gift.',
            OUT_OF_STOCK: 'This gift is out of stock.',
            GENERIC: 'Something went wrong. Please try again.',
        },
        SUCCESS: {
            GIFT_PURCHASED: 'Gift successfully added to your collection!',
            PROFILE_UPDATED: 'Profile updated successfully!',
        },
        INFO: {
            WELCOME: 'Welcome to FanZone! Start collecting gifts!',
            LOADING: 'Loading...',
        }
    },
    
    // Development Settings
    DEBUG: true, // Set to true for development logging
    
    // Analytics (Google Analytics 4 - free tier)
    ANALYTICS: {
        GA4_ID: '', // To be set up during deployment
        EVENTS: {
            GIFT_PURCHASE: 'gift_purchase',
            PAGE_VIEW: 'page_view',
            USER_LOGIN: 'user_login',
            LEADERBOARD_VIEW: 'leaderboard_view',
            PROFILE_VIEW: 'profile_view',
        }
    },
    
    // Local Storage Keys
    STORAGE_KEYS: {
        USER_DATA: 'fanzone_user',
        THEME: 'fanzone_theme',
        LAST_VISIT: 'fanzone_last_visit',
        POINTS_HISTORY: 'fanzone_points_history',
    },
    
    // Database Table Names (Supabase)
    TABLES: {
        USERS: 'users',
        GIFTS: 'gifts',
        USER_GIFTS: 'user_gifts',
        LEADERBOARD: 'leaderboard_view', // Database view
    },
    
    // Security Settings
    SECURITY: {
        MAX_REQUEST_RATE: 60, // requests per minute
        SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    }
};

// Initialize Telegram theme if available
if (window.Telegram && window.Telegram.WebApp) {
    CONFIG.TELEGRAM.THEME_PARAMS = window.Telegram.WebApp.themeParams;
    CONFIG.TELEGRAM.USER_DATA = window.Telegram.WebApp.initDataUnsafe?.user;
    CONFIG.TELEGRAM.VIEWPORT = window.Telegram.WebApp.viewportHeight;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Global access
window.CONFIG = CONFIG;