// Core interfaces and abstractions following Interface Segregation Principle
// These define contracts that implementations must follow

/**
 * Authentication Provider Interface
 */
class IAuthProvider {
    async authenticate(userData) {
        throw new Error('authenticate must be implemented');
    }
    
    async createUser(userData) {
        throw new Error('createUser must be implemented');
    }
    
    async updateUser(userId, updates) {
        throw new Error('updateUser must be implemented');
    }
    
    async getUser(userId) {
        throw new Error('getUser must be implemented');
    }
    
    isAuthenticated() {
        throw new Error('isAuthenticated must be implemented');
    }
}

/**
 * Data Repository Interface
 */
class IDataRepository {
    async create(table, data) {
        throw new Error('create must be implemented');
    }
    
    async read(table, id) {
        throw new Error('read must be implemented');
    }
    
    async update(table, id, data) {
        throw new Error('update must be implemented');
    }
    
    async delete(table, id) {
        throw new Error('delete must be implemented');
    }
    
    async query(table, filters, options) {
        throw new Error('query must be implemented');
    }
    
    async execute(functionName, params) {
        throw new Error('execute must be implemented');
    }
}

/**
 * Gift Service Interface
 */
class IGiftService {
    async getAvailableGifts(filters) {
        throw new Error('getAvailableGifts must be implemented');
    }
    
    async purchaseGift(userId, giftId) {
        throw new Error('purchaseGift must be implemented');
    }
    
    async getUserGifts(userId) {
        throw new Error('getUserGifts must be implemented');
    }
    
    async validatePurchase(userId, giftId) {
        throw new Error('validatePurchase must be implemented');
    }
}

/**
 * User Service Interface
 */
class IUserService {
    async getUserProfile(userId) {
        throw new Error('getUserProfile must be implemented');
    }
    
    async updatePoints(userId, pointChange) {
        throw new Error('updatePoints must be implemented');
    }
    
    async getLeaderboard(limit) {
        throw new Error('getLeaderboard must be implemented');
    }
    
    async getUserRank(userId) {
        throw new Error('getUserRank must be implemented');
    }
}

/**
 * Platform Adapter Interface
 */
class IPlatformAdapter {
    async initialize() {
        throw new Error('initialize must be implemented');
    }
    
    getUserData() {
        throw new Error('getUserData must be implemented');
    }
    
    getThemeParams() {
        throw new Error('getThemeParams must be implemented');
    }
    
    showMainButton(text, callback) {
        throw new Error('showMainButton must be implemented');
    }
    
    hideMainButton() {
        throw new Error('hideMainButton must be implemented');
    }
    
    sendHapticFeedback(type) {
        throw new Error('sendHapticFeedback must be implemented');
    }
    
    isAvailable() {
        throw new Error('isAvailable must be implemented');
    }
}

/**
 * Event Bus Interface for decoupled communication
 */
class IEventBus {
    subscribe(event, handler) {
        throw new Error('subscribe must be implemented');
    }
    
    unsubscribe(event, handler) {
        throw new Error('unsubscribe must be implemented');
    }
    
    emit(event, data) {
        throw new Error('emit must be implemented');
    }
}

/**
 * Logger Interface
 */
class ILogger {
    log(level, message, context) {
        throw new Error('log must be implemented');
    }
    
    error(message, error, context) {
        throw new Error('error must be implemented');
    }
    
    warn(message, context) {
        throw new Error('warn must be implemented');
    }
    
    info(message, context) {
        throw new Error('info must be implemented');
    }
    
    debug(message, context) {
        throw new Error('debug must be implemented');
    }
}

// Export interfaces
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        IAuthProvider,
        IDataRepository,
        IGiftService,
        IUserService,
        IPlatformAdapter,
        IEventBus,
        ILogger
    };
}

// Global access for browser
window.Interfaces = {
    IAuthProvider,
    IDataRepository,
    IGiftService,
    IUserService,
    IPlatformAdapter,
    IEventBus,
    ILogger
};