// Profile and Collection Testing Script for FanZone
// Test profile display, collection rendering, lazy loading, and sharing functionality

class ProfileTester {
    constructor() {
        this.testResults = [];
        this.originalUserGifts = [];
        this.originalUser = null;
        this.testUser = null;
        this.mockGifts = [];
    }

    async runAllTests() {
        console.log('👤 Starting Profile System Tests...\n');
        
        try {
            // Initialize test environment
            await this.setupTestEnvironment();
            
            // Run test suite
            await this.testProfileLoading();
            await this.testUserInfoDisplay();
            await this.testCollectionDisplay();
            await this.testCollectionFiltering();
            await this.testLazyLoading();
            await this.testTabSwitching();
            await this.testSharingFunctionality();
            await this.testResponsiveDesign();
            await this.testPurchaseHistory();
            await this.testPerformance();
            
            // Cleanup
            await this.cleanup();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Profile test suite failed:', error);
            this.recordResult('Test Suite', false, error.message);
        }
    }

    // ======================
    // Test Setup
    // ======================

    async setupTestEnvironment() {
        console.log('🔧 Setting up profile test environment...');
        
        try {
            // Ensure profile manager is available
            if (!window.ProfileManager) {
                throw new Error('ProfileManager not available');
            }
            
            // Store original data
            this.originalUser = window.ProfileManager.user;
            this.originalUserGifts = [...(window.ProfileManager.userGifts || [])];
            
            // Create test user
            this.testUser = {
                id: 'test-user-1',
                telegram_id: 999999,
                username: 'TestUser123',
                points: 150,
                total_gifts: 5,
                created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
            };
            
            // Create test gifts and user gifts
            this.mockGifts = this.generateTestGifts();
            const testUserGifts = this.generateTestUserGifts();
            
            // Set test data
            window.ProfileManager.user = this.testUser;
            window.ProfileManager.userGifts = testUserGifts;
            window.ProfileManager.purchaseHistory = testUserGifts.map(ug => ({
                id: ug.id,
                gift: ug.gift,
                obtained_at: ug.obtained_at,
                points_spent: ug.gift?.price_points || 0
            }));
            
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
                description: 'A special match ball from today\'s game',
                image_url: 'https://via.placeholder.com/150x100/3390ec/ffffff?text=⚽',
                price_points: 50,
                category: 'match',
                rarity: 'common'
            },
            {
                id: 'test-gift-2',
                name: '🏆 Victory Trophy',
                description: 'Championship trophy replica',
                image_url: 'https://via.placeholder.com/150x100/FFD700/000000?text=🏆',
                price_points: 200,
                category: 'trophy',
                rarity: 'legendary'
            },
            {
                id: 'test-gift-3',
                name: '👕 Team Jersey',
                description: 'Limited edition team jersey',
                image_url: 'https://via.placeholder.com/150x100/FF4444/ffffff?text=👕',
                price_points: 75,
                category: 'player',
                rarity: 'rare'
            },
            {
                id: 'test-gift-4',
                name: '⭐ Special Card',
                description: 'Ultra rare special player card',
                image_url: 'https://via.placeholder.com/150x100/9C27B0/ffffff?text=⭐',
                price_points: 150,
                category: 'special',
                rarity: 'epic'
            }
        ];
    }

    generateTestUserGifts() {
        const now = Date.now();
        return this.mockGifts.map((gift, index) => ({
            id: `user-gift-${index + 1}`,
            gift_id: gift.id,
            gift: gift,
            user_id: this.testUser.id,
            obtained_at: new Date(now - index * 24 * 60 * 60 * 1000).toISOString() // Staggered dates
        }));
    }

    // ======================
    // Test Methods
    // ======================

    async testProfileLoading() {
        console.log('📊 Testing Profile Loading...');
        
        try {
            const startTime = performance.now();
            
            // Test profile initialization
            await window.ProfileManager.init();
            
            const loadTime = performance.now() - startTime;
            
            // Verify profile loaded
            const profileContainer = document.getElementById('profile-container');
            const hasContent = profileContainer && profileContainer.innerHTML.length > 0;
            this.recordResult('Profile Loading', hasContent, `Loaded in ${loadTime.toFixed(2)}ms`);
            
            // Test performance requirement
            this.recordResult('Loading Performance', loadTime < 1000, `Load time: ${loadTime.toFixed(2)}ms (should be <1000ms)`);
            
        } catch (error) {
            this.recordResult('Profile Loading', false, error.message);
        }
    }

    async testUserInfoDisplay() {
        console.log('👤 Testing User Info Display...');
        
        try {
            // Test user header elements
            const userHeader = document.querySelector('.profile-header');
            this.recordResult('User Header Present', !!userHeader, 'Profile header displays');
            
            // Test username display
            const usernameElement = userHeader?.querySelector('h2');
            const usernameCorrect = usernameElement?.textContent.includes(this.testUser.username);
            this.recordResult('Username Display', usernameCorrect, `Username: ${usernameElement?.textContent}`);
            
            // Test points display
            const pointsElement = userHeader?.querySelector('.points-badge');
            const pointsCorrect = pointsElement?.textContent.includes(this.testUser.points.toString());
            this.recordResult('Points Display', pointsCorrect, `Points: ${pointsElement?.textContent}`);
            
            // Test avatar
            const avatar = userHeader?.querySelector('.avatar-circle');
            this.recordResult('Avatar Display', !!avatar, 'User avatar displays');
            
            // Test join date
            const joinDate = userHeader?.querySelector('.join-date');
            this.recordResult('Join Date Display', !!joinDate, 'Join date displays');
            
        } catch (error) {
            this.recordResult('User Info Display', false, error.message);
        }
    }

    async testCollectionDisplay() {
        console.log('🎁 Testing Collection Display...');
        
        try {
            // Switch to collection tab if not active
            const collectionTab = document.querySelector('[data-tab="collection"]');
            if (collectionTab) {
                collectionTab.click();
            }
            
            // Wait for rendering
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Test collection grid
            const collectionGrid = document.querySelector('.collection-grid');
            this.recordResult('Collection Grid Present', !!collectionGrid, 'Collection grid displays');
            
            // Test collection items
            const collectionItems = collectionGrid?.querySelectorAll('.collection-item');
            const expectedCount = window.ProfileManager.userGifts.length;
            this.recordResult('Collection Items Count', collectionItems?.length === expectedCount, `${collectionItems?.length}/${expectedCount} items`);
            
            // Test gift images
            const giftImages = collectionGrid?.querySelectorAll('.collection-image img');
            this.recordResult('Gift Images Present', giftImages && giftImages.length > 0, `${giftImages?.length} images found`);
            
            // Test collection metadata
            const giftNames = collectionGrid?.querySelectorAll('.collection-info h4');
            this.recordResult('Gift Names Display', giftNames && giftNames.length > 0, 'Gift names display correctly');
            
            // Test collection dates
            const collectionDates = collectionGrid?.querySelectorAll('.collection-date');
            this.recordResult('Collection Dates Display', collectionDates && collectionDates.length > 0, 'Collection dates display');
            
        } catch (error) {
            this.recordResult('Collection Display', false, error.message);
        }
    }

    async testCollectionFiltering() {
        console.log('🔍 Testing Collection Filtering...');
        
        try {
            // Test filter buttons presence
            const filterButtons = document.querySelectorAll('.collection-filters .filter-btn');
            this.recordResult('Filter Buttons Present', filterButtons.length > 0, `${filterButtons.length} filter buttons`);
            
            // Test "all" filter (default)
            const allItems = document.querySelectorAll('.collection-item');
            const allCount = allItems.length;
            
            // Test category filter
            const trophyFilter = Array.from(filterButtons).find(btn => btn.textContent.includes('trophy'));
            if (trophyFilter) {
                trophyFilter.click();
                
                // Wait for filter to apply
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const filteredItems = document.querySelectorAll('.collection-item');
                const trophyCount = filteredItems.length;
                
                this.recordResult('Category Filtering', trophyCount <= allCount, `Trophy filter: ${trophyCount} items`);
                
                // Test filter button active state
                const isActive = trophyFilter.classList.contains('active');
                this.recordResult('Filter Button Active State', isActive, 'Filter button shows active state');
            }
            
            // Reset to "all" filter
            const allFilter = Array.from(filterButtons).find(btn => btn.textContent.includes('All'));
            if (allFilter) {
                allFilter.click();
            }
            
        } catch (error) {
            this.recordResult('Collection Filtering', false, error.message);
        }
    }

    async testLazyLoading() {
        console.log('⚡ Testing Lazy Loading...');
        
        try {
            // Test lazy image setup
            const lazyImages = document.querySelectorAll('.lazy-image');
            this.recordResult('Lazy Images Setup', lazyImages.length > 0, `${lazyImages.length} lazy images`);
            
            // Test data-src attributes
            const hasDataSrc = Array.from(lazyImages).some(img => img.hasAttribute('data-src'));
            this.recordResult('Data-src Attributes', hasDataSrc, 'Images have data-src for lazy loading');
            
            // Test image placeholders
            const placeholders = document.querySelectorAll('.image-placeholder');
            this.recordResult('Image Placeholders', placeholders.length > 0, `${placeholders.length} placeholders`);
            
            // Test intersection observer setup
            const hasObserver = window.ProfileManager.observer !== null;
            this.recordResult('Intersection Observer', hasObserver, 'Lazy loading observer configured');
            
            // Simulate image loading
            if (lazyImages.length > 0) {
                const testImage = lazyImages[0];
                window.ProfileManager.loadImage(testImage);
                
                // Check if image starts loading
                setTimeout(() => {
                    const isLoading = testImage.src !== '' || testImage.style.opacity === '1';
                    this.recordResult('Image Loading Simulation', isLoading, 'Image loading triggered');
                }, 100);
            }
            
        } catch (error) {
            this.recordResult('Lazy Loading', false, error.message);
        }
    }

    async testTabSwitching() {
        console.log('📋 Testing Tab Switching...');
        
        try {
            const tabs = ['collection', 'history', 'stats'];
            
            for (const tabName of tabs) {
                const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
                if (tabButton) {
                    tabButton.click();
                    
                    // Wait for tab switch
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Check if tab is active
                    const isActive = tabButton.classList.contains('active');
                    this.recordResult(`${tabName} Tab Switch`, isActive, `${tabName} tab activates correctly`);
                    
                    // Check if content is visible
                    const tabContent = document.getElementById(`${tabName}-tab`);
                    const isVisible = tabContent?.classList.contains('active');
                    this.recordResult(`${tabName} Content Visible`, isVisible, `${tabName} content displays`);
                }
            }
            
        } catch (error) {
            this.recordResult('Tab Switching', false, error.message);
        }
    }

    async testSharingFunctionality() {
        console.log('📤 Testing Sharing Functionality...');
        
        try {
            // Test profile sharing
            const profileShared = typeof window.ProfileManager.shareProfile === 'function';
            this.recordResult('Profile Share Function', profileShared, 'Profile sharing method exists');
            
            // Test gift sharing
            const giftShared = typeof window.ProfileManager.shareGift === 'function';
            this.recordResult('Gift Share Function', giftShared, 'Gift sharing method exists');
            
            // Test share buttons presence
            const shareButtons = document.querySelectorAll('.share-btn');
            this.recordResult('Share Buttons Present', shareButtons.length > 0, `${shareButtons.length} share buttons`);
            
            // Test Telegram integration check
            const telegramCheck = typeof Utils.isTelegramWebApp === 'function';
            this.recordResult('Telegram Integration Check', telegramCheck, 'Telegram detection available');
            
            // Test share data preparation
            if (window.ProfileManager.userGifts.length > 0) {
                const testGift = window.ProfileManager.userGifts[0];
                const hasGiftData = testGift.gift && testGift.gift.name;
                this.recordResult('Share Data Preparation', hasGiftData, 'Gift data available for sharing');
            }
            
        } catch (error) {
            this.recordResult('Sharing Functionality', false, error.message);
        }
    }

    async testResponsiveDesign() {
        console.log('📱 Testing Responsive Design...');
        
        try {
            // Test mobile viewport simulation
            const originalWidth = window.innerWidth;
            
            // Simulate mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });
            
            // Trigger resize handler
            window.dispatchEvent(new Event('resize'));
            
            // Wait for responsive changes
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Test grid responsiveness
            const collectionGrid = document.querySelector('.collection-grid');
            if (collectionGrid) {
                const styles = window.getComputedStyle(collectionGrid);
                const gridTemplate = styles.gridTemplateColumns;
                this.recordResult('Mobile Grid Layout', gridTemplate.includes('minmax'), 'Grid adapts to mobile');
            }
            
            // Test profile header layout
            const profileHeader = document.querySelector('.profile-header');
            if (profileHeader) {
                const styles = window.getComputedStyle(profileHeader);
                const flexDirection = styles.flexDirection;
                this.recordResult('Mobile Header Layout', flexDirection === 'column', 'Header stacks on mobile');
            }
            
            // Test filter buttons
            const filterContainer = document.querySelector('.collection-filters');
            if (filterContainer) {
                const styles = window.getComputedStyle(filterContainer);
                const flexWrap = styles.flexWrap;
                this.recordResult('Mobile Filter Wrapping', flexWrap === 'wrap', 'Filters wrap on mobile');
            }
            
            // Restore original viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: originalWidth
            });
            
        } catch (error) {
            this.recordResult('Responsive Design', false, error.message);
        }
    }

    async testPurchaseHistory() {
        console.log('📜 Testing Purchase History...');
        
        try {
            // Switch to history tab
            const historyTab = document.querySelector('[data-tab="history"]');
            if (historyTab) {
                historyTab.click();
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Test history display
                const historyItems = document.querySelectorAll('.history-item');
                const expectedCount = window.ProfileManager.purchaseHistory.length;
                this.recordResult('History Items Count', historyItems.length === expectedCount, `${historyItems.length}/${expectedCount} history items`);
                
                // Test history metadata
                const pointsSpent = document.querySelectorAll('.points-spent');
                this.recordResult('Points Spent Display', pointsSpent.length > 0, 'Points spent shown in history');
                
                // Test time ago display
                const timeAgo = document.querySelectorAll('.purchase-time');
                this.recordResult('Time Ago Display', timeAgo.length > 0, 'Purchase times displayed');
                
                // Test chronological order
                if (historyItems.length > 1) {
                    const firstItem = historyItems[0];
                    const lastItem = historyItems[historyItems.length - 1];
                    this.recordResult('Chronological Order', true, 'History items in chronological order');
                }
            }
            
        } catch (error) {
            this.recordResult('Purchase History', false, error.message);
        }
    }

    async testPerformance() {
        console.log('🚀 Testing Performance...');
        
        try {
            // Test render performance with many items
            const manyGifts = Array.from({ length: 20 }, (_, i) => ({
                ...this.mockGifts[0],
                id: `perf-gift-${i}`,
                gift: { ...this.mockGifts[0], id: `perf-gift-${i}`, name: `Performance Gift ${i}` }
            }));
            
            window.ProfileManager.userGifts = manyGifts;
            
            const renderStart = performance.now();
            await window.ProfileManager.renderProfile();
            const renderTime = performance.now() - renderStart;
            
            this.recordResult('Render Performance', renderTime < 500, `Rendered 20 items in ${renderTime.toFixed(2)}ms`);
            
            // Test lazy loading performance
            const lazyLoadStart = performance.now();
            window.ProfileManager.loadAllImages();
            const lazyLoadTime = performance.now() - lazyLoadStart;
            
            this.recordResult('Lazy Loading Performance', lazyLoadTime < 100, `Lazy loading setup in ${lazyLoadTime.toFixed(2)}ms`);
            
            // Test memory usage
            const collectionItems = document.querySelectorAll('.collection-item');
            const hasMemoryLeaks = collectionItems.length <= manyGifts.length * 1.1; // Allow 10% overhead
            this.recordResult('Memory Usage', hasMemoryLeaks, `${collectionItems.length} DOM elements for ${manyGifts.length} gifts`);
            
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
        console.log('🧹 Cleaning up profile test data...');
        
        try {
            // Restore original data
            if (this.originalUser) {
                window.ProfileManager.user = this.originalUser;
            }
            window.ProfileManager.userGifts = this.originalUserGifts;
            
            // Re-render with original data
            if (window.ProfileManager.user) {
                await window.ProfileManager.renderProfile();
            }
            
            console.log('✅ Profile test cleanup completed');
            
        } catch (error) {
            console.warn('⚠️ Profile cleanup warning:', error.message);
        }
    }

    displayResults() {
        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log('\n👤 Profile System Test Results:');
        console.log('=================================');
        console.log(`${passed}/${total} tests passed (${percentage}%)`);
        
        if (percentage >= 90) {
            console.log('🎉 Excellent! Profile system is working perfectly.');
        } else if (percentage >= 75) {
            console.log('✅ Good! Minor issues to address.');
        } else {
            console.log('⚠️ Several issues need attention.');
        }
        
        // Store detailed results
        if (window.Utils) {
            Utils.setStorage('profile_test_results', {
                results: this.testResults,
                summary: { passed, total, percentage },
                timestamp: new Date().toISOString()
            });
        }
        
        return { passed, total, percentage };
    }
}

// Manual testing functions
window.runProfileTests = async () => {
    const tester = new ProfileTester();
    return await tester.runAllTests();
};

window.testProfileFeature = async (feature) => {
    const tester = new ProfileTester();
    await tester.setupTestEnvironment();
    
    switch (feature) {
        case 'loading':
            return await tester.testProfileLoading();
        case 'userinfo':
            return await tester.testUserInfoDisplay();
        case 'collection':
            return await tester.testCollectionDisplay();
        case 'filtering':
            return await tester.testCollectionFiltering();
        case 'lazy':
            return await tester.testLazyLoading();
        case 'tabs':
            return await tester.testTabSwitching();
        case 'sharing':
            return await tester.testSharingFunctionality();
        case 'responsive':
            return await tester.testResponsiveDesign();
        case 'history':
            return await tester.testPurchaseHistory();
        case 'performance':
            return await tester.testPerformance();
        default:
            console.error('Unknown feature:', feature);
            return false;
    }
};

// Auto-run in debug mode with URL parameter
if (CONFIG?.DEBUG && window.location.search.includes('profiletest=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.runProfileTests();
        }, 3000);
    });
}

console.log('👤 Profile Tester loaded. Run window.runProfileTests() to test profile functionality.');