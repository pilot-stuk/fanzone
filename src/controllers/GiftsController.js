// Gifts Controller - UI logic for gifts page
// Follows Single Responsibility Principle - only handles gift UI

class GiftsController {
    constructor(giftService, userService, logger, eventBus) {
        this.giftService = giftService;
        this.userService = userService;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.gifts = [];
        this.filteredGifts = [];
        this.userGifts = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.isInitialized = false;
        this.isLoading = false;
    }
    
    /**
     * Initialize the gifts page
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.logger.debug('Initializing gifts controller');
            
            this.showLoadingState();
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
            
            if (!currentUser) {
                throw new Error('No authenticated user');
            }
            
            // Load gifts and user gifts in parallel
            const [gifts, userGifts] = await Promise.all([
                this.giftService.getAvailableGifts(),
                this.giftService.getUserGifts(currentUser.telegram_id || currentUser.id)
            ]);
            
            this.gifts = gifts;
            this.userGifts = userGifts.map(ug => ug.gift_id || ug.gift?.id);
            
            this.filterGifts();
            
        } catch (error) {
            this.logger.error('Failed to load gifts data', error);
            throw error;
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
        
        // Event bus subscriptions
        this.eventBus.subscribe('gift:purchased', (data) => {
            this.handleGiftPurchased(data);
        });
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
        const grid = document.getElementById('gifts-grid');
        if (!grid) return;
        
        if (this.isLoading) {
            grid.innerHTML = this.renderLoadingState();
            return;
        }
        
        if (this.filteredGifts.length === 0) {
            grid.innerHTML = this.renderEmptyState();
            return;
        }
        
        grid.innerHTML = this.filteredGifts.map(gift => this.renderGiftCard(gift)).join('');
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
    async purchaseGift(giftId) {
        try {
            const authService = window.DIContainer.get('authService');
            const user = authService.getCurrentUser();
            
            if (!user) {
                this.showToast('Please login first', 'error');
                return;
            }
            
            const gift = this.gifts.find(g => g.id === giftId);
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
                
                // Emit event for other components
                this.eventBus.emit('gift:purchased', {
                    giftId: giftId,
                    giftName: result.gift_name || gift.name,
                    pointsSpent: result.price_paid || gift.price_points,
                    userId: user.id
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
            this.logger.error('Gift purchase failed', error);
            
            // Enhanced error messages
            let errorMessage = 'Purchase failed';
            
            if (error.message.includes('insufficient points')) {
                errorMessage = 'Not enough points to purchase this gift';
            } else if (error.message.includes('out of stock')) {
                errorMessage = 'This gift is no longer available';
            } else if (error.message.includes('already owned')) {
                errorMessage = 'You already own this gift';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Purchase timed out. Please try again.';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error. Please check your connection.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showToast(errorMessage, 'error');
            
            // Error haptic feedback
            const platformAdapter = window.DIContainer.get('platformAdapter');
            platformAdapter.sendHapticFeedback('error');
            
        } finally {
            this.setButtonLoading(giftId, false);
        }
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