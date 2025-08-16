// Gift browsing and purchasing functionality for FanZone
// This module handles gift display, filtering, and purchase logic

class GiftsManager {
    constructor() {
        this.gifts = [];
        this.filteredGifts = [];
        this.userGifts = [];
        this.isLoading = false;
        this.isPurchasing = false;
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.subscription = null;
        
        // Performance optimizations
        this.renderDebounceTime = 100;
        this.lastRenderTime = 0;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadGifts = this.loadGifts.bind(this);
        this.renderGifts = this.renderGifts.bind(this);
        this.purchaseGift = this.purchaseGift.bind(this);
        this.filterGifts = this.filterGifts.bind(this);
        this.searchGifts = this.searchGifts.bind(this);
        this.handleInventoryUpdate = this.handleInventoryUpdate.bind(this);
        this.showPurchaseConfirmation = this.showPurchaseConfirmation.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            this.showLoadingState();
            await this.loadGifts();
            this.setupFilteringAndSearch();
            this.filterGifts();
            this.renderGifts();
            this.setupEventListeners();
            this.setupRealTimeUpdates();
            
            // Track gifts view
            window.FanZoneApp?.trackEvent('gifts_view', {
                total_gifts: this.gifts.length,
                available_gifts: this.gifts.filter(g => g.current_supply < g.max_supply).length
            });
            
        } catch (error) {
            Utils.logError(error, 'Gifts initialization');
            this.showError('Failed to load gifts');
        }
    }
    
    setupEventListeners() {
        // Gift purchase clicks
        const container = Utils.getElementById('gifts-container');
        if (container) {
            container.addEventListener('click', (e) => {
                const giftCard = e.target.closest('.gift-card');
                if (giftCard && giftCard.dataset.giftId) {
                    this.handleGiftClick(giftCard.dataset.giftId);
                }
            });
        }
        
        // Filter buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-filter]')) {
                const filter = e.target.closest('[data-filter]').dataset.filter;
                this.setFilter(filter);
            }
        });
        
        // Search input
        const searchInput = document.getElementById('gift-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchGifts(e.target.value);
            }, 300));
        }
    }

    setupFilteringAndSearch() {
        const container = Utils.getElementById('gifts-container');
        if (!container) return;
        
        // Create filtering and search UI
        const filterHTML = `
            <div class="gifts-controls">
                <div class="search-section">
                    <div class="search-input-container">
                        <input type="text" id="gift-search" placeholder="🔍 Search gifts..." />
                        <button id="clear-search" style="display: none;">✕</button>
                    </div>
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
        
        container.innerHTML = filterHTML;
    }

    setupRealTimeUpdates() {
        if (window.FanZoneRealtime?.isReady()) {
            const realtimeManager = window.FanZoneRealtime.getManager();
            
            // Subscribe to gift inventory updates
            realtimeManager.subscribeToGiftInventory((data) => {
                this.handleInventoryUpdate(data);
            });
            
            if (CONFIG.DEBUG) {
                console.log('🎁 Real-time gift updates enabled');
            }
        }
    }
    
    // ======================
    // Data Loading
    // ======================
    
    async loadGifts() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        const startTime = performance.now();
        
        try {
            const app = window.FanZoneApp;
            const supabase = app?.getSupabase();
            
            if (supabase) {
                // Load from Supabase with optimized query
                const { data: gifts, error } = await supabase
                    .from(CONFIG.TABLES.GIFTS)
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                this.gifts = gifts || [];
                
                // Load user's gifts efficiently
                const user = app.getUser();
                if (user) {
                    const { data: userGifts, error: userGiftsError } = await supabase
                        .from(CONFIG.TABLES.USER_GIFTS)
                        .select('gift_id')
                        .eq('user_id', user.id);
                    
                    if (userGiftsError) {
                        Utils.logError(userGiftsError, 'Load user gifts');
                        this.userGifts = [];
                    } else {
                        this.userGifts = userGifts?.map(ug => ug.gift_id) || [];
                    }
                }
                
                if (CONFIG.DEBUG) {
                    const loadTime = performance.now() - startTime;
                    console.log(`🎁 Gifts loaded in ${loadTime.toFixed(2)}ms (${this.gifts.length} gifts, ${this.userGifts.length} owned)`);
                }
                
            } else {
                // MVP mode - use sample gifts
                this.gifts = this.getSampleGifts();
                this.userGifts = Utils.getStorage('user_gifts', []);
            }
            
        } catch (error) {
            Utils.logError(error, 'Load gifts');
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    // ======================
    // Filtering and Search
    // ======================

    filterGifts() {
        let filtered = [...this.gifts];
        
        // Apply category filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(gift => gift.category === this.currentFilter);
        }
        
        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(gift => 
                gift.name.toLowerCase().includes(query) ||
                gift.description.toLowerCase().includes(query) ||
                gift.category.toLowerCase().includes(query)
            );
        }
        
        // Sort by availability and then by price
        filtered.sort((a, b) => {
            const aAvailable = a.current_supply < a.max_supply;
            const bAvailable = b.current_supply < b.max_supply;
            
            if (aAvailable !== bAvailable) {
                return bAvailable ? 1 : -1; // Available first
            }
            
            return a.price_points - b.price_points; // Cheaper first
        });
        
        this.filteredGifts = filtered;
        this.updateGiftsStats();
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
        
        this.filterGifts();
        this.renderGifts();
        
        // Track filter usage
        window.FanZoneApp?.trackEvent('gifts_filter', { filter });
    }

    searchGifts(query) {
        this.searchQuery = query.trim();
        
        // Update clear button visibility
        const clearButton = document.getElementById('clear-search');
        if (clearButton) {
            clearButton.style.display = this.searchQuery ? 'block' : 'none';
        }
        
        this.filterGifts();
        this.renderGifts();
        
        // Track search usage
        if (this.searchQuery) {
            window.FanZoneApp?.trackEvent('gifts_search', { 
                query: this.searchQuery,
                results: this.filteredGifts.length 
            });
        }
    }

    updateGiftsStats() {
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
    
    getSampleGifts() {
        return [
            {
                id: 'gift-1',
                name: '⚽ Match Ball',
                description: 'Official match ball from today\'s game',
                image_url: 'https://via.placeholder.com/150x100/3390ec/ffffff?text=⚽',
                price_points: 50,
                max_supply: 100,
                current_supply: 23,
                category: 'match',
                is_active: true
            },
            {
                id: 'gift-2',
                name: '🏆 Victory Trophy',
                description: 'Celebrate the team\'s amazing victory!',
                image_url: 'https://via.placeholder.com/150x100/FFD700/000000?text=🏆',
                price_points: 100,
                max_supply: 50,
                current_supply: 12,
                category: 'trophy',
                is_active: true
            },
            {
                id: 'gift-3',
                name: '👕 Team Jersey',
                description: 'Limited edition digital jersey',
                image_url: 'https://via.placeholder.com/150x100/FF4444/ffffff?text=👕',
                price_points: 75,
                max_supply: 200,
                current_supply: 87,
                category: 'player',
                is_active: true
            },
            {
                id: 'gift-4',
                name: '🥅 Goal Celebration',
                description: 'Commemorate that amazing goal!',
                image_url: 'https://via.placeholder.com/150x100/00AA00/ffffff?text=🥅',
                price_points: 30,
                max_supply: 500,
                current_supply: 234,
                category: 'match',
                is_active: true
            },
            {
                id: 'gift-5',
                name: '⭐ Star Player Card',
                description: 'Exclusive star player digital card',
                image_url: 'https://via.placeholder.com/150x100/9C27B0/ffffff?text=⭐',
                price_points: 150,
                max_supply: 25,
                current_supply: 3,
                category: 'special',
                is_active: true
            }
        ];
    }
    
    // ======================
    // Rendering
    // ======================
    
    renderGifts() {
        const gridContainer = Utils.getElementById('gifts-grid');
        if (!gridContainer) return;
        
        // Debounce rendering for performance
        const now = performance.now();
        if (now - this.lastRenderTime < this.renderDebounceTime) {
            setTimeout(() => this.renderGifts(), this.renderDebounceTime);
            return;
        }
        this.lastRenderTime = now;
        
        if (this.isLoading) {
            gridContainer.innerHTML = this.renderLoadingState();
            return;
        }
        
        if (this.filteredGifts.length === 0) {
            gridContainer.innerHTML = this.renderEmptyState();
            return;
        }
        
        // Render filtered gifts
        gridContainer.innerHTML = this.filteredGifts.map(gift => this.renderGiftCard(gift)).join('');
        
        // Add fade-in animation
        gridContainer.classList.add('fade-in');
        setTimeout(() => gridContainer.classList.remove('fade-in'), 300);
    }

    renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading amazing gifts...</p>
            </div>
        `;
    }

    renderEmptyState() {
        if (this.searchQuery) {
            return `
                <div class="empty-state">
                    <h3>🔍 No gifts found</h3>
                    <p>No gifts match "${this.searchQuery}". Try a different search term.</p>
                    <button class="btn btn-secondary" onclick="document.getElementById('gift-search').value=''; window.GiftsManager.searchGifts('')">
                        Clear Search
                    </button>
                </div>
            `;
        }
        
        if (this.currentFilter !== 'all') {
            return `
                <div class="empty-state">
                    <h3>🎁 No ${this.currentFilter} gifts</h3>
                    <p>No gifts in this category yet. Try browsing all gifts!</p>
                    <button class="btn btn-secondary" onclick="window.GiftsManager.setFilter('all')">
                        View All Gifts
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="empty-state">
                <h3>🎁 No gifts available yet</h3>
                <p>Check back soon for new digital gifts!</p>
                <button class="btn btn-primary" onclick="window.GiftsManager.loadGifts().then(() => window.GiftsManager.renderGifts())">
                    Refresh
                </button>
            </div>
        `;
    }

    showLoadingState() {
        const container = Utils.getElementById('gifts-container');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading gifts...</p>
                </div>
            `;
        }
    }
    
    renderGiftCard(gift) {
        const isOwned = this.userGifts.includes(gift.id);
        const isOutOfStock = gift.current_supply >= gift.max_supply;
        const user = window.FanZoneApp?.getUser();
        const canAfford = user && user.points >= gift.price_points;
        
        const supplyPercentage = (gift.current_supply / gift.max_supply) * 100;
        const rarityClass = this.getRarityClass(gift);
        const statusClass = isOwned ? 'owned' : isOutOfStock ? 'out-of-stock' : !canAfford ? 'insufficient-points' : '';
        
        return `
            <div class="gift-card ${statusClass} ${rarityClass}" data-gift-id="${gift.id}">
                <div class="gift-image">
                    <img src="${gift.image_url}" alt="${gift.name}" loading="lazy" />
                    ${isOwned ? '<div class="owned-badge">✓ Owned</div>' : ''}
                    ${supplyPercentage > 90 ? '<div class="low-stock-badge">⚡ Low Stock</div>' : ''}
                    ${gift.rarity ? `<div class="rarity-badge rarity-${gift.rarity}">${this.getRarityIcon(gift.rarity)}</div>` : ''}
                </div>
                
                <div class="gift-info">
                    <div class="gift-header">
                        <h3>${gift.name}</h3>
                        <div class="category-badge">${this.getCategoryIcon(gift.category)}</div>
                    </div>
                    
                    <p class="gift-description">${Utils.truncateText(gift.description, 60)}</p>
                    
                    <div class="gift-stats">
                        <div class="gift-price">
                            <span class="price-tag">${Utils.formatPoints(gift.price_points)} pts</span>
                        </div>
                        
                        <div class="supply-section">
                            <div class="supply-bar">
                                <div class="supply-fill" style="width: ${supplyPercentage}%"></div>
                            </div>
                            <span class="supply-text">${gift.current_supply}/${gift.max_supply}</span>
                        </div>
                    </div>
                    
                    <div class="gift-actions">
                        ${this.renderGiftButton(gift, isOwned, isOutOfStock, canAfford)}
                    </div>
                </div>
            </div>
        `;
    }

    getRarityClass(gift) {
        if (gift.rarity) {
            return `rarity-${gift.rarity}`;
        }
        
        // Fallback based on price
        if (gift.price_points >= 150) return 'rarity-legendary';
        if (gift.price_points >= 100) return 'rarity-epic';
        if (gift.price_points >= 50) return 'rarity-rare';
        return 'rarity-common';
    }

    getRarityIcon(rarity) {
        const icons = {
            'common': '⚪',
            'rare': '🔵',
            'epic': '🟣',
            'legendary': '🟡'
        };
        return icons[rarity] || '⚪';
    }

    getCategoryIcon(category) {
        const icons = {
            'match': '⚽',
            'trophy': '🏆',
            'player': '👕',
            'special': '⭐',
            'general': '🎁'
        };
        return icons[category] || '🎁';
    }
    
    renderGiftButton(gift, isOwned, isOutOfStock, canAfford) {
        if (isOwned) {
            return '<button class="btn btn-success" disabled><span class="btn-icon">✓</span> Owned</button>';
        }
        
        if (isOutOfStock) {
            return '<button class="btn btn-secondary" disabled><span class="btn-icon">❌</span> Out of Stock</button>';
        }
        
        if (!canAfford) {
            const user = window.FanZoneApp?.getUser();
            const needed = gift.price_points - (user?.points || 0);
            return `<button class="btn btn-secondary" disabled><span class="btn-icon">💰</span> Need ${needed} more pts</button>`;
        }
        
        return `<button class="btn btn-primary" onclick="window.GiftsManager.showPurchaseConfirmation('${gift.id}')">
            <span class="btn-icon">🎁</span> Collect Gift
        </button>`;
    }
    
    // ======================
    // Gift Interaction
    // ======================
    
    handleGiftClick(giftId) {
        const gift = this.gifts.find(g => g.id === giftId);
        if (!gift) return;
        
        // Show gift details
        this.showGiftDetails(gift);
        Utils.hapticFeedback('light');
    }
    
    showGiftDetails(gift) {
        const isOwned = this.userGifts.includes(gift.id);
        const isOutOfStock = gift.current_supply >= gift.max_supply;
        const user = window.FanZoneApp?.getUser();
        const canAfford = user && user.points >= gift.price_points;
        
        const supplyPercentage = (gift.current_supply / gift.max_supply) * 100;
        const rarityText = gift.rarity ? ` • ${gift.rarity.charAt(0).toUpperCase() + gift.rarity.slice(1)}` : '';
        
        const message = `🎁 ${gift.name}${rarityText}

${gift.description}

💰 Price: ${Utils.formatPoints(gift.price_points)} points
📦 Supply: ${gift.current_supply}/${gift.max_supply} (${Math.round(100-supplyPercentage)}% available)
🏷️ Category: ${gift.category}

${isOwned ? '✅ You already own this gift!' : 
  isOutOfStock ? '❌ This gift is out of stock' :
  !canAfford ? `💸 You need ${gift.price_points - user.points} more points` :
  '🎁 Tap "Collect Gift" to add this to your collection!'}`;
        
        // Show toast instead of alert for better UX
        Utils.showToast(message, 'info', 5000);
    }

    showPurchaseConfirmation(giftId) {
        const gift = this.gifts.find(g => g.id === giftId);
        if (!gift) return;
        
        const user = window.FanZoneApp?.getUser();
        if (!user) return;
        
        const remainingPoints = user.points - gift.price_points;
        
        const confirmMessage = `🎁 Confirm Purchase

${gift.name}
💰 Cost: ${Utils.formatPoints(gift.price_points)} points

After purchase:
💳 Your points: ${Utils.formatPoints(remainingPoints)} pts
🎁 This gift will be added to your collection

Are you sure you want to collect this gift?`;
        
        if (confirm(confirmMessage)) {
            this.purchaseGift(giftId);
        }
    }
    
    async purchaseGift(giftId) {
        if (this.isPurchasing) {
            Utils.showToast('Please wait, processing another purchase...', 'warning');
            return;
        }
        
        const gift = this.gifts.find(g => g.id === giftId);
        if (!gift) {
            Utils.showToast('Gift not found', 'error');
            return;
        }
        
        const user = window.FanZoneApp?.getUser();
        if (!user) {
            Utils.showToast('Please log in first', 'error');
            return;
        }
        
        // Comprehensive validation checks
        const validationResult = this.validatePurchase(gift, user);
        if (!validationResult.valid) {
            Utils.showToast(validationResult.message, validationResult.type);
            return;
        }
        
        this.isPurchasing = true;
        
        try {
            // Show loading state with better UX
            this.setGiftButtonLoading(giftId, true);
            
            Utils.showToast('Processing your purchase...', 'info');
            
            // Process purchase with retry logic
            const result = await this.processPurchaseWithRetry(giftId, gift);
            
            if (result.success) {
                // Update local state immediately for better UX
                this.userGifts.push(giftId);
                gift.current_supply += 1;
                
                // Update user points locally
                user.points -= gift.price_points;
                
                // Refresh UI
                this.filterGifts();
                this.renderGifts();
                
                // Update app's user display
                window.FanZoneApp?.updateUserDisplay();
                
                // Refresh leaderboard and profile
                if (window.LeaderboardManager) {
                    window.LeaderboardManager.refresh();
                }
                if (window.ProfileManager) {
                    window.ProfileManager.refresh();
                }
                
                Utils.showToast(`🎉 ${gift.name} added to your collection!`, 'success');
                Utils.hapticFeedback('success');
                
                // Track successful purchase
                window.FanZoneApp?.trackEvent('gift_purchase_success', {
                    gift_id: giftId,
                    gift_name: gift.name,
                    price: gift.price_points,
                    remaining_points: user.points
                });
                
                // Reload data from server to ensure consistency
                setTimeout(() => {
                    this.loadGifts().then(() => this.renderGifts());
                }, 1000);
                
            } else {
                throw new Error(result.message || 'Purchase failed');
            }
            
        } catch (error) {
            Utils.logError(error, 'Gift purchase');
            
            let errorMessage = 'Purchase failed. Please try again.';
            
            if (error.message.includes('INSUFFICIENT_POINTS')) {
                errorMessage = 'Not enough points for this purchase.';
            } else if (error.message.includes('OUT_OF_STOCK')) {
                errorMessage = 'This gift is now out of stock.';
            } else if (error.message.includes('ALREADY_OWNED')) {
                errorMessage = 'You already own this gift.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Check your connection and try again.';
            }
            
            Utils.showToast(errorMessage, 'error');
            
            // Track failed purchase
            window.FanZoneApp?.trackEvent('gift_purchase_failed', {
                gift_id: giftId,
                gift_name: gift.name,
                error: error.message
            });
            
        } finally {
            this.isPurchasing = false;
            this.setGiftButtonLoading(giftId, false);
        }
    }

    validatePurchase(gift, user) {
        if (this.userGifts.includes(gift.id)) {
            return { valid: false, message: 'You already own this gift!', type: 'warning' };
        }
        
        if (gift.current_supply >= gift.max_supply) {
            return { valid: false, message: 'This gift is out of stock!', type: 'error' };
        }
        
        if (user.points < gift.price_points) {
            const needed = gift.price_points - user.points;
            return { valid: false, message: `You need ${needed} more points to buy this gift`, type: 'warning' };
        }
        
        return { valid: true };
    }

    setGiftButtonLoading(giftId, isLoading) {
        const button = document.querySelector(`[data-gift-id="${giftId}"] .btn-primary`);
        if (button) {
            if (isLoading) {
                button.disabled = true;
                button.innerHTML = '<span class="btn-icon">⏳</span> Processing...';
                button.classList.add('loading');
            } else {
                button.disabled = false;
                button.innerHTML = '<span class="btn-icon">🎁</span> Collect Gift';
                button.classList.remove('loading');
            }
        }
    }

    async processPurchaseWithRetry(giftId, gift, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.processPurchase(giftId, gift);
                return { success: true, result };
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                
                if (CONFIG.DEBUG) {
                    console.log(`🔄 Retrying purchase attempt ${attempt + 1}/${maxRetries}`);
                }
            }
        }
    }
    
    async processPurchase(giftId, gift) {
        const app = window.FanZoneApp;
        const supabase = app?.getSupabase();
        const user = app?.getUser();
        
        if (supabase && user) {
            // Use the enhanced purchase function from database
            const { data: result, error: purchaseError } = await supabase.rpc('purchase_gift', {
                p_user_telegram_id: user.telegram_id,
                p_gift_id: giftId
            });
            
            if (purchaseError) {
                throw new Error(`Database error: ${purchaseError.message}`);
            }
            
            if (!result || !result.success) {
                throw new Error(result?.message || 'Purchase failed');
            }
            
            // Update local user data
            user.points = result.remaining_points || (user.points - gift.price_points);
            user.total_gifts = (user.total_gifts || 0) + 1;
            
            // Update the app's user data
            Utils.setStorage(CONFIG.STORAGE_KEYS.USER_DATA, user);
            
            return result;
            
        } else {
            // MVP mode - update localStorage
            const success = await app.updateUserPoints(-gift.price_points);
            if (!success) {
                throw new Error('Failed to deduct points');
            }
            
            // Add to user's collection
            this.userGifts.push(giftId);
            Utils.setStorage('user_gifts', this.userGifts);
            
            // Update gift supply (mock)
            gift.current_supply += 1;
            Utils.setStorage('gifts_data', this.gifts);
            
            return { success: true, gift_name: gift.name, price_paid: gift.price_points };
        }
    }

    // ======================
    // Real-time Updates
    // ======================

    handleInventoryUpdate(data) {
        if (!data || !data.gift) return;
        
        try {
            const giftId = data.gift.id;
            const giftIndex = this.gifts.findIndex(g => g.id === giftId);
            
            if (giftIndex !== -1) {
                // Update gift data
                this.gifts[giftIndex] = { ...this.gifts[giftIndex], ...data.gift };
                
                // Re-filter and render if this gift is visible
                const isVisible = this.filteredGifts.some(g => g.id === giftId);
                if (isVisible) {
                    this.filterGifts();
                    this.renderGifts();
                }
                
                // Show notification if stock is running low
                const gift = this.gifts[giftIndex];
                const supplyPercentage = (gift.current_supply / gift.max_supply) * 100;
                
                if (supplyPercentage >= 90 && supplyPercentage < 100) {
                    Utils.showToast(`⚡ ${gift.name} is running low! Only ${gift.max_supply - gift.current_supply} left`, 'warning');
                } else if (supplyPercentage >= 100) {
                    Utils.showToast(`❌ ${gift.name} is now out of stock!`, 'error');
                }
                
                if (CONFIG.DEBUG) {
                    console.log('📦 Gift inventory updated:', data);
                }
            }
            
        } catch (error) {
            Utils.logError(error, 'Handle inventory update');
        }
    }
    
    // ======================
    // Utility Methods
    // ======================
    
    showError(message) {
        const container = Utils.getElementById('gifts-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>⚠️ Error Loading Gifts</h3>
                    <p>${message}</p>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="window.GiftsManager.init()">
                            🔄 Try Again
                        </button>
                        <button class="btn btn-secondary" onclick="window.GiftsManager.loadSampleData()">
                            📋 Use Sample Data
                        </button>
                    </div>
                </div>
            `;
        }
    }
    
    async loadSampleData() {
        try {
            this.gifts = this.getSampleGifts();
            this.userGifts = [];
            this.filterGifts();
            this.renderGifts();
            Utils.showToast('Sample gifts loaded for testing', 'info');
        } catch (error) {
            Utils.logError(error, 'Load sample data');
        }
    }
    
    getUserGifts() {
        return this.userGifts;
    }
    
    getGifts() {
        return this.gifts;
    }
    
    getFilteredGifts() {
        return this.filteredGifts;
    }
    
    async refresh() {
        try {
            this.showLoadingState();
            await this.loadGifts();
            this.filterGifts();
            this.renderGifts();
            
            if (CONFIG.DEBUG) {
                console.log('🎁 Gifts refreshed successfully');
            }
        } catch (error) {
            Utils.logError(error, 'Refresh gifts');
            this.showError('Failed to refresh gifts');
        }
    }
    
    // Get gift statistics for analytics
    getGiftsStats() {
        return {
            total_gifts: this.gifts.length,
            owned_gifts: this.userGifts.length,
            available_gifts: this.gifts.filter(g => g.current_supply < g.max_supply).length,
            out_of_stock: this.gifts.filter(g => g.current_supply >= g.max_supply).length,
            current_filter: this.currentFilter,
            search_query: this.searchQuery,
            filtered_count: this.filteredGifts.length
        };
    }
    
    // Cleanup method
    destroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
        
        // Clear any pending purchase
        this.isPurchasing = false;
        
        if (CONFIG.DEBUG) {
            console.log('🎁 GiftsManager destroyed');
        }
    }
}

// Create global instance
window.GiftsManager = new GiftsManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.GiftsManager.destroy();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GiftsManager;
}