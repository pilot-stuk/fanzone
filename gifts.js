// Gift browsing and purchasing functionality for FanZone
// This module handles gift display, filtering, and purchase logic

class GiftsManager {
    constructor() {
        this.gifts = [];
        this.userGifts = [];
        this.isLoading = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadGifts = this.loadGifts.bind(this);
        this.renderGifts = this.renderGifts.bind(this);
        this.purchaseGift = this.purchaseGift.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            await this.loadGifts();
            this.renderGifts();
            this.setupEventListeners();
        } catch (error) {
            Utils.logError(error, 'Gifts initialization');
            this.showError('Failed to load gifts');
        }
    }
    
    setupEventListeners() {
        // Gift purchase clicks will be added dynamically
        const container = Utils.getElementById('gifts-container');
        if (container) {
            container.addEventListener('click', (e) => {
                const giftCard = e.target.closest('.gift-card');
                if (giftCard && giftCard.dataset.giftId) {
                    this.handleGiftClick(giftCard.dataset.giftId);
                }
            });
        }
    }
    
    // ======================
    // Data Loading
    // ======================
    
    async loadGifts() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            const app = window.FanZoneApp;
            const supabase = app?.getSupabase();
            
            if (supabase) {
                // Load from Supabase
                const { data: gifts, error } = await supabase
                    .from(CONFIG.TABLES.GIFTS)
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                this.gifts = gifts || [];
                
                // Load user's gifts
                const user = app.getUser();
                if (user) {
                    const { data: userGifts, error: userGiftsError } = await supabase
                        .from(CONFIG.TABLES.USER_GIFTS)
                        .select('gift_id')
                        .eq('user_id', user.id);
                    
                    if (userGiftsError) {
                        Utils.logError(userGiftsError, 'Load user gifts');
                    } else {
                        this.userGifts = userGifts?.map(ug => ug.gift_id) || [];
                    }
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
        const container = Utils.getElementById('gifts-container');
        if (!container) return;
        
        if (this.gifts.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <h3>No gifts available yet</h3>
                    <p>Check back soon for new digital gifts!</p>
                </div>
            `;
            return;
        }
        
        // Clear welcome message and render gifts
        container.innerHTML = this.gifts.map(gift => this.renderGiftCard(gift)).join('');
    }
    
    renderGiftCard(gift) {
        const isOwned = this.userGifts.includes(gift.id);
        const isOutOfStock = gift.current_supply >= gift.max_supply;
        const user = window.FanZoneApp?.getUser();
        const canAfford = user && user.points >= gift.price_points;
        
        const statusClass = isOwned ? 'owned' : isOutOfStock ? 'out-of-stock' : !canAfford ? 'insufficient-points' : '';
        
        return `
            <div class="gift-card ${statusClass}" data-gift-id="${gift.id}">
                <div class="gift-image">
                    <img src="${gift.image_url}" alt="${gift.name}" loading="lazy" />
                    ${isOwned ? '<div class="owned-badge">✓ Owned</div>' : ''}
                </div>
                
                <div class="gift-info">
                    <h3>${gift.name}</h3>
                    <p>${Utils.truncateText(gift.description, 40)}</p>
                    
                    <div class="gift-price">
                        <span class="price-tag">${Utils.formatPoints(gift.price_points)} pts</span>
                        <span class="supply-info">${gift.current_supply}/${gift.max_supply}</span>
                    </div>
                    
                    <div class="gift-actions">
                        ${this.renderGiftButton(gift, isOwned, isOutOfStock, canAfford)}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderGiftButton(gift, isOwned, isOutOfStock, canAfford) {
        if (isOwned) {
            return '<button class="btn btn-secondary" disabled>Already Owned</button>';
        }
        
        if (isOutOfStock) {
            return '<button class="btn btn-secondary" disabled>Out of Stock</button>';
        }
        
        if (!canAfford) {
            return '<button class="btn btn-secondary" disabled>Not Enough Points</button>';
        }
        
        return `<button class="btn btn-primary" onclick="window.GiftsManager.purchaseGift('${gift.id}')">Collect Gift</button>`;
    }
    
    // ======================
    // Gift Interaction
    // ======================
    
    handleGiftClick(giftId) {
        const gift = this.gifts.find(g => g.id === giftId);
        if (!gift) return;
        
        // Show gift details modal (simplified for MVP)
        this.showGiftDetails(gift);
        Utils.hapticFeedback('light');
    }
    
    showGiftDetails(gift) {
        const isOwned = this.userGifts.includes(gift.id);
        const isOutOfStock = gift.current_supply >= gift.max_supply;
        const user = window.FanZoneApp?.getUser();
        const canAfford = user && user.points >= gift.price_points;
        
        // For MVP, use a simple alert (in production, you'd use a proper modal)
        const message = `
${gift.name}

${gift.description}

Price: ${Utils.formatPoints(gift.price_points)} points
Supply: ${gift.current_supply}/${gift.max_supply}

${isOwned ? '✓ You own this gift!' : 
  isOutOfStock ? '❌ Out of stock' :
  !canAfford ? '💰 Not enough points' :
  '🎁 Click "Collect Gift" to purchase'}
        `;
        
        alert(message.trim());
    }
    
    async purchaseGift(giftId) {
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
        
        // Validation checks
        if (this.userGifts.includes(giftId)) {
            Utils.showToast('You already own this gift!', 'warning');
            return;
        }
        
        if (gift.current_supply >= gift.max_supply) {
            Utils.showToast(CONFIG.MESSAGES.ERRORS.OUT_OF_STOCK, 'error');
            return;
        }
        
        if (user.points < gift.price_points) {
            Utils.showToast(CONFIG.MESSAGES.ERRORS.INSUFFICIENT_POINTS, 'error');
            return;
        }
        
        try {
            // Show loading state
            const button = document.querySelector(`[data-gift-id="${giftId}"] .btn-primary`);
            if (button) {
                button.disabled = true;
                button.textContent = 'Processing...';
            }
            
            // Process purchase
            await this.processPurchase(giftId, gift);
            
            // Update UI
            await this.loadGifts();
            this.renderGifts();
            
            Utils.showToast(CONFIG.MESSAGES.SUCCESS.GIFT_PURCHASED, 'success');
            Utils.hapticFeedback('success');
            
            // Track purchase
            window.FanZoneApp?.trackEvent('gift_purchase', {
                gift_id: giftId,
                gift_name: gift.name,
                price: gift.price_points
            });
            
        } catch (error) {
            Utils.logError(error, 'Gift purchase');
            Utils.showToast('Purchase failed. Please try again.', 'error');
            
            // Reset button
            const button = document.querySelector(`[data-gift-id="${giftId}"] .btn-primary`);
            if (button) {
                button.disabled = false;
                button.textContent = 'Collect Gift';
            }
        }
    }
    
    async processPurchase(giftId, gift) {
        const app = window.FanZoneApp;
        const supabase = app?.getSupabase();
        const user = app?.getUser();
        
        if (supabase && user) {
            // Database transaction
            const { error: purchaseError } = await supabase.rpc('purchase_gift', {
                p_user_id: user.id,
                p_gift_id: giftId,
                p_price: gift.price_points
            });
            
            if (purchaseError) throw purchaseError;
            
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
                    <h3>Error Loading Gifts</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.GiftsManager.init()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    getUserGifts() {
        return this.userGifts;
    }
    
    getGifts() {
        return this.gifts;
    }
    
    refresh() {
        this.init();
    }
}

// Create global instance
window.GiftsManager = new GiftsManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GiftsManager;
}