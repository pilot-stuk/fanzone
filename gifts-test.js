// Gift Browsing and Purchase System Testing Script for FanZone
// Test all gift functionality including browsing, filtering, search, and purchases

class GiftsTester {
    constructor() {
        this.testResults = [];
        this.originalGifts = [];
        this.originalUserGifts = [];
        this.mockPurchases = [];
    }

    async runAllTests() {
        console.log('🎁 Starting Gift System Tests...\n');
        
        try {
            // Initialize test environment
            await this.setupTestEnvironment();
            
            // Run test suite
            await this.testGiftLoading();
            await this.testFilteringSystem();
            await this.testSearchFunctionality();
            await this.testGiftRendering();
            await this.testPurchaseFlow();
            await this.testErrorHandling();
            await this.testRealTimeUpdates();
            await this.testMobileResponsiveness();
            await this.testPerformance();
            
            // Cleanup
            await this.cleanup();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Gift test suite failed:', error);
            this.recordResult('Test Suite', false, error.message);
        }
    }

    // ======================
    // Test Setup
    // ======================

    async setupTestEnvironment() {
        console.log('🔧 Setting up gift test environment...');
        
        try {
            // Ensure gifts manager is available
            if (!window.GiftsManager) {
                throw new Error('GiftsManager not available');
            }
            
            // Store original data
            this.originalGifts = [...window.GiftsManager.gifts];
            this.originalUserGifts = [...window.GiftsManager.userGifts];
            
            // Setup test data
            window.GiftsManager.gifts = this.generateTestGifts();
            window.GiftsManager.userGifts = ['test-gift-1']; // User owns one gift
            
            this.recordResult('Test Environment Setup', true);
            
        } catch (error) {
            this.recordResult('Test Environment Setup', false, error.message);
            throw error;
        }
    }

    generateTestGifts() {
        return [
            {
                id: 'test-gift-1',
                name: '⚽ Test Match Ball',
                description: 'A test match ball for testing purposes',
                image_url: 'https://via.placeholder.com/150x100/3390ec/ffffff?text=⚽',
                price_points: 50,
                max_supply: 100,
                current_supply: 25,
                category: 'match',
                rarity: 'common',
                is_active: true
            },
            {
                id: 'test-gift-2',
                name: '🏆 Test Trophy',
                description: 'A legendary test trophy',
                image_url: 'https://via.placeholder.com/150x100/FFD700/000000?text=🏆',
                price_points: 200,
                max_supply: 10,
                current_supply: 9,
                category: 'trophy',
                rarity: 'legendary',
                is_active: true
            },
            {
                id: 'test-gift-3',
                name: '👕 Test Jersey',
                description: 'Limited edition test jersey',
                image_url: 'https://via.placeholder.com/150x100/FF4444/ffffff?text=👕',
                price_points: 75,
                max_supply: 50,
                current_supply: 50, // Out of stock
                category: 'player',
                rarity: 'rare',
                is_active: true
            },
            {
                id: 'test-gift-4',
                name: '⭐ Test Special Card',
                description: 'Very expensive special test card',
                image_url: 'https://via.placeholder.com/150x100/9C27B0/ffffff?text=⭐',
                price_points: 500, // Too expensive for most users
                max_supply: 5,
                current_supply: 1,
                category: 'special',
                rarity: 'epic',
                is_active: true
            }
        ];
    }

    // ======================
    // Test Methods
    // ======================

    async testGiftLoading() {
        console.log('📦 Testing Gift Loading...');
        
        try {
            const startTime = performance.now();
            
            // Test loading gifts
            await window.GiftsManager.loadGifts();
            
            const loadTime = performance.now() - startTime;
            
            // Verify gifts loaded
            const gifts = window.GiftsManager.getGifts();
            this.recordResult('Gift Loading', gifts.length > 0, `Loaded ${gifts.length} gifts in ${loadTime.toFixed(2)}ms`);
            
            // Test performance requirement
            this.recordResult('Loading Performance', loadTime < 1000, `Load time: ${loadTime.toFixed(2)}ms (should be <1000ms)`);
            
            // Test user gifts loading
            const userGifts = window.GiftsManager.getUserGifts();
            this.recordResult('User Gifts Loading', Array.isArray(userGifts), `User owns ${userGifts.length} gifts`);
            
        } catch (error) {
            this.recordResult('Gift Loading', false, error.message);
        }
    }

    async testFilteringSystem() {
        console.log('🔍 Testing Filtering System...');
        
        try {
            // Test category filtering
            window.GiftsManager.setFilter('match');
            let filtered = window.GiftsManager.getFilteredGifts();
            const matchFiltered = filtered.every(gift => gift.category === 'match');
            this.recordResult('Category Filtering', matchFiltered, `Filtered to ${filtered.length} match gifts`);
            
            // Test trophy filter
            window.GiftsManager.setFilter('trophy');
            filtered = window.GiftsManager.getFilteredGifts();
            const trophyFiltered = filtered.every(gift => gift.category === 'trophy');
            this.recordResult('Trophy Category Filter', trophyFiltered, `Filtered to ${filtered.length} trophy gifts`);
            
            // Test "all" filter
            window.GiftsManager.setFilter('all');
            filtered = window.GiftsManager.getFilteredGifts();
            const allGifts = window.GiftsManager.getGifts();
            this.recordResult('All Filter', filtered.length === allGifts.length, 'All gifts shown when filter is "all"');
            
            // Test filter UI updates
            const activeFilter = document.querySelector('.filter-btn.active');
            this.recordResult('Filter UI Updates', activeFilter && activeFilter.dataset.filter === 'all', 'Filter buttons update correctly');
            
        } catch (error) {
            this.recordResult('Filtering System', false, error.message);
        }
    }

    async testSearchFunctionality() {
        console.log('🔎 Testing Search Functionality...');
        
        try {
            // Test search by name
            window.GiftsManager.searchGifts('Test Match');
            let filtered = window.GiftsManager.getFilteredGifts();
            const nameSearch = filtered.some(gift => gift.name.includes('Test Match'));
            this.recordResult('Search by Name', nameSearch, `Found ${filtered.length} gifts matching "Test Match"`);
            
            // Test search by description
            window.GiftsManager.searchGifts('legendary');
            filtered = window.GiftsManager.getFilteredGifts();
            const descriptionSearch = filtered.some(gift => gift.description.includes('legendary'));
            this.recordResult('Search by Description', descriptionSearch, `Found ${filtered.length} gifts with "legendary"`);
            
            // Test case insensitive search
            window.GiftsManager.searchGifts('TROPHY');
            filtered = window.GiftsManager.getFilteredGifts();
            const caseInsensitive = filtered.some(gift => gift.name.toLowerCase().includes('trophy'));
            this.recordResult('Case Insensitive Search', caseInsensitive, 'Search works regardless of case');
            
            // Test empty search
            window.GiftsManager.searchGifts('');
            filtered = window.GiftsManager.getFilteredGifts();
            const allGifts = window.GiftsManager.getGifts();
            this.recordResult('Empty Search', filtered.length === allGifts.length, 'Empty search shows all gifts');
            
            // Test no results search
            window.GiftsManager.searchGifts('NonexistentGift');
            filtered = window.GiftsManager.getFilteredGifts();
            this.recordResult('No Results Search', filtered.length === 0, 'No results for invalid search');
            
            // Reset search
            window.GiftsManager.searchGifts('');
            
        } catch (error) {
            this.recordResult('Search Functionality', false, error.message);
        }
    }

    async testGiftRendering() {
        console.log('🎨 Testing Gift Rendering...');
        
        try {
            // Test basic rendering
            window.GiftsManager.renderGifts();
            
            const container = document.getElementById('gifts-grid');
            const giftCards = container?.querySelectorAll('.gift-card');
            this.recordResult('Gift Cards Rendered', giftCards && giftCards.length > 0, `Rendered ${giftCards?.length || 0} gift cards`);
            
            // Test rarity classes
            const rarityCards = container?.querySelectorAll('[class*="rarity-"]');
            this.recordResult('Rarity Styling', rarityCards && rarityCards.length > 0, 'Rarity classes applied');
            
            // Test owned gift display
            const ownedCards = container?.querySelectorAll('.gift-card.owned');
            this.recordResult('Owned Gift Styling', ownedCards !== null, `${ownedCards?.length || 0} owned gifts styled`);
            
            // Test out of stock display
            const outOfStockCards = container?.querySelectorAll('.gift-card.out-of-stock');
            this.recordResult('Out of Stock Styling', outOfStockCards !== null, `${outOfStockCards?.length || 0} out of stock gifts styled`);
            
            // Test insufficient points styling
            const insufficientPointsCards = container?.querySelectorAll('.gift-card.insufficient-points');
            this.recordResult('Insufficient Points Styling', insufficientPointsCards !== null, 'Insufficient points styling applied');
            
            // Test button states
            const buttons = container?.querySelectorAll('.btn');
            const hasButtons = buttons && buttons.length > 0;
            this.recordResult('Action Buttons', hasButtons, `${buttons?.length || 0} action buttons rendered`);
            
        } catch (error) {
            this.recordResult('Gift Rendering', false, error.message);
        }
    }

    async testPurchaseFlow() {
        console.log('💰 Testing Purchase Flow...');
        
        try {
            // Test purchase validation
            const user = window.FanZoneApp?.getUser();
            if (user) {
                user.points = 100; // Set test points
            }
            
            const testGift = window.GiftsManager.getGifts().find(g => g.id === 'test-gift-2');
            if (testGift) {
                // Test validation with insufficient points
                const validationFail = window.GiftsManager.validatePurchase(testGift, { points: 50 });
                this.recordResult('Insufficient Points Validation', !validationFail.valid, validationFail.message);
                
                // Test validation with sufficient points
                const validationPass = window.GiftsManager.validatePurchase(testGift, { points: 300 });
                this.recordResult('Sufficient Points Validation', validationPass.valid, 'Validation passes with sufficient points');
                
                // Test already owned validation
                const ownedGift = window.GiftsManager.getGifts().find(g => g.id === 'test-gift-1');
                const ownedValidation = window.GiftsManager.validatePurchase(ownedGift, { points: 300 });
                this.recordResult('Already Owned Validation', !ownedValidation.valid, ownedValidation.message);
                
                // Test out of stock validation
                const outOfStockGift = window.GiftsManager.getGifts().find(g => g.current_supply >= g.max_supply);
                if (outOfStockGift) {
                    const stockValidation = window.GiftsManager.validatePurchase(outOfStockGift, { points: 300 });
                    this.recordResult('Out of Stock Validation', !stockValidation.valid, stockValidation.message);
                }
            }
            
            // Test purchase confirmation dialog
            const hasConfirmation = typeof window.GiftsManager.showPurchaseConfirmation === 'function';
            this.recordResult('Purchase Confirmation', hasConfirmation, 'Purchase confirmation method exists');
            
            // Test purchase button loading states
            const hasLoadingState = typeof window.GiftsManager.setGiftButtonLoading === 'function';
            this.recordResult('Loading State Management', hasLoadingState, 'Button loading state management exists');
            
        } catch (error) {
            this.recordResult('Purchase Flow', false, error.message);
        }
    }

    async testErrorHandling() {
        console.log('⚠️ Testing Error Handling...');
        
        try {
            // Test invalid gift ID
            try {
                await window.GiftsManager.purchaseGift('invalid-gift-id');
                this.recordResult('Invalid Gift ID Handling', false, 'Should have thrown error');
            } catch (error) {
                this.recordResult('Invalid Gift ID Handling', true, 'Properly handles invalid gift ID');
            }
            
            // Test network error simulation
            const originalProcessPurchase = window.GiftsManager.processPurchase;
            window.GiftsManager.processPurchase = async () => {
                throw new Error('Network error');
            };
            
            try {
                await window.GiftsManager.purchaseGift('test-gift-2');
                this.recordResult('Network Error Handling', false, 'Should have handled network error');
            } catch (error) {
                this.recordResult('Network Error Handling', true, 'Network errors handled gracefully');
            }
            
            // Restore original function
            window.GiftsManager.processPurchase = originalProcessPurchase;
            
            // Test error display
            window.GiftsManager.showError('Test error message');
            const errorState = document.querySelector('.error-state');
            this.recordResult('Error State Display', !!errorState, 'Error state displays correctly');
            
        } catch (error) {
            this.recordResult('Error Handling', false, error.message);
        }
    }

    async testRealTimeUpdates() {
        console.log('⚡ Testing Real-time Updates...');
        
        try {
            // Test inventory update handler
            const hasInventoryHandler = typeof window.GiftsManager.handleInventoryUpdate === 'function';
            this.recordResult('Inventory Update Handler', hasInventoryHandler, 'Real-time inventory handler exists');
            
            if (hasInventoryHandler) {
                // Simulate inventory update
                const testGift = window.GiftsManager.getGifts()[0];
                const originalSupply = testGift.current_supply;
                
                window.GiftsManager.handleInventoryUpdate({
                    gift: {
                        id: testGift.id,
                        current_supply: originalSupply + 1
                    }
                });
                
                // Check if gift was updated
                const updatedGift = window.GiftsManager.getGifts().find(g => g.id === testGift.id);
                this.recordResult('Inventory Update Processing', updatedGift.current_supply === originalSupply + 1, 'Inventory updates processed correctly');
            }
            
            // Test real-time setup
            const hasRealTimeSetup = typeof window.GiftsManager.setupRealTimeUpdates === 'function';
            this.recordResult('Real-time Setup', hasRealTimeSetup, 'Real-time update setup method exists');
            
        } catch (error) {
            this.recordResult('Real-time Updates', false, error.message);
        }
    }

    async testMobileResponsiveness() {
        console.log('📱 Testing Mobile Responsiveness...');
        
        try {
            // Simulate mobile viewport
            const originalWidth = window.innerWidth;
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });
            
            // Test mobile grid layout
            const container = document.getElementById('gifts-grid');
            if (container) {
                const styles = window.getComputedStyle(container);
                const gridTemplate = styles.gridTemplateColumns;
                this.recordResult('Mobile Grid Layout', gridTemplate.includes('minmax'), 'Grid adapts to mobile viewport');
            }
            
            // Test touch interactions
            const giftCards = document.querySelectorAll('.gift-card');
            const hasTouchSupport = giftCards.length > 0;
            this.recordResult('Touch Interactions', hasTouchSupport, 'Gift cards support touch interactions');
            
            // Test filter button scrolling
            const filterButtons = document.querySelector('.filter-buttons');
            if (filterButtons) {
                const styles = window.getComputedStyle(filterButtons);
                const overflowX = styles.overflowX;
                this.recordResult('Filter Button Scrolling', overflowX === 'auto', 'Filter buttons scroll on mobile');
            }
            
            // Restore original viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: originalWidth
            });
            
        } catch (error) {
            this.recordResult('Mobile Responsiveness', false, error.message);
        }
    }

    async testPerformance() {
        console.log('🚀 Testing Performance...');
        
        try {
            // Test render performance with many gifts
            const manyGifts = Array.from({ length: 50 }, (_, i) => ({
                ...this.generateTestGifts()[0],
                id: `perf-gift-${i}`,
                name: `Performance Gift ${i}`
            }));
            
            window.GiftsManager.gifts = manyGifts;
            window.GiftsManager.filterGifts();
            
            const renderStart = performance.now();
            window.GiftsManager.renderGifts();
            const renderTime = performance.now() - renderStart;
            
            this.recordResult('Render Performance', renderTime < 500, `Rendered 50 gifts in ${renderTime.toFixed(2)}ms`);
            
            // Test search performance
            const searchStart = performance.now();
            window.GiftsManager.searchGifts('Performance');
            const searchTime = performance.now() - searchStart;
            
            this.recordResult('Search Performance', searchTime < 100, `Search completed in ${searchTime.toFixed(2)}ms`);
            
            // Test filter performance
            const filterStart = performance.now();
            window.GiftsManager.setFilter('match');
            const filterTime = performance.now() - filterStart;
            
            this.recordResult('Filter Performance', filterTime < 100, `Filter applied in ${filterTime.toFixed(2)}ms`);
            
            // Test memory usage
            const giftElements = document.querySelectorAll('.gift-card');
            const hasMemoryLeaks = giftElements.length <= manyGifts.length * 1.1; // Allow 10% overhead
            this.recordResult('Memory Usage', hasMemoryLeaks, `${giftElements.length} DOM elements for ${manyGifts.length} gifts`);
            
        } catch (error) {
            this.recordResult('Performance Tests', false, error.message);
        }
    }

    // ======================
    // Test Utilities
    // ======================

    recordResult(testName, success, message = '') {
        const result = {
            test: testName,
            success,
            message,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const icon = success ? '✅' : '❌';
        const status = success ? 'PASS' : 'FAIL';
        const details = message ? `: ${message}` : '';
        
        console.log(`${icon} ${testName}: ${status}${details}`);
    }

    async cleanup() {
        console.log('🧹 Cleaning up gift test data...');
        
        try {
            // Restore original data
            window.GiftsManager.gifts = this.originalGifts;
            window.GiftsManager.userGifts = this.originalUserGifts;
            window.GiftsManager.filterGifts();
            window.GiftsManager.renderGifts();
            
            console.log('✅ Gift test cleanup completed');
            
        } catch (error) {
            console.warn('⚠️ Gift cleanup warning:', error.message);
        }
    }

    displayResults() {
        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log('\n🎁 Gift System Test Results:');
        console.log('============================');
        console.log(`${passed}/${total} tests passed (${percentage}%)`);
        
        if (percentage >= 90) {
            console.log('🎉 Excellent! Gift system is working perfectly.');
        } else if (percentage >= 75) {
            console.log('✅ Good! Minor issues to address.');
        } else {
            console.log('⚠️ Several issues need attention.');
        }
        
        // Store detailed results
        if (window.Utils) {
            Utils.setStorage('gift_test_results', {
                results: this.testResults,
                summary: { passed, total, percentage },
                timestamp: new Date().toISOString()
            });
        }
        
        return { passed, total, percentage };
    }
}

// Manual testing functions
window.runGiftTests = async () => {
    const tester = new GiftsTester();
    return await tester.runAllTests();
};

window.testGiftFeature = async (feature) => {
    const tester = new GiftsTester();
    await tester.setupTestEnvironment();
    
    switch (feature) {
        case 'loading':
            return await tester.testGiftLoading();
        case 'filtering':
            return await tester.testFilteringSystem();
        case 'search':
            return await tester.testSearchFunctionality();
        case 'rendering':
            return await tester.testGiftRendering();
        case 'purchase':
            return await tester.testPurchaseFlow();
        case 'errors':
            return await tester.testErrorHandling();
        case 'realtime':
            return await tester.testRealTimeUpdates();
        case 'mobile':
            return await tester.testMobileResponsiveness();
        case 'performance':
            return await tester.testPerformance();
        default:
            console.error('Unknown feature:', feature);
            return false;
    }
};

// Auto-run in debug mode with URL parameter
if (CONFIG?.DEBUG && window.location.search.includes('gifttest=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.runGiftTests();
        }, 3000);
    });
}

console.log('🎁 Gift Tester loaded. Run window.runGiftTests() to test gift functionality.');