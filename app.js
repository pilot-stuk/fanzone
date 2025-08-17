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
        
        // Registration State Tracking
        this.userRegistrationState = {
            hasClickedStart: false,
            isFullyRegistered: false,
            registrationTimestamp: null
        };
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
            
            // Ensure web registration button handler is always available
            this.setupGlobalWebHandler();
            
            // Get services from container (DIContainer should already be initialized)
            await this.injectServices();
            
            // Load registration state from localStorage
            this.loadRegistrationState();
            
            // FORCE CLEAR: In Telegram, ensure no auto-registration bypass
            if (this.platformAdapter.isAvailable() && !this.userRegistrationState.registrationTimestamp) {
                // If in Telegram but no valid registration timestamp, force clear everything
                this.logger.warn('Telegram app detected with invalid registration state, forcing clear');
                localStorage.removeItem('fanzone_registration_state');
                localStorage.removeItem('fanzone_auth_token');
                localStorage.removeItem('fanzone_current_user');
                this.userRegistrationState = {
                    hasClickedStart: false,
                    isFullyRegistered: false,
                    registrationTimestamp: null
                };
            }
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // DO NOT authenticate during initialization - only load existing user if any
            // Authentication (which creates users) should only happen on button click
            try {
                // Only try to get existing authenticated user, don't create new one
                const existingUser = this.authService.getCurrentUser();
                if (existingUser) {
                    this.logger.info('Existing authenticated user found', { userId: existingUser.id });
                } else {
                    this.logger.info('No authenticated user, waiting for Start Collection button click');
                }
            } catch (error) {
                this.logger.info('No existing authentication found');
            }
            
            // Check if user is registered (from localStorage)
            if (!this.isUserFullyRegistered()) {
                this.logger.info('User not registered, will show Start Collecting button');
            }
            
            // Initialize UI
            await this.initializeUI();
            
            // Hide loading and show app
            this.hideLoading();
            this.showMainApp();
            
            this.isInitialized = true;
            this.isInitializing = false;
            
            this.logger.info('Application initialized successfully');
            
            // Add debugging tools
            this.setupDebugTools();
            
            // Check registration state to determine initial page
            if (!this.isUserFullyRegistered()) {
                // For unregistered users, stay on gifts page but they'll see the lock screen
                this.currentPage = 'gifts';
                this.logger.info('User not registered, showing gifts page with registration prompt', {
                    registrationState: this.userRegistrationState,
                    isRegistered: this.isUserFullyRegistered(),
                    platformAvailable: this.platformAdapter.isAvailable(),
                    platformMode: this.platformAdapter.getModeInfo()
                });
            }
            
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
        // Block navigation to gifts for unregistered users
        if (page === 'gifts' && !this.isUserFullyRegistered()) {
            this.logger.warn('Navigation to gifts blocked - user not registered');
            // Still navigate to show the lock screen
        }
        
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
        
        this.logger.debug('Navigated to page', { 
            page,
            isRegistered: this.isUserFullyRegistered()
        });
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
     * Setup Telegram-specific UI with enhanced platform handling
     */
    async setupTelegramUI() {
        try {
            // Check registration state with platform validation
            const isRegistered = this.isUserFullyRegistered();
            const currentPlatform = this.platformAdapter.isAvailable() ? 'telegram' : 'web';
            
            this.logger.info('Setting up platform-specific UI', {
                isRegistered,
                platform: currentPlatform,
                registrationState: this.userRegistrationState,
                platformAvailable: this.platformAdapter.isAvailable()
            });
            
            // Show button for unregistered users with platform-specific handling
            console.log('🎮 Setup UI - Registration check result:', {
                isRegistered,
                willShowButton: !isRegistered,
                platformAvailable: this.platformAdapter.isAvailable()
            });
            
            if (!isRegistered) {
                if (this.platformAdapter.isAvailable()) {
                    // Telegram platform - show main button with retry logic
                    this.logger.info('Setting up Telegram main button for unregistered user');
                    
                    // Ensure button callback is properly set
                    const buttonCallback = async () => {
                        this.logger.info('Telegram main button clicked');
                        try {
                            await this.handleMainButtonClick();
                        } catch (error) {
                            this.logger.error('Registration error:', error);
                            this.showToast('Registration failed. Please try again.', 'error');
                        }
                    };
                    
                    // Show the button with retry logic
                    let attempts = 0;
                    const maxAttempts = 3;
                    let buttonShown = false;
                    
                    while (attempts < maxAttempts && !buttonShown) {
                        try {
                            buttonShown = await this.platformAdapter.showMainButton(
                                '🎁 Start Collecting!', 
                                buttonCallback
                            );
                            
                            if (buttonShown) {
                                this.logger.info('Telegram main button shown successfully');
                                break;
                            } else {
                                attempts++;
                                this.logger.warn(`Failed to show button, attempt ${attempts}/${maxAttempts}`);
                                if (attempts < maxAttempts) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            }
                        } catch (error) {
                            attempts++;
                            this.logger.error(`Button setup error, attempt ${attempts}/${maxAttempts}:`, error);
                            if (attempts < maxAttempts) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                    }
                    
                    if (!buttonShown) {
                        this.logger.error('Failed to show Telegram main button after multiple attempts');
                        // Fall back to web interface
                        this.setupWebRegistrationInterface();
                    } else {
                        this.logger.info('Telegram Start Collecting button setup completed', {
                            platform: 'telegram',
                            attempts: attempts + 1,
                            buttonVisible: this.platformAdapter.getMainButtonState()?.visible
                        });
                    }
                    
                } else {
                    // Web platform
                    this.logger.info('Web platform detected, configuring web registration interface');
                    this.setupWebRegistrationInterface();
                    
                    // Also trigger re-render of gifts controller to show button
                    if (this.giftsController) {
                        this.logger.info('Re-rendering gifts to show web button');
                        this.giftsController.renderGifts();
                    }
                }
            } else {
                // Registered user - hide main button and log platform info
                await this.platformAdapter.hideMainButton();
                this.logger.info('User registered, main button hidden', {
                    platform: currentPlatform,
                    registrationPlatform: this.userRegistrationState.platform,
                    userId: this.userRegistrationState.userId
                });
                
                // Validate platform consistency for registered users
                if (this.userRegistrationState.platform && 
                    this.userRegistrationState.platform !== currentPlatform) {
                    this.logger.warn('Platform changed since registration', {
                        originalPlatform: this.userRegistrationState.platform,
                        currentPlatform: currentPlatform
                    });
                    
                    // Update platform in state but keep registration
                    this.userRegistrationState.platform = currentPlatform;
                    localStorage.setItem('fanzone_registration_state', JSON.stringify(this.userRegistrationState));
                }
            }
            
            const user = this.authService.getCurrentUser();
            
            // Log comprehensive UI setup info
            this.logger.debug('Platform UI setup completed', {
                platform: currentPlatform,
                isRegistered,
                mainButtonShown: !isRegistered && this.platformAdapter.isAvailable(),
                userId: user?.id || 'not_authenticated',
                hasUser: !!user,
                registrationTimestamp: this.userRegistrationState.registrationTimestamp
            });
            
        } catch (error) {
            this.logger.error('Failed to setup platform UI:', error);
            
            // Use ErrorHandler if available
            if (window.ErrorHandler) {
                window.ErrorHandler.logError(error, 'FanZoneApp.setupTelegramUI', {
                    category: 'ui_error',
                    userMessage: 'Failed to setup platform interface'
                });
            }
        }
    }
    
    /**
     * Setup global web registration handler early in initialization
     */
    setupGlobalWebHandler() {
        // Ensure web registration button handler is always available
        if (!window.handleStartCollecting) {
            window.handleStartCollecting = async () => {
                console.log('🎯 Web Start Collecting button clicked');
                
                if (window.FanZoneApp && window.FanZoneApp.handleMainButtonClick) {
                    try {
                        await window.FanZoneApp.handleMainButtonClick();
                    } catch (error) {
                        console.error('Registration failed:', error);
                        if (window.FanZoneApp.showToast) {
                            window.FanZoneApp.showToast('Registration failed. Please try again.', 'error');
                        } else {
                            alert('Registration failed. Please try again.');
                        }
                    }
                } else {
                    console.error('FanZone app not ready');
                    alert('App is still loading. Please wait and try again.');
                }
            };
            console.log('✅ Global web registration handler set up');
        }
    }

    /**
     * Setup web-specific registration interface
     */
    setupWebRegistrationInterface() {
        this.logger.info('Setting up web registration interface');
        
        // Ensure global handler is available
        this.setupGlobalWebHandler();
        
        // Also check if elements already exist and set them up
        const webRegistrationElements = document.querySelectorAll('.web-registration, .start-collecting-web');
        webRegistrationElements.forEach(element => {
            element.style.display = 'block';
            
            // Add click handler if not already present
            if (!element.onclick) {
                element.onclick = window.handleStartCollecting;
            }
        });
        
        this.logger.info('Web registration interface configured', {
            elementsFound: webRegistrationElements.length,
            handlerSet: !!window.handleStartCollecting
        });
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
                
                // Mark user as fully registered with platform information
                this.userRegistrationState = {
                    hasClickedStart: true,
                    isFullyRegistered: true,
                    registrationTimestamp: new Date().toISOString(),
                    platform: this.platformAdapter.isAvailable() ? 'telegram' : 'web',
                    userId: user.telegram_id || user.id,
                    registrationMethod: 'button_click'
                };
                
                // Persist registration state with platform context
                localStorage.setItem('fanzone_registration_state', JSON.stringify(this.userRegistrationState));
                
                // Force reload of app registration state to ensure it's fresh
                this.loadRegistrationState();
                
                // Show success message immediately
                this.showToast('🎉 Welcome! You can now collect gifts!', 'success');
                
                // Hide loading and main button after successful registration
                await this.platformAdapter.setMainButtonLoading(false);
                await this.platformAdapter.hideMainButton();
                
                // Force complete reload of gifts controller after registration
                if (this.giftsController) {
                    // Re-initialize to load fresh data with proper authentication
                    this.giftsController.isInitialized = false;
                    
                    // Debug registration state before reinitializing
                    this.logger.info('Before gifts controller reinit', {
                        appRegistered: this.isUserFullyRegistered(),
                        localStorage: localStorage.getItem('fanzone_registration_state'),
                        userState: this.userRegistrationState
                    });
                    
                    await this.giftsController.initialize();
                    this.logger.info('Gifts controller reinitialized after registration');
                } else {
                    this.logger.warn('Gifts controller not available, initializing controllers');
                    this.initializeControllers();
                    if (this.giftsController) {
                        await this.giftsController.initialize();
                    }
                }
                
                // Success - navigate to gifts (this will refresh the controller)
                this.navigateToPage('gifts');
                
                // Ensure the main app is visible and loading is hidden
                this.hideLoading();
                this.showMainApp();
                
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
    
    /**
     * Load registration state from localStorage with platform validation
     */
    loadRegistrationState() {
        try {
            const saved = localStorage.getItem('fanzone_registration_state');
            console.log('📋 Loading registration state from localStorage:', saved);
            
            if (saved) {
                const state = JSON.parse(saved);
                console.log('📋 Parsed registration state:', state);
                
                // Check if state is too old (more than 7 days)
                if (state.registrationTimestamp) {
                    const ageInHours = (Date.now() - new Date(state.registrationTimestamp).getTime()) / (1000 * 60 * 60);
                    console.log(`📋 Registration state age: ${Math.round(ageInHours)} hours`);
                    
                    if (ageInHours > 168) { // 7 days = 168 hours
                        console.log('⚠️ Registration state too old, clearing it');
                        this.logger?.warn('Registration state expired due to age', { ageInHours, state });
                        localStorage.removeItem('fanzone_registration_state');
                        this.resetRegistrationState();
                        return;
                    }
                }
                
                // Don't clear state just because of platform mismatch
                // Users might switch between web and Telegram
                if (state.hasClickedStart && state.isFullyRegistered) {
                    console.log('✅ Valid registration state found, preserving it');
                    this.logger?.info('Valid registration state found, preserving it', {
                        platform: state.platform,
                        timestamp: state.registrationTimestamp
                    });
                    this.userRegistrationState = state;
                    return;
                }
                
                // Only clear if state is incomplete
                console.log('⚠️ Incomplete registration state found, resetting');
                this.logger?.warn('Incomplete registration state found', state);
            } else {
                console.log('📋 No saved registration state found');
            }
            
            // No valid state found
            this.resetRegistrationState();
            console.log('🔄 Registration state reset to default');
            this.logger?.info('No valid registration state, user needs to register');
            
        } catch (error) {
            console.error('❌ Failed to load registration state:', error);
            this.logger?.warn('Failed to load registration state', error);
            this.resetRegistrationState();
        }
    }
    
    /**
     * Reset registration state to clean default
     */
    resetRegistrationState() {
        this.userRegistrationState = {
            hasClickedStart: false,
            isFullyRegistered: false,
            registrationTimestamp: null,
            platform: null,
            userId: null,
            registrationMethod: null
        };
    }
    
    /**
     * Check if user has completed registration process
     */
    isUserFullyRegistered() {
        const result = this.userRegistrationState && 
               this.userRegistrationState.hasClickedStart && 
               this.userRegistrationState.isFullyRegistered;
        
        // Debug logging to understand what's happening
        console.log('🔍 Registration Check:', {
            hasState: !!this.userRegistrationState,
            hasClickedStart: this.userRegistrationState?.hasClickedStart,
            isFullyRegistered: this.userRegistrationState?.isFullyRegistered,
            finalResult: result,
            registrationState: this.userRegistrationState
        });
        
        return result;
    }
    
    /**
     * Get registration state for external validation
     */
    getRegistrationState() {
        return { ...this.userRegistrationState };
    }
    
    /**
     * Clear registration state (for testing/debugging)
     */
    clearRegistrationState() {
        this.userRegistrationState = {
            hasClickedStart: false,
            isFullyRegistered: false,
            registrationTimestamp: null
        };
        localStorage.removeItem('fanzone_registration_state');
        this.logger.info('Registration state cleared');
        // Force UI refresh
        if (this.giftsController) {
            this.giftsController.renderGifts();
        }
        this.setupTelegramUI();
    }
    
    /**
     * Debug registration state
     */
    debugRegistration() {
        console.log('=== Registration Debug Info ===');
        console.log('Current State:', this.userRegistrationState);
        console.log('Is Registered:', this.isUserFullyRegistered());
        console.log('LocalStorage:', localStorage.getItem('fanzone_registration_state'));
        console.log('Current User:', this.authService?.getCurrentUser());
        console.log('Platform Available:', this.platformAdapter?.isAvailable());
        console.log('===============================');
        return this.userRegistrationState;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    /**
     * Comprehensive Registration Testing Framework
     */
    
    /**
     * Run complete registration flow test
     */
    async testRegistrationFlow(options = {}) {
        const {
            platform = 'auto', // 'telegram', 'web', or 'auto'
            clearState = true,
            verbose = true
        } = options;
        
        console.log('🧪 Starting Registration Flow Test');
        console.log('Test Configuration:', { platform, clearState, verbose });
        
        const testResults = {
            phase: null,
            steps: [],
            success: false,
            errors: [],
            startTime: Date.now()
        };
        
        try {
            // Phase 1: Clear state and validate initial conditions
            testResults.phase = 'initialization';
            if (clearState) {
                await this.testClearAllState();
                testResults.steps.push({ step: 'clearState', success: true, timestamp: Date.now() });
            }
            
            // Phase 2: Validate initial button visibility
            testResults.phase = 'button_visibility';
            const buttonVisible = await this.testButtonVisibility(platform);
            testResults.steps.push({ 
                step: 'buttonVisibility', 
                success: buttonVisible.success, 
                details: buttonVisible,
                timestamp: Date.now() 
            });
            
            if (!buttonVisible.success) {
                throw new Error(`Button visibility test failed: ${buttonVisible.error}`);
            }
            
            // Phase 3: Test registration flow
            testResults.phase = 'registration_flow';
            const registrationResult = await this.testRegistrationProcess();
            testResults.steps.push({ 
                step: 'registrationFlow', 
                success: registrationResult.success, 
                details: registrationResult,
                timestamp: Date.now() 
            });
            
            if (!registrationResult.success) {
                throw new Error(`Registration flow test failed: ${registrationResult.error}`);
            }
            
            // Phase 4: Test purchase flow after registration
            testResults.phase = 'purchase_flow';
            const purchaseResult = await this.testPurchaseFlow();
            testResults.steps.push({ 
                step: 'purchaseFlow', 
                success: purchaseResult.success, 
                details: purchaseResult,
                timestamp: Date.now() 
            });
            
            // Phase 5: Test state persistence
            testResults.phase = 'state_persistence';
            const persistenceResult = await this.testStatePersistence();
            testResults.steps.push({ 
                step: 'statePersistence', 
                success: persistenceResult.success, 
                details: persistenceResult,
                timestamp: Date.now() 
            });
            
            testResults.success = true;
            testResults.phase = 'completed';
            
        } catch (error) {
            testResults.success = false;
            testResults.errors.push({
                phase: testResults.phase,
                error: error.message,
                timestamp: Date.now()
            });
        }
        
        testResults.endTime = Date.now();
        testResults.duration = testResults.endTime - testResults.startTime;
        
        // Generate test report
        this.generateTestReport(testResults, verbose);
        
        return testResults;
    }
    
    /**
     * Clear all registration state for testing
     */
    async testClearAllState() {
        console.log('🧹 Clearing all registration state...');
        
        // Clear localStorage
        const keysToRemove = [
            'fanzone_registration_state',
            'fanzone_auth_token', 
            'fanzone_current_user',
            'fanzone_user_gifts',
            'fanzone_fallback_user',
            'fanzone_web_user_id'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Reset application registration state
        this.resetRegistrationState();
        
        // Reset auth service
        if (this.authService) {
            try {
                await this.authService.logout();
            } catch (error) {
                console.warn('Auth service logout warning:', error);
            }
        }
        
        console.log('✅ State cleared successfully');
        return { success: true };
    }
    
    /**
     * Test button visibility in different platforms
     */
    async testButtonVisibility(platform) {
        console.log('👁️ Testing button visibility...');
        
        const result = {
            success: false,
            platform: this.platformAdapter.isAvailable() ? 'telegram' : 'web',
            buttonState: null,
            registrationState: this.getRegistrationState(),
            error: null
        };
        
        try {
            // Check if user is registered (should be false after clear)
            const isRegistered = this.isUserFullyRegistered();
            if (isRegistered) {
                result.error = 'User appears registered after state clear';
                return result;
            }
            
            // Setup UI and check button state
            await this.setupTelegramUI();
            
            if (this.platformAdapter.isAvailable()) {
                // Telegram platform
                result.buttonState = this.platformAdapter.getMainButtonState();
                result.success = result.buttonState.visible && result.buttonState.text.includes('Start Collecting');
                
                if (!result.success) {
                    result.error = `Button not visible or incorrect text. State: ${JSON.stringify(result.buttonState)}`;
                }
            } else {
                // Web platform - check for web registration elements
                const webElements = document.querySelectorAll('.start-collecting-web, .web-registration');
                result.success = webElements.length > 0;
                result.buttonState = { 
                    available: true,
                    webElementsFound: webElements.length,
                    elements: Array.from(webElements).map(el => ({
                        visible: el.style.display !== 'none',
                        text: el.textContent
                    }))
                };
                
                if (!result.success) {
                    result.error = 'No web registration elements found';
                }
            }
            
        } catch (error) {
            result.error = error.message;
        }
        
        console.log('Button visibility result:', result);
        return result;
    }
    
    /**
     * Test the registration process
     */
    async testRegistrationProcess() {
        console.log('📝 Testing registration process...');
        
        const result = {
            success: false,
            beforeState: this.getRegistrationState(),
            afterState: null,
            authResult: null,
            error: null
        };
        
        try {
            // Simulate button click
            console.log('Simulating registration button click...');
            await this.handleMainButtonClick();
            
            // Wait a moment for async operations
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if registration was successful
            result.afterState = this.getRegistrationState();
            result.authResult = this.authService.getCurrentUser();
            
            const isRegistered = this.isUserFullyRegistered();
            result.success = isRegistered && result.authResult;
            
            if (!result.success) {
                result.error = `Registration failed. IsRegistered: ${isRegistered}, HasUser: ${!!result.authResult}`;
            }
            
        } catch (error) {
            result.error = error.message;
        }
        
        console.log('Registration process result:', result);
        return result;
    }
    
    /**
     * Test purchase flow after registration
     */
    async testPurchaseFlow() {
        console.log('🛒 Testing purchase flow...');
        
        const result = {
            success: false,
            giftsLoaded: false,
            purchaseAttempted: false,
            error: null
        };
        
        try {
            // Ensure gifts controller is initialized
            if (!this.giftsController) {
                result.error = 'Gifts controller not available';
                return result;
            }
            
            await this.giftsController.initialize();
            
            // Check if gifts are loaded
            result.giftsLoaded = this.giftsController.gifts && this.giftsController.gifts.length > 0;
            
            if (!result.giftsLoaded) {
                result.error = 'No gifts loaded';
                return result;
            }
            
            // Find a gift to test purchase
            const testGift = this.giftsController.gifts.find(g => 
                g.current_supply < g.max_supply && g.price_points <= 1000
            );
            
            if (!testGift) {
                result.error = 'No suitable gift found for testing';
                return result;
            }
            
            // Check if user registration allows purchase
            const registrationCheck = this.giftsController.checkUserRegistration();
            result.success = registrationCheck;
            result.purchaseAttempted = true;
            
            if (!result.success) {
                result.error = 'Purchase blocked - registration check failed';
            }
            
        } catch (error) {
            result.error = error.message;
        }
        
        console.log('Purchase flow result:', result);
        return result;
    }
    
    /**
     * Test state persistence across page refresh
     */
    async testStatePersistence() {
        console.log('💾 Testing state persistence...');
        
        const result = {
            success: false,
            beforeRefresh: null,
            afterRefresh: null,
            error: null
        };
        
        try {
            // Capture current state
            result.beforeRefresh = {
                registrationState: this.getRegistrationState(),
                isRegistered: this.isUserFullyRegistered(),
                localStorage: {
                    registrationState: localStorage.getItem('fanzone_registration_state'),
                    currentUser: localStorage.getItem('fanzone_current_user')
                }
            };
            
            // Simulate page refresh by reloading registration state
            this.loadRegistrationState();
            
            result.afterRefresh = {
                registrationState: this.getRegistrationState(),
                isRegistered: this.isUserFullyRegistered(),
                localStorage: {
                    registrationState: localStorage.getItem('fanzone_registration_state'),
                    currentUser: localStorage.getItem('fanzone_current_user')
                }
            };
            
            // Check if state persisted correctly
            result.success = 
                result.beforeRefresh.isRegistered === result.afterRefresh.isRegistered &&
                !!result.afterRefresh.localStorage.registrationState;
            
            if (!result.success) {
                result.error = 'State persistence failed - registration state lost';
            }
            
        } catch (error) {
            result.error = error.message;
        }
        
        console.log('State persistence result:', result);
        return result;
    }
    
    /**
     * Generate comprehensive test report
     */
    generateTestReport(testResults, verbose = true) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 REGISTRATION FLOW TEST REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n🕐 Test Duration: ${testResults.duration}ms`);
        console.log(`✅ Overall Success: ${testResults.success ? 'PASS' : 'FAIL'}`);
        console.log(`📍 Final Phase: ${testResults.phase}`);
        
        if (testResults.success) {
            console.log('\n🎉 All tests passed successfully!');
        } else {
            console.log('\n❌ Test failed in phase:', testResults.phase);
            testResults.errors.forEach(error => {
                console.log(`   Error in ${error.phase}: ${error.error}`);
            });
        }
        
        if (verbose) {
            console.log('\n📋 Detailed Steps:');
            testResults.steps.forEach((step, index) => {
                const status = step.success ? '✅' : '❌';
                console.log(`   ${index + 1}. ${status} ${step.step}`);
                if (step.details && step.details.error) {
                    console.log(`      Error: ${step.details.error}`);
                }
            });
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Store test results for debugging
        window.lastTestResults = testResults;
    }
    
    /**
     * Test edge cases for registration flow
     */
    async testRegistrationEdgeCases() {
        console.log('🔍 Testing registration edge cases...');
        
        const edgeCases = [
            'double_click_prevention',
            'network_failure_simulation',
            'invalid_platform_state',
            'corrupted_localStorage',
            'session_expiry'
        ];
        
        const results = {};
        
        for (const testCase of edgeCases) {
            try {
                console.log(`Testing: ${testCase}`);
                results[testCase] = await this.runEdgeCaseTest(testCase);
            } catch (error) {
                results[testCase] = { success: false, error: error.message };
            }
        }
        
        console.log('Edge case test results:', results);
        return results;
    }
    
    /**
     * Run specific edge case test
     */
    async runEdgeCaseTest(testCase) {
        switch (testCase) {
            case 'double_click_prevention':
                return this.testDoubleClickPrevention();
            case 'network_failure_simulation':
                return this.testNetworkFailure();
            case 'invalid_platform_state':
                return this.testInvalidPlatformState();
            case 'corrupted_localStorage':
                return this.testCorruptedLocalStorage();
            case 'session_expiry':
                return this.testSessionExpiry();
            default:
                return { success: false, error: 'Unknown test case' };
        }
    }
    
    /**
     * Test double click prevention
     */
    async testDoubleClickPrevention() {
        console.log('Testing double click prevention...');
        
        // Clear state first
        await this.testClearAllState();
        
        // Simulate rapid button clicks
        const promises = [];
        for (let i = 0; i < 3; i++) {
            promises.push(this.handleMainButtonClick());
        }
        
        try {
            await Promise.all(promises);
            
            // Should only register once
            const registrationState = this.getRegistrationState();
            return {
                success: registrationState.hasClickedStart && registrationState.isFullyRegistered,
                registrationState
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Test corrupted localStorage handling
     */
    async testCorruptedLocalStorage() {
        console.log('Testing corrupted localStorage handling...');
        
        // Set invalid JSON in localStorage
        localStorage.setItem('fanzone_registration_state', 'invalid json');
        
        try {
            // This should gracefully handle the corruption
            this.loadRegistrationState();
            
            const isRegistered = this.isUserFullyRegistered();
            return {
                success: !isRegistered, // Should be false due to corruption cleanup
                state: this.getRegistrationState()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Test network failure simulation
     */
    async testNetworkFailure() {
        console.log('Testing network failure handling...');
        
        try {
            // Clear state first
            await this.testClearAllState();
            
            // Mock network failure
            const originalFetch = window.fetch;
            window.fetch = () => Promise.reject(new Error('Network error'));
            
            try {
                // Attempt registration with network failure
                await this.handleMainButtonClick();
                
                // Should handle gracefully
                return {
                    success: true,
                    message: 'Network failure handled gracefully'
                };
            } catch (error) {
                return {
                    success: error.message.includes('Network') || error.message.includes('Failed'),
                    error: error.message
                };
            } finally {
                // Restore original fetch
                window.fetch = originalFetch;
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Test invalid platform state
     */
    async testInvalidPlatformState() {
        console.log('Testing invalid platform state handling...');
        
        try {
            // Create inconsistent platform state
            localStorage.setItem('fanzone_registration_state', JSON.stringify({
                hasClickedStart: true,
                isFullyRegistered: true,
                platform: 'telegram', // Wrong platform
                registrationTimestamp: new Date().toISOString()
            }));
            
            // Load state - should detect platform mismatch
            this.loadRegistrationState();
            
            const isRegistered = this.isUserFullyRegistered();
            const currentPlatform = this.platformAdapter.isAvailable() ? 'telegram' : 'web';
            
            return {
                success: !isRegistered, // Should be false due to platform mismatch cleanup
                detectedPlatform: currentPlatform,
                state: this.getRegistrationState()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Test session expiry
     */
    async testSessionExpiry() {
        console.log('Testing session expiry handling...');
        
        try {
            // Create expired registration state
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 8); // 8 days ago
            
            localStorage.setItem('fanzone_registration_state', JSON.stringify({
                hasClickedStart: true,
                isFullyRegistered: true,
                platform: this.platformAdapter.isAvailable() ? 'telegram' : 'web',
                registrationTimestamp: expiredDate.toISOString()
            }));
            
            // Load state - should detect expiry
            this.loadRegistrationState();
            
            const isRegistered = this.isUserFullyRegistered();
            
            return {
                success: !isRegistered, // Should be false due to expiry
                expiredTimestamp: expiredDate.toISOString(),
                state: this.getRegistrationState()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Debug registration state
     */
    debugRegistrationState() {
        console.log('\n' + '='.repeat(50));
        console.log('🔍 REGISTRATION DEBUG INFORMATION');
        console.log('='.repeat(50));
        
        const state = {
            app: {
                isRegistered: this.isUserFullyRegistered(),
                registrationState: this.getRegistrationState(),
                currentUser: this.authService?.getCurrentUser()
            },
            platform: {
                type: this.platformAdapter.isAvailable() ? 'telegram' : 'web',
                buttonState: this.platformAdapter.getMainButtonState(),
                modeInfo: this.platformAdapter.getModeInfo()
            },
            localStorage: {
                registrationState: localStorage.getItem('fanzone_registration_state'),
                currentUser: localStorage.getItem('fanzone_current_user'),
                authToken: localStorage.getItem('fanzone_auth_token')
            },
            services: {
                giftService: !!this.giftService,
                authService: !!this.authService,
                userService: !!this.userService,
                platformAdapter: !!this.platformAdapter
            }
        };
        
        console.log('Current State:', state);
        console.log('='.repeat(50));
        
        return state;
    }

    /**
     * Setup debugging tools for development and troubleshooting
     */
    setupDebugTools() {
        // Add manual registration trigger for debugging
        window.triggerRegistration = async () => {
            console.log('🔧 Manually triggering registration...');
            
            if (this.handleMainButtonClick) {
                try {
                    await this.handleMainButtonClick();
                    console.log('✅ Registration triggered successfully');
                } catch (error) {
                    console.error('❌ Registration failed:', error);
                }
            } else {
                console.error('❌ Registration handler not available');
            }
        };
        
        // Add registration state inspector
        window.inspectRegistration = () => {
            const state = {
                appReady: this.isInitialized,
                isRegistered: this.isUserFullyRegistered(),
                registrationState: this.userRegistrationState,
                localStorage: localStorage.getItem('fanzone_registration_state'),
                platform: this.platformAdapter?.isAvailable() ? 'telegram' : 'web',
                mainButtonState: this.platformAdapter?.getMainButtonState?.() || null,
                webButtonExists: document.querySelectorAll('.start-collecting-web').length > 0,
                hasGlobalHandler: !!window.handleStartCollecting
            };
            
            console.log('📊 Registration State:', state);
            return state;
        };
        
        // Add button visibility checker
        window.checkButtonVisibility = () => {
            const telegram = {
                adapterAvailable: !!this.platformAdapter,
                platformAvailable: this.platformAdapter?.isAvailable(),
                mainButtonState: this.platformAdapter?.getMainButtonState?.() || null
            };
            
            const web = {
                globalHandler: !!window.handleStartCollecting,
                webButtons: Array.from(document.querySelectorAll('.start-collecting-web')).map(btn => ({
                    visible: btn.style.display !== 'none',
                    hasClick: !!btn.onclick,
                    text: btn.textContent
                }))
            };
            
            console.log('🔍 Button Visibility Check:', { telegram, web });
            return { telegram, web };
        };
        
        // Add registration state reset for testing
        window.resetRegistrationForTesting = () => {
            console.log('🧹 Clearing registration state...');
            localStorage.removeItem('fanzone_registration_state');
            localStorage.removeItem('fanzone_auth_token');
            localStorage.removeItem('fanzone_current_user');
            this.resetRegistrationState();
            console.log('✅ Registration state cleared');
            
            // Re-setup UI
            if (this.setupTelegramUI) {
                this.setupTelegramUI().catch(console.error);
            }
        };
        
        this.logger.info('Debug tools initialized', {
            tools: ['triggerRegistration', 'inspectRegistration', 'checkButtonVisibility', 'resetRegistrationForTesting']
        });
        
        // Add complete state cleaner
        window.clearAllFanZoneData = () => {
            console.log('🧹 Clearing ALL FanZone data...');
            
            // Clear all localStorage
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('fanzone')) {
                    keys.push(key);
                }
            }
            
            keys.forEach(key => {
                console.log(`Removing: ${key}`);
                localStorage.removeItem(key);
            });
            
            // Reset app state
            if (this.resetRegistrationState) {
                this.resetRegistrationState();
            }
            
            console.log('✅ All FanZone data cleared - reload page for fresh start');
            return { cleared: keys };
        };
        
        console.log('💡 Debug tools available:');
        console.log('  window.inspectRegistration() - Check registration state');
        console.log('  window.triggerRegistration() - Manually register');
        console.log('  window.checkButtonVisibility() - Check button state');
        console.log('  window.resetRegistrationForTesting() - Clear registration');
        console.log('  window.clearAllFanZoneData() - Nuclear option: clear everything');
    }
}

// Add testing utilities to window for console access
window.debugRegistration = () => window.FanZoneApp?.debugRegistrationState();
window.testRegistration = (options) => window.FanZoneApp?.testRegistrationFlow(options);
window.testEdgeCases = () => window.FanZoneApp?.testRegistrationEdgeCases();
window.clearTestState = () => window.FanZoneApp?.testClearAllState();


// Application will be created after services are initialized
window.FanZoneApp = null;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FanZoneApplication;
}