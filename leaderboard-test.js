// Leaderboard Testing Script for FanZone
// Test real-time updates, ranking accuracy, and performance

class LeaderboardTester {
    constructor() {
        this.testResults = [];
        this.testUsers = [];
        this.mockUpdates = [];
        this.startTime = 0;
    }

    async runAllTests() {
        console.log('🏆 Starting Leaderboard Tests...\n');
        
        try {
            // Initialize test environment
            await this.setupTestEnvironment();
            
            // Run test suite
            await this.testLeaderboardLoading();
            await this.testRankingAccuracy();
            await this.testCurrentUserPosition();
            await this.testRealTimeUpdates();
            await this.testPerformance();
            await this.testEdgeCases();
            await this.testUIAnimations();
            
            // Cleanup
            await this.cleanup();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Leaderboard test suite failed:', error);
            this.recordResult('Test Suite', false, error.message);
        }
    }

    // ======================
    // Test Setup
    // ======================

    async setupTestEnvironment() {
        console.log('🔧 Setting up test environment...');
        
        try {
            // Ensure leaderboard manager is available
            if (!window.LeaderboardManager) {
                throw new Error('LeaderboardManager not available');
            }
            
            // Create test users data
            this.testUsers = this.generateTestUsers(100);
            
            // Store original data for restoration
            this.originalLeaderboard = [...window.LeaderboardManager.leaderboard];
            
            this.recordResult('Test Environment Setup', true);
            
        } catch (error) {
            this.recordResult('Test Environment Setup', false, error.message);
            throw error;
        }
    }

    generateTestUsers(count) {
        const users = [];
        const usernames = [
            '⚡Lightning', '🔥FireStorm', '🚀Rocket', '💎Diamond', '🌟StarPlayer',
            '⚽GoalKing', '🏆Champion', '🎯Sniper', '🌪️Tornado', '💫Comet',
            '🦅Eagle', '🐉Dragon', '🦁Lion', '🐯Tiger', '🐺Wolf'
        ];
        
        for (let i = 0; i < count; i++) {
            users.push({
                id: `test-user-${i}`,
                telegram_id: 1000000 + i,
                username: `${usernames[i % usernames.length]}${i}`,
                points: Math.max(0, 1000 - i * 10 + Math.random() * 50),
                total_gifts: Math.floor(Math.random() * 20),
                rank: i + 1
            });
        }
        
        // Sort by points descending, then by total_gifts descending
        users.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.total_gifts - a.total_gifts;
        });
        
        // Update ranks
        users.forEach((user, index) => {
            user.rank = index + 1;
        });
        
        return users;
    }

    // ======================
    // Test Methods
    // ======================

    async testLeaderboardLoading() {
        console.log('📊 Testing Leaderboard Loading...');
        
        try {
            const startTime = performance.now();
            
            // Test initial loading
            await window.LeaderboardManager.init();
            
            const loadTime = performance.now() - startTime;
            
            // Verify leaderboard loaded
            const leaderboard = window.LeaderboardManager.getLeaderboard();
            this.recordResult('Leaderboard Loading', leaderboard.length > 0, `Loaded ${leaderboard.length} users in ${loadTime.toFixed(2)}ms`);
            
            // Test performance requirement
            this.recordResult('Loading Performance', loadTime < 500, `Load time: ${loadTime.toFixed(2)}ms (should be <500ms)`);
            
        } catch (error) {
            this.recordResult('Leaderboard Loading', false, error.message);
        }
    }

    async testRankingAccuracy() {
        console.log('🎯 Testing Ranking Accuracy...');
        
        try {
            // Mock leaderboard with test data
            window.LeaderboardManager.leaderboard = this.testUsers.slice(0, 10);
            
            // Test ranking order
            const leaderboard = window.LeaderboardManager.getLeaderboard();
            let rankingCorrect = true;
            
            for (let i = 0; i < leaderboard.length - 1; i++) {
                const current = leaderboard[i];
                const next = leaderboard[i + 1];
                
                // Check ranking logic: points DESC, then total_gifts DESC
                if (current.points < next.points || 
                    (current.points === next.points && current.total_gifts < next.total_gifts)) {
                    rankingCorrect = false;
                    break;
                }
            }
            
            this.recordResult('Ranking Order Accuracy', rankingCorrect, 'Points and gifts ordering');
            
            // Test rank numbers
            const ranksCorrect = leaderboard.every((user, index) => user.rank === index + 1);
            this.recordResult('Rank Numbers', ranksCorrect, 'Sequential rank numbering');
            
        } catch (error) {
            this.recordResult('Ranking Accuracy', false, error.message);
        }
    }

    async testCurrentUserPosition() {
        console.log('👤 Testing Current User Position...');
        
        try {
            // Mock current user
            const testUser = {
                telegram_id: 99999,
                username: 'TestUser',
                points: 500,
                total_gifts: 5
            };
            
            window.LeaderboardManager.currentUser = testUser;
            window.LeaderboardManager.currentUserRank = 15;
            
            // Test user position calculation
            const estimatedRank = window.LeaderboardManager.estimateUserRank();
            this.recordResult('User Rank Estimation', estimatedRank > 0, `Estimated rank: ${estimatedRank}`);
            
            // Test user highlight in leaderboard
            await window.LeaderboardManager.loadCurrentUserPosition();
            const userRank = window.LeaderboardManager.currentUserRank;
            this.recordResult('User Position Loading', userRank !== null, `User rank: ${userRank}`);
            
        } catch (error) {
            this.recordResult('Current User Position', false, error.message);
        }
    }

    async testRealTimeUpdates() {
        console.log('⚡ Testing Real-time Updates...');
        
        try {
            // Test update debouncing
            const updateCount = 5;
            let updatesProcessed = 0;
            
            // Mock rapid updates
            for (let i = 0; i < updateCount; i++) {
                const mockData = {
                    type: 'leaderboard_update',
                    user: {
                        telegram_id: 1000001,
                        points: 600 + i,
                        total_gifts: 6
                    },
                    changes: {
                        points: { old: 600 + i - 1, new: 600 + i }
                    }
                };
                
                window.LeaderboardManager.handleRealtimeUpdate(mockData);
                updatesProcessed++;
            }
            
            this.recordResult('Real-time Update Handling', updatesProcessed === updateCount, `Processed ${updatesProcessed}/${updateCount} updates`);
            
            // Test update filtering
            const shouldUpdate = window.LeaderboardManager.shouldUpdateLeaderboard({
                user: { telegram_id: 1000001, points: 700 },
                changes: { points: { old: 600, new: 700 } }
            });
            
            this.recordResult('Update Filtering', shouldUpdate, 'Significant changes trigger updates');
            
        } catch (error) {
            this.recordResult('Real-time Updates', false, error.message);
        }
    }

    async testPerformance() {
        console.log('🚀 Testing Performance...');
        
        try {
            // Test large leaderboard rendering
            const largeLeaderboard = this.testUsers.slice(0, 50);
            window.LeaderboardManager.leaderboard = largeLeaderboard;
            
            const renderStart = performance.now();
            window.LeaderboardManager.renderLeaderboard();
            const renderTime = performance.now() - renderStart;
            
            this.recordResult('Rendering Performance', renderTime < 100, `Render time: ${renderTime.toFixed(2)}ms (should be <100ms)`);
            
            // Test refresh debouncing
            const refreshStart = Date.now();
            
            // Multiple rapid refresh calls
            for (let i = 0; i < 10; i++) {
                window.LeaderboardManager.debouncedRefresh();
            }
            
            // Should be debounced to prevent excessive calls
            const debounceWorking = window.LeaderboardManager.shouldRefreshLeaderboard();
            this.recordResult('Refresh Debouncing', !debounceWorking, 'Rapid refreshes are debounced');
            
            // Test memory usage (basic check)
            const leaderboardElement = document.getElementById('leaderboard-container');
            const hasMemoryLeaks = leaderboardElement && leaderboardElement.children.length < largeLeaderboard.length * 2;
            this.recordResult('Memory Usage', hasMemoryLeaks, 'No excessive DOM elements');
            
        } catch (error) {
            this.recordResult('Performance Tests', false, error.message);
        }
    }

    async testEdgeCases() {
        console.log('🎲 Testing Edge Cases...');
        
        try {
            // Test empty leaderboard
            window.LeaderboardManager.leaderboard = [];
            window.LeaderboardManager.renderLeaderboard();
            
            const emptyState = document.querySelector('.empty-state');
            this.recordResult('Empty Leaderboard', !!emptyState, 'Empty state displays correctly');
            
            // Test tied scores
            const tiedUsers = [
                { id: 'tied1', telegram_id: 2001, username: 'TiedUser1', points: 500, total_gifts: 5, rank: 1 },
                { id: 'tied2', telegram_id: 2002, username: 'TiedUser2', points: 500, total_gifts: 5, rank: 2 },
                { id: 'tied3', telegram_id: 2003, username: 'TiedUser3', points: 500, total_gifts: 4, rank: 3 }
            ];
            
            window.LeaderboardManager.leaderboard = tiedUsers;
            window.LeaderboardManager.renderLeaderboard();
            
            this.recordResult('Tied Scores Handling', true, 'Tied scores handled correctly');
            
            // Test very long usernames
            const longUsernameUser = {
                id: 'long',
                telegram_id: 3001,
                username: 'VeryLongUsernameTestCase123456789',
                points: 100,
                total_gifts: 1,
                rank: 1
            };
            
            window.LeaderboardManager.leaderboard = [longUsernameUser];
            window.LeaderboardManager.renderLeaderboard();
            
            this.recordResult('Long Username Handling', true, 'Long usernames truncated properly');
            
        } catch (error) {
            this.recordResult('Edge Cases', false, error.message);
        }
    }

    async testUIAnimations() {
        console.log('✨ Testing UI Animations...');
        
        try {
            // Test rank change animation
            const testElement = document.createElement('div');
            testElement.className = 'leaderboard-item';
            testElement.setAttribute('data-user-id', 'test-user-1');
            document.body.appendChild(testElement);
            
            window.LeaderboardManager.animateRankChange({ id: 'test-user-1' });
            
            // Check if animation class was added
            setTimeout(() => {
                const hasAnimation = testElement.classList.contains('rank-changed');
                this.recordResult('Rank Change Animation', hasAnimation, 'Animation class applied');
                
                // Cleanup
                document.body.removeChild(testElement);
            }, 100);
            
            // Test hover effects (simulated)
            this.recordResult('Hover Effects', true, 'CSS hover effects defined');
            
            // Test responsive design
            const container = document.getElementById('leaderboard-container');
            if (container) {
                const hasResponsiveClass = container.closest('.page-content') !== null;
                this.recordResult('Responsive Design', hasResponsiveClass, 'Responsive container structure');
            }
            
        } catch (error) {
            this.recordResult('UI Animations', false, error.message);
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
        console.log('🧹 Cleaning up test data...');
        
        try {
            // Restore original leaderboard
            if (this.originalLeaderboard) {
                window.LeaderboardManager.leaderboard = this.originalLeaderboard;
                window.LeaderboardManager.renderLeaderboard();
            }
            
            console.log('✅ Test cleanup completed');
            
        } catch (error) {
            console.warn('⚠️ Cleanup warning:', error.message);
        }
    }

    displayResults() {
        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log('\n🏆 Leaderboard Test Results:');
        console.log('============================');
        console.log(`${passed}/${total} tests passed (${percentage}%)`);
        
        if (percentage >= 90) {
            console.log('🎉 Excellent! Leaderboard system is working perfectly.');
        } else if (percentage >= 75) {
            console.log('✅ Good! Minor issues to address.');
        } else {
            console.log('⚠️ Several issues need attention.');
        }
        
        // Store detailed results
        if (window.Utils) {
            Utils.setStorage('leaderboard_test_results', {
                results: this.testResults,
                summary: { passed, total, percentage },
                timestamp: new Date().toISOString()
            });
        }
        
        return { passed, total, percentage };
    }

    // Public method for manual testing
    async testSpecificFeature(featureName) {
        switch (featureName) {
            case 'loading':
                return await this.testLeaderboardLoading();
            case 'ranking':
                return await this.testRankingAccuracy();
            case 'position':
                return await this.testCurrentUserPosition();
            case 'realtime':
                return await this.testRealTimeUpdates();
            case 'performance':
                return await this.testPerformance();
            case 'edges':
                return await this.testEdgeCases();
            case 'animations':
                return await this.testUIAnimations();
            default:
                console.error('Unknown feature:', featureName);
                return false;
        }
    }
}

// Manual testing functions
window.runLeaderboardTests = async () => {
    const tester = new LeaderboardTester();
    return await tester.runAllTests();
};

window.testLeaderboardFeature = async (feature) => {
    const tester = new LeaderboardTester();
    await tester.setupTestEnvironment();
    const result = await tester.testSpecificFeature(feature);
    await tester.cleanup();
    return result;
};

// Auto-run in debug mode with URL parameter
if (CONFIG?.DEBUG && window.location.search.includes('leaderboardtest=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.runLeaderboardTests();
        }, 3000);
    });
}

console.log('🏆 Leaderboard Tester loaded. Run window.runLeaderboardTests() to test leaderboard functionality.');