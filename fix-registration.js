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
    
    // 6. Add initialization complete handler with more aggressive checking
    let checkAttempts = 0;
    const maxAttempts = 100; // 10 seconds at 100ms intervals
    
    const checkAppReady = setInterval(() => {
        checkAttempts++;
        
        if (window.FanZoneApp && window.FanZoneApp.isInitialized) {
            clearInterval(checkAppReady);
            
            console.log('🚀 FanZone app initialized, checking registration state...');
            
            // Give a small delay for everything to settle
            setTimeout(() => {
                // Check if user needs to register
                if (!window.FanZoneApp.isUserFullyRegistered()) {
                    console.log('📝 User not registered, ensuring button is visible');
                    
                    // Re-setup UI to ensure button is shown
                    window.FanZoneApp.setupTelegramUI().catch(error => {
                        console.error('Failed to setup UI:', error);
                    });
                    
                    // For web mode, ensure the button is visible
                    setTimeout(() => {
                        const webButtons = document.querySelectorAll('.start-collecting-web');
                        console.log(`🔍 Found ${webButtons.length} web buttons`);
                        webButtons.forEach(btn => {
                            btn.style.display = 'inline-block';
                            btn.onclick = window.handleStartCollecting;
                            console.log('✅ Web button configured');
                        });
                        
                        // If no web buttons found, try to trigger gifts controller render
                        if (webButtons.length === 0) {
                            console.log('🔄 No web buttons found, triggering gifts controller render');
                            if (window.FanZoneApp.giftsController) {
                                window.FanZoneApp.giftsController.renderGifts();
                            }
                        }
                    }, 500);
                }
            }, 200);
            
        } else if (checkAttempts >= maxAttempts) {
            clearInterval(checkAppReady);
            console.error('❌ App initialization timeout - manual check available via window.triggerRegistration()');
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
    
    // 8. Add comprehensive registration state inspector
    window.inspectRegistration = function() {
        const state = {
            appReady: !!(window.FanZoneApp && window.FanZoneApp.isInitialized),
            isRegistered: window.FanZoneApp?.isUserFullyRegistered() || false,
            registrationState: window.FanZoneApp?.userRegistrationState || null,
            localStorage: localStorage.getItem('fanzone_registration_state'),
            platform: window.TelegramAdapter?.isAvailable() ? 'telegram' : 'web',
            mainButtonState: window.TelegramAdapter?.getMainButtonState() || null,
            webButtonExists: document.querySelectorAll('.start-collecting-web').length > 0,
            webButtonsDetails: Array.from(document.querySelectorAll('.start-collecting-web')).map(btn => ({
                visible: btn.style.display !== 'none',
                hasOnclick: !!btn.onclick,
                text: btn.textContent.trim()
            })),
            giftsControllerReady: !!(window.FanZoneApp?.giftsController?.isInitialized),
            hasGlobalHandler: !!window.handleStartCollecting,
            registrationPromptVisible: document.querySelector('.registration-prompt') !== null
        };
        
        console.log('📊 Registration State:', state);
        console.table(state);
        return state;
    };
    
    // 9. Add button forcer for emergencies
    window.forceShowButton = function() {
        console.log('🚨 Force showing registration button...');
        
        // Check if there's a registration prompt container
        const giftsGrid = document.getElementById('gifts-grid');
        if (giftsGrid && !document.querySelector('.start-collecting-web')) {
            console.log('💉 Injecting registration button directly into gifts grid');
            giftsGrid.innerHTML = `
                <div class="registration-prompt">
                    <div class="empty-state">
                        <div class="empty-icon">🔒</div>
                        <h2>Registration Required</h2>
                        <p>Please click the "Start Collecting" button to unlock gift collection!</p>
                        <button class="btn btn-primary start-collecting-web" onclick="window.handleStartCollecting()" style="display: inline-block;">
                            🎁 Start Collecting!
                        </button>
                    </div>
                </div>
            `;
            console.log('✅ Registration button injected');
        }
        
        // Also try to show Telegram button
        if (window.FanZoneApp && window.FanZoneApp.platformAdapter) {
            try {
                window.FanZoneApp.platformAdapter.showMainButton('🎁 Start Collecting!', window.handleStartCollecting);
                console.log('✅ Telegram button forced');
            } catch (error) {
                console.error('❌ Failed to force Telegram button:', error);
            }
        }
    };
    
    // 10. Add CSS styles for web buttons to ensure they're visible
    const style = document.createElement('style');
    style.textContent = `
        .start-collecting-web {
            display: inline-block !important;
            padding: 12px 24px;
            background: #3390ec;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin: 16px auto;
            transition: background-color 0.2s;
        }
        
        .start-collecting-web:hover {
            background: #2980d6;
        }
        
        .registration-prompt {
            text-align: center;
            padding: 40px 20px;
        }
        
        .registration-prompt .empty-state {
            max-width: 400px;
            margin: 0 auto;
        }
        
        .registration-prompt .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        .registration-prompt h2 {
            margin: 16px 0;
            color: var(--tg-theme-text-color, #333);
        }
        
        .registration-prompt p {
            margin-bottom: 24px;
            color: var(--tg-theme-hint-color, #666);
        }
    `;
    document.head.appendChild(style);
    
    console.log('✅ Registration fixes applied successfully');
    console.log('💡 Debug tools available:');
    console.log('  window.inspectRegistration() - Check registration state');
    console.log('  window.triggerRegistration() - Manually register');
    console.log('  window.forceShowButton() - Force show button');
    
    // Auto-check after 3 seconds
    setTimeout(() => {
        console.log('🔍 Auto-checking registration state...');
        window.inspectRegistration();
    }, 3000);
    
})();