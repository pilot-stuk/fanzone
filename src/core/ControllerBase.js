// Base Controller Class - provides common functionality for all controllers
// Implements proper event subscription management and timing

class ControllerBase {
    constructor(eventBus, logger) {
        // Validate critical dependencies
        this.validateEventBus(eventBus);
        this.validateLogger(logger);
        
        this.eventBus = eventBus;
        this.logger = logger;
        
        // Event subscription management
        this.subscriptions = [];
        this.isInitialized = false;
        this.isDestroyed = false;
        this.pendingSubscriptions = [];
        
        // Event replay functionality
        this.enableEventReplay = true;
        this.replayEvents = [];
        this.subscriptionReady = false;
    }
    
    /**
     * Validate EventBus dependency
     */
    validateEventBus(eventBus) {
        if (!eventBus) {
            throw new Error('EventBus is required for controller initialization');
        }
        
        // Check if EventBus has required methods
        const requiredMethods = ['subscribe', 'emit', 'unsubscribe', 'once', 'hasHandlers'];
        const missingMethods = requiredMethods.filter(method => 
            typeof eventBus[method] !== 'function'
        );
        
        if (missingMethods.length > 0) {
            throw new Error(`EventBus is missing required methods: ${missingMethods.join(', ')}`);
        }
        
        // Verify EventBus is properly initialized
        if (!eventBus.events && !eventBus.getEvents) {
            throw new Error('EventBus appears to be uninitialized or corrupted');
        }
    }
    
    /**
     * Validate Logger dependency
     */
    validateLogger(logger) {
        if (!logger) {
            throw new Error('Logger is required for controller initialization');
        }
        
        const requiredMethods = ['debug', 'info', 'warn', 'error'];
        const missingMethods = requiredMethods.filter(method => 
            typeof logger[method] !== 'function'
        );
        
        if (missingMethods.length > 0) {
            throw new Error(`Logger is missing required methods: ${missingMethods.join(', ')}`);
        }
    }
    
    /**
     * Safe event subscription with validation and tracking
     */
    subscribe(event, handler, options = {}) {
        if (this.isDestroyed) {
            this.logger.warn(`Attempted to subscribe to ${event} on destroyed controller`);
            return () => {};
        }
        
        // Validate parameters
        if (!event || typeof event !== 'string') {
            throw new Error('Event name must be a non-empty string');
        }
        
        if (!handler || typeof handler !== 'function') {
            throw new Error('Event handler must be a function');
        }
        
        // If controller is not ready for subscriptions, queue them
        if (!this.subscriptionReady && !options.immediate) {
            this.logger.debug(`Queuing subscription for ${event} until controller is ready`);
            this.pendingSubscriptions.push({ event, handler, options });
            return () => this.removePendingSubscription(event, handler);
        }
        
        try {
            // Create wrapper handler for additional functionality
            const wrappedHandler = this.createWrappedHandler(event, handler, options);
            
            // Subscribe to EventBus
            const unsubscribe = this.eventBus.subscribe(event, wrappedHandler);
            
            // Track subscription
            const subscription = {
                event,
                handler,
                wrappedHandler,
                unsubscribe,
                options,
                subscribedAt: Date.now()
            };
            
            this.subscriptions.push(subscription);
            
            this.logger.debug(`Subscribed to event: ${event}`, {
                totalSubscriptions: this.subscriptions.length,
                options
            });
            
            // Replay missed events if enabled
            if (this.enableEventReplay && options.replayMissed) {
                this.replayMissedEvents(event, wrappedHandler);
            }
            
            // Return unsubscribe function
            return () => this.unsubscribe(event, handler);
            
        } catch (error) {
            this.logger.error(`Failed to subscribe to event ${event}:`, error);
            throw error;
        }
    }
    
    /**
     * Subscribe to event only once
     */
    once(event, handler, options = {}) {
        return this.subscribe(event, handler, { ...options, once: true });
    }
    
    /**
     * Unsubscribe from event
     */
    unsubscribe(event, handler) {
        const subscriptionIndex = this.subscriptions.findIndex(sub => 
            sub.event === event && sub.handler === handler
        );
        
        if (subscriptionIndex === -1) {
            this.logger.warn(`No subscription found for event ${event}`);
            return false;
        }
        
        const subscription = this.subscriptions[subscriptionIndex];
        
        try {
            // Call EventBus unsubscribe
            const result = subscription.unsubscribe();
            
            // Remove from tracking
            this.subscriptions.splice(subscriptionIndex, 1);
            
            this.logger.debug(`Unsubscribed from event: ${event}`, {
                remainingSubscriptions: this.subscriptions.length
            });
            
            return result;
            
        } catch (error) {
            this.logger.error(`Failed to unsubscribe from event ${event}:`, error);
            return false;
        }
    }
    
    /**
     * Wait for EventBus to be ready and process pending subscriptions
     */
    async waitForEventBusReady(timeout = 5000) {
        const startTime = Date.now();
        
        while (!this.isEventBusReady() && (Date.now() - startTime) < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!this.isEventBusReady()) {
            throw new Error('EventBus failed to become ready within timeout');
        }
        
        this.subscriptionReady = true;
        await this.processPendingSubscriptions();
    }
    
    /**
     * Check if EventBus is ready for subscriptions
     */
    isEventBusReady() {
        try {
            // Test basic EventBus functionality
            return this.eventBus && 
                   typeof this.eventBus.subscribe === 'function' &&
                   typeof this.eventBus.emit === 'function' &&
                   !this.eventBus._initializing;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Process queued subscriptions
     */
    async processPendingSubscriptions() {
        if (this.pendingSubscriptions.length === 0) return;
        
        this.logger.debug(`Processing ${this.pendingSubscriptions.length} pending subscriptions`);
        
        const subscriptions = [...this.pendingSubscriptions];
        this.pendingSubscriptions = [];
        
        for (const { event, handler, options } of subscriptions) {
            try {
                await this.subscribe(event, handler, { ...options, immediate: true });
            } catch (error) {
                this.logger.error(`Failed to process pending subscription for ${event}:`, error);
                // Re-queue failed subscription for retry
                this.pendingSubscriptions.push({ event, handler, options });
            }
        }
    }
    
    /**
     * Create wrapped event handler with additional functionality
     */
    createWrappedHandler(event, originalHandler, options = {}) {
        return (data) => {
            try {
                // Log event reception if debug enabled
                if (this.logger.isDebugEnabled && this.logger.isDebugEnabled()) {
                    this.logger.debug(`Received event: ${event}`, { data });
                }
                
                // Call original handler
                const result = originalHandler(data);
                
                // Handle once subscription
                if (options.once) {
                    this.unsubscribe(event, originalHandler);
                }
                
                return result;
                
            } catch (error) {
                this.logger.error(`Error in event handler for ${event}:`, error);
                
                // Optionally re-throw based on options
                if (options.throwErrors) {
                    throw error;
                }
                
                return null;
            }
        };
    }
    
    /**
     * Replay missed events from EventBus history
     */
    replayMissedEvents(event, handler) {
        if (!this.eventBus.getHistory) return;
        
        try {
            const eventHistory = this.eventBus.getHistory(event);
            const recentEvents = eventHistory.filter(item => 
                item.timestamp > (Date.now() - 60000) // Last minute
            );
            
            if (recentEvents.length > 0) {
                this.logger.debug(`Replaying ${recentEvents.length} missed events for ${event}`);
                
                // Replay events asynchronously
                setTimeout(() => {
                    recentEvents.forEach(item => {
                        try {
                            handler(item.data);
                        } catch (error) {
                            this.logger.error(`Error replaying event ${event}:`, error);
                        }
                    });
                }, 0);
            }
        } catch (error) {
            this.logger.error(`Failed to replay events for ${event}:`, error);
        }
    }
    
    /**
     * Remove pending subscription
     */
    removePendingSubscription(event, handler) {
        const index = this.pendingSubscriptions.findIndex(sub => 
            sub.event === event && sub.handler === handler
        );
        
        if (index !== -1) {
            this.pendingSubscriptions.splice(index, 1);
            this.logger.debug(`Removed pending subscription for ${event}`);
        }
    }
    
    /**
     * Emit event through EventBus
     */
    emit(event, data) {
        if (this.isDestroyed) {
            this.logger.warn(`Attempted to emit ${event} from destroyed controller`);
            return;
        }
        
        try {
            return this.eventBus.emit(event, data);
        } catch (error) {
            this.logger.error(`Failed to emit event ${event}:`, error);
            throw error;
        }
    }
    
    /**
     * Emit event asynchronously
     */
    async emitAsync(event, data) {
        if (this.isDestroyed) {
            this.logger.warn(`Attempted to emit async ${event} from destroyed controller`);
            return;
        }
        
        try {
            return await this.eventBus.emitAsync(event, data);
        } catch (error) {
            this.logger.error(`Failed to emit async event ${event}:`, error);
            throw error;
        }
    }
    
    /**
     * Get subscription information
     */
    getSubscriptionInfo() {
        return {
            active: this.subscriptions.length,
            pending: this.pendingSubscriptions.length,
            ready: this.subscriptionReady,
            destroyed: this.isDestroyed,
            events: this.subscriptions.map(sub => ({
                event: sub.event,
                subscribedAt: sub.subscribedAt,
                options: sub.options
            }))
        };
    }
    
    /**
     * Initialize controller with event subscription setup
     */
    async initializeEventSystem() {
        if (this.isInitialized) return;
        
        try {
            this.logger.debug('Initializing controller event system');
            
            // Wait for EventBus to be ready
            await this.waitForEventBusReady();
            
            // Mark as initialized
            this.isInitialized = true;
            
            this.logger.debug('Controller event system initialized', {
                subscriptions: this.subscriptions.length,
                pending: this.pendingSubscriptions.length
            });
            
        } catch (error) {
            this.logger.error('Failed to initialize controller event system:', error);
            throw error;
        }
    }
    
    /**
     * Cleanup all subscriptions
     */
    destroy() {
        if (this.isDestroyed) return;
        
        this.logger.debug('Destroying controller and cleaning up subscriptions');
        
        // Unsubscribe from all events
        const subscriptions = [...this.subscriptions];
        subscriptions.forEach(subscription => {
            try {
                subscription.unsubscribe();
            } catch (error) {
                this.logger.error(`Error unsubscribing from ${subscription.event}:`, error);
            }
        });
        
        // Clear arrays
        this.subscriptions = [];
        this.pendingSubscriptions = [];
        
        // Mark as destroyed
        this.isDestroyed = true;
        this.isInitialized = false;
        this.subscriptionReady = false;
        
        this.logger.debug('Controller destroyed');
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ControllerBase;
}

window.ControllerBase = ControllerBase;