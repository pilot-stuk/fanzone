// Event Bus for decoupled communication between modules
// Implements Observer Pattern for loose coupling

class EventBus extends window.Interfaces.IEventBus {
    constructor() {
        super();
        this.events = new Map();
        this.oneTimeEvents = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
        this.debug = false;
        
        // Initialization state
        this._initializing = false;
        this._initialized = false;
        this._readyPromise = null;
        this.isInitialized = false; // For ServiceValidator compatibility
        
        // Start initialization
        this.initialize();
    }
    
    /**
     * Initialize EventBus
     */
    async initialize() {
        if (this._initialized || this._initializing) return this._readyPromise;
        
        this._initializing = true;
        
        this._readyPromise = new Promise((resolve) => {
            // Minimal initialization - EventBus is ready immediately
            setTimeout(() => {
                this._initialized = true;
                this._initializing = false;
                
                // Also set isInitialized for ServiceValidator compatibility
                this.isInitialized = true;
                
                if (this.debug) {
                    console.log('📢 EventBus initialized and ready');
                }
                
                resolve(this);
            }, 0);
        });
        
        return this._readyPromise;
    }
    
    /**
     * Wait for EventBus to be ready
     */
    async waitForReady(timeout = 5000) {
        if (this._initialized) return this;
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('EventBus initialization timeout')), timeout);
        });
        
        return Promise.race([this._readyPromise, timeoutPromise]);
    }
    
    /**
     * Check if EventBus is ready
     */
    isReady() {
        return this._initialized && !this._initializing;
    }
    
    /**
     * Subscribe to an event
     */
    subscribe(event, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        this.events.get(event).add(handler);
        
        if (this.debug) {
            console.log(`📢 Subscribed to event: ${event}`);
        }
        
        // Return unsubscribe function
        return () => this.unsubscribe(event, handler);
    }
    
    /**
     * Subscribe to an event once
     */
    once(event, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        
        if (!this.oneTimeEvents.has(event)) {
            this.oneTimeEvents.set(event, new Set());
        }
        
        this.oneTimeEvents.get(event).add(handler);
        
        if (this.debug) {
            console.log(`📢 Subscribed once to event: ${event}`);
        }
        
        // Return unsubscribe function
        return () => this.unsubscribeOnce(event, handler);
    }
    
    /**
     * Unsubscribe from an event
     */
    unsubscribe(event, handler) {
        if (!this.events.has(event)) {
            return false;
        }
        
        const handlers = this.events.get(event);
        const deleted = handlers.delete(handler);
        
        // Clean up empty sets
        if (handlers.size === 0) {
            this.events.delete(event);
        }
        
        if (this.debug && deleted) {
            console.log(`📢 Unsubscribed from event: ${event}`);
        }
        
        return deleted;
    }
    
    /**
     * Unsubscribe from a one-time event
     */
    unsubscribeOnce(event, handler) {
        if (!this.oneTimeEvents.has(event)) {
            return false;
        }
        
        const handlers = this.oneTimeEvents.get(event);
        const deleted = handlers.delete(handler);
        
        // Clean up empty sets
        if (handlers.size === 0) {
            this.oneTimeEvents.delete(event);
        }
        
        return deleted;
    }
    
    /**
     * Emit an event
     */
    emit(event, data = null) {
        // Add to history
        this.addToHistory(event, data);
        
        if (this.debug) {
            console.log(`📢 Emitting event: ${event}`, data);
        }
        
        const results = [];
        
        // Call regular handlers
        if (this.events.has(event)) {
            const handlers = this.events.get(event);
            
            for (const handler of handlers) {
                try {
                    const result = handler(data);
                    results.push(result);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            }
        }
        
        // Call one-time handlers
        if (this.oneTimeEvents.has(event)) {
            const handlers = this.oneTimeEvents.get(event);
            
            for (const handler of handlers) {
                try {
                    const result = handler(data);
                    results.push(result);
                } catch (error) {
                    console.error(`Error in one-time event handler for ${event}:`, error);
                }
            }
            
            // Remove all one-time handlers after calling
            this.oneTimeEvents.delete(event);
        }
        
        return results;
    }
    
    /**
     * Emit an event asynchronously
     */
    async emitAsync(event, data = null) {
        // Add to history
        this.addToHistory(event, data);
        
        if (this.debug) {
            console.log(`📢 Emitting async event: ${event}`, data);
        }
        
        const results = [];
        
        // Call regular handlers
        if (this.events.has(event)) {
            const handlers = this.events.get(event);
            
            for (const handler of handlers) {
                try {
                    const result = await handler(data);
                    results.push(result);
                } catch (error) {
                    console.error(`Error in async event handler for ${event}:`, error);
                }
            }
        }
        
        // Call one-time handlers
        if (this.oneTimeEvents.has(event)) {
            const handlers = this.oneTimeEvents.get(event);
            
            for (const handler of handlers) {
                try {
                    const result = await handler(data);
                    results.push(result);
                } catch (error) {
                    console.error(`Error in async one-time event handler for ${event}:`, error);
                }
            }
            
            // Remove all one-time handlers after calling
            this.oneTimeEvents.delete(event);
        }
        
        return results;
    }
    
    /**
     * Clear all handlers for an event
     */
    clear(event) {
        const hadHandlers = this.events.has(event) || this.oneTimeEvents.has(event);
        
        this.events.delete(event);
        this.oneTimeEvents.delete(event);
        
        if (this.debug && hadHandlers) {
            console.log(`📢 Cleared all handlers for event: ${event}`);
        }
        
        return hadHandlers;
    }
    
    /**
     * Clear all event handlers
     */
    clearAll() {
        const eventCount = this.events.size + this.oneTimeEvents.size;
        
        this.events.clear();
        this.oneTimeEvents.clear();
        
        if (this.debug) {
            console.log(`📢 Cleared all event handlers (${eventCount} events)`);
        }
    }
    
    /**
     * Get all registered events
     */
    getEvents() {
        const regularEvents = Array.from(this.events.keys());
        const oneTimeEvents = Array.from(this.oneTimeEvents.keys());
        
        return {
            regular: regularEvents,
            oneTime: oneTimeEvents,
            all: [...new Set([...regularEvents, ...oneTimeEvents])]
        };
    }
    
    /**
     * Get handler count for an event
     */
    getHandlerCount(event) {
        const regularCount = this.events.get(event)?.size || 0;
        const oneTimeCount = this.oneTimeEvents.get(event)?.size || 0;
        
        return regularCount + oneTimeCount;
    }
    
    /**
     * Check if event has handlers
     */
    hasHandlers(event) {
        return this.events.has(event) || this.oneTimeEvents.has(event);
    }
    
    /**
     * Add event to history
     */
    addToHistory(event, data) {
        this.eventHistory.push({
            event,
            data,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
    
    /**
     * Get event history
     */
    getHistory(event = null) {
        if (event) {
            return this.eventHistory.filter(item => item.event === event);
        }
        
        return [...this.eventHistory];
    }
    
    /**
     * Clear event history
     */
    clearHistory() {
        this.eventHistory = [];
    }
    
    /**
     * Enable/disable debug mode
     */
    setDebug(enabled) {
        this.debug = enabled;
    }
    
    /**
     * Wait for an event to be emitted
     */
    waitFor(event, timeout = 5000) {
        return new Promise((resolve, reject) => {
            let timeoutId;
            
            const handler = (data) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                resolve(data);
            };
            
            // Subscribe once
            this.once(event, handler);
            
            // Set timeout
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    this.unsubscribeOnce(event, handler);
                    reject(new Error(`Timeout waiting for event: ${event}`));
                }, timeout);
            }
        });
    }
    
    /**
     * Create a namespaced event bus
     */
    namespace(prefix) {
        const parent = this;
        
        return {
            subscribe: (event, handler) => parent.subscribe(`${prefix}:${event}`, handler),
            once: (event, handler) => parent.once(`${prefix}:${event}`, handler),
            unsubscribe: (event, handler) => parent.unsubscribe(`${prefix}:${event}`, handler),
            emit: (event, data) => parent.emit(`${prefix}:${event}`, data),
            emitAsync: (event, data) => parent.emitAsync(`${prefix}:${event}`, data),
            clear: (event) => parent.clear(`${prefix}:${event}`),
            hasHandlers: (event) => parent.hasHandlers(`${prefix}:${event}`),
            waitFor: (event, timeout) => parent.waitFor(`${prefix}:${event}`, timeout)
        };
    }
}

// Create singleton instance
window.EventBus = new EventBus();

// Common event names for consistency
window.EventBus.Events = {
    // Authentication
    AUTH_SUCCESS: 'auth:success',
    AUTH_FAILED: 'auth:failed',
    AUTH_LOGOUT: 'auth:logout',
    
    // User
    USER_REGISTERED: 'user:registered',
    USER_UPDATED: 'user:updated',
    USER_REFRESHED: 'user:refreshed',
    USER_POINTS_UPDATED: 'user:points:updated',
    USER_PROFILE_UPDATED: 'user:profile:updated',
    
    // Gifts
    GIFT_PURCHASED: 'gift:purchased',
    GIFT_PURCHASE_FAILED: 'gift:purchase:failed',
    GIFTS_LOADED: 'gifts:loaded',
    GIFTS_FILTERED: 'gifts:filtered',
    
    // Navigation
    PAGE_CHANGED: 'navigation:page:changed',
    NAVIGATION_BACK: 'navigation:back',
    
    // UI
    THEME_CHANGED: 'theme:changed',
    VIEWPORT_CHANGED: 'viewport:changed',
    LOADING_START: 'ui:loading:start',
    LOADING_END: 'ui:loading:end',
    TOAST_SHOW: 'ui:toast:show',
    
    // Telegram
    MAIN_BUTTON_CLICKED: 'mainbutton:clicked',
    SETTINGS_OPENED: 'settings:opened',
    
    // Network
    ONLINE: 'network:online',
    OFFLINE: 'network:offline',
    
    // Errors
    ERROR_OCCURRED: 'error:occurred'
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
}