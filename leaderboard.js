// Leaderboard functionality for FanZone
// This module handles real-time leaderboard display and updates

class LeaderboardManager {
    constructor() {
        this.leaderboard = [];
        this.currentUser = null;
        this.isLoading = false;
        this.refreshInterval = null;
        this.subscription = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadLeaderboard = this.loadLeaderboard.bind(this);
        this.renderLeaderboard = this.renderLeaderboard.bind(this);
        this.startRealTimeUpdates = this.startRealTimeUpdates.bind(this);
        this.stopRealTimeUpdates = this.stopRealTimeUpdates.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            this.currentUser = window.FanZoneApp?.getUser();
            await this.loadLeaderboard();
            this.renderLeaderboard();
            this.startRealTimeUpdates();
            
            // Track leaderboard view
            window.FanZoneApp?.trackEvent('leaderboard_view');
            
        } catch (error) {
            Utils.logError(error, 'Leaderboard initialization');
            this.showError('Failed to load leaderboard');
        }
    }
    
    // ======================
    // Data Loading
    // ======================
    
    async loadLeaderboard() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            const app = window.FanZoneApp;
            const supabase = app?.getSupabase();
            
            if (supabase) {
                // Load from Supabase with ranking
                const { data: leaderboard, error } = await supabase
                    .from(CONFIG.TABLES.USERS)
                    .select('id, telegram_id, username, points, total_gifts')
                    .order('points', { ascending: false })
                    .order('total_gifts', { ascending: false })
                    .limit(CONFIG.LEADERBOARD.DEFAULT_LIMIT);
                
                if (error) throw error;
                
                // Add rank to each user
                this.leaderboard = leaderboard.map((user, index) => ({
                    ...user,
                    rank: index + 1
                }));
                
            } else {
                // MVP mode - generate sample leaderboard
                this.leaderboard = this.getSampleLeaderboard();
            }
            
        } catch (error) {
            Utils.logError(error, 'Load leaderboard');
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    getSampleLeaderboard() {
        const currentUser = this.currentUser;
        
        // Generate sample users
        const sampleUsers = [
            { username: '⚡ Lightning', points: 850, total_gifts: 12 },
            { username: '🔥 FireStorm', points: 720, total_gifts: 10 },
            { username: '🚀 Rocket', points: 680, total_gifts: 9 },
            { username: '💎 Diamond', points: 620, total_gifts: 8 },
            { username: '🌟 StarPlayer', points: 580, total_gifts: 7 },
            { username: '⚽ GoalKing', points: 520, total_gifts: 6 },
            { username: '🏆 Champion', points: 480, total_gifts: 5 },
            { username: '🎯 Sniper', points: 420, total_gifts: 4 },
            { username: '🌪️ Tornado', points: 380, total_gifts: 3 },
            { username: '💫 Comet', points: 320, total_gifts: 2 }
        ];
        
        // Insert current user if they should be in top 10
        if (currentUser && currentUser.points > 320) {
            // Find position where current user should be inserted
            let insertIndex = sampleUsers.findIndex(user => user.points < currentUser.points);
            if (insertIndex === -1) insertIndex = sampleUsers.length;
            
            sampleUsers.splice(insertIndex, 0, {
                username: currentUser.username,
                points: currentUser.points,
                total_gifts: currentUser.total_gifts || 0,
                isCurrentUser: true
            });
            
            // Keep only top 10
            sampleUsers.splice(10);
        }
        
        // Add ranks
        return sampleUsers.map((user, index) => ({
            id: `user-${index}`,
            telegram_id: user.isCurrentUser ? currentUser?.telegram_id : 1000 + index,
            ...user,
            rank: index + 1
        }));
    }
    
    // ======================
    // Real-time Updates
    // ======================
    
    startRealTimeUpdates() {
        const app = window.FanZoneApp;
        const supabase = app?.getSupabase();
        
        if (supabase) {
            // Subscribe to users table changes
            this.subscription = supabase
                .channel('leaderboard-changes')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: CONFIG.TABLES.USERS,
                    filter: 'points=gt.0'
                }, () => {
                    // Debounced refresh to avoid too many updates
                    this.debouncedRefresh();
                })
                .subscribe();
        } else {
            // MVP mode - periodic refresh
            this.refreshInterval = setInterval(() => {
                this.refresh();
            }, CONFIG.LEADERBOARD.REFRESH_INTERVAL);
        }
    }
    
    stopRealTimeUpdates() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    debouncedRefresh = Utils.debounce(() => {
        this.refresh();
    }, 2000);
    
    // ======================
    // Rendering
    // ======================
    
    renderLeaderboard() {
        const container = Utils.getElementById('leaderboard-container');
        if (!container) return;
        
        if (this.leaderboard.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No rankings yet</h3>
                    <p>Be the first to collect gifts and climb the leaderboard!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="leaderboard-list">
                ${this.leaderboard.map(user => this.renderLeaderboardItem(user)).join('')}
            </div>
            ${this.renderCurrentUserRank()}
        `;
    }
    
    renderLeaderboardItem(user) {
        const isCurrentUser = this.currentUser && 
            user.telegram_id === this.currentUser.telegram_id;
        
        const rankIcon = this.getRankIcon(user.rank);
        const userClass = isCurrentUser ? 'current-user' : '';
        
        return `
            <div class="leaderboard-item ${userClass}" data-user-id="${user.id}">
                <div class="rank-section">
                    <div class="rank-number">${rankIcon || user.rank}</div>
                </div>
                
                <div class="user-section">
                    <div class="user-info">
                        <span class="username">${Utils.truncateText(user.username, 20)}</span>
                        ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
                    </div>
                    <div class="user-stats">
                        <span class="points">${Utils.formatPoints(user.points)} pts</span>
                        <span class="gifts">${user.total_gifts} gifts</span>
                    </div>
                </div>
                
                <div class="actions-section">
                    ${this.renderUserActions(user, isCurrentUser)}
                </div>
            </div>
        `;
    }
    
    renderUserActions(user, isCurrentUser) {
        if (isCurrentUser) {
            return '<span class="current-user-indicator">👤</span>';
        }
        
        // For future features like user profiles or challenges
        return '<span class="rank-trend">📈</span>';
    }
    
    renderCurrentUserRank() {
        if (!this.currentUser) return '';
        
        // Check if current user is in top 10
        const userInTop10 = this.leaderboard.find(user => 
            user.telegram_id === this.currentUser.telegram_id
        );
        
        if (userInTop10) return '';
        
        // Show current user's rank if not in top 10
        return `
            <div class="current-user-rank">
                <div class="separator">
                    <span>Your Rank</span>
                </div>
                <div class="leaderboard-item current-user">
                    <div class="rank-section">
                        <div class="rank-number">?</div>
                    </div>
                    <div class="user-section">
                        <div class="user-info">
                            <span class="username">${Utils.truncateText(this.currentUser.username, 20)}</span>
                            <span class="you-badge">You</span>
                        </div>
                        <div class="user-stats">
                            <span class="points">${Utils.formatPoints(this.currentUser.points)} pts</span>
                            <span class="gifts">${this.currentUser.total_gifts || 0} gifts</span>
                        </div>
                    </div>
                    <div class="actions-section">
                        <span class="current-user-indicator">👤</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    getRankIcon(rank) {
        const icons = {
            1: '🥇',
            2: '🥈', 
            3: '🥉'
        };
        return icons[rank];
    }
    
    // ======================
    // Utility Methods
    // ======================
    
    showError(message) {
        const container = Utils.getElementById('leaderboard-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>Error Loading Leaderboard</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.LeaderboardManager.init()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    async refresh() {
        try {
            await this.loadLeaderboard();
            this.renderLeaderboard();
        } catch (error) {
            Utils.logError(error, 'Leaderboard refresh');
        }
    }
    
    getCurrentUserRank() {
        const userInLeaderboard = this.leaderboard.find(user => 
            this.currentUser && user.telegram_id === this.currentUser.telegram_id
        );
        
        return userInLeaderboard ? userInLeaderboard.rank : null;
    }
    
    getLeaderboard() {
        return this.leaderboard;
    }
    
    // Cleanup when page changes
    destroy() {
        this.stopRealTimeUpdates();
    }
}

// Create global instance
window.LeaderboardManager = new LeaderboardManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.LeaderboardManager.destroy();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardManager;
}