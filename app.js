// Refactored Main Application
// Following SOLID principles with proper dependency injection

class FanZoneApplication {
    constructor(container) {
        this.container = container;
        this.currentPage = 'gifts';
        this.isInitialized = false;
        this.isInitializing = false;
        this.initializationError = null;
        
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
        // Prevent multiple initialization attempts
        if (this.isInitialized) {
            console.warn('Application already initialized');
            return;
        }
        
        if (this.isInitializing) {
            console.warn('Application initialization already in progress');
            return;
        }
        
        this.isInitializing = true;
        this.initializationError = null;
        
        try {
            console.log('🚀 Starting FanZone Application...');
            
            // Show loading screen
            this.showLoading('Initializing FanZone...');
            
            // Get services from container (DIContainer should already be initialized)
            await this.injectServices();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Initialize UI
            await this.initializeUI();
            
            // Hide loading and show app
            this.hideLoading();
            this.showMainApp();
            
            this.isInitialized = true;
            this.isInitializing = false;
            
            this.logger.info('Application initialized successfully');
            
            // Navigate to initial page
            this.navigateToPage(this.currentPage);
            
            // Show welcome message after everything is loaded
            setTimeout(() => {
                this.showToast('Welcome to FanZone! 🎁', 'success');
            }, 500);
            
        } catch (error) {
            this.isInitializing = false;
            this.initializationError = error;
            this.logger?.error('Application initialization failed', error);
            this.handleInitializationError(error);
            throw error; // Re-throw to allow caller to handle
        }
    }
    
    /**
     * Inject services from DI container
     */
    async injectServices() {
        // Validate container is ready
        if (!this.container || !this.container.initialized) {
            throw new Error('DIContainer is not initialized');
        }
        
        try {
            this.logger = this.container.get('logger');
            this.eventBus = this.container.get('eventBus');
            this.authService = this.container.get('authService');
            this.userService = this.container.get('userService');
            this.giftService = this.container.get('giftService');
            this.platformAdapter = this.container.get('platformAdapter');
            
            // Validate critical services are available (now async)
            await this.validateCriticalServices();
            
            this.logger.debug('Services injected successfully');
        } catch (error) {
            console.error('Failed to inject services:', error);
            throw new Error(`Service injection failed: ${error.message}`);
        }
    }
    
    /**
     * Validate that critical services are available and functional
     */
    async validateCriticalServices() {
        // Check if validation is disabled for debugging
        if (localStorage.getItem('fanzone_disable_validation') === 'true' || 
            window.location.search.includes('disable_validation=true')) {
            console.warn('⚠️ Service validation disabled for debugging');
            return;
        }
        
        // Use ServiceValidator for comprehensive validation
        if (!window.ServiceValidator) {
            console.warn('ServiceValidator is not available, using basic validation');
            this.basicServiceValidation();
            return;
        }
        
        // Wait for EventBus to be ready if it has a waitForReady method
        if (this.eventBus && typeof this.eventBus.waitForReady === 'function') {
            try {
                await this.eventBus.waitForReady(2000); // 2 second timeout
                console.log('📢 EventBus is ready for validation');
            } catch (error) {
                console.warn('EventBus ready timeout, proceeding with validation:', error);
            }
        }
        
        const requiredServices = [
            { name: 'Logger', service: this.logger },
            { name: 'EventBus', service: this.eventBus },
            { name: 'AuthService', service: this.authService },
            { name: 'UserService', service: this.userService },
            { name: 'GiftService', service: this.giftService },
            { name: 'PlatformAdapter', service: this.platformAdapter }
        ];
        
        // Validate all services with better error handling
        const validation = window.ServiceValidator.validateServices(requiredServices);
        
        if (!validation.valid) {
            // Log detailed error information for debugging
            console.error('Service validation failed:', validation.errors);
            
            // Check if it's just EventBus timing issues
            const eventBusErrors = validation.errors.filter(e => e.service === 'EventBus');
            const otherErrors = validation.errors.filter(e => e.service !== 'EventBus');
            
            if (eventBusErrors.length > 0 && otherErrors.length === 0) {
                // Only EventBus errors, try to proceed with basic validation
                console.warn('Only EventBus validation failed, checking basic functionality...');
                
                if (this.eventBus && typeof this.eventBus.emit === 'function' && typeof this.eventBus.subscribe === 'function') {
                    console.warn('EventBus has required methods, proceeding...');
                } else {
                    const errorDetails = validation.errors.map(e => `${e.service}: ${e.error}`).join('; ');
                    throw new Error(`Critical service validation failed: ${errorDetails}`);
                }
            } else {
                const errorDetails = validation.errors.map(e => `${e.service}: ${e.error}`).join('; ');
                throw new Error(`Service validation failed: ${errorDetails}`);
            }
        }
        
        // Validate critical methods with error handling
        try {
            window.ServiceValidator.validateMethod(this.eventBus, 'emit', 'EventBus');
            window.ServiceValidator.validateMethod(this.eventBus, 'subscribe', 'EventBus');
            window.ServiceValidator.validateMethod(this.logger, 'info', 'Logger');
            window.ServiceValidator.validateMethod(this.logger, 'error', 'Logger');
        } catch (methodError) {
            console.error('Method validation failed:', methodError);
            
            // Check if the methods actually exist and are callable
            if (typeof this.eventBus?.emit !== 'function' || typeof this.eventBus?.subscribe !== 'function') {
                throw new Error('EventBus critical methods are not available');
            }
            
            if (typeof this.logger?.info !== 'function' || typeof this.logger?.error !== 'function') {
                throw new Error('Logger critical methods are not available');
            }
            
            // Methods exist, so proceed without proxies
            console.warn('Method validation failed but methods are available, proceeding without proxies');
        }
        
        // Create validated proxies for services to catch runtime errors (optional)
        try {
            this.logger = window.ServiceValidator.createValidatedProxy(this.logger, 'Logger');
            this.eventBus = window.ServiceValidator.createValidatedProxy(this.eventBus, 'EventBus');
            console.log('✅ Service proxies created successfully');
        } catch (proxyError) {
            console.warn('Failed to create service proxies, using original services:', proxyError);
        }
        
        console.log('✅ Critical services validation completed');
    }
    
    /**
     * Basic service validation without ServiceValidator
     */
    basicServiceValidation() {
        const services = [
            { name: 'logger', service: this.logger },
            { name: 'eventBus', service: this.eventBus },
            { name: 'authService', service: this.authService },
            { name: 'userService', service: this.userService },
            { name: 'giftService', service: this.giftService },
            { name: 'platformAdapter', service: this.platformAdapter }
        ];
        
        const missing = services.filter(({ service }) => !service);
        
        if (missing.length > 0) {
            const missingNames = missing.map(({ name }) => name).join(', ');
            throw new Error(`Missing critical services: ${missingNames}`);
        }
        
        // Check critical methods
        if (typeof this.eventBus?.emit !== 'function' || typeof this.eventBus?.subscribe !== 'function') {
            throw new Error('EventBus is missing critical methods');
        }
        
        if (typeof this.logger?.info !== 'function' || typeof this.logger?.error !== 'function') {
            throw new Error('Logger is missing critical methods');
        }
        
        console.log('✅ Basic service validation completed');
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
        await this.setupTelegramUI();
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
     * Setup Telegram-specific UI - Enhanced with async handling
     */
    async setupTelegramUI() {
        try {
            const user = this.authService.getCurrentUser();
            
            if (this.platformAdapter.isAvailable() && user) {
                // Setup main button for new users
                if (!user.total_gifts || user.total_gifts === 0) {
                    await this.platformAdapter.showMainButton('🎁 Start Collecting!', async () => {
                        await this.handleMainButtonClick();
                    });
                }
                
                // Log Telegram UI setup
                this.logger.debug('Telegram UI setup completed', {
                    mainButtonShown: !user.total_gifts || user.total_gifts === 0,
                    userId: user.id
                });
            } else {
                this.logger.debug('Telegram UI setup skipped', {
                    platformAvailable: this.platformAdapter.isAvailable(),
                    userAvailable: !!user
                });
            }
            
        } catch (error) {
            this.logger.error('Failed to setup Telegram UI:', error);
            
            // Use ErrorHandler if available
            if (window.ErrorHandler) {
                window.ErrorHandler.logError(error, 'FanZoneApp.setupTelegramUI', {
                    category: 'ui_error',
                    userMessage: 'Failed to setup Telegram interface'
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
     * Handle main button click - Enhanced with database validation
     */
    async handleMainButtonClick() {
        try {
            this.logger.info('Main button clicked - starting enhanced authentication flow');
            
            // Show loading state on main button with timeout protection
            await this.platformAdapter.setMainButtonLoading(true, 15000);
            
            // Always authenticate to ensure database registration
            try {
                this.logger.info('Starting authentication with database validation...');
                
                // Authenticate user (this will create user in database if needed)
                const user = await this.authService.authenticate();
                
                if (!user) {
                    throw new Error('Authentication returned null user');
                }
                
                // Enhanced validation: Verify user is actually in database
                const isRegistered = await this.validateUserRegistration(user);
                
                if (!isRegistered) {
                    this.logger.warn('User not properly registered in database, attempting fix...');
                    await this.ensureUserInDatabase(user);
                }
                
                // Test database connection and user permissions
                await this.testUserDatabaseAccess(user);
                
                // Success - navigate to gifts
                this.navigateToPage('gifts');
                
                // Show success message
                this.showToast('🎉 Welcome! You can now collect gifts!', 'success');
                
                // Hide loading and main button after successful navigation
                await this.platformAdapter.setMainButtonLoading(false);
                await this.platformAdapter.hideMainButton();
                
                this.logger.info('User registration and navigation completed successfully', {
                    userId: user.telegram_id,
                    isLocal: !!user.is_local
                });
                
            } catch (authError) {
                this.logger.error('Enhanced authentication failed', authError);
                
                // Provide specific error messages
                let errorMessage = 'Authentication failed. ';
                if (authError.message.includes('database')) {
                    errorMessage += 'Database connection issue. Please try again.';
                } else if (authError.message.includes('permission')) {
                    errorMessage += 'Permission issue. Contact support.';
                } else {
                    errorMessage += 'Please refresh and try again.';
                }
                
                this.showToast(errorMessage, 'error');
                await this.platformAdapter.setMainButtonLoading(false);
            }
            
        } catch (error) {
            this.logger.error('Main button click handling failed', error);
            this.showToast('Something went wrong. Please refresh and try again.', 'error');
            
            // Ensure loading state is cleared
            try {
                await this.platformAdapter.setMainButtonLoading(false);
            } catch (cleanupError) {
                console.warn('Failed to clear main button loading state:', cleanupError);
            }
        }
    }
    
    /**
     * Validate user is properly registered in database
     */
    async validateUserRegistration(user) {
        try {
            if (!user || !user.telegram_id) {
                return false;
            }
            
            // Skip validation for local users (offline mode)
            if (user.is_local) {
                this.logger.info('User is in local mode, skipping database validation');
                return true;
            }
            
            // Try to get user profile from database
            const userService = this.container.get('userService');
            const profile = await userService.getUserProfile(user.telegram_id);
            
            return !!(profile && profile.success && profile.user);
            
        } catch (error) {
            this.logger.warn('User registration validation failed', error);
            return false;
        }
    }
    
    /**
     * Ensure user exists in database
     */
    async ensureUserInDatabase(user) {
        try {
            if (!user || !user.telegram_id) {
                throw new Error('Invalid user data for database registration');
            }
            
            this.logger.info('Ensuring user exists in database', { userId: user.telegram_id });
            
            // Get repository and try to create user
            const repository = this.container.get('repository');
            
            if (!repository || repository.constructor.name === 'MockRepository') {
                this.logger.warn('Using mock repository - user will not be saved to database');
                return true;
            }
            
            // Try to create user using the database function
            const result = await repository.execute('create_user', {
                p_telegram_id: user.telegram_id,
                p_username: user.username || `User${user.telegram_id}`,
                p_first_name: user.first_name || null,
                p_last_name: user.last_name || null
            });
            
            if (result && result.success) {
                this.logger.info('User successfully ensured in database', {
                    userId: user.telegram_id,
                    created: result.created,
                    message: result.message
                });
                return true;
            } else {
                throw new Error(`Database user creation failed: ${result?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            this.logger.error('Failed to ensure user in database', error);
            throw error;
        }
    }
    
    /**
     * Test user's database access and permissions
     */
    async testUserDatabaseAccess(user) {
        try {
            if (!user || user.is_local) {
                return true; // Skip test for local users
            }
            
            this.logger.info('Testing user database access', { userId: user.telegram_id });
            
            // Test 1: Can access gifts
            const giftService = this.container.get('giftService');
            await giftService.getAvailableGifts();
            
            // Test 2: Can access user profile
            const userService = this.container.get('userService');
            await userService.getUserProfile(user.telegram_id);
            
            this.logger.info('Database access test successful');
            return true;
            
        } catch (error) {
            this.logger.warn('Database access test failed', error);
            // Don't throw error, just log warning
            return false;
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
        
        // Use ErrorHandler for comprehensive error handling
        if (window.ErrorHandler) {
            const errorInfo = window.ErrorHandler.handleInitError(error, 'FanZoneApp.initialization');
            
            // Show error with recovery option
            this.showError(errorInfo.userMessage, () => {
                if (errorInfo.recoveryPossible && errorInfo.recoveryAction) {
                    window.ErrorHandler.executeRecovery(errorInfo.recoveryAction);
                } else {
                    window.location.reload();
                }
            });
        } else {
            // Fallback error handling
            let message = 'Failed to initialize application';
            
            if (error.message.includes('auth')) {
                message = 'Authentication failed. Please ensure you\'re opening this from Telegram.';
            } else if (error.message.includes('network')) {
                message = 'Network error. Please check your connection.';
            } else if (error.message.includes('service')) {
                message = 'Some services failed to load. Please refresh and try again.';
            }
            
            this.showError(message, () => {
                window.location.reload();
            });
        }
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
        // Remove existing toasts to prevent stacking
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => {
            toast.classList.add('animate-out');
            setTimeout(() => toast.remove(), 300);
        });
        
        // Create enhanced toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add accessibility attributes
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');
        
        // Add to body
        document.body.appendChild(toast);
        
        // Enhanced animation with proper timing
        requestAnimationFrame(() => {
            toast.classList.add('animate-in');
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);
        });
        
        // Auto-remove after duration with smooth exit animation
        const removeTimeout = setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('animate-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, duration);
        
        // Allow manual dismissal by clicking
        toast.addEventListener('click', () => {
            clearTimeout(removeTimeout);
            toast.classList.remove('show');
            toast.classList.add('animate-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        });
        
        // Add cursor pointer to indicate clickability
        toast.style.cursor = 'pointer';
    }
    
    formatPoints(points) {
        return new Intl.NumberFormat().format(points || 0);
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}


// Application will be created after services are initialized
window.FanZoneApp = null;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FanZoneApplication;
}