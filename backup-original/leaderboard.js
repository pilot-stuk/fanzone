// Leaderboard functionality for FanZone
// This module handles real-time leaderboard display and updates

class LeaderboardManager {
    constructor() {
        this.leaderboard = [];
        this.currentUser = null;
        this.currentUserRank = null;
        this.isLoading = false;
        this.refreshInterval = null;
        this.subscription = null;
        this.updateAnimation = null;
        this.lastUpdateTime = 0;
        this.pendingUpdates = new Map();
        
        // Performance settings
        this.MAX_DISPLAY_USERS = CONFIG.LEADERBOARD.DEFAULT_LIMIT;
        this.UPDATE_DEBOUNCE_TIME = 1000;
        this.ANIMATION_DURATION = 300;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadLeaderboard = this.loadLeaderboard.bind(this);
        this.renderLeaderboard = this.renderLeaderboard.bind(this);
        this.startRealTimeUpdates = this.startRealTimeUpdates.bind(this);
        this.stopRealTimeUpdates = this.stopRealTimeUpdates.bind(this);
        this.handleRealtimeUpdate = this.handleRealtimeUpdate.bind(this);
        this.animateRankChange = this.animateRankChange.bind(this);
        this.loadCurrentUserPosition = this.loadCurrentUserPosition.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        try {
            this.currentUser = window.FanZoneApp?.getUser();
            
            // Load leaderboard and current user position in parallel
            await Promise.all([
                this.loadLeaderboard(),
                this.loadCurrentUserPosition()
            ]);
            
            this.renderLeaderboard();
            this.startRealTimeUpdates();
            
            // Track leaderboard view
            window.FanZoneApp?.trackEvent('leaderboard_view', {
                leaderboard_size: this.leaderboard.length,
                user_rank: this.currentUserRank
            });
            
            if (CONFIG.DEBUG) {
                console.log('📊 Leaderboard initialized:', {
                    users: this.leaderboard.length,
                    currentUserRank: this.currentUserRank
                });
            }
            
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
        
        const startTime = performance.now();
        
        try {
            const app = window.FanZoneApp;
            const supabase = app?.getSupabase();
            
            if (supabase) {
                // Use the optimized leaderboard view from database
                const { data: leaderboard, error } = await supabase
                    .from('leaderboard_view')
                    .select('id, telegram_id, username, points, total_gifts, rank')
                    .limit(this.MAX_DISPLAY_USERS);
                
                if (error) throw error;
                
                this.leaderboard = leaderboard || [];
                
                if (CONFIG.DEBUG) {
                    const loadTime = performance.now() - startTime;
                    console.log(`📊 Leaderboard loaded in ${loadTime.toFixed(2)}ms (${this.leaderboard.length} users)`);
                }
                
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

    async loadCurrentUserPosition() {
        if (!this.currentUser) return;
        
        try {
            const app = window.FanZoneApp;
            const supabase = app?.getSupabase();
            
            if (supabase) {
                // Use the database function to get user's exact position
                const { data: positionData, error } = await supabase
                    .rpc('get_user_leaderboard_position', {
                        p_telegram_id: this.currentUser.telegram_id
                    });
                
                if (error) throw error;
                
                this.currentUserRank = positionData?.rank || null;
                
                if (CONFIG.DEBUG) {
                    console.log('📊 Current user rank:', this.currentUserRank);
                }
                
            } else {
                // MVP mode - estimate position
                this.currentUserRank = this.estimateUserRank();
            }
            
        } catch (error) {
            Utils.logError(error, 'Load current user position');
            this.currentUserRank = null;
        }
    }

    estimateUserRank() {
        if (!this.currentUser || !this.leaderboard.length) return null;
        
        // Find where the user would rank based on points
        let rank = 1;
        for (const user of this.leaderboard) {
            if (this.currentUser.points > user.points || 
                (this.currentUser.points === user.points && this.currentUser.total_gifts > user.total_gifts)) {
                break;
            }
            rank++;
        }
        
        return rank;
    }
    
    getSampleLeaderboard() {
        const currentUser = this.currentUser;
        
        // Fix: More realistic sample users with proper engagement patterns
        const sampleUsers = [
            { username: '⚡ Lightning', points: 50, total_gifts: 12 }, // Spent 50 points, has gifts
            { username: '🔥 FireStorm', points: 20, total_gifts: 10 }, // Spent 80 points, has gifts
            { username: '🚀 Rocket', points: 45, total_gifts: 9 },    // Spent 55 points, has gifts
            { username: '💎 Diamond', points: 10, total_gifts: 8 },   // Spent 90 points, has gifts
            { username: '🌟 StarPlayer', points: 80, total_gifts: 7 }, // Spent 20 points, has gifts
            { username: '⚽ GoalKing', points: 30, total_gifts: 6 },   // Spent 70 points, has gifts
            { username: '🏆 Champion', points: 60, total_gifts: 5 },   // Spent 40 points, has gifts
            { username: '🎯 Sniper', points: 25, total_gifts: 4 },     // Spent 75 points, has gifts
            { username: '🌪️ Tornado', points: 75, total_gifts: 3 },   // Spent 25 points, has gifts
            { username: '💫 Comet', points: 40, total_gifts: 2 }       // Spent 60 points, has gifts
        ];
        
        // Fix: Don't include users with default 100 points and 0 gifts in leaderboard
        // Only insert current user if they have actually engaged
        if (currentUser && (currentUser.total_gifts > 0 || currentUser.points !== 100)) {
            let insertIndex = sampleUsers.findIndex(user => {
                // Prioritize by gifts, then points
                if (currentUser.total_gifts !== user.total_gifts) {
                    return currentUser.total_gifts > user.total_gifts;
                }
                return currentUser.points > user.points;
            });
            
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
        
        if (supabase && window.FanZoneRealtime?.isReady()) {
            // Use the enhanced real-time manager
            const realtimeManager = window.FanZoneRealtime.getManager();
            
            // Subscribe to leaderboard updates
            realtimeManager.subscribeToLeaderboard((data) => {
                this.handleRealtimeUpdate(data);
            });
            
            if (CONFIG.DEBUG) {
                console.log('📊 Real-time leaderboard updates enabled');
            }
            
        } else if (supabase) {
            // Fallback to direct Supabase subscription
            this.subscription = supabase
                .channel('leaderboard-changes')
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: CONFIG.TABLES.USERS,
                    filter: 'points=gt.0'
                }, (payload) => {
                    this.handleRealtimeUpdate({
                        type: 'leaderboard_update',
                        user: payload.new,
                        changes: this.getChanges(payload.old, payload.new)
                    });
                })
                .subscribe();
                
        } else {
            // MVP mode - periodic refresh
            this.refreshInterval = setInterval(() => {
                this.refresh();
            }, CONFIG.LEADERBOARD.REFRESH_INTERVAL);
        }
    }

    handleRealtimeUpdate(data) {
        if (!data || !data.user) return;
        
        try {
            const now = Date.now();
            const userId = data.user.telegram_id;
            
            // Debounce updates per user to prevent spam
            const lastUpdate = this.pendingUpdates.get(userId) || 0;
            if (now - lastUpdate < this.UPDATE_DEBOUNCE_TIME) {
                return;
            }
            
            this.pendingUpdates.set(userId, now);
            
            // Check if this affects the leaderboard
            const affectsLeaderboard = this.shouldUpdateLeaderboard(data);
            
            if (affectsLeaderboard) {
                // Animate the change before refreshing
                this.animateRankChange(data.user);
                
                // Debounced refresh
                this.debouncedRefresh();
            }
            
            // If it's the current user, update their rank
            if (this.currentUser && userId === this.currentUser.telegram_id) {
                this.loadCurrentUserPosition();
            }
            
            if (CONFIG.DEBUG) {
                console.log('📊 Leaderboard real-time update:', data);
            }
            
        } catch (error) {
            Utils.logError(error, 'Handle real-time update');
        }
    }

    shouldUpdateLeaderboard(data) {
        if (!data.user || !data.changes) return true;
        
        // Check if points or total_gifts changed significantly
        const pointsChanged = data.changes.points;
        const giftsChanged = data.changes.total_gifts;
        
        if (!pointsChanged && !giftsChanged) return false;
        
        // Check if the user is in current leaderboard or could enter it
        const userInLeaderboard = this.leaderboard.find(u => 
            u.telegram_id === data.user.telegram_id
        );
        
        if (userInLeaderboard) return true;
        
        // Check if user's new points would put them in top N
        const lowestInLeaderboard = this.leaderboard[this.leaderboard.length - 1];
        if (lowestInLeaderboard && data.user.points > lowestInLeaderboard.points) {
            return true;
        }
        
        return false;
    }

    animateRankChange(user) {
        if (!user) return;
        
        const userElement = document.querySelector(`[data-user-id="${user.id}"]`);
        if (userElement) {
            // Add flash animation
            userElement.classList.add('rank-changed');
            
            setTimeout(() => {
                userElement.classList.remove('rank-changed');
            }, this.ANIMATION_DURATION);
        }
    }

    getChanges(oldData, newData) {
        const changes = {};
        
        if (!oldData || !newData) return changes;
        
        for (const key in newData) {
            if (oldData[key] !== newData[key]) {
                changes[key] = {
                    old: oldData[key],
                    new: newData[key]
                };
            }
        }
        
        return changes;
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
        
        // Check if current user is in top display
        const userInDisplay = this.leaderboard.find(user => 
            user.telegram_id === this.currentUser.telegram_id
        );
        
        if (userInDisplay) return '';
        
        // Show current user's rank if not in top display
        const rankDisplay = this.currentUserRank ? `#${this.currentUserRank}` : '?';
        const rankClass = this.getRankClass();
        
        return `
            <div class="current-user-rank">
                <div class="separator">
                    <span>Your Position</span>
                </div>
                <div class="leaderboard-item current-user ${rankClass}">
                    <div class="rank-section">
                        <div class="rank-number">${rankDisplay}</div>
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
                        <div class="rank-info">
                            ${this.renderRankProgress()}
                        </div>
                    </div>
                </div>
                ${this.renderRankingTip()}
            </div>
        `;
    }

    getRankClass() {
        if (!this.currentUserRank) return '';
        
        if (this.currentUserRank <= 3) return 'top-three';
        if (this.currentUserRank <= 10) return 'top-ten';
        if (this.currentUserRank <= 50) return 'top-fifty';
        return 'needs-improvement';
    }

    renderRankProgress() {
        if (!this.currentUserRank || this.currentUserRank <= this.MAX_DISPLAY_USERS) {
            return '<span class="current-user-indicator">👤</span>';
        }
        
        // Show how close to top N
        const pointsNeeded = this.calculatePointsToAdvance();
        if (pointsNeeded > 0) {
            return `<span class="rank-tip">📈 +${pointsNeeded} pts to advance</span>`;
        }
        
        return '<span class="rank-tip">🚀 Keep collecting!</span>';
    }

    calculatePointsToAdvance() {
        if (!this.leaderboard.length || !this.currentUser) return 0;
        
        const lowestInDisplay = this.leaderboard[this.leaderboard.length - 1];
        if (!lowestInDisplay) return 0;
        
        return Math.max(0, lowestInDisplay.points - this.currentUser.points + 1);
    }

    renderRankingTip() {
        if (!this.currentUserRank) return '';
        
        if (this.currentUserRank <= 3) {
            return '<div class="ranking-tip success">🎉 Amazing! You\'re in the top 3!</div>';
        } else if (this.currentUserRank <= 10) {
            return '<div class="ranking-tip good">🔥 Great job! You\'re in the top 10!</div>';
        } else if (this.currentUserRank <= 50) {
            return '<div class="ranking-tip progress">⭐ Nice! You\'re in the top 50!</div>';
        } else {
            return '<div class="ranking-tip motivate">🚀 Collect more gifts to climb the ranks!</div>';
        }
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
    // Performance Optimization
    // ======================

    shouldRefreshLeaderboard() {
        // Only refresh if last update was more than X seconds ago
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        
        return timeSinceLastUpdate > this.UPDATE_DEBOUNCE_TIME;
    }

    batchUpdates(callback) {
        // Batch DOM updates to prevent layout thrashing
        if (this.updateAnimation) {
            cancelAnimationFrame(this.updateAnimation);
        }
        
        this.updateAnimation = requestAnimationFrame(() => {
            callback();
            this.lastUpdateTime = Date.now();
        });
    }

    optimizedRender() {
        // Use virtual scrolling for large leaderboards (future enhancement)
        this.batchUpdates(() => {
            this.renderLeaderboard();
        });
    }

    // ======================
    // Utility Methods
    // ======================
    
    showError(message) {
        const container = Utils.getElementById('leaderboard-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <h3>⚠️ Leaderboard Unavailable</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.LeaderboardManager.init()">
                        🔄 Retry Loading
                    </button>
                </div>
            `;
        }
    }
    
    async refresh() {
        if (!this.shouldRefreshLeaderboard()) {
            return;
        }
        
        try {
            const promises = [this.loadLeaderboard()];
            
            // Also refresh current user position if needed
            if (this.currentUser) {
                promises.push(this.loadCurrentUserPosition());
            }
            
            await Promise.all(promises);
            this.optimizedRender();
            
            if (CONFIG.DEBUG) {
                console.log('📊 Leaderboard refreshed');
            }
            
        } catch (error) {
            Utils.logError(error, 'Leaderboard refresh');
        }
    }

    // Method called by real-time manager for external updates
    handleInventoryUpdate(data) {
        // When gifts are purchased, refresh leaderboard if needed
        if (data.type === 'inventory_update') {
            this.debouncedRefresh();
        }
    }

    // Get leaderboard statistics for analytics
    getLeaderboardStats() {
        return {
            total_users: this.leaderboard.length,
            current_user_rank: this.currentUserRank,
            top_user_points: this.leaderboard[0]?.points || 0,
            user_in_top_10: this.currentUserRank ? this.currentUserRank <= 10 : false,
            last_updated: this.lastUpdateTime
        };
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