// Gifts Controller - UI logic for gifts page
// Follows Single Responsibility Principle - only handles gift UI

class GiftsController extends ControllerBase {
    constructor(giftService, userService, logger, eventBus) {
        // Initialize base controller with event system
        super(eventBus, logger);
        
        // Validate services before assigning
        this.validateDependencies(giftService, userService, logger, eventBus);
        
        this.giftService = giftService;
        this.userService = userService;
        
        this.gifts = [];
        this.filteredGifts = [];
        this.userGifts = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.isInitialized = false;
        this.isLoading = false;
    }
    
    /**
     * Validate controller dependencies
     */
    validateDependencies(giftService, userService, logger, eventBus) {
        if (window.ServiceValidator) {
            window.ServiceValidator.validateService(giftService, 'GiftService');
            window.ServiceValidator.validateService(userService, 'UserService');
            window.ServiceValidator.validateService(logger, 'Logger');
            window.ServiceValidator.validateService(eventBus, 'EventBus');
        } else {
            // Fallback validation if ServiceValidator not available
            if (!giftService) throw new Error('GiftService is required');
            if (!userService) throw new Error('UserService is required');
            if (!logger) throw new Error('Logger is required');
            if (!eventBus) throw new Error('EventBus is required');
        }
    }
    
    /**
     * Initialize the gifts page
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.logger.debug('Initializing gifts controller');
            
            this.showLoadingState();
            
            // Initialize event system first
            await this.initializeEventSystem();
            
            await this.loadData();
            this.setupUI();
            this.setupEventListeners();
            this.renderGifts();
            
            this.isInitialized = true;
            this.logger.debug('Gifts controller initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize gifts controller', error);
            this.showError('Failed to load gifts');
        }
    }
    
    /**
     * Load gifts and user data
     */
    async loadData() {
        try {
            const authService = window.DIContainer.get('authService');
            const currentUser = authService.getCurrentUser();
            
            // Load available gifts regardless of user authentication
            this.gifts = await this.giftService.getAvailableGifts();
            
            // Load user gifts only if authenticated AND registered
            if (currentUser && this.checkUserRegistration()) {
                this.logger.info('Loading user gifts', { userId: currentUser.id });
                try {
                    const userGifts = await this.giftService.getUserGifts(currentUser.telegram_id || currentUser.id);
                    this.userGifts = userGifts.map(ug => ug.gift_id || ug.gift?.id);
                } catch (error) {
                    this.logger.warn('Failed to load user gifts, user may not be fully registered', error);
                    this.userGifts = [];
                }
            } else {
                this.logger.info('No authenticated user or not registered, showing gifts without user data');
                this.userGifts = [];
            }
            
            this.filterGifts();
            
        } catch (error) {
            this.logger.error('Failed to load gifts data', error);
            // Don't throw - show what we can
            this.gifts = this.gifts || [];
            this.userGifts = this.userGifts || [];
            this.filterGifts();
        }
    }
    
    /**
     * Setup UI components
     */
    setupUI() {
        const container = document.getElementById('gifts-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="gifts-controls">
                <div class="search-section">
                    <input type="text" id="gift-search" placeholder="🔍 Search gifts..." />
                </div>
                
                <div class="filter-section">
                    <div class="filter-buttons">
                        <button class="filter-btn active" data-filter="all">All</button>
                        <button class="filter-btn" data-filter="match">⚽ Match</button>
                        <button class="filter-btn" data-filter="trophy">🏆 Trophy</button>
                        <button class="filter-btn" data-filter="player">👕 Player</button>
                        <button class="filter-btn" data-filter="special">⭐ Special</button>
                    </div>
                </div>
                
                <div class="gifts-stats">
                    <span id="gifts-count">Loading...</span>
                </div>
            </div>
            
            <div class="gifts-grid" id="gifts-grid">
                <!-- Gifts will be rendered here -->
            </div>
        `;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const container = document.getElementById('gifts-container');
        if (!container) return;
        
        // Gift purchase clicks
        container.addEventListener('click', async (e) => {
            const giftCard = e.target.closest('.gift-card');
            if (giftCard && giftCard.dataset.giftId) {
                await this.handleGiftClick(giftCard.dataset.giftId);
            }
            
            // Filter buttons
            if (e.target.classList.contains('filter-btn')) {
                this.setFilter(e.target.dataset.filter);
            }
            
            // Purchase button
            if (e.target.classList.contains('purchase-btn')) {
                const giftId = e.target.dataset.giftId;
                await this.purchaseGift(giftId);
            }
        });
        
        // Search input
        const searchInput = document.getElementById('gift-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchGifts(e.target.value);
            });
        }
        
        // Event bus subscriptions with proper validation and replay
        this.subscribe('gift:purchased', (data) => {
            this.handleGiftPurchased(data);
        }, { replayMissed: true });
        
        // Subscribe to user data updates
        this.subscribe('user:points:updated', () => {
            this.renderGifts(); // Re-render to update affordability
        }, { replayMissed: false });
    }
    
    /**
     * Filter gifts by category
     */
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.filterGifts();
        this.renderGifts();
    }
    
    /**
     * Search gifts by query
     */
    searchGifts(query) {
        this.searchQuery = query.toLowerCase().trim();
        this.filterGifts();
        this.renderGifts();
    }
    
    /**
     * Apply filters to gifts
     */
    filterGifts() {
        let filtered = [...this.gifts];
        
        // Apply category filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(gift => gift.category === this.currentFilter);
        }
        
        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(gift => 
                gift.name.toLowerCase().includes(this.searchQuery) ||
                gift.description.toLowerCase().includes(this.searchQuery)
            );
        }
        
        // Sort by availability and price
        filtered.sort((a, b) => {
            const aAvailable = a.current_supply < a.max_supply;
            const bAvailable = b.current_supply < b.max_supply;
            
            if (aAvailable !== bAvailable) {
                return bAvailable ? 1 : -1;
            }
            
            return a.price_points - b.price_points;
        });
        
        this.filteredGifts = filtered;
        this.updateStats();
    }
    
    /**
     * Render gifts grid
     */
    renderGifts() {
        const grid = document.getElementById('gifts-container');
        if (!grid) {
            this.logger.warn('Gifts container element not found');
            return;
        }
        
        // Check if user is registered
        const isRegistered = this.checkUserRegistration();
        
        this.logger.info('Rendering gifts', {
            isRegistered,
            isLoading: this.isLoading,
            giftsCount: this.filteredGifts.length,
            hasGrid: !!grid,
            appRegistrationCheck: window.FanZoneApp?.isUserFullyRegistered?.(),
            localStorageState: localStorage.getItem('fanzone_registration_state')
        });
        
        if (this.isLoading) {
            grid.innerHTML = this.renderLoadingState();
            return;
        }
        
        // Show registration prompt if not registered
        if (!isRegistered) {
            grid.innerHTML = this.renderRegistrationPrompt();
            return;
        }
        
        if (this.filteredGifts.length === 0) {
            grid.innerHTML = this.renderEmptyState();
            return;
        }
        
        grid.innerHTML = this.filteredGifts.map(gift => this.renderGiftCard(gift)).join('');
    }
    
    /**
     * Render registration prompt
     */
    renderRegistrationPrompt() {
        // Check if we're in web mode (no Telegram button available)
        const platformAdapter = window.DIContainer.get('platformAdapter');
        const isWebMode = !platformAdapter.isAvailable();
        
        this.logger.info('Rendering registration prompt', {
            isWebMode,
            platformAvailable: platformAdapter.isAvailable(),
            hasGlobalHandler: !!window.handleStartCollecting,
            hasFanZoneApp: !!window.FanZoneApp
        });
        
        return `
            <div class="registration-prompt">
                <div class="empty-state">
                    <div class="empty-icon">🔒</div>
                    <h2>Registration Required</h2>
                    <p>Please click the "Start Collecting" button to unlock gift collection!</p>
                    <div class="registration-benefits">
                        <div class="benefit">✨ Access exclusive gifts</div>
                        <div class="benefit">🎁 Start your collection</div>
                        <div class="benefit">🏆 Compete on leaderboard</div>
                    </div>
                    ${isWebMode ? `
                        <button class="btn btn-primary start-collecting-web" onclick="
                            if (window.handleStartCollecting) {
                                window.handleStartCollecting();
                            } else if (window.FanZoneApp && window.FanZoneApp.handleMainButtonClick) {
                                window.FanZoneApp.handleMainButtonClick();
                            }
                        ">
                            🎁 Start Collecting!
                        </button>
                    ` : `
                        <p class="hint">👆 Click the button at the bottom to get started!</p>
                    `}
                </div>
            </div>
        `;
    }
    
    /**
     * Render individual gift card
     */
    renderGiftCard(gift) {
        const isOwned = this.userGifts.includes(gift.id);
        const isOutOfStock = gift.current_supply >= gift.max_supply;
        const authService = window.DIContainer.get('authService');
        const user = authService.getCurrentUser();
        const canAfford = user && user.points >= gift.price_points;
        
        const supplyPercentage = (gift.current_supply / gift.max_supply) * 100;
        
        return `
            <div class="gift-card ${isOwned ? 'owned' : ''} ${isOutOfStock ? 'out-of-stock' : ''}" 
                 data-gift-id="${gift.id}">
                <div class="gift-image">
                    <img src="${gift.image_url}" alt="${gift.name}" loading="lazy" />
                    ${isOwned ? '<div class="owned-badge">✓ Owned</div>' : ''}
                    ${supplyPercentage > 90 ? '<div class="low-stock-badge">⚡ Low Stock</div>' : ''}
                </div>
                
                <div class="gift-info">
                    <h3>${gift.name}</h3>
                    <p>${this.truncateText(gift.description, 60)}</p>
                    
                    <div class="gift-stats">
                        <div class="price">${this.formatPoints(gift.price_points)} pts</div>
                        <div class="supply">${gift.current_supply}/${gift.max_supply}</div>
                    </div>
                    
                    <div class="gift-actions">
                        ${this.renderGiftButton(gift, isOwned, isOutOfStock, canAfford)}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render gift action button
     */
    renderGiftButton(gift, isOwned, isOutOfStock, canAfford) {
        if (isOwned) {
            return '<button class="btn btn-success" disabled>✓ Owned</button>';
        }
        
        if (isOutOfStock) {
            return '<button class="btn btn-secondary" disabled>❌ Out of Stock</button>';
        }
        
        if (!canAfford) {
            const authService = window.DIContainer.get('authService');
            const user = authService.getCurrentUser();
            const needed = gift.price_points - (user?.points || 0);
            return `<button class="btn btn-secondary" disabled>💰 Need ${needed} more</button>`;
        }
        
        return `<button class="btn btn-primary purchase-btn" data-gift-id="${gift.id}">
            🎁 Collect Gift
        </button>`;
    }
    
    /**
     * Handle gift click
     */
    async handleGiftClick(giftId) {
        // Check registration state before allowing any gift interaction
        if (!this.checkUserRegistration()) {
            this.showRegistrationRequired();
            return;
        }
        
        const gift = this.gifts.find(g => g.id === giftId);
        if (!gift) return;
        
        this.showGiftDetails(gift);
    }
    
    /**
     * Show gift details modal/toast
     */
    showGiftDetails(gift) {
        const isOwned = this.userGifts.includes(gift.id);
        const supplyPercentage = (gift.current_supply / gift.max_supply) * 100;
        
        const message = `🎁 ${gift.name}

${gift.description}

💰 Price: ${this.formatPoints(gift.price_points)} points
📦 Supply: ${gift.current_supply}/${gift.max_supply} (${Math.round(100-supplyPercentage)}% available)

${isOwned ? '✅ You already own this gift!' : '🎁 Tap "Collect Gift" to add this to your collection!'}`;
        
        this.showToast(message, 'info', 5000);
    }
    
    /**
     * Purchase a gift
     */
    checkUserRegistration() {
        // For button display purposes, use the main app's registration check first
        try {
            // Check if main app is available and use its registration state
            if (window.FanZoneApp && typeof window.FanZoneApp.isUserFullyRegistered === 'function') {
                const isRegistered = window.FanZoneApp.isUserFullyRegistered();
                this.logger.debug('Controller registration check via main app', {
                    isRegistered,
                    method: 'main_app'
                });
                return isRegistered;
            }
            
            // Fallback to simple localStorage check for button display
            const saved = localStorage.getItem('fanzone_registration_state');
            if (saved) {
                const state = JSON.parse(saved);
                const isRegistered = state.hasClickedStart && state.isFullyRegistered;
                this.logger.debug('Controller registration check via localStorage', {
                    isRegistered,
                    method: 'localStorage',
                    state: {
                        hasClickedStart: state.hasClickedStart,
                        isFullyRegistered: state.isFullyRegistered
                    }
                });
                return isRegistered;
            }
            
            // No registration state found - user is not registered
            this.logger.debug('Controller registration check - no state found', {
                isRegistered: false,
                method: 'no_state'
            });
            return false;
            
        } catch (error) {
            this.logger.warn('Failed to check registration state', error);
            return false;
        }
    }
    
    showRegistrationRequired() {
        // Get detailed registration state for better user messaging
        let message = '⚠️ Please click "Start Collecting" to enable gift features!';
        
        try {
            const registrationState = this.giftService.checkUserRegistrationState();
            
            if (registrationState.source === 'error') {
                message = '⚠️ Registration verification failed. Please restart the app and click "Start Collecting"';
            } else if (registrationState.validationResults) {
                const failedValidations = registrationState.validationResults.filter(v => !v.isRegistered);
                if (failedValidations.some(v => v.reason === 'expired')) {
                    message = '⚠️ Your registration has expired. Please click "Start Collecting" again';
                } else if (failedValidations.some(v => v.reason === 'missing_telegram_id')) {
                    message = '⚠️ Platform verification failed. Please restart the app and click "Start Collecting"';
                }
            }
        } catch (error) {
            this.logger.warn('Failed to get detailed registration state', error);
        }
        
        this.showToast(message, 'warning', 5000);
        
        // Show the main button to guide user
        const platformAdapter = window.DIContainer.get('platformAdapter');
        if (platformAdapter && platformAdapter.showMainButton) {
            platformAdapter.showMainButton('🎁 Start Collecting!', () => {
                if (window.FanZoneApp && window.FanZoneApp.handleMainButtonClick) {
                    window.FanZoneApp.handleMainButtonClick();
                }
            });
        }
    }
    
    async purchaseGift(giftId) {
        let user = null;
        let gift = null;
        
        try {
            // Check registration first (simple check for UI)
            if (!this.checkUserRegistration()) {
                this.showRegistrationRequired();
                return;
            }
            
            // For actual purchase, use comprehensive validation through GiftService
            // This will be checked again in the service layer with all security validations
            // Validate services are still available before critical operation
            if (window.ServiceValidator) {
                window.ServiceValidator.validateService(this.giftService, 'GiftService');
                window.ServiceValidator.validateMethod(this.giftService, 'purchaseGift', 'GiftService');
            }
            
            const authService = window.DIContainer.get('authService');
            
            // Validate auth service before use
            if (window.ServiceValidator) {
                window.ServiceValidator.validateService(authService, 'AuthService');
                window.ServiceValidator.validateMethod(authService, 'getCurrentUser', 'AuthService');
            }
            
            user = authService.getCurrentUser();
            
            if (!user) {
                this.showToast('Please login first', 'error');
                return;
            }
            
            gift = this.gifts.find(g => g.id === giftId);
            if (!gift) {
                this.showToast('Gift not found', 'error');
                return;
            }
            
            // Check if user can afford the gift
            if (user.points < gift.price_points) {
                const needed = gift.price_points - user.points;
                this.showToast(`Not enough points! You need ${needed} more points.`, 'error');
                return;
            }
            
            // Check if gift is in stock
            if (gift.current_supply >= gift.max_supply) {
                this.showToast('This gift is out of stock!', 'error');
                return;
            }
            
            // Check if user already owns this gift
            if (this.userGifts.includes(giftId)) {
                this.showToast('You already own this gift!', 'error');
                return;
            }
            
            // Show confirmation with haptic feedback
            const platformAdapter = window.DIContainer.get('platformAdapter');
            platformAdapter.sendHapticFeedback('light');
            
            const confirmed = await platformAdapter.showConfirm(
                `Purchase ${gift.name} for ${this.formatPoints(gift.price_points)} points?`
            );
            
            if (!confirmed) return;
            
            this.setButtonLoading(giftId, true);
            
            // Add timeout for the purchase operation
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Purchase timed out')), 10000);
            });
            
            // Purchase through service with timeout
            const result = await Promise.race([
                this.giftService.purchaseGift(user.telegram_id || user.id, giftId),
                timeoutPromise
            ]);
            
            if (result.success) {
                // Update local state
                this.userGifts.push(giftId);
                
                // Update user points locally
                user.points = (user.points || 0) - gift.price_points;
                
                // Emit event for other components using base class method
                this.emit('gift:purchased', {
                    giftId: giftId,
                    giftName: result.gift_name || gift.name,
                    pointsSpent: result.price_paid || gift.price_points,
                    userId: user.id
                });
                
                // Also emit user points update
                this.emit('user:points:updated', {
                    userId: user.id,
                    newPoints: user.points,
                    pointsSpent: result.price_paid || gift.price_points
                });
                
                // Success feedback
                platformAdapter.sendHapticFeedback('success');
                this.showToast(`🎉 ${result.gift_name || gift.name} added to your collection!`, 'success');
                this.renderGifts();
                
                // Update gift supply locally
                gift.current_supply = (gift.current_supply || 0) + 1;
            } else {
                // Handle failed purchase
                throw new Error(result.message || 'Purchase failed');
            }
            
        } catch (error) {
            this.logger.error('Gift purchase failed', error, { 
                giftId, 
                userId: user?.id,
                errorType: this.categorizeError(error),
                registrationState: this.giftService.checkUserRegistrationState()
            });
            
            // Handle error with comprehensive categorization and guidance
            await this.handlePurchaseError(error, giftId, gift, user);
            
        } finally {
            this.setButtonLoading(giftId, false);
        }
    }
    
    /**
     * Categorize error types for better handling
     */
    categorizeError(error) {
        const errorMessage = error.message?.toLowerCase() || '';
        
        if (errorMessage.includes('start collecting') || errorMessage.includes('registration')) {
            return 'REGISTRATION_REQUIRED';
        } else if (errorMessage.includes('insufficient points') || errorMessage.includes('not enough points')) {
            return 'INSUFFICIENT_POINTS';
        } else if (errorMessage.includes('out of stock') || errorMessage.includes('supply')) {
            return 'OUT_OF_STOCK';
        } else if (errorMessage.includes('already owned') || errorMessage.includes('own this gift')) {
            return 'ALREADY_OWNED';
        } else if (errorMessage.includes('timeout')) {
            return 'TIMEOUT';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            return 'NETWORK_ERROR';
        } else if (errorMessage.includes('user not found')) {
            return 'USER_NOT_FOUND';
        } else if (errorMessage.includes('gift not found')) {
            return 'GIFT_NOT_FOUND';
        } else if (errorMessage.includes('database') || errorMessage.includes('repository')) {
            return 'DATABASE_ERROR';
        } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
            return 'PERMISSION_ERROR';
        } else {
            return 'UNKNOWN_ERROR';
        }
    }
    
    /**
     * Comprehensive purchase error handler with user guidance
     */
    async handlePurchaseError(error, giftId, gift, user) {
        const errorType = this.categorizeError(error);
        const platformAdapter = window.DIContainer.get('platformAdapter');
        
        // Send appropriate haptic feedback
        platformAdapter.sendHapticFeedback('error');
        
        let errorInfo;
        
        switch (errorType) {
            case 'REGISTRATION_REQUIRED':
                errorInfo = await this.handleRegistrationError(error, gift);
                break;
                
            case 'INSUFFICIENT_POINTS':
                errorInfo = this.handleInsufficientPointsError(error, gift, user);
                break;
                
            case 'OUT_OF_STOCK':
                errorInfo = this.handleOutOfStockError(error, gift);
                break;
                
            case 'ALREADY_OWNED':
                errorInfo = this.handleAlreadyOwnedError(error, gift);
                break;
                
            case 'TIMEOUT':
                errorInfo = this.handleTimeoutError(error, gift);
                break;
                
            case 'NETWORK_ERROR':
                errorInfo = this.handleNetworkError(error, gift);
                break;
                
            case 'USER_NOT_FOUND':
                errorInfo = await this.handleUserNotFoundError(error, gift);
                break;
                
            case 'GIFT_NOT_FOUND':
                errorInfo = this.handleGiftNotFoundError(error, gift);
                break;
                
            case 'DATABASE_ERROR':
                errorInfo = this.handleDatabaseError(error, gift);
                break;
                
            case 'PERMISSION_ERROR':
                errorInfo = this.handlePermissionError(error, gift);
                break;
                
            default:
                errorInfo = this.handleUnknownError(error, gift);
                break;
        }
        
        // Show error message with appropriate styling
        this.showToast(errorInfo.message, errorInfo.type || 'error', errorInfo.duration || 4000);
        
        // Execute recovery action if available
        if (errorInfo.recoveryAction) {
            try {
                await errorInfo.recoveryAction();
            } catch (recoveryError) {
                this.logger.warn('Error recovery action failed', recoveryError);
            }
        }
        
        // Log structured error information
        this.logger.info('Purchase error handled', {
            errorType,
            giftId,
            giftName: gift?.name,
            userId: user?.id,
            message: errorInfo.message,
            hasRecovery: !!errorInfo.recoveryAction
        });
    }
    
    /**
     * Handle registration required errors
     */
    async handleRegistrationError(error, gift) {
        const platformAdapter = window.DIContainer.get('platformAdapter');
        
        return {
            message: '⚠️ Please click "Start Collecting" first to enable gift purchases!',
            type: 'warning',
            duration: 5000,
            recoveryAction: async () => {
                // Show registration guidance
                this.showRegistrationRequired();
                
                // Show main button for immediate action
                if (platformAdapter.isAvailable()) {
                    await platformAdapter.showMainButton('🎁 Start Collecting!', async () => {
                        if (window.FanZoneApp && window.FanZoneApp.handleMainButtonClick) {
                            await window.FanZoneApp.handleMainButtonClick();
                        }
                    });
                }
            }
        };
    }
    
    /**
     * Handle insufficient points errors
     */
    handleInsufficientPointsError(error, gift, user) {
        const needed = gift ? gift.price_points - (user?.points || 0) : 0;
        
        return {
            message: `💰 Not enough points! You need ${this.formatPoints(needed)} more points to purchase ${gift?.name || 'this gift'}.`,
            type: 'warning',
            duration: 4000,
            recoveryAction: () => {
                // Could trigger a "how to earn points" guide
                this.showToast('💡 Tip: Complete activities to earn more points!', 'info', 3000);
            }
        };
    }
    
    /**
     * Handle out of stock errors
     */
    handleOutOfStockError(error, gift) {
        return {
            message: `📦 ${gift?.name || 'This gift'} is currently out of stock. Check back later!`,
            type: 'warning',
            duration: 4000,
            recoveryAction: () => {
                // Refresh gifts to show current availability
                setTimeout(() => {
                    this.renderGifts();
                }, 1000);
            }
        };
    }
    
    /**
     * Handle already owned errors
     */
    handleAlreadyOwnedError(error, gift) {
        return {
            message: `✅ You already own ${gift?.name || 'this gift'}! Check your collection.`,
            type: 'info',
            duration: 3000,
            recoveryAction: () => {
                // Navigate to profile to show collection
                if (window.FanZoneApp) {
                    setTimeout(() => {
                        window.FanZoneApp.navigateToPage('profile');
                    }, 1000);
                }
            }
        };
    }
    
    /**
     * Handle timeout errors
     */
    handleTimeoutError(error, gift) {
        return {
            message: '⏱️ Purchase timed out. Please check your connection and try again.',
            type: 'error',
            duration: 4000,
            recoveryAction: () => {
                // Refresh data after timeout
                setTimeout(() => {
                    this.loadData();
                }, 2000);
            }
        };
    }
    
    /**
     * Handle network errors
     */
    handleNetworkError(error, gift) {
        return {
            message: '🌐 Network error. Please check your internet connection and try again.',
            type: 'error',
            duration: 5000,
            recoveryAction: () => {
                // Check network status and refresh if online
                if (navigator.onLine) {
                    setTimeout(() => {
                        this.loadData();
                    }, 2000);
                }
            }
        };
    }
    
    /**
     * Handle user not found errors
     */
    async handleUserNotFoundError(error, gift) {
        return {
            message: '👤 User session expired. Please restart the app.',
            type: 'error',
            duration: 5000,
            recoveryAction: async () => {
                // Clear user session and restart
                localStorage.removeItem('fanzone_current_user');
                localStorage.removeItem('fanzone_auth_token');
                
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        };
    }
    
    /**
     * Handle gift not found errors
     */
    handleGiftNotFoundError(error, gift) {
        return {
            message: '🎁 Gift not found. The gift may have been removed.',
            type: 'error',
            duration: 4000,
            recoveryAction: () => {
                // Refresh gifts list
                this.loadData();
            }
        };
    }
    
    /**
     * Handle database errors
     */
    handleDatabaseError(error, gift) {
        return {
            message: '🔧 Database temporarily unavailable. Please try again in a moment.',
            type: 'error',
            duration: 5000,
            recoveryAction: () => {
                // Attempt retry after delay
                setTimeout(() => {
                    this.showToast('🔄 You can try purchasing again now.', 'info');
                }, 5000);
            }
        };
    }
    
    /**
     * Handle permission errors
     */
    handlePermissionError(error, gift) {
        return {
            message: '🔒 Permission denied. Please restart the app and try again.',
            type: 'error',
            duration: 5000,
            recoveryAction: () => {
                // Clear auth and suggest restart
                setTimeout(() => {
                    this.showToast('💡 Tip: Restart the app to refresh permissions.', 'info');
                }, 2000);
            }
        };
    }
    
    /**
     * Handle unknown errors
     */
    handleUnknownError(error, gift) {
        return {
            message: `❌ Purchase failed: ${error.message || 'Unknown error'}. Please try again.`,
            type: 'error',
            duration: 4000,
            recoveryAction: () => {
                // General recovery - refresh data
                setTimeout(() => {
                    this.loadData();
                }, 2000);
            }
        };
    }
    
    /**
     * Handle gift purchased event
     */
    handleGiftPurchased(data) {
        if (!this.userGifts.includes(data.giftId)) {
            this.userGifts.push(data.giftId);
            this.renderGifts();
        }
    }
    
    /**
     * Set button loading state
     */
    setButtonLoading(giftId, isLoading) {
        const button = document.querySelector(`[data-gift-id="${giftId}"] .purchase-btn`);
        if (button) {
            button.disabled = isLoading;
            button.textContent = isLoading ? '⏳ Processing...' : '🎁 Collect Gift';
        }
    }
    
    /**
     * Update statistics display
     */
    updateStats() {
        const statsElement = document.getElementById('gifts-count');
        if (statsElement) {
            const total = this.gifts.length;
            const filtered = this.filteredGifts.length;
            const available = this.filteredGifts.filter(g => g.current_supply < g.max_supply).length;
            
            if (this.currentFilter === 'all' && !this.searchQuery) {
                statsElement.textContent = `${total} gifts • ${available} available`;
            } else {
                statsElement.textContent = `${filtered} of ${total} gifts • ${available} available`;
            }
        }
    }
    
    /**
     * Show loading state
     */
    showLoadingState() {
        const container = document.getElementById('gifts-container');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading gifts...</p>
                </div>
            `;
        }
    }
    
    /**
     * Show empty state
     */
    renderEmptyState() {
        if (this.searchQuery) {
            return `
                <div class="empty-state">
                    <h3>🔍 No gifts found</h3>
                    <p>No gifts match "${this.searchQuery}"</p>
                    <button class="btn btn-secondary" onclick="document.getElementById('gift-search').value=''; window.GiftsController.searchGifts('')">
                        Clear Search
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="empty-state">
                <h3>🎁 No gifts available</h3>
                <p>Check back soon for new digital gifts!</p>
            </div>
        `;
    }
    
    /**
     * Show loading state for grid
     */
    renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading gifts...</p>
            </div>
        `;
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('gifts-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>⚠️ Error</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.GiftsController.initialize()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * Refresh gifts data
     */
    async refresh() {
        this.isInitialized = false;
        await this.initialize();
    }
    
    // Helper methods
    formatPoints(points) {
        return new Intl.NumberFormat().format(points || 0);
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    showToast(message, type = 'info', duration = 3000) {
        // Use the app's toast system
        if (window.FanZoneApp && window.FanZoneApp.showToast) {
            window.FanZoneApp.showToast(message, type, duration);
        } else {
            alert(message);
        }
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GiftsController;
}

window.GiftsController = GiftsController;