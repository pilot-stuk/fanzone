// Refactored Main Application
// Following SOLID principles with proper dependency injection

class FanZoneApplication {
    constructor(container) {
        this.container = container;
        this.currentPage = 'gifts';
        this.isInitialized = false;
        
        // Services will be injected
        this.logger = null;
        this.eventBus = null;
        this.authService = null;
        this.userService = null;
        this.giftService = null;
        this.platformAdapter = null;
        
        // UI Controllers
        this.giftsController = null;
        this.profileController = null;
        this.leaderboardController = null;
    }
    
    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('🚀 Starting FanZone Application...');
            
            // Show loading screen
            this.showLoading('Initializing FanZone...');
            
            // Initialize DI Container
            await this.container.initializeApp();
            
            // Get services from container
            this.injectServices();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Initialize UI
            await this.initializeUI();
            
            // Hide loading and show app
            this.hideLoading();
            this.showMainApp();
            
            this.isInitialized = true;
            
            this.logger.info('Application initialized successfully');
            this.showToast('Welcome to FanZone! 🎁', 'success');
            
            // Navigate to initial page
            this.navigateToPage(this.currentPage);
            
        } catch (error) {
            this.logger?.error('Application initialization failed', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Inject services from DI container
     */
    injectServices() {
        this.logger = this.container.get('logger');
        this.eventBus = this.container.get('eventBus');
        this.authService = this.container.get('authService');
        this.userService = this.container.get('userService');
        this.giftService = this.container.get('giftService');
        this.platformAdapter = this.container.get('platformAdapter');
        
        this.logger.debug('Services injected successfully');
    }
    
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Authentication events
        this.eventBus.subscribe('auth:success', (data) => {
            this.handleAuthSuccess(data);
        });
        
        this.eventBus.subscribe('auth:failed', (data) => {
            this.handleAuthFailed(data);
        });
        
        this.eventBus.subscribe('auth:logout', () => {
            this.handleLogout();
        });
        
        // User events
        this.eventBus.subscribe('user:points:updated', (data) => {
            this.updateUserDisplay();
        });
        
        // Gift events
        this.eventBus.subscribe('gift:purchased', (data) => {
            this.handleGiftPurchased(data);
        });
        
        // Navigation events
        this.eventBus.subscribe('navigation:back', () => {
            this.handleBackNavigation();
        });
        
        // Telegram events
        this.eventBus.subscribe('mainbutton:clicked', () => {
            this.handleMainButtonClick();
        });
        
        this.eventBus.subscribe('theme:changed', () => {
            this.applyTheme();
        });
        
        // Network events
        window.addEventListener('online', () => {
            this.eventBus.emit('network:online');
            this.showToast('Connection restored', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.eventBus.emit('network:offline');
            this.showToast('No internet connection', 'warning');
        });
        
        // Error handling
        window.addEventListener('error', (event) => {
            this.logger.error('Global error', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('Unhandled promise rejection', event.reason);
        });
    }
    
    /**
     * Initialize UI components
     */
    async initializeUI() {
        // Setup navigation
        this.setupNavigation();
        
        // Initialize controllers
        this.initializeControllers();
        
        // Apply theme
        this.applyTheme();
        
        // Update user display
        this.updateUserDisplay();
        
        // Setup Telegram UI elements
        this.setupTelegramUI();
    }
    
    /**
     * Initialize page controllers
     */
    initializeControllers() {
        // Create controllers with injected services
        this.giftsController = new window.GiftsController(
            this.giftService,
            this.userService,
            this.logger,
            this.eventBus
        );
        
        this.profileController = new window.ProfileController(
            this.userService,
            this.giftService,
            this.logger,
            this.eventBus
        );
        
        this.leaderboardController = new window.LeaderboardController(
            this.userService,
            this.logger,
            this.eventBus
        );
    }
    
    /**
     * Setup navigation
     */
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this.navigateToPage(page);
                this.platformAdapter.sendHapticFeedback('light');
            });
        });
    }
    
    /**
     * Navigate to a page
     */
    navigateToPage(page) {
        // Update navigation UI
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        // Update page visibility
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `${page}-page`);
        });
        
        this.currentPage = page;
        
        // Initialize page content
        this.initializePage(page);
        
        // Track navigation
        this.eventBus.emit('navigation:page:changed', { page });
        
        this.logger.debug('Navigated to page', { page });
    }
    
    /**
     * Initialize specific page
     */
    async initializePage(page) {
        try {
            switch (page) {
                case 'gifts':
                    await this.giftsController?.initialize();
                    break;
                case 'profile':
                    await this.profileController?.initialize();
                    break;
                case 'leaderboard':
                    await this.leaderboardController?.initialize();
                    break;
            }
        } catch (error) {
            this.logger.error(`Failed to initialize ${page} page`, error);
            this.showToast(`Failed to load ${page}`, 'error');
        }
    }
    
    /**
     * Setup Telegram-specific UI
     */
    setupTelegramUI() {
        const user = this.authService.getCurrentUser();
        
        if (this.platformAdapter.isAvailable() && user) {
            // Setup main button for new users
            if (!user.total_gifts || user.total_gifts === 0) {
                this.platformAdapter.showMainButton('🎁 Start Collecting!', () => {
                    this.navigateToPage('gifts');
                    this.platformAdapter.hideMainButton();
                });
            }
        }
    }
    
    /**
     * Handle authentication success
     */
    handleAuthSuccess(data) {
        this.logger.info('Authentication successful', { userId: data.user?.telegram_id });
        this.updateUserDisplay();
    }
    
    /**
     * Handle authentication failure
     */
    handleAuthFailed(data) {
        this.logger.error('Authentication failed', null, data);
        this.showError('Authentication failed. Please refresh and try again.');
    }
    
    /**
     * Handle logout
     */
    handleLogout() {
        this.logger.info('User logged out');
        window.location.reload();
    }
    
    /**
     * Handle gift purchased
     */
    handleGiftPurchased(data) {
        this.updateUserDisplay();
        
        // Refresh relevant pages
        if (this.currentPage === 'profile') {
            this.profileController?.refresh();
        }
        
        if (this.currentPage === 'leaderboard') {
            this.leaderboardController?.refresh();
        }
        
        this.showToast(`🎉 ${data.giftName} added to your collection!`, 'success');
        this.platformAdapter.sendHapticFeedback('success');
    }
    
    /**
     * Handle back navigation
     */
    handleBackNavigation() {
        if (this.currentPage !== 'gifts') {
            this.navigateToPage('gifts');
        } else {
            this.platformAdapter.close();
        }
    }
    
    /**
     * Handle main button click
     */
    handleMainButtonClick() {
        const user = this.authService.getCurrentUser();
        
        if (!user) {
            // Authenticate first
            this.authService.authenticate().then(() => {
                this.navigateToPage('gifts');
            }).catch(error => {
                this.logger.error('Authentication failed on main button click', error);
                this.showToast('Please login to start collecting gifts', 'error');
            });
        } else {
            // Navigate to gifts page
            this.navigateToPage('gifts');
        }
    }
    
    /**
     * Update user display
     */
    updateUserDisplay() {
        const user = this.authService.getCurrentUser();
        
        if (!user) return;
        
        const userNameElement = document.getElementById('user-name');
        const userPointsElement = document.getElementById('user-points');
        
        if (userNameElement) {
            userNameElement.textContent = this.truncateText(user.username || 'User', 15);
        }
        
        if (userPointsElement) {
            userPointsElement.textContent = `${this.formatPoints(user.points)} pts`;
        }
    }
    
    /**
     * Apply theme
     */
    applyTheme() {
        const themeParams = this.platformAdapter.getThemeParams();
        
        if (themeParams) {
            const root = document.documentElement;
            
            Object.keys(themeParams).forEach(key => {
                if (key !== 'colorScheme') {
                    root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, themeParams[key]);
                }
            });
        }
    }
    
    /**
     * Handle initialization error
     */
    handleInitializationError(error) {
        this.hideLoading();
        
        let message = 'Failed to initialize application';
        
        if (error.message.includes('auth')) {
            message = 'Authentication failed. Please ensure you\'re opening this from Telegram.';
        } else if (error.message.includes('network')) {
            message = 'Network error. Please check your connection.';
        }
        
        this.showError(message, () => {
            window.location.reload();
        });
    }
    
    // UI Helper Methods
    
    showLoading(message = 'Loading...') {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
            const textElement = loadingElement.querySelector('p');
            if (textElement) {
                textElement.textContent = message;
            }
        }
    }
    
    hideLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
    
    showMainApp() {
        const mainApp = document.getElementById('main-app');
        if (mainApp) {
            mainApp.style.display = 'block';
        }
    }
    
    showError(message, callback) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'flex';
            const textElement = document.getElementById('error-text');
            if (textElement) {
                textElement.textContent = message;
            }
            
            const retryButton = document.getElementById('retry-btn');
            if (retryButton && callback) {
                retryButton.onclick = callback;
            }
        }
    }
    
    showToast(message, type = 'info', duration = 3000) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to body
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }
    
    formatPoints(points) {
        return new Intl.NumberFormat().format(points || 0);
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}


// Create and export application instance
window.FanZoneApp = new FanZoneApplication(window.DIContainer);

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FanZoneApplication;
}