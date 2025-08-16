// Real-time Database Configuration for FanZone
// Handles Supabase real-time subscriptions for live updates

class RealtimeManager {
    constructor() {
        this.supabase = null;
        this.subscriptions = new Map();
        this.callbacks = new Map();
        this.isConnected = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.subscribe = this.subscribe.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
        this.handleRealtimeEvent = this.handleRealtimeEvent.bind(this);
    }

    // ======================
    // Initialization
    // ======================

    async init(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('Supabase client required for real-time functionality');
        }
        
        this.supabase = supabaseClient;
        
        try {
            // Test connection
            const channel = this.supabase.channel('test-connection');
            await channel.subscribe();
            channel.unsubscribe();
            
            this.isConnected = true;
            
            if (CONFIG.DEBUG) {
                console.log('🔴 Real-time manager initialized');
            }
            
            return true;
            
        } catch (error) {
            Utils.logError(error, 'Real-time initialization');
            this.isConnected = false;
            return false;
        }
    }

    // ======================
    // Subscription Management
    // ======================

    subscribe(subscriptionName, config, callback) {
        if (!this.isConnected) {
            console.warn('Real-time not connected, skipping subscription:', subscriptionName);
            return null;
        }

        try {
            // Unsubscribe existing if exists
            this.unsubscribe(subscriptionName);
            
            const channel = this.supabase.channel(subscriptionName);
            
            // Configure the subscription based on type
            if (config.type === 'table') {
                channel.on('postgres_changes', {
                    event: config.event || '*',
                    schema: 'public',
                    table: config.table,
                    filter: config.filter
                }, (payload) => {
                    this.handleRealtimeEvent(subscriptionName, payload, callback);
                });
            }
            
            // Store subscription
            this.subscriptions.set(subscriptionName, channel);
            this.callbacks.set(subscriptionName, callback);
            
            // Subscribe
            channel.subscribe((status) => {
                if (CONFIG.DEBUG) {
                    console.log(`📡 Subscription ${subscriptionName}:`, status);
                }
            });
            
            if (CONFIG.DEBUG) {
                console.log(`🔴 Subscribed to: ${subscriptionName}`);
            }
            
            return channel;
            
        } catch (error) {
            Utils.logError(error, `Real-time subscription: ${subscriptionName}`);
            return null;
        }
    }

    unsubscribe(subscriptionName) {
        const channel = this.subscriptions.get(subscriptionName);
        if (channel) {
            channel.unsubscribe();
            this.subscriptions.delete(subscriptionName);
            this.callbacks.delete(subscriptionName);
            
            if (CONFIG.DEBUG) {
                console.log(`🔴 Unsubscribed from: ${subscriptionName}`);
            }
        }
    }

    unsubscribeAll() {
        for (const [name] of this.subscriptions) {
            this.unsubscribe(name);
        }
        
        if (CONFIG.DEBUG) {
            console.log('🔴 All subscriptions unsubscribed');
        }
    }

    // ======================
    // Event Handling
    // ======================

    handleRealtimeEvent(subscriptionName, payload, callback) {
        try {
            if (CONFIG.DEBUG) {
                console.log(`📡 Real-time event [${subscriptionName}]:`, payload);
            }
            
            // Call the callback with processed data
            if (callback && typeof callback === 'function') {
                callback(payload);
            }
            
            // Emit custom event for other components to listen
            window.dispatchEvent(new CustomEvent('fanzone-realtime', {
                detail: {
                    subscription: subscriptionName,
                    payload: payload
                }
            }));
            
        } catch (error) {
            Utils.logError(error, `Real-time event handling: ${subscriptionName}`);
        }
    }

    // ======================
    // Predefined Subscriptions
    // ======================

    subscribeToLeaderboard(callback) {
        return this.subscribe('leaderboard-updates', {
            type: 'table',
            table: 'users',
            event: 'UPDATE',
            filter: 'points=gt.0'
        }, (payload) => {
            // Process leaderboard update
            if (callback) {
                callback({
                    type: 'leaderboard_update',
                    user: payload.new,
                    changes: this.getChanges(payload.old, payload.new)
                });
            }
        });
    }

    subscribeToGiftInventory(callback) {
        return this.subscribe('gift-inventory', {
            type: 'table',
            table: 'gifts',
            event: 'UPDATE'
        }, (payload) => {
            // Process gift inventory update
            if (callback) {
                callback({
                    type: 'inventory_update',
                    gift: payload.new,
                    previous_supply: payload.old?.current_supply,
                    new_supply: payload.new?.current_supply
                });
            }
        });
    }

    subscribeToUserGifts(userId, callback) {
        return this.subscribe(`user-gifts-${userId}`, {
            type: 'table',
            table: 'user_gifts',
            event: 'INSERT',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            // Process new gift acquisition
            if (callback) {
                callback({
                    type: 'gift_acquired',
                    userGift: payload.new
                });
            }
        });
    }

    subscribeToUserPoints(telegramId, callback) {
        return this.subscribe(`user-points-${telegramId}`, {
            type: 'table',
            table: 'users',
            event: 'UPDATE',
            filter: `telegram_id=eq.${telegramId}`
        }, (payload) => {
            // Process points update
            if (callback) {
                callback({
                    type: 'points_update',
                    old_points: payload.old?.points,
                    new_points: payload.new?.points,
                    change: payload.new?.points - payload.old?.points
                });
            }
        });
    }

    // ======================
    // Utility Methods
    // ======================

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

    getActiveSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }

    getSubscriptionStatus() {
        return {
            connected: this.isConnected,
            active_subscriptions: this.getActiveSubscriptions().length,
            subscriptions: this.getActiveSubscriptions()
        };
    }

    // ======================
    // Debug Methods
    // ======================

    debug() {
        console.log('🔴 Real-time Manager Status:');
        console.log('Connected:', this.isConnected);
        console.log('Active Subscriptions:', this.getActiveSubscriptions());
        console.log('Callbacks:', Array.from(this.callbacks.keys()));
    }
}

// ======================
// Integration with FanZone App
// ======================

class FanZoneRealtime {
    constructor() {
        this.manager = new RealtimeManager();
        this.isInitialized = false;
    }

    async init(app) {
        if (!app || !app.getSupabase()) {
            console.warn('Supabase not available, real-time features disabled');
            return false;
        }

        try {
            const success = await this.manager.init(app.getSupabase());
            
            if (success) {
                this.setupDefaultSubscriptions(app);
                this.isInitialized = true;
                
                if (CONFIG.DEBUG) {
                    console.log('🔴 FanZone real-time initialized');
                }
            }
            
            return success;
            
        } catch (error) {
            Utils.logError(error, 'FanZone real-time initialization');
            return false;
        }
    }

    setupDefaultSubscriptions(app) {
        const user = app.getUser();
        
        if (!user) return;
        
        // Subscribe to leaderboard updates
        this.manager.subscribeToLeaderboard((data) => {
            if (window.LeaderboardManager) {
                window.LeaderboardManager.handleRealtimeUpdate(data);
            }
        });
        
        // Subscribe to gift inventory updates
        this.manager.subscribeToGiftInventory((data) => {
            if (window.GiftsManager) {
                window.GiftsManager.handleInventoryUpdate(data);
            }
        });
        
        // Subscribe to user's own points updates
        this.manager.subscribeToUserPoints(user.telegram_id, (data) => {
            app.updateUserDisplay();
            
            // Show toast for points changes
            if (data.change !== 0) {
                const message = data.change > 0 
                    ? `+${data.change} points earned!` 
                    : `${data.change} points spent`;
                
                Utils.showToast(message, data.change > 0 ? 'success' : 'info');
            }
        });
        
        // Subscribe to user's gift acquisitions
        this.manager.subscribeToUserGifts(user.id, (data) => {
            if (window.ProfileManager) {
                window.ProfileManager.handleNewGift(data);
            }
            
            Utils.showToast('New gift added to your collection! 🎁', 'success');
        });
    }

    cleanup() {
        if (this.manager) {
            this.manager.unsubscribeAll();
        }
        this.isInitialized = false;
        
        if (CONFIG.DEBUG) {
            console.log('🔴 FanZone real-time cleaned up');
        }
    }

    getManager() {
        return this.manager;
    }

    isReady() {
        return this.isInitialized;
    }
}

// Create global instance
window.FanZoneRealtime = new FanZoneRealtime();

// Auto-initialize when app is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for app to be ready
    const initRealtime = () => {
        if (window.FanZoneApp && window.FanZoneApp.isReady()) {
            window.FanZoneRealtime.init(window.FanZoneApp);
        } else {
            setTimeout(initRealtime, 1000);
        }
    };
    
    setTimeout(initRealtime, 2000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.FanZoneRealtime) {
        window.FanZoneRealtime.cleanup();
    }
});

if (CONFIG.DEBUG) {
    console.log('🔴 Real-time configuration loaded');
}