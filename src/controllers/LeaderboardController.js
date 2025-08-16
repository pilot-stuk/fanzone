// Leaderboard Controller - UI logic for leaderboard page
// Follows Single Responsibility Principle - only handles leaderboard UI

class LeaderboardController {
    constructor(userService, logger, eventBus) {
        this.userService = userService;
        this.logger = logger;
        this.eventBus = eventBus;
        
        this.leaderboard = [];
        this.currentUserRank = null;
        this.isInitialized = false;
        this.isLoading = false;
        this.refreshInterval = null;
    }
    
    /**
     * Initialize the leaderboard page
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.logger.debug('Initializing leaderboard controller');
            
            this.showLoadingState();
            await this.loadLeaderboard();
            this.setupEventListeners();
            this.renderLeaderboard();
            this.startAutoRefresh();
            
            this.isInitialized = true;
            this.logger.debug('Leaderboard controller initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize leaderboard controller', error);
            this.showError('Failed to load leaderboard');
        }
    }
    
    /**
     * Load leaderboard data
     */
    async loadLeaderboard() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            const authService = window.DIContainer.get('authService');
            const currentUser = authService.getCurrentUser();
            
            // Load leaderboard and current user rank
            const [leaderboard, userRank] = await Promise.all([
                this.userService.getLeaderboard(10),
                currentUser ? this.userService.getUserRank(currentUser.telegram_id || currentUser.id) : null
            ]);
            
            this.leaderboard = leaderboard || [];
            this.currentUserRank = userRank;
            
            this.logger.debug('Leaderboard loaded', {
                count: this.leaderboard.length,
                userRank: this.currentUserRank
            });
            
        } catch (error) {
            this.logger.error('Failed to load leaderboard', error);
            
            // Fallback to sample data
            this.leaderboard = this.getSampleLeaderboard();
            this.currentUserRank = null;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Subscribe to relevant events
        this.eventBus.subscribe('gift:purchased', () => {
            // Refresh leaderboard when gifts are purchased
            setTimeout(() => this.refresh(), 1000);
        });
        
        this.eventBus.subscribe('user:points:updated', () => {
            // Refresh when points change
            setTimeout(() => this.refresh(), 1000);
        });
        
        // Manual refresh button
        const container = document.getElementById('leaderboard-container');
        if (container) {
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('refresh-btn')) {
                    this.refresh();
                }
            });
        }
    }
    
    /**
     * Render leaderboard
     */
    renderLeaderboard() {
        const container = document.getElementById('leaderboard-container');
        if (!container) return;
        
        if (this.isLoading) {
            container.innerHTML = this.renderLoadingState();
            return;
        }
        
        if (this.leaderboard.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }
        
        container.innerHTML = `
            <div class="leaderboard-header">
                <div class="leaderboard-stats">
                    <span>${this.leaderboard.length} top collectors</span>
                    ${this.currentUserRank ? `<span>Your rank: #${this.currentUserRank}</span>` : ''}
                </div>
                <button class="btn btn-secondary refresh-btn">🔄 Refresh</button>
            </div>
            
            ${this.renderCurrentUserCard()}
            
            <div class="leaderboard-list">
                ${this.leaderboard.map((user, index) => this.renderLeaderboardItem(user, index)).join('')}
            </div>
            
            <div class="leaderboard-footer">
                <p>Rankings update in real-time based on points and gifts collected!</p>
            </div>
        `;
    }
    
    /**
     * Render current user card if not in top list
     */
    renderCurrentUserCard() {
        const authService = window.DIContainer.get('authService');
        const currentUser = authService.getCurrentUser();
        
        if (!currentUser || !this.currentUserRank || this.currentUserRank <= 10) {
            return '';
        }
        
        return `
            <div class="current-user-card">
                <h3>Your Position</h3>
                <div class="leaderboard-item current-user">
                    <div class="rank-badge rank-${this.getRankClass(this.currentUserRank)}">
                        #${this.currentUserRank}
                    </div>
                    <div class="user-info">
                        <div class="username">${this.truncateText(currentUser.username, 20)}</div>
                        <div class="user-stats">
                            <span class="points">${this.formatPoints(currentUser.points)} pts</span>
                            <span class="gifts">${currentUser.total_gifts || 0} gifts</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render individual leaderboard item
     */
    renderLeaderboardItem(user, index) {
        const rank = user.rank || (index + 1);
        const authService = window.DIContainer.get('authService');
        const currentUser = authService.getCurrentUser();
        const isCurrentUser = currentUser && 
            (user.telegram_id === currentUser.telegram_id || user.id === currentUser.id);
        
        return `
            <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}">
                <div class="rank-badge rank-${this.getRankClass(rank)}">
                    ${rank <= 3 ? this.getRankEmoji(rank) : `#${rank}`}
                </div>
                
                <div class="user-avatar">
                    ${this.getUserAvatar(user)}
                </div>
                
                <div class="user-info">
                    <div class="username">
                        ${this.truncateText(user.username, 20)}
                        ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
                    </div>
                    <div class="user-stats">
                        <span class="points">${this.formatPoints(user.points)} pts</span>
                        <span class="gifts">${user.total_gifts || 0} gifts</span>
                    </div>
                </div>
                
                <div class="user-actions">
                    ${this.renderUserActions(user, isCurrentUser)}
                </div>
            </div>
        `;
    }
    
    /**
     * Get rank class for styling
     */
    getRankClass(rank) {
        if (rank === 1) return 'gold';
        if (rank === 2) return 'silver';
        if (rank === 3) return 'bronze';
        if (rank <= 10) return 'top10';
        return 'regular';
    }
    
    /**
     * Get rank emoji for top 3
     */
    getRankEmoji(rank) {
        const emojis = { 1: '🥇', 2: '🥈', 3: '🥉' };
        return emojis[rank] || `#${rank}`;
    }
    
    /**
     * Get user avatar
     */
    getUserAvatar(user) {
        // Try to get Telegram photo if available
        if (user.photo_url) {
            return `<img src="${user.photo_url}" alt="${user.username}" class="avatar-img" />`;
        }
        
        // Generate avatar from first letter
        const firstLetter = (user.username || 'U').charAt(0).toUpperCase();
        return `<div class="avatar-letter">${firstLetter}</div>`;
    }
    
    /**
     * Render user actions
     */
    renderUserActions(user, isCurrentUser) {
        if (isCurrentUser) {
            return '<span class="current-user-indicator">👤</span>';
        }
        
        // Could add friend request, challenge, etc. in the future
        return '';
    }
    
    /**
     * Start auto-refresh timer
     */
    startAutoRefresh() {
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.refresh();
        }, 30000);
    }
    
    /**
     * Stop auto-refresh timer
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    /**
     * Refresh leaderboard data
     */
    async refresh() {
        try {
            await this.loadLeaderboard();
            this.renderLeaderboard();
            
            this.logger.debug('Leaderboard refreshed');
            
        } catch (error) {
            this.logger.error('Failed to refresh leaderboard', error);
        }
    }
    
    /**
     * Show loading state
     */
    showLoadingState() {
        const container = document.getElementById('leaderboard-container');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading leaderboard...</p>
                </div>
            `;
        }
    }
    
    /**
     * Show empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <h3>🏆 No rankings yet</h3>
                <p>Be the first to collect gifts and climb the leaderboard!</p>
                <button class="btn btn-primary" onclick="window.FanZoneApp.navigateToPage('gifts')">
                    Start Collecting
                </button>
            </div>
        `;
    }
    
    /**
     * Show loading state for container
     */
    renderLoadingState() {
        return `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading rankings...</p>
            </div>
        `;
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('leaderboard-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>⚠️ Error</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.LeaderboardController.initialize()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * Get sample leaderboard for fallback
     */
    getSampleLeaderboard() {
        return [
            { rank: 1, username: 'Champion', points: 950, total_gifts: 15 },
            { rank: 2, username: 'StarPlayer', points: 875, total_gifts: 12 },
            { rank: 3, username: 'GoalMaster', points: 800, total_gifts: 10 },
            { rank: 4, username: 'FanHero', points: 750, total_gifts: 9 },
            { rank: 5, username: 'TopSupporter', points: 700, total_gifts: 8 },
            { rank: 6, username: 'ClubLegend', points: 650, total_gifts: 7 },
            { rank: 7, username: 'UltraFan', points: 600, total_gifts: 6 },
            { rank: 8, username: 'Devoted', points: 550, total_gifts: 5 },
            { rank: 9, username: 'Faithful', points: 500, total_gifts: 4 },
            { rank: 10, username: 'Rookie', points: 450, total_gifts: 3 }
        ];
    }
    
    /**
     * Get current user rank (for external access)
     */
    getCurrentUserRank() {
        return this.currentUserRank;
    }
    
    /**
     * Cleanup when page changes
     */
    cleanup() {
        this.stopAutoRefresh();
        this.isInitialized = false;
    }
    
    // Helper methods
    formatPoints(points) {
        return new Intl.NumberFormat().format(points || 0);
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardController;
}

window.LeaderboardController = LeaderboardController;