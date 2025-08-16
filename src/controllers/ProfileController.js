// Profile Controller - UI logic for profile page
// Follows Single Responsibility Principle - only handles profile UI

class ProfileController {
    constructor(userService, giftService, logger, eventBus) {
        this.userService = userService;
        this.giftService = giftService;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.user = null;
        this.userGifts = [];
        this.userStats = null;
        this.currentTab = 'collection';
        this.isInitialized = false;
        this.isLoading = false;
    }
    
    /**
     * Initialize the profile page
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.logger.debug('Initializing profile controller');
            
            this.showLoadingState();
            await this.loadProfileData();
            this.setupEventListeners();
            this.renderProfile();
            
            this.isInitialized = true;
            this.logger.debug('Profile controller initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize profile controller', error);
            this.showError('Failed to load profile');
        }
    }
    
    /**
     * Load profile data
     */
    async loadProfileData() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            const authService = window.DIContainer.get('authService');
            const currentUser = authService.getCurrentUser();
            
            if (!currentUser) {
                throw new Error('No authenticated user');
            }
            
            // Load user data, gifts, and stats
            const [userProfile, userGifts, userStats] = await Promise.all([
                this.userService.getUserProfile(currentUser.telegram_id || currentUser.id),
                this.giftService.getUserGifts(currentUser.telegram_id || currentUser.id),
                this.userService.getUserStats(currentUser.telegram_id || currentUser.id)
            ]);
            
            this.user = userProfile || currentUser;
            this.userGifts = userGifts || [];
            this.userStats = userStats;
            
            this.logger.debug('Profile data loaded', {
                username: this.user.username,
                giftsCount: this.userGifts.length
            });
            
        } catch (error) {
            this.logger.error('Failed to load profile data', error);
            
            // Fallback to current user data
            const authService = window.DIContainer.get('authService');
            this.user = authService.getCurrentUser();
            this.userGifts = [];
            this.userStats = null;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const container = document.getElementById('profile-container');
        if (!container) return;
        
        // Tab switching
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target.dataset.tab);
            }
            
            if (e.target.classList.contains('share-btn')) {
                this.shareProfile();
            }
            
            if (e.target.classList.contains('refresh-btn')) {
                this.refresh();
            }
        });
        
        // Event bus subscriptions
        this.eventBus.subscribe('gift:purchased', (data) => {
            this.handleGiftPurchased(data);
        });
        
        this.eventBus.subscribe('user:points:updated', () => {
            this.refreshUserData();
        });
    }
    
    /**
     * Render profile page
     */
    renderProfile() {
        const container = document.getElementById('profile-container');
        if (!container) return;
        
        if (this.isLoading) {
            container.innerHTML = this.renderLoadingState();
            return;
        }
        
        if (!this.user) {
            container.innerHTML = this.renderErrorState();
            return;
        }
        
        container.innerHTML = `
            <div class="profile-header">
                ${this.renderUserInfo()}
            </div>
            
            <div class="profile-tabs">
                <button class="tab-btn ${this.currentTab === 'collection' ? 'active' : ''}" data-tab="collection">
                    🎁 Collection (${this.userGifts.length})
                </button>
                <button class="tab-btn ${this.currentTab === 'stats' ? 'active' : ''}" data-tab="stats">
                    📊 Stats
                </button>
                <button class="tab-btn ${this.currentTab === 'achievements' ? 'active' : ''}" data-tab="achievements">
                    🏆 Achievements
                </button>
            </div>
            
            <div class="profile-content">
                ${this.renderTabContent()}
            </div>
        `;
    }
    
    /**
     * Render user info header
     */
    renderUserInfo() {
        const joinDate = new Date(this.user.created_at || Date.now()).toLocaleDateString();
        const rank = this.userStats?.rank || null;
        
        return `
            <div class="user-avatar">
                ${this.getUserAvatar()}
            </div>
            
            <div class="user-details">
                <h2>${this.truncateText(this.user.username || 'User', 25)}</h2>
                <div class="user-badges">
                    <span class="badge points-badge">
                        💰 ${this.formatPoints(this.user.points)} points
                    </span>
                    ${rank ? `<span class="badge rank-badge">🏆 Rank #${rank}</span>` : ''}
                </div>
                <div class="user-meta">
                    <span class="join-date">Joined ${joinDate}</span>
                    ${this.user.telegram_id ? `<span class="telegram-id">ID: ${this.user.telegram_id}</span>` : ''}
                </div>
            </div>
            
            <div class="user-actions">
                <button class="btn btn-secondary share-btn">📤 Share</button>
                <button class="btn btn-secondary refresh-btn" id="profile-refresh-btn">🔄 Refresh</button>
            </div>
        `;
    }
    
    /**
     * Get user avatar
     */
    getUserAvatar() {
        // Try to get Telegram photo
        const telegramUser = window.TelegramAdapter?.getUserData();
        if (telegramUser?.photoUrl) {
            return `<img src="${telegramUser.photoUrl}" alt="${this.user.username}" class="avatar-image" />`;
        }
        
        // Generate avatar from first letter
        const firstLetter = (this.user.username || 'U').charAt(0).toUpperCase();
        return `<div class="avatar-circle"><span class="avatar-letter">${firstLetter}</span></div>`;
    }
    
    /**
     * Render tab content
     */
    renderTabContent() {
        switch (this.currentTab) {
            case 'collection':
                return this.renderCollection();
            case 'stats':
                return this.renderStats();
            case 'achievements':
                return this.renderAchievements();
            default:
                return this.renderCollection();
        }
    }
    
    /**
     * Render collection tab
     */
    renderCollection() {
        if (this.userGifts.length === 0) {
            return `
                <div class="empty-collection">
                    <div class="empty-icon">🎁</div>
                    <h3>No gifts yet</h3>
                    <p>Start collecting digital gifts to build your collection!</p>
                    <button class="btn btn-primary" onclick="window.FanZoneApp.navigateToPage('gifts')">
                        Browse Gifts
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="collection-header">
                <h3>My Collection (${this.userGifts.length})</h3>
                <div class="collection-stats">
                    <span>Total Value: ${this.getTotalValue()} pts</span>
                </div>
            </div>
            
            <div class="collection-grid">
                ${this.userGifts.map(userGift => this.renderCollectionItem(userGift)).join('')}
            </div>
        `;
    }
    
    /**
     * Render collection item
     */
    renderCollectionItem(userGift) {
        const gift = userGift.gift || userGift;
        const obtainedDate = new Date(userGift.obtained_at || Date.now()).toLocaleDateString();
        
        return `
            <div class="collection-item" data-gift-id="${gift.id}">
                <div class="gift-image">
                    <img src="${gift.image_url}" alt="${gift.name}" loading="lazy" />
                    <div class="rarity-badge rarity-${gift.rarity || 'common'}">
                        ${this.getRarityIcon(gift.rarity)}
                    </div>
                </div>
                
                <div class="gift-info">
                    <h4>${gift.name}</h4>
                    <p class="gift-category">${this.getCategoryIcon(gift.category)} ${gift.category}</p>
                    <div class="gift-meta">
                        <span class="obtained-date">Collected ${obtainedDate}</span>
                        <span class="gift-value">${this.formatPoints(gift.price_points)} pts</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render stats tab
     */
    renderStats() {
        const totalSpent = this.getTotalValue();
        const avgGiftValue = this.userGifts.length > 0 ? Math.round(totalSpent / this.userGifts.length) : 0;
        
        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-info">
                        <div class="stat-value">${this.formatPoints(this.user.points)}</div>
                        <div class="stat-label">Current Points</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">🎁</div>
                    <div class="stat-info">
                        <div class="stat-value">${this.userGifts.length}</div>
                        <div class="stat-label">Gifts Collected</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">💎</div>
                    <div class="stat-info">
                        <div class="stat-value">${this.formatPoints(totalSpent)}</div>
                        <div class="stat-label">Total Spent</div>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-info">
                        <div class="stat-value">${this.formatPoints(avgGiftValue)}</div>
                        <div class="stat-label">Avg Gift Value</div>
                    </div>
                </div>
                
                ${this.userStats?.rank ? `
                <div class="stat-card highlight">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-info">
                        <div class="stat-value">#${this.userStats.rank}</div>
                        <div class="stat-label">Global Rank</div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="stats-details">
                <h3>Collection Breakdown</h3>
                ${this.renderCategoryBreakdown()}
            </div>
        `;
    }
    
    /**
     * Render category breakdown
     */
    renderCategoryBreakdown() {
        const categories = {};
        
        this.userGifts.forEach(userGift => {
            const gift = userGift.gift || userGift;
            const category = gift.category || 'general';
            
            if (!categories[category]) {
                categories[category] = { count: 0, value: 0 };
            }
            
            categories[category].count++;
            categories[category].value += gift.price_points || 0;
        });
        
        if (Object.keys(categories).length === 0) {
            return '<p>No gifts to analyze yet.</p>';
        }
        
        return `
            <div class="category-breakdown">
                ${Object.entries(categories).map(([category, data]) => `
                    <div class="category-item">
                        <div class="category-icon">${this.getCategoryIcon(category)}</div>
                        <div class="category-info">
                            <div class="category-name">${category}</div>
                            <div class="category-stats">
                                ${data.count} gifts • ${this.formatPoints(data.value)} pts
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * Render achievements tab
     */
    renderAchievements() {
        const achievements = this.calculateAchievements();
        
        return `
            <div class="achievements-grid">
                ${achievements.map(achievement => `
                    <div class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon">${achievement.icon}</div>
                        <div class="achievement-info">
                            <h4>${achievement.name}</h4>
                            <p>${achievement.description}</p>
                            <div class="achievement-progress">
                                ${achievement.progress}/${achievement.target}
                            </div>
                        </div>
                        ${achievement.unlocked ? '<div class="achievement-badge">✓</div>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * Calculate achievements
     */
    calculateAchievements() {
        const giftsCount = this.userGifts.length;
        const totalSpent = this.getTotalValue();
        const points = this.user.points || 0;
        
        return [
            {
                name: 'First Collection',
                description: 'Collect your first gift',
                icon: '🎁',
                target: 1,
                progress: giftsCount,
                unlocked: giftsCount >= 1
            },
            {
                name: 'Gift Collector',
                description: 'Collect 5 gifts',
                icon: '🏆',
                target: 5,
                progress: giftsCount,
                unlocked: giftsCount >= 5
            },
            {
                name: 'Master Collector',
                description: 'Collect 10 gifts',
                icon: '💎',
                target: 10,
                progress: giftsCount,
                unlocked: giftsCount >= 10
            },
            {
                name: 'Big Spender',
                description: 'Spend 500 points',
                icon: '💰',
                target: 500,
                progress: totalSpent,
                unlocked: totalSpent >= 500
            },
            {
                name: 'Point Saver',
                description: 'Accumulate 200 points',
                icon: '🏪',
                target: 200,
                progress: points,
                unlocked: points >= 200
            }
        ];
    }
    
    /**
     * Switch tabs
     */
    switchTab(tab) {
        this.currentTab = tab;
        this.renderProfile();
    }
    
    /**
     * Handle gift purchased event
     */
    handleGiftPurchased(data) {
        // Add the new gift to collection
        const newGift = {
            gift_id: data.giftId,
            gift: {
                id: data.giftId,
                name: data.giftName,
                price_points: data.pointsSpent
            },
            obtained_at: new Date().toISOString(),
            purchase_price: data.pointsSpent
        };
        
        this.userGifts.push(newGift);
        
        // Re-render if on collection tab
        if (this.currentTab === 'collection') {
            this.renderProfile();
        }
    }
    
    /**
     * Refresh user data
     */
    async refreshUserData() {
        try {
            const authService = window.DIContainer.get('authService');
            this.user = authService.getCurrentUser();
            this.renderProfile();
        } catch (error) {
            this.logger.error('Failed to refresh user data', error);
        }
    }
    
    /**
     * Share profile
     */
    shareProfile() {
        const shareText = `🎁 Check out my FanZone collection!\n\n` +
            `💰 ${this.formatPoints(this.user.points)} points\n` +
            `🎁 ${this.userGifts.length} gifts collected\n` +
            `${this.userStats?.rank ? `🏆 Rank #${this.userStats.rank}` : ''}\n\n` +
            `Join me in collecting digital gifts!`;
        
        if (navigator.share) {
            navigator.share({
                title: 'My FanZone Collection',
                text: shareText
            });
        } else {
            // Fallback - copy to clipboard
            navigator.clipboard?.writeText(shareText);
            this.showToast('Profile copied to clipboard!', 'success');
        }
    }
    
    /**
     * Refresh profile data
     */
    async refresh() {
        try {
            this.logger.debug('Refreshing profile data');
            
            // Show loading state
            this.showRefreshingState();
            
            // Reset initialization flag
            this.isInitialized = false;
            
            // Reload all data
            await this.loadProfileData();
            
            // Re-render the profile
            this.renderProfile();
            
            // Show success feedback
            this.showToast('Profile refreshed!', 'success');
            
            // Haptic feedback
            const platformAdapter = window.DIContainer.get('platformAdapter');
            platformAdapter.sendHapticFeedback('light');
            
            this.logger.debug('Profile refreshed successfully');
            
        } catch (error) {
            this.logger.error('Failed to refresh profile', error);
            this.showToast('Failed to refresh profile', 'error');
        }
    }
    
    /**
     * Show loading state
     */
    showLoadingState() {
        const container = document.getElementById('profile-container');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading profile...</p>
                </div>
            `;
        }
    }
    
    /**
     * Show refreshing state
     */
    showRefreshingState() {
        const refreshBtn = document.getElementById('profile-refresh-btn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '⏳ Refreshing...';
        }
        
        // Reset button after a delay
        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄 Refresh';
            }
        }, 2000);
    }
    
    /**
     * Show error state
     */
    renderErrorState() {
        return `
            <div class="error-state">
                <h3>⚠️ Error</h3>
                <p>Failed to load profile</p>
                <button class="btn btn-primary" onclick="window.ProfileController.initialize()">
                    Try Again
                </button>
            </div>
        `;
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('profile-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>⚠️ Error</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.ProfileController.initialize()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * Get total value of collection
     */
    getTotalValue() {
        return this.userGifts.reduce((total, userGift) => {
            const gift = userGift.gift || userGift;
            return total + (gift.price_points || 0);
        }, 0);
    }
    
    /**
     * Get rarity icon
     */
    getRarityIcon(rarity) {
        const icons = {
            'common': '⚪',
            'rare': '🔵',
            'epic': '🟣',
            'legendary': '🟡'
        };
        return icons[rarity] || '⚪';
    }
    
    /**
     * Get category icon
     */
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
    
    // Helper methods
    formatPoints(points) {
        return new Intl.NumberFormat().format(points || 0);
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    showToast(message, type = 'info', duration = 3000) {
        if (window.FanZoneApp && window.FanZoneApp.showToast) {
            window.FanZoneApp.showToast(message, type, duration);
        } else {
            alert(message);
        }
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileController;
}

window.ProfileController = ProfileController;