// Fix for FanZone Registration Issues
// This file fixes the "Start Collection" button not showing properly

(function() {
    console.log('🔧 Applying FanZone registration fixes...');
    
    // 1. Fix TelegramAdapter platform detection
    if (window.TelegramAdapter) {
        const originalDetect = window.TelegramAdapter.detectTelegramAvailability;
        window.TelegramAdapter.detectTelegramAvailability = async function() {
            console.log('🔍 Enhanced platform detection...');
            
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
                console.log('📱 Telegram API not found - using web mode');
                return {
                    isAvailable: false,
                    forceFallback: false,
                    reason: 'telegram_api_not_found'
                };
            }
            
            const webApp = window.Telegram.WebApp;
            
            // More permissive check - allow Telegram mode even without full data
            if (webApp && typeof webApp.ready === 'function') {
                console.log('✅ Telegram API available');
                
                // Get user data if available
                const userData = webApp.initDataUnsafe?.user;
                
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
            
            return {
                isAvailable: false,
                forceFallback: false,
                reason: 'telegram_not_initialized'
            };
        };
    }
    
    // 2. Fix registration state validation to prevent incorrect clearing
    if (window.FanZoneApplication) {
        const originalLoadState = window.FanZoneApplication.prototype.loadRegistrationState;
        window.FanZoneApplication.prototype.loadRegistrationState = function() {
            try {
                const saved = localStorage.getItem('fanzone_registration_state');
                if (saved) {
                    const state = JSON.parse(saved);
                    
                    // Don't clear state just because of platform mismatch
                    // Users might switch between web and Telegram
                    if (state.hasClickedStart && state.isFullyRegistered) {
                        console.log('✅ Valid registration state found, preserving it');
                        this.userRegistrationState = state;
                        return;
                    }
                }
                
                // No valid state found
                this.resetRegistrationState();
                console.log('📝 No valid registration state, user needs to register');
                
            } catch (error) {
                console.warn('Failed to load registration state:', error);
                this.resetRegistrationState();
            }
        };
    }
    
    // 3. Ensure web registration button handler is always available
    window.handleStartCollecting = async function() {
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
    
    // 4. Fix setupTelegramUI to ensure button shows
    if (window.FanZoneApplication) {
        const originalSetupUI = window.FanZoneApplication.prototype.setupTelegramUI;
        window.FanZoneApplication.prototype.setupTelegramUI = async function() {
            try {
                const isRegistered = this.isUserFullyRegistered();
                const currentPlatform = this.platformAdapter.isAvailable() ? 'telegram' : 'web';
                
                console.log('🎮 Setting up platform UI', {
                    isRegistered,
                    platform: currentPlatform
                });
                
                if (!isRegistered) {
                    if (this.platformAdapter.isAvailable()) {
                        // Telegram platform - show main button
                        console.log('📱 Setting up Telegram main button');
                        
                        // Ensure button callback is properly set
                        const buttonCallback = async () => {
                            console.log('🔘 Telegram main button clicked');
                            try {
                                await this.handleMainButtonClick();
                            } catch (error) {
                                console.error('Registration error:', error);
                                this.showToast('Registration failed. Please try again.', 'error');
                            }
                        };
                        
                        // Show the button with retry logic
                        let attempts = 0;
                        const maxAttempts = 3;
                        
                        while (attempts < maxAttempts) {
                            try {
                                const buttonShown = await this.platformAdapter.showMainButton(
                                    '🎁 Start Collecting!', 
                                    buttonCallback
                                );
                                
                                if (buttonShown) {
                                    console.log('✅ Telegram main button shown successfully');
                                    break;
                                } else {
                                    attempts++;
                                    console.warn(`⚠️ Failed to show button, attempt ${attempts}/${maxAttempts}`);
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            } catch (error) {
                                attempts++;
                                console.error(`Button setup error, attempt ${attempts}/${maxAttempts}:`, error);
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                        
                        if (attempts >= maxAttempts) {
                            console.error('❌ Failed to show Telegram main button after multiple attempts');
                            // Fall back to web interface
                            this.setupWebRegistrationInterface();
                        }
                        
                    } else {
                        // Web platform
                        console.log('🌐 Setting up web registration interface');
                        this.setupWebRegistrationInterface();
                        
                        // Also trigger re-render of gifts controller to show button
                        if (this.giftsController) {
                            this.giftsController.renderGifts();
                        }
                    }
                } else {
                    // User is registered - hide button
                    await this.platformAdapter.hideMainButton();
                    console.log('✅ User already registered, button hidden');
                }
                
            } catch (error) {
                console.error('Failed to setup platform UI:', error);
                // Ensure web fallback is available
                this.setupWebRegistrationInterface();
            }
        };
    }
    
    // 5. Fix GiftsController registration check
    if (window.GiftsController) {
        window.GiftsController.prototype.checkUserRegistration = function() {
            try {
                // Primary check - use main app if available
                if (window.FanZoneApp && typeof window.FanZoneApp.isUserFullyRegistered === 'function') {
                    return window.FanZoneApp.isUserFullyRegistered();
                }
                
                // Fallback - check localStorage
                const saved = localStorage.getItem('fanzone_registration_state');
                if (saved) {
                    const state = JSON.parse(saved);
                    return state.hasClickedStart && state.isFullyRegistered;
                }
                
                return false;
            } catch (error) {
                console.warn('Registration check failed:', error);
                return false;
            }
        };
    }
    
    // 6. Add initialization complete handler
    const checkAppReady = setInterval(() => {
        if (window.FanZoneApp && window.FanZoneApp.isInitialized) {
            clearInterval(checkAppReady);
            
            console.log('🚀 FanZone app initialized, checking registration state...');
            
            // Check if user needs to register
            if (!window.FanZoneApp.isUserFullyRegistered()) {
                console.log('📝 User not registered, ensuring button is visible');
                
                // Re-setup UI to ensure button is shown
                window.FanZoneApp.setupTelegramUI().catch(error => {
                    console.error('Failed to setup UI:', error);
                });
                
                // For web mode, ensure the button is visible
                const webButtons = document.querySelectorAll('.start-collecting-web');
                webButtons.forEach(btn => {
                    btn.style.display = 'inline-block';
                    btn.onclick = window.handleStartCollecting;
                });
            }
        }
    }, 100);
    
    // 7. Add manual registration trigger for debugging
    window.triggerRegistration = async function() {
        console.log('🔧 Manually triggering registration...');
        
        if (window.FanZoneApp && window.FanZoneApp.handleMainButtonClick) {
            try {
                await window.FanZoneApp.handleMainButtonClick();
                console.log('✅ Registration triggered successfully');
            } catch (error) {
                console.error('❌ Registration failed:', error);
            }
        } else {
            console.error('❌ FanZone app not available');
        }
    };
    
    // 8. Add registration state inspector
    window.inspectRegistration = function() {
        const state = {
            appReady: !!(window.FanZoneApp && window.FanZoneApp.isInitialized),
            isRegistered: window.FanZoneApp?.isUserFullyRegistered() || false,
            registrationState: window.FanZoneApp?.getRegistrationState() || null,
            localStorage: localStorage.getItem('fanzone_registration_state'),
            platform: window.TelegramAdapter?.isAvailable() ? 'telegram' : 'web',
            mainButtonState: window.TelegramAdapter?.getMainButtonState() || null,
            webButtonExists: document.querySelectorAll('.start-collecting-web').length > 0
        };
        
        console.log('📊 Registration State:', state);
        return state;
    };
    
    console.log('✅ Registration fixes applied successfully');
    console.log('💡 Use window.inspectRegistration() to check state');
    console.log('💡 Use window.triggerRegistration() to manually register');
    
})();