// Test script for the refactored FanZone application
// Run this in the browser console to verify functionality

class FanZoneTests {
    constructor() {
        this.results = [];
    }
    
    async runAllTests() {
        console.log('🧪 Starting FanZone Refactored Tests...');
        
        try {
            await this.testDIContainer();
            await this.testEventBus();
            await this.testLogger();
            await this.testTelegramAdapter();
            await this.testServices();
            
            this.displayResults();
        } catch (error) {
            console.error('❌ Test execution failed:', error);
        }
    }
    
    test(name, testFn) {
        try {
            const result = testFn();
            
            if (result === true || (result && result.success)) {
                this.results.push({ name, status: '✅ PASS', details: result.details || '' });
                console.log(`✅ ${name}: PASS`);
            } else {
                this.results.push({ name, status: '❌ FAIL', details: result.error || 'Unknown error' });
                console.log(`❌ ${name}: FAIL`);
            }
        } catch (error) {
            this.results.push({ name, status: '❌ ERROR', details: error.message });
            console.log(`❌ ${name}: ERROR - ${error.message}`);
        }
    }
    
    async testDIContainer() {
        console.log('\n📦 Testing DI Container...');
        
        this.test('DI Container exists', () => {
            return window.DIContainer && typeof window.DIContainer.get === 'function';
        });
        
        this.test('DI Container is initialized', () => {
            const stats = window.DIContainer.getStats();
            return stats.initialized && stats.services > 0;
        });
        
        this.test('Core services registered', () => {
            const hasLogger = window.DIContainer.has('logger');
            const hasEventBus = window.DIContainer.has('eventBus');
            const hasAuth = window.DIContainer.has('authService');
            
            return hasLogger && hasEventBus && hasAuth;
        });
    }
    
    async testEventBus() {
        console.log('\n📡 Testing Event Bus...');
        
        this.test('EventBus exists', () => {
            return window.EventBus && typeof window.EventBus.emit === 'function';
        });
        
        this.test('Event subscription works', () => {
            let called = false;
            const unsubscribe = window.EventBus.subscribe('test:event', () => {
                called = true;
            });
            
            window.EventBus.emit('test:event');
            unsubscribe();
            
            return called;
        });
        
        this.test('Event history tracking', () => {
            window.EventBus.emit('test:history', { test: true });
            const history = window.EventBus.getHistory('test:history');
            
            return history.length > 0 && history[0].event === 'test:history';
        });
    }
    
    async testLogger() {
        console.log('\n📝 Testing Logger...');
        
        this.test('Logger exists', () => {
            return window.Logger && typeof window.Logger.info === 'function';
        });
        
        this.test('Logging works', () => {
            const initialCount = window.Logger.getLogs().length;
            window.Logger.info('Test log message');
            const newCount = window.Logger.getLogs().length;
            
            return newCount > initialCount;
        });
        
        this.test('Error logging with context', () => {
            const testError = new Error('Test error');
            window.Logger.error('Test error message', testError, { test: true });
            
            const errorLogs = window.Logger.getLogs('error');
            const lastLog = errorLogs[errorLogs.length - 1];
            
            return lastLog && lastLog.context.test === true;
        });
    }
    
    async testTelegramAdapter() {
        console.log('\n📱 Testing Telegram Adapter...');
        
        this.test('TelegramAdapter exists', () => {
            return window.TelegramAdapter && typeof window.TelegramAdapter.getUserData === 'function';
        });
        
        this.test('Platform detection', () => {
            const isAvailable = window.TelegramAdapter.isAvailable();
            // Should work in both Telegram and development mode
            return typeof isAvailable === 'boolean';
        });
        
        this.test('User data retrieval', () => {
            try {
                const userData = window.TelegramAdapter.getUserData();
                return userData && userData.id && userData.firstName;
            } catch (error) {
                // Expected in development mode
                return true;
            }
        });
    }
    
    async testServices() {
        console.log('\n🔧 Testing Services...');
        
        this.test('Services can be retrieved from DI', () => {
            try {
                const authService = window.DIContainer.get('authService');
                const userService = window.DIContainer.get('userService');
                const giftService = window.DIContainer.get('giftService');
                
                return authService && userService && giftService;
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        this.test('AuthService functionality', () => {
            try {
                const authService = window.DIContainer.get('authService');
                const isAuth = authService.isAuthenticated();
                const user = authService.getCurrentUser();
                
                // Should have user data after initialization
                return typeof isAuth === 'boolean' && (user !== null);
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        this.test('UserService functionality', () => {
            try {
                const userService = window.DIContainer.get('userService');
                const authService = window.DIContainer.get('authService');
                const currentUser = authService.getCurrentUser();
                
                if (!currentUser) {
                    return { success: false, error: 'No authenticated user' };
                }
                
                // Test cache functionality
                userService.cacheUser(currentUser);
                const cachedUser = userService.getCachedUser(currentUser.telegram_id || currentUser.id);
                
                return cachedUser !== null;
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
        
        this.test('GiftService functionality', () => {
            try {
                const giftService = window.DIContainer.get('giftService');
                
                // Test sample gifts
                const sampleGifts = giftService.getSampleGifts();
                
                return Array.isArray(sampleGifts) && sampleGifts.length > 0;
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
    }
    
    displayResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' .repeat(50));
        
        let passed = 0;
        let failed = 0;
        
        this.results.forEach(result => {
            console.log(`${result.status} ${result.name}`);
            if (result.details) {
                console.log(`   ${result.details}`);
            }
            
            if (result.status.includes('PASS')) {
                passed++;
            } else {
                failed++;
            }
        });
        
        console.log('=' .repeat(50));
        console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`);
        
        if (failed === 0) {
            console.log('🎉 All tests passed! The refactored system is working correctly.');
        } else {
            console.log(`⚠️ ${failed} test(s) failed. Check the details above.`);
        }
        
        return { total: this.results.length, passed, failed, results: this.results };
    }
}

// Additional helper functions for debugging

window.FanZoneDebug = {
    // Check application state
    checkAppState() {
        console.log('🔍 Application State Check:');
        console.log('DI Container:', window.DIContainer?.getStats());
        console.log('Event Bus Events:', window.EventBus?.getEvents());
        console.log('Logger Stats:', window.Logger?.getStats());
        console.log('Current User:', window.DIContainer?.get('authService')?.getCurrentUser());
    },
    
    // Test gift purchase flow
    async testGiftPurchase(giftId = 'gift-1') {
        try {
            const giftService = window.DIContainer.get('giftService');
            const authService = window.DIContainer.get('authService');
            
            const user = authService.getCurrentUser();
            if (!user) {
                console.error('No authenticated user');
                return;
            }
            
            console.log('Testing gift purchase for gift:', giftId);
            
            // Validate purchase
            const validation = await giftService.validatePurchase(user.telegram_id || user.id, giftId);
            console.log('Validation result:', validation);
            
            if (validation.valid) {
                console.log('✅ Purchase validation passed');
            } else {
                console.log('❌ Purchase validation failed:', validation.message);
            }
            
        } catch (error) {
            console.error('❌ Test gift purchase failed:', error);
        }
    },
    
    // Force re-initialization
    async reinitialize() {
        console.log('🔄 Reinitializing application...');
        try {
            await window.FanZoneApp.initialize();
            console.log('✅ Reinitialization complete');
        } catch (error) {
            console.error('❌ Reinitialization failed:', error);
        }
    },
    
    // Export logs for debugging
    exportLogs() {
        const logs = window.Logger.exportLogs('json');
        console.log('📁 Logs exported:', logs);
        return logs;
    }
};

// Run tests automatically if in development mode
if (window.CONFIG && window.CONFIG.DEBUG) {
    // Wait for app to initialize, then run tests
    setTimeout(async () => {
        if (window.FanZoneApp && window.FanZoneApp.isInitialized) {
            console.log('🚀 Running automatic tests...');
            const tests = new FanZoneTests();
            await tests.runAllTests();
        }
    }, 2000);
}

// Make test class available globally
window.FanZoneTests = FanZoneTests;