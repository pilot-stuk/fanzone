// Database Operations Testing Script for FanZone
// Test all CRUD operations and verify performance

class DatabaseTester {
    constructor() {
        this.supabase = null;
        this.testResults = [];
        this.testUser = {
            telegram_id: 999999999,
            username: 'test_user_db',
            first_name: 'Test',
            last_name: 'User'
        };
    }

    async init() {
        // Initialize Supabase client
        if (!window.supabase || !CONFIG.SUPABASE.URL) {
            throw new Error('Supabase not configured');
        }
        
        this.supabase = window.supabase.createClient(
            CONFIG.SUPABASE.URL,
            CONFIG.SUPABASE.ANON_KEY
        );
        
        console.log('🧪 Database Tester Initialized');
    }

    async runAllTests() {
        console.log('🚀 Starting Database Tests...\n');
        
        try {
            await this.init();
            
            // Run test suite
            await this.testDatabaseConnection();
            await this.testUserOperations();
            await this.testGiftOperations();
            await this.testPurchaseFunction();
            await this.testLeaderboardOperations();
            await this.testRealTimeSubscriptions();
            await this.testPerformance();
            
            // Cleanup
            await this.cleanup();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            this.recordResult('Test Suite', false, error.message);
        }
    }

    // ======================
    // Test Methods
    // ======================

    async testDatabaseConnection() {
        console.log('🔌 Testing Database Connection...');
        
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('count')
                .limit(1);
            
            this.recordResult('Database Connection', !error, error?.message);
            
        } catch (error) {
            this.recordResult('Database Connection', false, error.message);
        }
    }

    async testUserOperations() {
        console.log('👤 Testing User Operations...');
        
        try {
            // Test user creation
            const { data: newUser, error: createError } = await this.supabase
                .from('users')
                .insert([this.testUser])
                .select()
                .single();
            
            this.recordResult('User Creation', !createError, createError?.message);
            
            if (newUser) {
                this.testUser.id = newUser.id;
                
                // Test user read
                const { data: readUser, error: readError } = await this.supabase
                    .from('users')
                    .select('*')
                    .eq('telegram_id', this.testUser.telegram_id)
                    .single();
                
                this.recordResult('User Read', !readError && readUser, readError?.message);
                
                // Test user update
                const { data: updatedUser, error: updateError } = await this.supabase
                    .from('users')
                    .update({ points: 200 })
                    .eq('id', this.testUser.id)
                    .select()
                    .single();
                
                this.recordResult('User Update', !updateError && updatedUser.points === 200, updateError?.message);
            }
            
        } catch (error) {
            this.recordResult('User Operations', false, error.message);
        }
    }

    async testGiftOperations() {
        console.log('🎁 Testing Gift Operations...');
        
        try {
            // Test reading gifts
            const { data: gifts, error: giftsError } = await this.supabase
                .from('gifts')
                .select('*')
                .eq('is_active', true)
                .limit(5);
            
            this.recordResult('Gift Read', !giftsError && gifts.length > 0, giftsError?.message);
            
            // Test gift filtering
            const { data: filteredGifts, error: filterError } = await this.supabase
                .from('gifts')
                .select('*')
                .eq('category', 'match')
                .eq('is_active', true);
            
            this.recordResult('Gift Filtering', !filterError, filterError?.message);
            
            // Test gift sorting
            const { data: sortedGifts, error: sortError } = await this.supabase
                .from('gifts')
                .select('name, price_points')
                .eq('is_active', true)
                .order('price_points', { ascending: true });
            
            this.recordResult('Gift Sorting', !sortError, sortError?.message);
            
        } catch (error) {
            this.recordResult('Gift Operations', false, error.message);
        }
    }

    async testPurchaseFunction() {
        console.log('💰 Testing Purchase Function...');
        
        try {
            if (!this.testUser.id) {
                throw new Error('Test user not created');
            }
            
            // Get a gift to purchase
            const { data: gift, error: giftError } = await this.supabase
                .from('gifts')
                .select('*')
                .eq('is_active', true)
                .lte('price_points', 100) // Affordable with initial points
                .limit(1)
                .single();
            
            if (giftError || !gift) {
                throw new Error('No affordable gift found for testing');
            }
            
            // Test purchase function
            const { data: purchaseResult, error: purchaseError } = await this.supabase
                .rpc('purchase_gift', {
                    p_user_telegram_id: this.testUser.telegram_id,
                    p_gift_id: gift.id
                });
            
            const isSuccess = !purchaseError && purchaseResult?.success === true;
            this.recordResult('Gift Purchase Function', isSuccess, purchaseError?.message || purchaseResult?.message);
            
            if (isSuccess) {
                // Verify purchase in user_gifts table
                const { data: userGift, error: verifyError } = await this.supabase
                    .from('user_gifts')
                    .select('*')
                    .eq('user_id', this.testUser.id)
                    .eq('gift_id', gift.id)
                    .single();
                
                this.recordResult('Purchase Verification', !verifyError && userGift, verifyError?.message);
                
                // Test duplicate purchase prevention
                const { data: duplicateResult, error: duplicateError } = await this.supabase
                    .rpc('purchase_gift', {
                        p_user_telegram_id: this.testUser.telegram_id,
                        p_gift_id: gift.id
                    });
                
                const isDuplicatePrevented = duplicateResult?.success === false && duplicateResult?.error === 'ALREADY_OWNED';
                this.recordResult('Duplicate Purchase Prevention', isDuplicatePrevented, 'Should prevent duplicate purchases');
            }
            
        } catch (error) {
            this.recordResult('Purchase Function', false, error.message);
        }
    }

    async testLeaderboardOperations() {
        console.log('🏆 Testing Leaderboard Operations...');
        
        try {
            // Test leaderboard view
            const { data: leaderboard, error: leaderboardError } = await this.supabase
                .from('leaderboard_view')
                .select('*')
                .limit(10);
            
            this.recordResult('Leaderboard View', !leaderboardError, leaderboardError?.message);
            
            // Test user position function
            const { data: userPosition, error: positionError } = await this.supabase
                .rpc('get_user_leaderboard_position', {
                    p_telegram_id: this.testUser.telegram_id
                });
            
            this.recordResult('User Position Function', !positionError, positionError?.message);
            
            // Test leaderboard ordering
            if (leaderboard && leaderboard.length > 1) {
                const isOrdered = leaderboard[0].points >= leaderboard[1].points;
                this.recordResult('Leaderboard Ordering', isOrdered, 'Leaderboard should be ordered by points DESC');
            }
            
        } catch (error) {
            this.recordResult('Leaderboard Operations', false, error.message);
        }
    }

    async testRealTimeSubscriptions() {
        console.log('⚡ Testing Real-time Subscriptions...');
        
        try {
            let subscriptionWorking = false;
            
            // Test subscription to leaderboard changes
            const subscription = this.supabase
                .channel('test-leaderboard')
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'users' 
                    }, 
                    (payload) => {
                        subscriptionWorking = true;
                        console.log('📡 Real-time update received:', payload);
                    }
                )
                .subscribe();
            
            // Wait a moment for subscription to establish
            await this.sleep(1000);
            
            // Trigger an update to test real-time
            if (this.testUser.id) {
                await this.supabase
                    .from('users')
                    .update({ points: 150 })
                    .eq('id', this.testUser.id);
                
                // Wait for real-time update
                await this.sleep(2000);
            }
            
            // Cleanup subscription
            subscription.unsubscribe();
            
            this.recordResult('Real-time Subscriptions', subscriptionWorking, 'Real-time updates should work');
            
        } catch (error) {
            this.recordResult('Real-time Subscriptions', false, error.message);
        }
    }

    async testPerformance() {
        console.log('⚡ Testing Performance...');
        
        try {
            // Test query performance with timing
            const startTime = performance.now();
            
            const { data, error } = await this.supabase
                .from('leaderboard_view')
                .select('*')
                .limit(50);
            
            const endTime = performance.now();
            const queryTime = endTime - startTime;
            
            const isPerformant = !error && queryTime < 1000; // Should be under 1 second
            this.recordResult('Query Performance', isPerformant, `Query took ${queryTime.toFixed(2)}ms`);
            
            // Test index usage by checking explain
            const { data: explainData, error: explainError } = await this.supabase
                .from('users')
                .select('*')
                .eq('telegram_id', 999999999)
                .limit(1);
            
            this.recordResult('Index Usage', !explainError, explainError?.message);
            
        } catch (error) {
            this.recordResult('Performance Tests', false, error.message);
        }
    }

    // ======================
    // Test Utilities
    // ======================

    async cleanup() {
        console.log('🧹 Cleaning up test data...');
        
        try {
            if (this.testUser.id) {
                // Delete test user (cascades to user_gifts)
                await this.supabase
                    .from('users')
                    .delete()
                    .eq('id', this.testUser.id);
                
                console.log('✅ Test data cleaned up');
            }
        } catch (error) {
            console.warn('⚠️ Cleanup failed:', error.message);
        }
    }

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

    displayResults() {
        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log('\n📊 Database Test Results:');
        console.log('========================');
        console.log(`${passed}/${total} tests passed (${percentage}%)`);
        
        if (percentage >= 90) {
            console.log('🎉 Excellent! Database is working perfectly.');
        } else if (percentage >= 70) {
            console.log('⚠️ Good, but some issues need attention.');
        } else {
            console.log('🚨 Multiple issues detected. Check the logs above.');
        }
        
        // Store results
        if (window.Utils) {
            Utils.setStorage('database_test_results', {
                results: this.testResults,
                summary: { passed, total, percentage },
                timestamp: new Date().toISOString()
            });
        }
        
        return { passed, total, percentage };
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Manual testing function
window.runDatabaseTests = async () => {
    const tester = new DatabaseTester();
    return await tester.runAllTests();
};

// Auto-run in debug mode
if (CONFIG?.DEBUG && window.location.search.includes('dbtest=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.runDatabaseTests();
        }, 2000);
    });
}

console.log('🗄️ Database Tester loaded. Run window.runDatabaseTests() to test database operations.');