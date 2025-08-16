// User profile and collection management for FanZone
// This module handles user profile display, gift collection, and purchase history

class ProfileManager {
    constructor() {
        this.user = null;
        this.userGifts = [];
        this.purchaseHistory = [];
        this.isLoading = false;
        this.currentFilter = 'all';
        
        // Performance optimizations
        this.observer = null;
        this.visibleGifts = new Set();
        this.renderDebounceTime = 150;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadUserData = this.loadUserData.bind(this);
        this.renderProfile = this.renderProfile.bind(this);
        this.renderCollection = this.renderCollection.bind(this);
        this.setupLazyLoading = this.setupLazyLoading.bind(this);
        this.handleImageLoad = this.handleImageLoad.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            this.showLoadingState();
            await this.loadUserData();
            this.renderProfile();
            this.setupEventListeners();
            this.setupLazyLoading();
            
            // Track profile view
            window.FanZoneApp?.trackEvent('profile_view', {
                total_gifts: this.userGifts.length,
                total_spent: this.getTotalSpent()
            });
            
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
                
                if (e.target.classList.contains('filter-btn')) {
                    this.setCollectionFilter(e.target.dataset.filter);
                }
                
                if (e.target.closest('.collection-item')) {
                    const giftId = e.target.closest('.collection-item').dataset.giftId;
                    this.showGiftDetails(giftId);
                }
            });
        }
        
        // Window resize for responsive handling
        window.addEventListener('resize', Utils.debounce(() => {
            this.handleResize();
        }, 250));
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
        
        // Get filtered gifts
        const filteredGifts = this.getFilteredUserGifts();
        
        if (filteredGifts.length === 0) {
            return `
                <div class="empty-collection">
                    <div class="empty-icon">🔍</div>
                    <h3>No gifts in this category</h3>
                    <p>Try selecting a different category.</p>
                    <button class="btn btn-secondary" onclick="window.ProfileManager.setCollectionFilter('all')">
                        Show All Gifts
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="collection-controls">
                <div class="collection-stats">
                    <span>${filteredGifts.length} of ${this.userGifts.length} gifts</span>
                </div>
                <div class="collection-filters">
                    ${this.renderCollectionFilters()}
                </div>
            </div>
            
            <div class="collection-grid" id="collection-grid">
                ${filteredGifts.map(userGift => this.renderCollectionItem(userGift)).join('')}
            </div>
        `;
    }
    
    renderCollectionItem(userGift) {
        const gift = userGift.gift;
        if (!gift) return '';
        
        const obtainedDate = new Date(userGift.obtained_at).toLocaleDateString();
        const timeAgo = Utils.timeAgo(userGift.obtained_at);
        const rarityClass = this.getRarityClass(gift);
        
        return `
            <div class="collection-item ${rarityClass}" data-gift-id="${gift.id}">
                <div class="collection-image">
                    <img 
                        data-src="${gift.image_url}" 
                        alt="${gift.name}" 
                        class="lazy-image"
                        style="opacity: 0; transition: opacity 0.3s ease;"
                    />
                    <div class="image-placeholder">
                        <div class="placeholder-shimmer"></div>
                    </div>
                    <div class="collection-overlay">
                        <button class="share-btn" data-gift-id="${gift.id}" title="Share this gift">
                            📤
                        </button>
                        <button class="view-btn" data-gift-id="${gift.id}" title="View details">
                            👁️
                        </button>
                    </div>
                    ${gift.rarity ? `<div class="rarity-badge rarity-${gift.rarity}">${this.getRarityIcon(gift.rarity)}</div>` : ''}
                </div>
                
                <div class="collection-info">
                    <h4 title="${gift.name}">${Utils.truncateText(gift.name, 30)}</h4>
                    <p class="collection-date" title="Collected ${obtainedDate}">${timeAgo}</p>
                    <div class="collection-meta">
                        <span class="price-paid">${Utils.formatPoints(gift.price_points)} pts</span>
                        <span class="category">${this.getCategoryIcon(gift.category)} ${gift.category}</span>
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
        const rank = window.LeaderboardManager?.getCurrentUserRank();
        const categories = this.getUserGiftCategories();
        const favoriteCategory = this.getFavoriteCategory(categories);
        const totalSpent = this.getTotalSpent();
        
        const message = `🎁 Check out my FanZone collection!\n\n` +
                       `👤 ${this.user.username}\n` +
                       `🏆 ${this.userGifts.length} gifts collected\n` +
                       `💰 ${Utils.formatPoints(this.user.points)} points\n` +
                       `${rank ? `🥇 Rank #${rank}` : ''}\n` +
                       `${favoriteCategory ? `⭐ Favorite: ${favoriteCategory}` : ''}\n` +
                       `💸 Total spent: ${Utils.formatPoints(totalSpent)} pts\n\n` +
                       `Join me in collecting digital gifts! 🚀`;
        
        if (Utils.isTelegramWebApp()) {
            // Enhanced Telegram sharing with more data
            const shareData = {
                action: 'share_profile',
                message,
                user_stats: {
                    gifts_count: this.userGifts.length,
                    points: this.user.points,
                    rank: rank || null,
                    favorite_category: favoriteCategory,
                    total_spent: totalSpent
                }
            };
            
            Utils.sendTelegramData(shareData);
            Utils.showToast('Profile shared!', 'success');
        } else {
            Utils.copyToClipboard(message);
            Utils.showToast('Profile copied to clipboard!', 'success');
        }
        
        Utils.hapticFeedback('success');
        
        // Track share with more details
        window.FanZoneApp?.trackEvent('profile_shared', {
            gifts_count: this.userGifts.length,
            total_spent: totalSpent,
            rank: rank || null
        });
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
    // Lazy Loading & Performance
    // ======================
    
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.1
            });
        }
        
        // Fallback for browsers without IntersectionObserver
        setTimeout(() => {
            this.loadAllImages();
        }, 100);
    }
    
    loadImage(img) {
        const src = img.dataset.src;
        if (src) {
            const newImg = new Image();
            newImg.onload = () => {
                img.src = src;
                img.style.opacity = '1';
                img.removeAttribute('data-src');
                
                // Hide placeholder
                const placeholder = img.nextElementSibling;
                if (placeholder && placeholder.classList.contains('image-placeholder')) {
                    placeholder.style.display = 'none';
                }
                
                this.visibleGifts.add(img.closest('[data-gift-id]')?.dataset.giftId);
            };
            newImg.onerror = () => {
                img.src = 'https://via.placeholder.com/150x100/e0e0e0/999999?text=Gift';
                img.style.opacity = '0.5';
            };
            newImg.src = src;
        }
    }
    
    loadAllImages() {
        const lazyImages = document.querySelectorAll('.lazy-image[data-src]');
        lazyImages.forEach(img => {
            if (this.observer) {
                this.observer.observe(img);
            } else {
                this.loadImage(img);
            }
        });
    }
    
    handleResize() {
        // Re-setup lazy loading after layout changes
        setTimeout(() => {
            this.loadAllImages();
        }, 100);
    }
    
    // ======================
    // Collection Filtering
    // ======================
    
    renderCollectionFilters() {
        const categories = this.getUserGiftCategories();
        const filterButtons = ['all', ...Object.keys(categories)];
        
        return filterButtons.map(filter => {
            const isActive = this.currentFilter === filter;
            const count = filter === 'all' ? this.userGifts.length : categories[filter];
            const icon = this.getCategoryIcon(filter);
            
            return `
                <button class="filter-btn ${isActive ? 'active' : ''}" data-filter="${filter}">
                    ${icon} ${filter.charAt(0).toUpperCase() + filter.slice(1)} (${count})
                </button>
            `;
        }).join('');
    }
    
    setCollectionFilter(filter) {
        this.currentFilter = filter;
        
        // Re-render collection with new filter
        const collectionTab = document.getElementById('collection-tab');
        if (collectionTab && collectionTab.classList.contains('active')) {
            collectionTab.innerHTML = this.renderCollection();
            this.loadAllImages();
        }
        
        // Track filter usage
        window.FanZoneApp?.trackEvent('profile_filter', { filter });
    }
    
    getFilteredUserGifts() {
        if (this.currentFilter === 'all') {
            return this.userGifts;
        }
        
        return this.userGifts.filter(userGift => 
            userGift.gift?.category === this.currentFilter
        );
    }
    
    showGiftDetails(giftId) {
        const userGift = this.userGifts.find(ug => ug.gift?.id === giftId);
        if (!userGift || !userGift.gift) return;
        
        const gift = userGift.gift;
        const obtainedDate = new Date(userGift.obtained_at).toLocaleDateString();
        const timeAgo = Utils.timeAgo(userGift.obtained_at);
        
        const message = `🎁 ${gift.name}\n\n` +
                       `${gift.description}\n\n` +
                       `📅 Collected: ${obtainedDate} (${timeAgo})\n` +
                       `💰 Paid: ${Utils.formatPoints(gift.price_points)} points\n` +
                       `🏷️ Category: ${gift.category}\n` +
                       `${gift.rarity ? `✨ Rarity: ${gift.rarity}\n` : ''}` +
                       `\nTap 📤 to share this gift!`;
        
        Utils.showToast(message, 'info', 5000);
        Utils.hapticFeedback('light');
        
        // Track gift view
        window.FanZoneApp?.trackEvent('collection_gift_view', {
            gift_id: giftId,
            gift_name: gift.name
        });
    }
    
    showLoadingState() {
        const container = Utils.getElementById('profile-container');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading your collection...</p>
                </div>
            `;
        }
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
            'general': '🎁',
            'all': '🎁'
        };
        return icons[category] || '🎁';
    }
    
    getTotalSpent() {
        return this.purchaseHistory.reduce((sum, item) => sum + item.points_spent, 0);
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