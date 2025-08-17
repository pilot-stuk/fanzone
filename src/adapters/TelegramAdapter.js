// Telegram Web App Adapter following Adapter Pattern
// Handles all Telegram-specific functionality

class TelegramAdapter extends window.Interfaces.IPlatformAdapter {
    constructor() {
        super();
        this.webApp = null;
        this.userData = null;
        this.isInitialized = false;
        this.mainButtonCallback = null;
    }
    
    /**
     * Initialize Telegram Web App with enhanced detection and error handling
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('TelegramAdapter already initialized');
            return true;
        }
        
        try {
            console.log('📱 Starting Telegram Web App initialization...');
            
            // Enhanced availability detection
            const availability = await this.detectTelegramAvailability();
            
            if (availability.isAvailable && !availability.forceFallback) {
                await this.initializeTelegramMode(availability);
            } else {
                await this.initializeFallbackMode(availability.reason);
            }
            
            this.isInitialized = true;
            
            // Log successful initialization
            console.log('✅ TelegramAdapter initialized successfully', {
                mode: this.webApp ? 'telegram' : 'fallback',
                userId: this.userData?.id,
                username: this.userData?.username
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Telegram initialization failed:', error);
            
            // Use ErrorHandler for comprehensive error handling
            if (window.ErrorHandler) {
                const errorInfo = window.ErrorHandler.handleInitError(error, 'TelegramAdapter.initialize');
                console.log('Error categorized as:', errorInfo.category);
                
                // Log error details for debugging
                if (errorInfo.context) {
                    console.log('Error context:', errorInfo.context);
                }
            }
            
            // Always fallback to ensure app works
            try {
                await this.initializeFallbackMode('initialization_error');
                this.isInitialized = true;
                console.warn('⚠️ Fallback mode activated after initialization error');
                return true;
            } catch (fallbackError) {
                console.error('❌ Even fallback mode failed:', fallbackError);
                throw new Error(`TelegramAdapter initialization completely failed: ${error.message}`);
            }
        }
    }
    
    /**
     * Enhanced Telegram availability detection
     */
    async detectTelegramAvailability() {
        // Check for forced fallback mode
        const forceFallback = localStorage.getItem('fanzone_fallback_mode') === 'true' ||
                            window.location.search.includes('fallback=true');
        
        if (forceFallback) {
            return {
                isAvailable: false,
                forceFallback: true,
                reason: 'fallback_mode_enabled'
            };
        }
        
        // Basic availability check
        if (!window.Telegram || !window.Telegram.WebApp) {
            return {
                isAvailable: false,
                forceFallback: false,
                reason: 'telegram_api_not_found'
            };
        }
        
        const webApp = window.Telegram.WebApp;
        
        // More permissive check - allow Telegram mode even without full data
        if (webApp && typeof webApp.ready === 'function') {
            console.log('✅ Telegram API available, proceeding with Telegram mode');
            
            // Get user data if available (but don't require it)
            const userData = webApp.initDataUnsafe?.user;
            if (!userData) {
                console.log('⚠️ No user data available, but Telegram API is functional');
            }
            
            return {
                isAvailable: true,
                forceFallback: false,
                reason: 'telegram_available',
                features: {
                    mainButton: !!webApp.MainButton,
                    backButton: !!webApp.BackButton,
                    hapticFeedback: !!webApp.HapticFeedback,
                    themingSupport: !!webApp.themeParams
                },
                userData: userData
            };
        }
        
        // If we reach here, Telegram API is not properly available
        return {
            isAvailable: false,
            forceFallback: false,
            reason: 'telegram_not_initialized'
        };
    }
    
    /**
     * Initialize Telegram mode with enhanced error handling
     */
    async initializeTelegramMode(availability) {
        this.webApp = window.Telegram.WebApp;
        
        console.log('📱 Initializing Telegram Web App mode...');
        console.log('🔧 Available features:', availability.features);
        
        try {
            // Initialize WebApp with timeout
            await this.initializeWebAppWithTimeout();
            
            // Get and validate user data
            this.userData = this.webApp.initDataUnsafe?.user;
            
            if (!this.userData || !this.userData.id) {
                console.warn('⚠️ Telegram user data not available, creating fallback user for Telegram mode');
                // Create a fallback user for Telegram mode when user data is missing
                this.userData = {
                    id: Math.floor(Math.random() * 1000000) + 1000000, // Random ID for Telegram mode
                    first_name: 'Telegram',
                    last_name: 'User',
                    username: `tg_user_${Date.now()}`,
                    language_code: 'en',
                    is_telegram_fallback: true
                };
                console.log('Created fallback user for Telegram mode:', this.userData.username);
            }
            
            // Setup event handlers with error handling
            await this.setupEventHandlers();
            
            // Apply theme if supported
            if (availability.features?.themingSupport) {
                this.applyTheme();
            }
            
            // Enable closing confirmation if supported
            if (typeof this.webApp.enableClosingConfirmation === 'function') {
                this.webApp.enableClosingConfirmation();
            }
            
            console.log('✅ Telegram mode initialized successfully:', {
                userId: this.userData.id,
                username: this.userData.username,
                firstName: this.userData.first_name,
                features: Object.keys(availability.features).filter(key => availability.features[key])
            });
            
        } catch (error) {
            console.error('Failed to initialize Telegram mode:', error);
            throw new Error(`Telegram mode initialization failed: ${error.message}`);
        }
    }
    
    /**
     * Initialize WebApp with timeout protection
     */
    async initializeWebAppWithTimeout(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('WebApp initialization timeout'));
            }, timeout);
            
            try {
                // Call ready and expand
                this.webApp.ready();
                
                // Use a small delay to ensure ready() completes
                setTimeout(() => {
                    try {
                        this.webApp.expand();
                        clearTimeout(timeoutId);
                        resolve();
                    } catch (error) {
                        clearTimeout(timeoutId);
                        reject(new Error(`WebApp expand failed: ${error.message}`));
                    }
                }, 100);
                
            } catch (error) {
                clearTimeout(timeoutId);
                reject(new Error(`WebApp ready failed: ${error.message}`));
            }
        });
    }
    
    /**
     * Initialize fallback mode for non-Telegram environments
     */
    async initializeFallbackMode(reason = 'unknown') {
        console.warn(`⚠️ Initializing fallback mode. Reason: ${reason}`);
        
        // Clear Telegram-specific properties
        this.webApp = null;
        
        try {
            // Check if we have saved user data from previous session
            const savedUserData = localStorage.getItem('fanzone_fallback_user');
            
            if (savedUserData) {
                try {
                    this.userData = JSON.parse(savedUserData);
                    console.log('📱 Restored fallback user data:', this.userData.username);
                    
                    // Validate restored data
                    if (!this.userData.id || !this.userData.username) {
                        throw new Error('Invalid saved user data');
                    }
                } catch (e) {
                    console.warn('Failed to restore saved user data:', e);
                    this.createFallbackUser();
                }
            } else {
                this.createFallbackUser();
            }
            
            // Setup fallback environment indicators
            this.setupFallbackIndicators(reason);
            
            console.log('✅ Fallback mode initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize fallback mode:', error);
            throw new Error(`Fallback mode initialization failed: ${error.message}`);
        }
    }
    
    /**
     * Setup fallback environment indicators
     */
    setupFallbackIndicators(reason) {
        // Add visual indicator that app is running in fallback mode
        const indicator = document.createElement('div');
        indicator.id = 'fallback-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff9800;
            color: white;
            text-align: center;
            padding: 5px;
            font-size: 12px;
            z-index: 10001;
            display: none;
        `;
        indicator.textContent = '⚠️ Development Mode - Not running in Telegram';
        
        // Show indicator in development
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug=true')) {
            indicator.style.display = 'block';
            
            // Add option to toggle modes
            indicator.innerHTML = `
                ⚠️ Development Mode - Not running in Telegram 
                <button onclick="window.TelegramAdapter.toggleFallbackMode()" 
                        style="margin-left: 10px; padding: 2px 8px; background: white; color: #ff9800; border: none; border-radius: 3px; cursor: pointer;">
                    Toggle Mode
                </button>
            `;
        }
        
        document.body.appendChild(indicator);
        
        // Store reason in localStorage for debugging
        localStorage.setItem('fanzone_fallback_reason', reason);
    }
    
    /**
     * Create fallback user for development/testing with platform consistency
     */
    createFallbackUser() {
        // Check if we have a persistent ID in localStorage
        let persistentId = localStorage.getItem('fanzone_web_user_id');
        if (!persistentId) {
            persistentId = Date.now();
            localStorage.setItem('fanzone_web_user_id', persistentId.toString());
        }
        
        this.userData = {
            id: parseInt(persistentId),
            first_name: 'Guest',
            last_name: 'User',
            username: `web_user_${persistentId}`,
            language_code: 'en',
            is_fallback: true,
            platform: 'web'
        };
        
        // Save fallback user for persistence with platform info
        const userData = {
            ...this.userData,
            created_at: new Date().toISOString(),
            platform: 'web'
        };
        localStorage.setItem('fanzone_fallback_user', JSON.stringify(userData));
        
        console.log('👤 Created platform-consistent fallback user:', {
            username: this.userData.username,
            id: this.userData.id,
            platform: 'web'
        });
    }
    
    /**
     * Setup Telegram event handlers
     */
    setupEventHandlers() {
        if (!this.webApp) return;
        
        // Theme change handler
        this.webApp.onEvent('themeChanged', () => {
            this.applyTheme();
            window.EventBus?.emit('theme:changed', this.getThemeParams());
        });
        
        // Viewport change handler
        this.webApp.onEvent('viewportChanged', () => {
            const viewportHeight = this.webApp.viewportHeight;
            document.documentElement.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
            window.EventBus?.emit('viewport:changed', { height: viewportHeight });
        });
        
        // Back button handler
        this.webApp.BackButton.onClick(() => {
            window.EventBus?.emit('navigation:back');
        });
        
        // Main button handler - Enhanced with platform-specific validation
        this.webApp.MainButton.onClick(() => {
            console.log('🔘 Main button clicked in Telegram app', {
                hasCallback: !!this.mainButtonCallback,
                isProgressVisible: this.webApp.MainButton.isProgressVisible,
                buttonText: this.webApp.MainButton.text,
                platform: 'telegram',
                userId: this.userData?.id,
                callbackFunction: this.mainButtonCallback?.name || 'anonymous'
            });
            
            // Prevent multiple clicks while processing
            if (this.webApp.MainButton.isProgressVisible) {
                console.log('⏳ Button click ignored - already processing');
                return;
            }
            
            // Show immediate feedback
            this.sendHapticFeedback('light');
            
            if (this.mainButtonCallback) {
                console.log('🚀 Executing main button callback with platform validation');
                // Execute callback with platform context
                try {
                    // Call the callback and ensure it's async-safe
                    const result = this.mainButtonCallback();
                    
                    // If callback returns a promise, handle it
                    if (result && typeof result.then === 'function') {
                        result.catch(error => {
                            console.error('Main button callback promise failed:', error);
                            this.webApp.MainButton.hideProgress();
                        });
                    }
                } catch (error) {
                    console.error('Main button callback failed:', error);
                    this.webApp.MainButton.hideProgress();
                }
            } else {
                console.log('📡 No callback set, emitting default event with platform data');
                // Default action with platform context
                window.EventBus?.emit('mainbutton:clicked', {
                    platform: 'telegram',
                    userData: this.userData,
                    timestamp: Date.now()
                });
            }
        });
        
        // Settings button handler
        if (this.webApp.SettingsButton) {
            this.webApp.SettingsButton.onClick(() => {
                window.EventBus?.emit('settings:opened');
            });
        }
    }
    
    /**
     * Apply Telegram theme to the app
     */
    applyTheme() {
        if (!this.webApp?.themeParams) return;
        
        const themeParams = this.webApp.themeParams;
        const root = document.documentElement;
        
        // Apply CSS variables
        Object.keys(themeParams).forEach(key => {
            const cssVar = `--tg-theme-${key.replace(/_/g, '-')}`;
            root.style.setProperty(cssVar, themeParams[key]);
        });
        
        // Determine if dark mode
        if (this.webApp.colorScheme === 'dark' || this.isColorDark(themeParams.bg_color)) {
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-light');
        } else {
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
        }
    }
    
    /**
     * Check if a color is dark
     */
    isColorDark(color) {
        if (!color) return false;
        
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        
        return brightness < 128;
    }
    
    /**
     * Get user data from Telegram
     */
    getUserData() {
        if (!this.isInitialized) {
            throw new Error('Telegram adapter not initialized');
        }
        
        return {
            id: this.userData.id,
            firstName: this.userData.first_name,
            lastName: this.userData.last_name,
            username: this.userData.username,
            languageCode: this.userData.language_code,
            isPremium: this.userData.is_premium || false,
            photoUrl: this.userData.photo_url
        };
    }
    
    /**
     * Get theme parameters
     */
    getThemeParams() {
        if (!this.webApp) return null;
        
        return {
            ...this.webApp.themeParams,
            colorScheme: this.webApp.colorScheme,
            headerColor: this.webApp.headerColor,
            backgroundColor: this.webApp.backgroundColor
        };
    }
    
    /**
     * Show main button with text and callback - Enhanced with async handling
     */
    async showMainButton(text, callback) {
        try {
            if (!this.webApp?.MainButton) {
                console.warn('Main button not available in fallback mode');
                return false;
            }
            
            // Validate parameters
            if (!text || typeof text !== 'string') {
                throw new Error('Main button text must be a non-empty string');
            }
            
            if (callback && typeof callback !== 'function') {
                throw new Error('Main button callback must be a function');
            }
            
            // Store callback for later use
            this.mainButtonCallback = callback;
            
            // Configure button appearance
            this.webApp.MainButton.setText(text);
            this.webApp.MainButton.color = this.webApp.themeParams?.button_color || '#3390ec';
            this.webApp.MainButton.textColor = this.webApp.themeParams?.button_text_color || '#ffffff';
            
            // Reset button state
            this.webApp.MainButton.enable();
            this.webApp.MainButton.hideProgress();
            
            // Show button with animation
            if (!this.webApp.MainButton.isVisible) {
                this.webApp.MainButton.show();
            }
            
            console.log('✅ Main button shown:', { 
                text, 
                hasCallback: !!callback,
                isVisible: this.webApp.MainButton.isVisible,
                callbackStored: !!this.mainButtonCallback
            });
            return true;
            
        } catch (error) {
            console.error('Failed to show main button:', error);
            
            // Use ErrorHandler if available
            if (window.ErrorHandler) {
                window.ErrorHandler.logError(error, 'TelegramAdapter.showMainButton', {
                    category: 'ui_error',
                    context: { text, hasCallback: !!callback }
                });
            }
            
            return false;
        }
    }
    
    /**
     * Hide main button - Enhanced with state management
     */
    async hideMainButton() {
        try {
            if (!this.webApp?.MainButton) {
                console.log('Main button not available in fallback mode');
                return true;
            }
            
            // Reset loading state first
            if (this.webApp.MainButton.isProgressVisible) {
                await this.setMainButtonLoading(false);
            }
            
            // Hide button
            this.webApp.MainButton.hide();
            this.mainButtonCallback = null;
            
            console.log('✅ Main button hidden');
            return true;
            
        } catch (error) {
            console.error('Failed to hide main button:', error);
            
            // Use ErrorHandler if available
            if (window.ErrorHandler) {
                window.ErrorHandler.logError(error, 'TelegramAdapter.hideMainButton', {
                    category: 'ui_error'
                });
            }
            
            return false;
        }
    }
    
    /**
     * Show/hide main button loading state - Enhanced with async handling
     */
    async setMainButtonLoading(isLoading, timeout = 10000) {
        try {
            if (!this.webApp?.MainButton) {
                console.log('Main button loading state not available in fallback mode');
                return false;
            }
            
            if (isLoading) {
                // Show loading with timeout protection
                this.webApp.MainButton.showProgress(true);
                this.webApp.MainButton.disable();
                
                // Auto-clear loading state after timeout
                if (timeout > 0) {
                    setTimeout(async () => {
                        if (this.webApp?.MainButton?.isProgressVisible) {
                            console.warn('Main button loading timeout reached, clearing state');
                            await this.setMainButtonLoading(false);
                        }
                    }, timeout);
                }
                
                console.log('✅ Main button loading state enabled');
            } else {
                // Hide loading
                this.webApp.MainButton.hideProgress();
                this.webApp.MainButton.enable();
                
                console.log('✅ Main button loading state disabled');
            }
            
            return true;
            
        } catch (error) {
            console.error('Failed to set main button loading state:', error);
            
            // Use ErrorHandler if available
            if (window.ErrorHandler) {
                window.ErrorHandler.logError(error, 'TelegramAdapter.setMainButtonLoading', {
                    category: 'ui_error',
                    context: { isLoading, timeout }
                });
            }
            
            return false;
        }
    }
    
    /**
     * Get main button state
     */
    getMainButtonState() {
        if (!this.webApp?.MainButton) {
            return {
                available: false,
                visible: false,
                enabled: false,
                loading: false,
                text: null
            };
        }
        
        return {
            available: true,
            visible: this.webApp.MainButton.isVisible,
            enabled: !this.webApp.MainButton.isProgressVisible,
            loading: this.webApp.MainButton.isProgressVisible,
            text: this.webApp.MainButton.text
        };
    }
    
    /**
     * Send haptic feedback
     */
    sendHapticFeedback(type = 'light') {
        if (!this.webApp?.HapticFeedback) return;
        
        const feedbackTypes = {
            light: 'impactOccurred',
            medium: 'impactOccurred',
            heavy: 'impactOccurred',
            rigid: 'impactOccurred',
            soft: 'impactOccurred',
            success: 'notificationOccurred',
            warning: 'notificationOccurred',
            error: 'notificationOccurred',
            selection: 'selectionChanged'
        };
        
        const method = feedbackTypes[type] || 'impactOccurred';
        
        if (method === 'impactOccurred') {
            const style = type === 'heavy' ? 'heavy' : type === 'medium' ? 'medium' : 'light';
            this.webApp.HapticFeedback.impactOccurred(style);
        } else if (method === 'notificationOccurred') {
            const notificationType = type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'error';
            this.webApp.HapticFeedback.notificationOccurred(notificationType);
        } else {
            this.webApp.HapticFeedback.selectionChanged();
        }
    }
    
    /**
     * Show popup
     */
    showPopup(params) {
        if (!this.webApp) {
            // Fallback to standard alert
            alert(params.message);
            return Promise.resolve(true);
        }
        
        return new Promise((resolve) => {
            this.webApp.showPopup({
                title: params.title || 'FanZone',
                message: params.message,
                buttons: params.buttons || [{ type: 'ok', text: 'OK' }]
            }, (buttonId) => {
                resolve(buttonId);
            });
        });
    }
    
    /**
     * Show confirm dialog
     */
    showConfirm(message, callback) {
        if (!this.webApp) {
            const result = confirm(message);
            if (callback) callback(result);
            return Promise.resolve(result);
        }
        
        return new Promise((resolve) => {
            this.webApp.showConfirm(message, (confirmed) => {
                if (callback) callback(confirmed);
                resolve(confirmed);
            });
        });
    }
    
    /**
     * Show/hide back button
     */
    setBackButtonVisible(visible) {
        if (!this.webApp) return;
        
        if (visible) {
            this.webApp.BackButton.show();
        } else {
            this.webApp.BackButton.hide();
        }
    }
    
    /**
     * Send data to Telegram bot
     */
    sendData(data) {
        if (!this.webApp) {
            console.warn('Cannot send data in development mode');
            return;
        }
        
        try {
            this.webApp.sendData(JSON.stringify(data));
        } catch (error) {
            console.error('Error sending data to Telegram:', error);
        }
    }
    
    /**
     * Close the Web App
     */
    close() {
        if (!this.webApp) {
            console.log('Would close app in production');
            return;
        }
        
        this.webApp.close();
    }
    
    /**
     * Check if platform is available
     */
    isAvailable() {
        const available = !!(this.webApp && window.Telegram && window.Telegram.WebApp);
        
        if (!available) {
            console.log('Platform availability check:', {
                hasWebApp: !!this.webApp,
                hasTelegram: !!window.Telegram,
                hasTelegramWebApp: !!(window.Telegram && window.Telegram.WebApp),
                isInitialized: this.isInitialized
            });
        }
        
        return available;
    }
    
    /**
     * Validate platform state before critical operations
     */
    validatePlatformState() {
        try {
            // Check basic initialization
            if (!this.isInitialized) {
                console.error('TelegramAdapter not initialized');
                return false;
            }
            
            // Validate user data consistency
            if (this.isAvailable()) {
                if (!this.userData || !this.userData.id) {
                    console.error('Missing Telegram user data');
                    return false;
                }
                
                // Cross-check with WebApp data
                const webAppUser = this.webApp.initDataUnsafe?.user;
                if (webAppUser && webAppUser.id !== this.userData.id) {
                    console.error('User data mismatch between adapter and WebApp');
                    return false;
                }
                
                // Check registration state consistency
                const registrationState = localStorage.getItem('fanzone_registration_state');
                if (registrationState) {
                    try {
                        const state = JSON.parse(registrationState);
                        if (state.platform && state.platform !== 'telegram') {
                            console.warn('Platform mismatch in registration state');
                            // Clear inconsistent state
                            localStorage.removeItem('fanzone_registration_state');
                        }
                    } catch (error) {
                        console.warn('Invalid registration state in localStorage:', error);
                        localStorage.removeItem('fanzone_registration_state');
                    }
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('Platform state validation failed:', error);
            return false;
        }
    }
    
    /**
     * Toggle between Telegram and fallback mode (for development)
     */
    async toggleFallbackMode() {
        const currentMode = localStorage.getItem('fanzone_fallback_mode') === 'true';
        const newMode = !currentMode;
        
        localStorage.setItem('fanzone_fallback_mode', newMode.toString());
        
        console.log(`🔄 Switching to ${newMode ? 'fallback' : 'telegram'} mode`);
        
        // Show confirmation
        if (this.showConfirm) {
            const confirmed = await this.showConfirm(
                `Switch to ${newMode ? 'fallback' : 'telegram'} mode? The page will reload.`
            );
            
            if (confirmed) {
                window.location.reload();
            }
        } else {
            if (confirm(`Switch to ${newMode ? 'fallback' : 'telegram'} mode? The page will reload.`)) {
                window.location.reload();
            }
        }
    }
    
    /**
     * Get current mode information
     */
    getModeInfo() {
        return {
            mode: this.webApp ? 'telegram' : 'fallback',
            isInitialized: this.isInitialized,
            userData: this.userData,
            features: this.webApp ? {
                mainButton: !!this.webApp.MainButton,
                backButton: !!this.webApp.BackButton,
                hapticFeedback: !!this.webApp.HapticFeedback,
                themingSupport: !!this.webApp.themeParams
            } : null,
            fallbackReason: localStorage.getItem('fanzone_fallback_reason')
        };
    }
    
    /**
     * Validate method availability before calling
     */
    isMethodAvailable(methodName) {
        if (!this.webApp) return false;
        
        const methodPath = methodName.split('.');
        let obj = this.webApp;
        
        for (const part of methodPath) {
            if (!obj || typeof obj[part] === 'undefined') {
                return false;
            }
            obj = obj[part];
        }
        
        return typeof obj === 'function';
    }
    
    /**
     * Get init data for validation
     */
    getInitData() {
        if (!this.webApp) return null;
        
        return this.webApp.initData;
    }
    
    /**
     * Get init data unsafe (parsed)
     */
    getInitDataUnsafe() {
        if (!this.webApp) return null;
        
        return this.webApp.initDataUnsafe;
    }
    
    /**
     * Request write access
     */
    async requestWriteAccess() {
        if (!this.webApp?.requestWriteAccess) {
            return Promise.resolve(true);
        }
        
        return new Promise((resolve) => {
            this.webApp.requestWriteAccess((granted) => {
                resolve(granted);
            });
        });
    }
    
    /**
     * Request contact
     */
    async requestContact() {
        if (!this.webApp?.requestContact) {
            return Promise.resolve(null);
        }
        
        return new Promise((resolve) => {
            this.webApp.requestContact((contact) => {
                resolve(contact);
            });
        });
    }
    
    /**
     * Open link
     */
    openLink(url, options = {}) {
        if (!this.webApp) {
            window.open(url, '_blank');
            return;
        }
        
        this.webApp.openLink(url, options);
    }
    
    /**
     * Open Telegram link
     */
    openTelegramLink(url) {
        if (!this.webApp) {
            window.open(url, '_blank');
            return;
        }
        
        this.webApp.openTelegramLink(url);
    }
    
    /**
     * Share to story
     */
    shareToStory(mediaUrl, options = {}) {
        if (!this.webApp?.shareToStory) {
            console.warn('Share to story not available');
            return;
        }
        
        this.webApp.shareToStory(mediaUrl, options);
    }
    
    /**
     * Ready for confirmation
     */
    ready() {
        if (this.webApp) {
            this.webApp.ready();
        }
    }
    
    /**
     * Expand the Web App
     */
    expand() {
        if (this.webApp) {
            this.webApp.expand();
        }
    }
}

// Create singleton instance
window.TelegramAdapter = new TelegramAdapter();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelegramAdapter;
}