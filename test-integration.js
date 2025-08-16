// Test integration script for FanZone Telegram Mini App
// This script helps test the authentication and Telegram Web App integration

class IntegrationTester {
    constructor() {
        this.tests = [];
        this.results = [];
        
        this.init();
    }
    
    init() {
        // Wait for app to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.runTests());
        } else {
            this.runTests();
        }
    }
    
    async runTests() {
        console.log('🧪 Starting FanZone Integration Tests...');
        
        try {
            await this.waitForApp();
            
            // Run test suite
            await this.testTelegramWebApp();
            await this.testAuthentication();
            await this.testSupabaseConnection();
            await this.testUserInterface();
            await this.testFeatures();
            
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }
    
    async waitForApp() {
        return new Promise((resolve) => {
            const checkApp = () => {
                if (window.FanZoneApp && window.FanZoneApp.isReady()) {
                    resolve();
                } else {
                    setTimeout(checkApp, 100);
                }
            };
            checkApp();
        });
    }
    
    // ======================
    // Test Suites
    // ======================
    
    async testTelegramWebApp() {
        this.log('🔍 Testing Telegram Web App Integration...');
        
        // Test 1: Telegram Web App API availability
        this.test('Telegram Web App API Available', () => {
            return !!(window.Telegram && window.Telegram.WebApp);
        });
        
        // Test 2: Telegram detection
        this.test('Telegram Environment Detection', () => {
            return Utils.isTelegramWebApp() !== undefined;
        });
        
        // Test 3: Web App initialization
        this.test('Web App Initialization', () => {
            if (window.Telegram && window.Telegram.WebApp) {
                return window.Telegram.WebApp.isExpanded !== undefined;
            }
            return true; // Pass in development mode
        });
        
        // Test 4: Theme integration
        this.test('Theme Integration', () => {
            const root = document.documentElement;
            const hasThemeVars = getComputedStyle(root).getPropertyValue('--tg-theme-bg-color');
            return hasThemeVars !== '';
        });
    }
    
    async testAuthentication() {
        this.log('🔐 Testing Authentication System...');
        
        // Test 1: AuthManager availability
        this.test('AuthManager Available', () => {
            return !!(window.AuthManager);
        });
        
        // Test 2: User authentication
        this.test('User Authentication', () => {
            return window.AuthManager.isUserAuthenticated();
        });
        
        // Test 3: User data validity
        this.test('User Data Valid', () => {
            const user = window.AuthManager.getUser();
            return !!(user && user.telegram_id && user.username);
        });
        
        // Test 4: Telegram user data
        this.test('Telegram User Data', () => {
            const telegramUser = window.AuthManager.getTelegramUser();
            return !!(telegramUser && telegramUser.id);
        });
    }
    
    async testSupabaseConnection() {
        this.log('🗄️ Testing Database Connection...');
        
        // Test 1: Supabase client
        this.test('Supabase Client Available', () => {
            const supabase = window.FanZoneApp.getSupabase();
            return supabase !== null || CONFIG.SUPABASE.URL === '';
        });
        
        // Test 2: Database connection (if configured)
        if (CONFIG.SUPABASE.URL) {
            this.test('Database Connection', async () => {
                try {
                    const supabase = window.FanZoneApp.getSupabase();
                    const { error } = await supabase.from('users').select('count').limit(1);
                    return !error;
                } catch (e) {
                    return false;
                }
            });
        }
    }
    
    async testUserInterface() {
        this.log('🎨 Testing User Interface...');
        
        // Test 1: Main app visibility
        this.test('Main App Visible', () => {
            const mainApp = document.getElementById('main-app');
            return mainApp && mainApp.style.display !== 'none';
        });
        
        // Test 2: User info display
        this.test('User Info Display', () => {
            const userName = document.getElementById('user-name');
            const userPoints = document.getElementById('user-points');
            return userName && userPoints && 
                   userName.textContent !== 'Loading...' &&
                   userPoints.textContent !== '0 pts';
        });
        
        // Test 3: Navigation functionality
        this.test('Navigation Functional', () => {
            const navButtons = document.querySelectorAll('.nav-btn');
            return navButtons.length === 3;
        });
        
        // Test 4: Responsive design
        this.test('Responsive Design', () => {
            const isMobile = window.innerWidth <= 768;
            const hasTouch = 'ontouchstart' in window;
            return !isMobile || hasTouch; // Should work on mobile with touch
        });
    }
    
    async testFeatures() {
        this.log('⚡ Testing Core Features...');
        
        // Test 1: Gifts manager
        this.test('Gifts Manager Available', () => {
            return !!(window.GiftsManager);
        });
        
        // Test 2: Leaderboard manager
        this.test('Leaderboard Manager Available', () => {
            return !!(window.LeaderboardManager);
        });
        
        // Test 3: Profile manager
        this.test('Profile Manager Available', () => {
            return !!(window.ProfileManager);
        });
        
        // Test 4: Sample data loading
        this.test('Sample Data Loaded', () => {
            const gifts = window.GiftsManager.getGifts();
            return gifts && gifts.length > 0;
        });
    }
    
    // ======================
    // Test Utilities
    // ======================
    
    test(name, testFunction) {
        try {
            const result = testFunction();
            
            if (result instanceof Promise) {
                return result.then(success => {
                    this.recordResult(name, success);
                }).catch(error => {
                    this.recordResult(name, false, error.message);
                });
            } else {
                this.recordResult(name, result);
            }
        } catch (error) {
            this.recordResult(name, false, error.message);
        }
    }
    
    recordResult(name, success, errorMessage = '') {
        const result = {
            name,
            success,
            errorMessage,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(result);
        
        const icon = success ? '✅' : '❌';
        const message = success ? 'PASS' : `FAIL${errorMessage ? ': ' + errorMessage : ''}`;
        
        console.log(`${icon} ${name}: ${message}`);
    }
    
    displayResults() {
        const passed = this.results.filter(r => r.success).length;
        const total = this.results.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log('\n📊 Test Results Summary:');
        console.log(`${passed}/${total} tests passed (${percentage}%)`);
        
        if (percentage >= 90) {
            console.log('🎉 Excellent! Integration is working well.');
        } else if (percentage >= 70) {
            console.log('⚠️ Good, but some issues need attention.');
        } else {
            console.log('🚨 Several issues detected. Check the logs above.');
        }
        
        // Store results for debugging
        Utils.setStorage('integration_test_results', {
            results: this.results,
            summary: { passed, total, percentage },
            timestamp: new Date().toISOString()
        });
        
        // Show results in UI (development mode)
        if (CONFIG.DEBUG) {
            this.showResultsInUI(passed, total, percentage);
        }
    }
    
    showResultsInUI(passed, total, percentage) {
        // Create test results display
        const resultsDiv = document.createElement('div');
        resultsDiv.id = 'test-results';
        resultsDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 10000;
            max-width: 200px;
        `;
        
        resultsDiv.innerHTML = `
            <strong>🧪 Integration Tests</strong><br>
            ${passed}/${total} passed (${percentage}%)<br>
            <button onclick="this.parentElement.remove()" style="margin-top:5px;font-size:10px;">Close</button>
        `;
        
        document.body.appendChild(resultsDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (resultsDiv.parentElement) {
                resultsDiv.remove();
            }
        }, 10000);
    }
    
    log(message) {
        console.log(`\n${message}`);
    }
}

// Auto-run tests in development mode
if (CONFIG.DEBUG) {
    window.IntegrationTester = new IntegrationTester();
}

// Manual testing function
window.runIntegrationTests = () => {
    new IntegrationTester();
};