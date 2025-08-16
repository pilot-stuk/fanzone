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
     * Initialize Telegram Web App
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                if (this.isAvailable()) {
                    this.webApp = window.Telegram.WebApp;
                    
                    // Initialize and expand
                    this.webApp.ready();
                    this.webApp.expand();
                    
                    // Get user data
                    this.userData = this.webApp.initDataUnsafe?.user;
                    
                    // Validate user data
                    if (!this.userData || !this.userData.id) {
                        throw new Error('Invalid Telegram user data');
                    }
                    
                    // Setup event handlers
                    this.setupEventHandlers();
                    
                    // Apply theme
                    this.applyTheme();
                    
                    // Enable closing confirmation
                    this.webApp.enableClosingConfirmation();
                    
                    this.isInitialized = true;
                    
                    console.log('✅ Telegram Web App initialized:', {
                        userId: this.userData.id,
                        username: this.userData.username,
                        firstName: this.userData.first_name
                    });
                    
                    resolve(true);
                } else {
                    // Fallback mode for development
                    this.userData = {
                        id: 12345,
                        first_name: 'Test',
                        last_name: 'User',
                        username: 'testuser',
                        language_code: 'en'
                    };
                    
                    this.isInitialized = true;
                    console.warn('⚠️ Running in development mode without Telegram');
                    resolve(true);
                }
            } catch (error) {
                console.error('❌ Telegram initialization error:', error);
                
                // Fallback to mock user
                this.userData = {
                    id: Date.now(),
                    first_name: 'Guest',
                    last_name: 'User',
                    username: `guest_${Date.now()}`,
                    language_code: 'en'
                };
                
                this.isInitialized = true;
                resolve(true);
            }
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
        
        // Main button handler - Fixed to properly handle authentication
        this.webApp.MainButton.onClick(() => {
            // Prevent multiple clicks while processing
            if (this.webApp.MainButton.isProgressVisible) {
                return;
            }
            
            if (this.mainButtonCallback) {
                this.mainButtonCallback();
            } else {
                // Default action - ensure user is authenticated first
                window.EventBus?.emit('mainbutton:clicked');
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
     * Show main button with text and callback
     */
    showMainButton(text, callback) {
        if (!this.webApp) {
            console.warn('Main button not available in development mode');
            return;
        }
        
        this.mainButtonCallback = callback;
        this.webApp.MainButton.setText(text);
        this.webApp.MainButton.color = this.webApp.themeParams?.button_color || '#3390ec';
        this.webApp.MainButton.textColor = this.webApp.themeParams?.button_text_color || '#ffffff';
        
        // Ensure button is enabled and not in progress state
        this.webApp.MainButton.enable();
        this.webApp.MainButton.hideProgress();
        
        if (!this.webApp.MainButton.isVisible) {
            this.webApp.MainButton.show();
        }
    }
    
    /**
     * Hide main button
     */
    hideMainButton() {
        if (!this.webApp) return;
        
        // Ensure progress is hidden before hiding button
        this.webApp.MainButton.hideProgress();
        this.webApp.MainButton.hide();
        this.mainButtonCallback = null;
    }
    
    /**
     * Show/hide main button loading state
     */
    setMainButtonLoading(isLoading) {
        if (!this.webApp) return;
        
        if (isLoading) {
            this.webApp.MainButton.showProgress(true);
            this.webApp.MainButton.disable();
        } else {
            this.webApp.MainButton.hideProgress();
            this.webApp.MainButton.enable();
        }
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
        return !!(window.Telegram && window.Telegram.WebApp);
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