// User profile and collection management for FanZone
// This module handles user profile display, gift collection, and purchase history

class ProfileManager {
    constructor() {
        this.user = null;
        this.userGifts = [];
        this.purchaseHistory = [];
        this.isLoading = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadUserData = this.loadUserData.bind(this);
        this.renderProfile = this.renderProfile.bind(this);
        this.renderCollection = this.renderCollection.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            await this.loadUserData();
            this.renderProfile();
            this.setupEventListeners();
            
            // Track profile view
            window.FanZoneApp?.trackEvent('profile_view');
            
        } catch (error) {
            Utils.logError(error, 'Profile initialization');
            this.showError('Failed to load profile');
        }
    }
    
    setupEventListeners() {
        // Tab switching for profile sections
        const profileContainer = Utils.getElementById('profile-container');
        if (profileContainer) {
            profileContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-btn')) {
                    this.switchTab(e.target.dataset.tab);
                }
                
                if (e.target.classList.contains('share-btn')) {
                    this.shareGift(e.target.dataset.giftId);
                }
            });
        }
    }
    
    // ======================
    // Data Loading
    // ======================
    
    async loadUserData() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            const app = window.FanZoneApp;
            this.user = app?.getUser();
            
            if (!this.user) {
                throw new Error('User not found');
            }
            
            const supabase = app?.getSupabase();
            
            if (supabase) {
                // Load user's gifts with gift details
                const { data: userGifts, error: giftsError } = await supabase
                    .from(CONFIG.TABLES.USER_GIFTS)
                    .select(`
                        *,
                        gift:gifts(*)
                    `)
                    .eq('user_id', this.user.id)
                    .order('obtained_at', { ascending: false });
                
                if (giftsError) throw giftsError;
                
                this.userGifts = userGifts || [];
                
                // Create purchase history from user gifts
                this.purchaseHistory = this.userGifts.map(ug => ({
                    id: ug.id,
                    gift: ug.gift,
                    obtained_at: ug.obtained_at,
                    points_spent: ug.gift?.price_points || 0
                }));
                
            } else {
                // MVP mode - load from localStorage
                await this.loadMVPData();
            }
            
        } catch (error) {
            Utils.logError(error, 'Load user data');
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    async loadMVPData() {
        const giftIds = Utils.getStorage('user_gifts', []);
        const allGifts = window.GiftsManager?.getGifts() || [];
        
        this.userGifts = giftIds.map(giftId => {
            const gift = allGifts.find(g => g.id === giftId);
            return {
                id: Utils.generateId(),
                gift_id: giftId,
                gift: gift,
                obtained_at: new Date().toISOString(),
                user_id: this.user.id
            };
        }).filter(ug => ug.gift); // Only include gifts that exist
        
        // Create purchase history
        this.purchaseHistory = this.userGifts.map(ug => ({
            id: ug.id,
            gift: ug.gift,
            obtained_at: ug.obtained_at,
            points_spent: ug.gift?.price_points || 0
        }));
    }
    
    // ======================
    // Rendering
    // ======================
    
    renderProfile() {
        const container = Utils.getElementById('profile-container');
        if (!container || !this.user) return;
        
        container.innerHTML = `
            <div class="profile-header">
                ${this.renderUserInfo()}
            </div>
            
            <div class="profile-tabs">
                <button class="tab-btn active" data-tab="collection">
                    🎁 Collection (${this.userGifts.length})
                </button>
                <button class="tab-btn" data-tab="history">
                    📜 History
                </button>
                <button class="tab-btn" data-tab="stats">
                    📊 Stats
                </button>
            </div>
            
            <div class="profile-content">
                <div id="collection-tab" class="tab-content active">
                    ${this.renderCollection()}
                </div>
                
                <div id="history-tab" class="tab-content">
                    ${this.renderHistory()}
                </div>
                
                <div id="stats-tab" class="tab-content">
                    ${this.renderStats()}
                </div>
            </div>
        `;
    }
    
    renderUserInfo() {
        const rank = window.LeaderboardManager?.getCurrentUserRank();
        const joinDate = new Date(this.user.created_at).toLocaleDateString();
        
        return `
            <div class="user-avatar">
                <div class="avatar-circle">
                    ${this.getAvatarEmoji()}
                </div>
            </div>
            
            <div class="user-details">
                <h2>${Utils.truncateText(this.user.username, 25)}</h2>
                <div class="user-badges">
                    <span class="badge points-badge">
                        💰 ${Utils.formatPoints(this.user.points)} points
                    </span>
                    ${rank ? `<span class="badge rank-badge">🏆 Rank #${rank}</span>` : ''}
                </div>
                <div class="user-meta">
                    <span class="join-date">Joined ${joinDate}</span>
                </div>
            </div>
            
            <div class="user-actions">
                <button class="btn btn-secondary" onclick="window.ProfileManager.shareProfile()">
                    📤 Share Profile
                </button>
            </div>
        `;
    }
    
    renderCollection() {
        if (this.userGifts.length === 0) {
            return `
                <div class="empty-collection">
                    <div class="empty-icon">🎁</div>
                    <h3>No gifts yet</h3>
                    <p>Start collecting digital gifts to build your trophy case!</p>
                    <button class="btn btn-primary" onclick="window.FanZoneApp.navigateToPage('gifts')">
                        Browse Gifts
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="collection-grid">
                ${this.userGifts.map(userGift => this.renderCollectionItem(userGift)).join('')}
            </div>
        `;
    }
    
    renderCollectionItem(userGift) {
        const gift = userGift.gift;
        if (!gift) return '';
        
        const obtainedDate = new Date(userGift.obtained_at).toLocaleDateString();
        
        return `
            <div class="collection-item" data-gift-id="${gift.id}">
                <div class="collection-image">
                    <img src="${gift.image_url}" alt="${gift.name}" loading="lazy" />
                    <div class="collection-overlay">
                        <button class="share-btn" data-gift-id="${gift.id}">
                            📤 Share
                        </button>
                    </div>
                </div>
                
                <div class="collection-info">
                    <h4>${gift.name}</h4>
                    <p class="collection-date">Collected ${obtainedDate}</p>
                    <div class="collection-meta">
                        <span class="price-paid">${Utils.formatPoints(gift.price_points)} pts</span>
                        <span class="category">${gift.category}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderHistory() {
        if (this.purchaseHistory.length === 0) {
            return `
                <div class="empty-history">
                    <div class="empty-icon">📜</div>
                    <h3>No purchase history</h3>
                    <p>Your gift purchases will appear here.</p>
                </div>
            `;
        }
        
        return `
            <div class="history-list">
                ${this.purchaseHistory.map(item => this.renderHistoryItem(item)).join('')}
            </div>
        `;
    }
    
    renderHistoryItem(item) {
        const gift = item.gift;
        const date = new Date(item.obtained_at);
        const timeAgo = Utils.timeAgo(item.obtained_at);
        
        return `
            <div class="history-item">
                <div class="history-image">
                    <img src="${gift.image_url}" alt="${gift.name}" />
                </div>
                
                <div class="history-details">
                    <h4>${gift.name}</h4>
                    <p class="history-description">${Utils.truncateText(gift.description, 50)}</p>
                    <div class="history-meta">
                        <span class="points-spent">-${Utils.formatPoints(item.points_spent)} pts</span>
                        <span class="purchase-time">${timeAgo}</span>
                    </div>
                </div>
                
                <div class="history-actions">
                    <button class="btn btn-sm btn-secondary" onclick="window.ProfileManager.shareGift('${gift.id}')">
                        Share
                    </button>
                </div>
            </div>
        `;
    }
    
    renderStats() {
        const totalSpent = this.purchaseHistory.reduce((sum, item) => sum + item.points_spent, 0);
        const categories = this.getUserGiftCategories();
        const favoriteCategory = this.getFavoriteCategory(categories);
        
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">🎁</div>
                    <div class="stat-value">${this.userGifts.length}</div>
                    <div class="stat-label">Total Gifts</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">${Utils.formatPoints(totalSpent)}</div>
                    <div class="stat-label">Points Spent</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${Utils.formatPoints(this.user.points)}</div>
                    <div class="stat-label">Current Points</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-value">${favoriteCategory || 'None'}</div>
                    <div class="stat-label">Favorite Category</div>
                </div>
            </div>
            
            <div class="category-breakdown">
                <h4>Collection by Category</h4>
                <div class="category-list">
                    ${Object.entries(categories).map(([category, count]) => `
                        <div class="category-item">
                            <span class="category-name">${category}</span>
                            <span class="category-count">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // ======================
    // Tab Management
    // ======================
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        Utils.hapticFeedback('light');
        
        // Track tab view
        window.FanZoneApp?.trackEvent('profile_tab_view', { tab: tabName });
    }
    
    // ======================
    // Actions
    // ======================
    
    shareProfile() {
        const message = `🎁 Check out my FanZone collection!\n\n` +
                       `👤 ${this.user.username}\n` +
                       `🏆 ${this.userGifts.length} gifts collected\n` +
                       `💰 ${Utils.formatPoints(this.user.points)} points\n\n` +
                       `Join me in collecting digital gifts! 🚀`;
        
        if (Utils.isTelegramWebApp()) {
            Utils.sendTelegramData({ action: 'share_profile', message });
        } else {
            Utils.copyToClipboard(message);
        }
        
        Utils.hapticFeedback('success');
        
        // Track share
        window.FanZoneApp?.trackEvent('profile_shared');
    }
    
    shareGift(giftId) {
        const userGift = this.userGifts.find(ug => ug.gift?.id === giftId);
        if (!userGift) return;
        
        const gift = userGift.gift;
        const message = `🎁 I just collected "${gift.name}" in FanZone!\n\n` +
                       `${gift.description}\n\n` +
                       `💰 ${Utils.formatPoints(gift.price_points)} points\n` +
                       `Join me in collecting digital gifts! 🚀`;
        
        if (Utils.isTelegramWebApp()) {
            Utils.sendTelegramData({ action: 'share_gift', gift_id: giftId, message });
        } else {
            Utils.copyToClipboard(message);
        }
        
        Utils.hapticFeedback('success');
        Utils.showToast('Gift shared!', 'success');
        
        // Track share
        window.FanZoneApp?.trackEvent('gift_shared', { gift_id: giftId, gift_name: gift.name });
    }
    
    // ======================
    // Utility Methods
    // ======================
    
    getAvatarEmoji() {
        if (!this.user.username) return '👤';
        
        // Generate emoji based on username
        const emojis = ['🎯', '⚡', '🔥', '💎', '🌟', '🚀', '⭐', '💫', '🎪', '🎨'];
        const index = this.user.telegram_id % emojis.length;
        return emojis[index];
    }
    
    getUserGiftCategories() {
        const categories = {};
        
        this.userGifts.forEach(userGift => {
            const category = userGift.gift?.category || 'other';
            categories[category] = (categories[category] || 0) + 1;
        });
        
        return categories;
    }
    
    getFavoriteCategory(categories) {
        let maxCount = 0;
        let favoriteCategory = null;
        
        Object.entries(categories).forEach(([category, count]) => {
            if (count > maxCount) {
                maxCount = count;
                favoriteCategory = category;
            }
        });
        
        return favoriteCategory;
    }
    
    showError(message) {
        const container = Utils.getElementById('profile-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>Error Loading Profile</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.ProfileManager.init()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    async refresh() {
        try {
            await this.loadUserData();
            this.renderProfile();
        } catch (error) {
            Utils.logError(error, 'Profile refresh');
        }
    }
    
    getUserGifts() {
        return this.userGifts;
    }
    
    getPurchaseHistory() {
        return this.purchaseHistory;
    }
}

// Create global instance
window.ProfileManager = new ProfileManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileManager;
}