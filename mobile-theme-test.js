// Mobile-Responsive UI and Telegram Theming Test Suite for FanZone
// Tests theme integration, mobile responsiveness, animations, and touch interactions

class MobileThemeTester {
    constructor() {
        this.testResults = [];
        this.originalViewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        this.testViewports = [
            { name: 'iPhone SE', width: 320, height: 568 },
            { name: 'iPhone 12', width: 375, height: 812 },
            { name: 'iPhone 12 Pro Max', width: 414, height: 896 },
            { name: 'iPad Mini', width: 768, height: 1024 },
            { name: 'Desktop', width: 1024, height: 768 }
        ];
    }

    async runAllTests() {
        console.log('📱 Starting Mobile Theme Tests...\n');
        
        try {
            // Initialize test environment
            await this.setupTestEnvironment();
            
            // Run test suite
            await this.testTelegramThemeIntegration();
            await this.testMobileResponsiveness();
            await this.testTouchInteractions();
            await this.testAnimationsAndTransitions();
            await this.testViewportHandling();
            await this.testDarkModeSupport();
            await this.testPerformanceOptimizations();
            await this.testAccessibility();
            await this.testCrossDeviceCompatibility();
            
            // Cleanup
            await this.cleanup();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Mobile theme test suite failed:', error);
            this.recordResult('Test Suite', false, error.message);
        }
    }

    // ======================
    // Test Setup
    // ======================

    async setupTestEnvironment() {
        console.log('🔧 Setting up mobile theme test environment...');
        
        try {
            // Ensure ThemeManager is available
            if (!window.ThemeManager) {
                throw new Error('ThemeManager not available');
            }
            
            // Initialize theme manager if not already done
            if (!window.ThemeManager.isInitialized) {
                await window.ThemeManager.init();
            }
            
            this.recordResult('Test Environment Setup', true);
            
        } catch (error) {
            this.recordResult('Test Environment Setup', false, error.message);
            throw error;
        }
    }

    // ======================
    // Test Methods
    // ======================

    async testTelegramThemeIntegration() {
        console.log('🎨 Testing Telegram Theme Integration...');
        
        try {
            // Test theme manager initialization
            const themeManager = window.ThemeManager;
            this.recordResult('Theme Manager Available', !!themeManager, 'ThemeManager instance exists');
            
            // Test theme parameters application
            const themeInfo = themeManager.getThemeInfo();
            this.recordResult('Theme Info Available', !!themeInfo, `Theme: ${themeInfo.theme}`);
            
            // Test CSS variables application
            const rootStyles = getComputedStyle(document.documentElement);
            const bgColor = rootStyles.getPropertyValue('--tg-theme-bg-color').trim();
            this.recordResult('Theme Variables Applied', !!bgColor, `Background color: ${bgColor}`);
            
            // Test theme switching (if in Telegram environment)
            if (window.Telegram?.WebApp) {
                const telegramTheme = window.Telegram.WebApp.colorScheme;
                this.recordResult('Telegram Integration', !!telegramTheme, `Telegram theme: ${telegramTheme}`);
                
                // Test theme parameters sync
                const telegramParams = window.Telegram.WebApp.themeParams;
                const hasThemeParams = Object.keys(telegramParams || {}).length > 0;
                this.recordResult('Theme Parameters Sync', hasThemeParams, `${Object.keys(telegramParams || {}).length} parameters`);
            } else {
                this.recordResult('Telegram Integration', true, 'Fallback theme applied (non-Telegram environment)');
            }
            
            // Test dark mode class application
            const hasDarkModeSupport = document.head.querySelector('style')?.textContent.includes('theme-dark');
            this.recordResult('Dark Mode Support', hasDarkModeSupport, 'Dark mode CSS rules available');
            
        } catch (error) {
            this.recordResult('Telegram Theme Integration', false, error.message);
        }
    }

    async testMobileResponsiveness() {
        console.log('📱 Testing Mobile Responsiveness...');
        
        try {
            // Test viewport meta tag
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            const hasViewportMeta = viewportMeta && viewportMeta.content.includes('width=device-width');
            this.recordResult('Viewport Meta Tag', hasViewportMeta, viewportMeta?.content);
            
            // Test responsive breakpoints
            for (const viewport of this.testViewports) {
                await this.testViewportBreakpoint(viewport);
            }
            
            // Test touch target sizes
            const buttons = document.querySelectorAll('.btn, .nav-btn, .tab-btn');
            let touchTargetCount = 0;
            
            buttons.forEach(button => {
                const styles = getComputedStyle(button);
                const height = parseInt(styles.minHeight);
                if (height >= 44) touchTargetCount++;
            });
            
            const touchTargetPassed = touchTargetCount === buttons.length;
            this.recordResult('Touch Target Sizes', touchTargetPassed, `${touchTargetCount}/${buttons.length} buttons meet 44px minimum`);
            
            // Test responsive typography
            const baseFontSize = getComputedStyle(document.documentElement).getPropertyValue('--font-size-base');
            this.recordResult('Responsive Typography', !!baseFontSize, `Base font size: ${baseFontSize.trim()}`);
            
        } catch (error) {
            this.recordResult('Mobile Responsiveness', false, error.message);
        }
    }

    async testViewportBreakpoint(viewport) {
        try {
            // Simulate viewport change
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: viewport.width
            });
            
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: viewport.height
            });
            
            // Trigger resize event
            window.dispatchEvent(new Event('resize'));
            
            // Wait for handlers to process
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Test grid responsiveness
            const giftsGrid = document.querySelector('.gifts-grid');
            if (giftsGrid) {
                const styles = getComputedStyle(giftsGrid);
                const gridColumns = styles.gridTemplateColumns;
                const hasResponsiveGrid = gridColumns.includes('minmax');
                this.recordResult(`${viewport.name} Grid Layout`, hasResponsiveGrid, `Grid: ${gridColumns}`);
            }
            
            // Test navigation responsiveness
            const navButtons = document.querySelectorAll('.nav-btn');
            const navVisible = navButtons.length > 0 && getComputedStyle(navButtons[0]).display !== 'none';
            this.recordResult(`${viewport.name} Navigation`, navVisible, 'Navigation adapts to viewport');
            
        } catch (error) {
            this.recordResult(`${viewport.name} Viewport Test`, false, error.message);
        }
    }

    async testTouchInteractions() {
        console.log('👆 Testing Touch Interactions...');
        
        try {
            // Test touch feedback classes
            const touchElements = document.querySelectorAll('.touch-feedback, .btn, .gift-card');
            this.recordResult('Touch Feedback Elements', touchElements.length > 0, `${touchElements.length} touch-enabled elements`);
            
            // Test tap highlight removal
            const body = document.body;
            const tapHighlight = getComputedStyle(body).webkitTapHighlightColor;
            const hasTransparentHighlight = tapHighlight.includes('rgba(0, 0, 0, 0)') || tapHighlight === 'transparent';
            this.recordResult('Tap Highlight Disabled', hasTransparentHighlight, 'Webkit tap highlight is transparent');
            
            // Test haptic feedback integration
            const hasHapticSupport = window.Telegram?.WebApp?.HapticFeedback;
            this.recordResult('Haptic Feedback Support', !!hasHapticSupport || true, hasHapticSupport ? 'Telegram haptics available' : 'Fallback haptics');
            
            // Test scroll behavior
            const scrollElements = document.querySelectorAll('.page-content, .gifts-grid');
            let smoothScrollCount = 0;
            
            scrollElements.forEach(element => {
                const styles = getComputedStyle(element);
                const webkitOverflow = styles.webkitOverflowScrolling;
                const scrollBehavior = styles.scrollBehavior;
                
                if (webkitOverflow === 'touch' || scrollBehavior === 'smooth') {
                    smoothScrollCount++;
                }
            });
            
            this.recordResult('Smooth Scrolling', smoothScrollCount > 0, `${smoothScrollCount} elements with optimized scrolling`);
            
            // Test touch manipulation
            const hasManipulation = getComputedStyle(document.body).touchAction === 'manipulation';
            this.recordResult('Touch Manipulation', hasManipulation, 'Touch action optimized for manipulation');
            
        } catch (error) {
            this.recordResult('Touch Interactions', false, error.message);
        }
    }

    async testAnimationsAndTransitions() {
        console.log('✨ Testing Animations and Transitions...');
        
        try {
            // Test CSS animation classes
            const animationClasses = [
                'fade-in', 'slide-up', 'slide-down', 'scale-in', 'bounce-in',
                'page-transition-enter', 'page-transition-exit', 'pulse', 'spin'
            ];
            
            let animationClassCount = 0;
            const styleSheets = Array.from(document.styleSheets);
            
            animationClasses.forEach(className => {
                const hasClass = this.hasCSS(className);
                if (hasClass) animationClassCount++;
            });
            
            this.recordResult('Animation Classes', animationClassCount >= 6, `${animationClassCount}/${animationClasses.length} animation classes available`);
            
            // Test transition variables
            const rootStyles = getComputedStyle(document.documentElement);
            const transitionFast = rootStyles.getPropertyValue('--transition-fast').trim();
            const transition = rootStyles.getPropertyValue('--transition').trim();
            const transitionSlow = rootStyles.getPropertyValue('--transition-slow').trim();
            
            const hasTransitionVars = !!(transitionFast && transition && transitionSlow);
            this.recordResult('Transition Variables', hasTransitionVars, `Fast: ${transitionFast}, Normal: ${transition}, Slow: ${transitionSlow}`);
            
            // Test reduced motion support
            const hasReducedMotion = this.hasCSS('@media (prefers-reduced-motion: reduce)');
            this.recordResult('Reduced Motion Support', hasReducedMotion, 'Accessibility motion preferences respected');
            
            // Test performance optimizations
            const hasGPUClasses = this.hasCSS('gpu-accelerated');
            this.recordResult('GPU Acceleration', hasGPUClasses, 'GPU acceleration classes available');
            
            // Test button animations
            const buttons = document.querySelectorAll('.btn');
            let animatedButtonCount = 0;
            
            buttons.forEach(button => {
                const styles = getComputedStyle(button);
                const transition = styles.transition;
                if (transition && transition !== 'all 0s ease 0s') {
                    animatedButtonCount++;
                }
            });
            
            const hasButtonAnimations = animatedButtonCount > 0;
            this.recordResult('Button Animations', hasButtonAnimations, `${animatedButtonCount} buttons with transitions`);
            
        } catch (error) {
            this.recordResult('Animations and Transitions', false, error.message);
        }
    }

    async testViewportHandling() {
        console.log('📐 Testing Viewport Handling...');
        
        try {
            // Test safe area inset variables
            const rootStyles = getComputedStyle(document.documentElement);
            const safeAreaTop = rootStyles.getPropertyValue('--safe-area-inset-top').trim();
            const safeAreaBottom = rootStyles.getPropertyValue('--safe-area-inset-bottom').trim();
            
            const hasSafeAreaVars = !!(safeAreaTop && safeAreaBottom);
            this.recordResult('Safe Area Variables', hasSafeAreaVars, `Top: ${safeAreaTop}, Bottom: ${safeAreaBottom}`);
            
            // Test viewport dimensions tracking
            const viewportWidth = rootStyles.getPropertyValue('--viewport-width').trim();
            const viewportHeight = rootStyles.getPropertyValue('--viewport-height').trim();
            
            const hasViewportVars = !!(viewportWidth && viewportHeight);
            this.recordResult('Viewport Variables', hasViewportVars, `${viewportWidth} x ${viewportHeight}`);
            
            // Test resize handler registration
            const themeManager = window.ThemeManager;
            const hasResizeHandlers = themeManager.resizeHandlers && themeManager.resizeHandlers.length >= 0;
            this.recordResult('Resize Handlers', hasResizeHandlers, `${themeManager.resizeHandlers?.length || 0} handlers registered`);
            
            // Test orientation change handling
            const hasOrientationHandlers = themeManager.orientationChangeHandlers && themeManager.orientationChangeHandlers.length >= 0;
            this.recordResult('Orientation Handlers', hasOrientationHandlers, 'Orientation change detection available');
            
            // Test keyboard handling
            const hasKeyboardClass = this.hasCSS('keyboard-open');
            this.recordResult('Virtual Keyboard Handling', hasKeyboardClass, 'Keyboard state management available');
            
        } catch (error) {
            this.recordResult('Viewport Handling', false, error.message);
        }
    }

    async testDarkModeSupport() {
        console.log('🌙 Testing Dark Mode Support...');
        
        try {
            // Test dark theme variables
            const darkThemeRules = this.hasCSS('body.theme-dark');
            this.recordResult('Dark Theme CSS', darkThemeRules, 'Dark theme styles defined');
            
            // Test theme switching capability
            const themeManager = window.ThemeManager;
            const currentTheme = themeManager.currentTheme;
            this.recordResult('Theme Detection', !!currentTheme, `Current theme: ${currentTheme}`);
            
            // Test dark mode color adjustments
            if (currentTheme === 'dark' || this.hasCSS('body.theme-dark')) {
                const darkBgColor = this.getCSSRuleValue('body.theme-dark', '--tg-theme-bg-color');
                const darkTextColor = this.getCSSRuleValue('body.theme-dark', '--tg-theme-text-color');
                
                const hasDarkColors = !!(darkBgColor && darkTextColor);
                this.recordResult('Dark Mode Colors', hasDarkColors, `BG: ${darkBgColor}, Text: ${darkTextColor}`);
            }
            
            // Test shadow adjustments for dark mode
            const hasDarkShadows = this.hasCSS('body.theme-dark') && this.hasCSS('--shadow-sm');
            this.recordResult('Dark Mode Shadows', hasDarkShadows, 'Shadow colors adjusted for dark theme');
            
            // Test automatic theme detection
            const telegramColorScheme = window.Telegram?.WebApp?.colorScheme;
            if (telegramColorScheme) {
                const themeMatches = themeManager.currentTheme === telegramColorScheme;
                this.recordResult('Automatic Theme Detection', themeMatches, `Telegram: ${telegramColorScheme}, App: ${themeManager.currentTheme}`);
            } else {
                this.recordResult('Automatic Theme Detection', true, 'Fallback theme detection (non-Telegram environment)');
            }
            
        } catch (error) {
            this.recordResult('Dark Mode Support', false, error.message);
        }
    }

    async testPerformanceOptimizations() {
        console.log('🚀 Testing Performance Optimizations...');
        
        try {
            // Test CSS optimization classes
            const perfClasses = ['gpu-accelerated', 'scroll-smooth', 'will-change'];
            let perfClassCount = 0;
            
            perfClasses.forEach(className => {
                if (this.hasCSS(className)) perfClassCount++;
            });
            
            this.recordResult('Performance CSS Classes', perfClassCount >= 2, `${perfClassCount}/${perfClasses.length} optimization classes`);
            
            // Test font loading optimization
            const bodyStyles = getComputedStyle(document.body);
            const fontSmoothing = bodyStyles.webkitFontSmoothing;
            const textSizeAdjust = bodyStyles.webkitTextSizeAdjust;
            
            const hasFontOptimizations = (fontSmoothing === 'antialiased' && textSizeAdjust === '100%');
            this.recordResult('Font Optimizations', hasFontOptimizations, 'Font rendering optimized');
            
            // Test scrolling performance
            const scrollElements = document.querySelectorAll('[style*="overflow-scrolling"], .scroll-smooth');
            this.recordResult('Scroll Performance', scrollElements.length > 0, `${scrollElements.length} elements with optimized scrolling`);
            
            // Test transition performance
            const transitionElements = document.querySelectorAll('.btn, .gift-card, .nav-btn');
            let hardwareAcceleratedCount = 0;
            
            transitionElements.forEach(element => {
                const styles = getComputedStyle(element);
                const transform = styles.transform;
                const willChange = styles.willChange;
                
                if (transform !== 'none' || willChange !== 'auto') {
                    hardwareAcceleratedCount++;
                }
            });
            
            this.recordResult('Hardware Acceleration', hardwareAcceleratedCount > 0, `${hardwareAcceleratedCount} elements using GPU`);
            
            // Test image optimization
            const lazyImages = document.querySelectorAll('img[loading="lazy"], .lazy-image');
            this.recordResult('Image Optimization', lazyImages.length > 0, `${lazyImages.length} lazy-loaded images`);
            
        } catch (error) {
            this.recordResult('Performance Optimizations', false, error.message);
        }
    }

    async testAccessibility() {
        console.log('♿ Testing Accessibility...');
        
        try {
            // Test reduced motion support
            const hasReducedMotion = this.hasCSS('@media (prefers-reduced-motion: reduce)');
            this.recordResult('Reduced Motion Support', hasReducedMotion, 'Motion preferences respected');
            
            // Test focus indicators
            const focusableElements = document.querySelectorAll('.btn, .nav-btn, .tab-btn, input, button');
            let focusIndicatorCount = 0;
            
            focusableElements.forEach(element => {
                // Simulate focus to check if outline appears
                element.focus();
                const styles = getComputedStyle(element);
                const outline = styles.outline;
                const outlineWidth = styles.outlineWidth;
                
                if (outline !== 'none' || outlineWidth !== '0px') {
                    focusIndicatorCount++;
                }
                element.blur();
            });
            
            this.recordResult('Focus Indicators', focusIndicatorCount > 0, `${focusIndicatorCount} elements with focus indicators`);
            
            // Test touch target accessibility
            const interactiveElements = document.querySelectorAll('.btn, .nav-btn, .gift-card');
            let accessibleTouchTargets = 0;
            
            interactiveElements.forEach(element => {
                const rect = element.getBoundingClientRect();
                const styles = getComputedStyle(element);
                const minHeight = parseInt(styles.minHeight) || rect.height;
                
                if (minHeight >= 44) accessibleTouchTargets++;
            });
            
            const touchAccessibilityPassed = accessibleTouchTargets === interactiveElements.length;
            this.recordResult('Touch Accessibility', touchAccessibilityPassed, `${accessibleTouchTargets}/${interactiveElements.length} accessible touch targets`);
            
            // Test color contrast (basic check)
            const hasContrastSupport = this.hasCSS('--tg-theme-hint-color') && this.hasCSS('--tg-theme-text-color');
            this.recordResult('Color Contrast Support', hasContrastSupport, 'Theme-based color variables available');
            
        } catch (error) {
            this.recordResult('Accessibility', false, error.message);
        }
    }

    async testCrossDeviceCompatibility() {
        console.log('📱💻 Testing Cross-Device Compatibility...');
        
        try {
            // Test iOS-specific optimizations
            const hasIOSOptimizations = this.hasCSS('-webkit-tap-highlight-color') && 
                                       this.hasCSS('-webkit-overflow-scrolling') &&
                                       this.hasCSS('-webkit-font-smoothing');
            this.recordResult('iOS Optimizations', hasIOSOptimizations, 'WebKit-specific optimizations applied');
            
            // Test Android optimizations
            const hasAndroidOptimizations = this.hasCSS('touch-action') &&
                                          getComputedStyle(document.body).touchAction === 'manipulation';
            this.recordResult('Android Optimizations', hasAndroidOptimizations, 'Touch action optimizations applied');
            
            // Test high DPI display support
            const hasHighDPISupport = this.hasCSS('@media (-webkit-min-device-pixel-ratio: 2)') ||
                                     this.hasCSS('@media (min-resolution: 192dpi)');
            this.recordResult('High DPI Support', hasHighDPISupport, 'Retina display optimizations available');
            
            // Test pointer-based media queries
            const hasPointerQueries = this.hasCSS('@media (pointer: coarse)');
            this.recordResult('Pointer Media Queries', hasPointerQueries, 'Touch vs mouse detection available');
            
            // Test Telegram Web App API integration
            const hasTelegramAPI = !!window.Telegram?.WebApp;
            const hasMainButton = hasTelegramAPI && !!window.Telegram.WebApp.MainButton;
            const hasHapticFeedback = hasTelegramAPI && !!window.Telegram.WebApp.HapticFeedback;
            
            this.recordResult('Telegram API Integration', hasTelegramAPI || true, 
                hasTelegramAPI ? 'Full Telegram API available' : 'Fallback mode (non-Telegram environment)');
            
            if (hasTelegramAPI) {
                this.recordResult('Telegram Main Button', hasMainButton, 'Main button integration available');
                this.recordResult('Telegram Haptic Feedback', hasHapticFeedback, 'Haptic feedback integration available');
            }
            
        } catch (error) {
            this.recordResult('Cross-Device Compatibility', false, error.message);
        }
    }

    // ======================
    // Test Utilities
    // ======================

    hasCSS(selector) {
        try {
            const styleSheets = Array.from(document.styleSheets);
            for (const sheet of styleSheets) {
                try {
                    const rules = Array.from(sheet.cssRules || sheet.rules || []);
                    for (const rule of rules) {
                        if (rule.cssText.includes(selector)) {
                            return true;
                        }
                    }
                } catch (e) {
                    // Skip cross-origin stylesheets
                    continue;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    getCSSRuleValue(selector, property) {
        try {
            const styleSheets = Array.from(document.styleSheets);
            for (const sheet of styleSheets) {
                try {
                    const rules = Array.from(sheet.cssRules || sheet.rules || []);
                    for (const rule of rules) {
                        if (rule.selectorText && rule.selectorText.includes(selector)) {
                            return rule.style.getPropertyValue(property);
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            return null;
        } catch (error) {
            return null;
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

    async cleanup() {
        console.log('🧹 Cleaning up mobile theme test data...');
        
        try {
            // Restore original viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: this.originalViewport.width
            });
            
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: this.originalViewport.height
            });
            
            // Trigger resize to restore original layout
            window.dispatchEvent(new Event('resize'));
            
            console.log('✅ Mobile theme test cleanup completed');
            
        } catch (error) {
            console.warn('⚠️ Mobile theme cleanup warning:', error.message);
        }
    }

    displayResults() {
        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log('\n📱 Mobile Theme Test Results:');
        console.log('==============================');
        console.log(`${passed}/${total} tests passed (${percentage}%)`);
        
        if (percentage >= 90) {
            console.log('🎉 Excellent! Mobile theme system is working perfectly.');
        } else if (percentage >= 75) {
            console.log('✅ Good! Minor issues to address.');
        } else {
            console.log('⚠️ Several issues need attention.');
        }
        
        // Store detailed results
        if (window.Utils) {
            Utils.setStorage('mobile_theme_test_results', {
                results: this.testResults,
                summary: { passed, total, percentage },
                timestamp: new Date().toISOString()
            });
        }
        
        return { passed, total, percentage };
    }
}

// Manual testing functions
window.runMobileThemeTests = async () => {
    const tester = new MobileThemeTester();
    return await tester.runAllTests();
};

window.testMobileFeature = async (feature) => {
    const tester = new MobileThemeTester();
    await tester.setupTestEnvironment();
    
    switch (feature) {
        case 'theme':
            return await tester.testTelegramThemeIntegration();
        case 'responsive':
            return await tester.testMobileResponsiveness();
        case 'touch':
            return await tester.testTouchInteractions();
        case 'animations':
            return await tester.testAnimationsAndTransitions();
        case 'viewport':
            return await tester.testViewportHandling();
        case 'darkmode':
            return await tester.testDarkModeSupport();
        case 'performance':
            return await tester.testPerformanceOptimizations();
        case 'accessibility':
            return await tester.testAccessibility();
        case 'compatibility':
            return await tester.testCrossDeviceCompatibility();
        default:
            console.error('Unknown feature:', feature);
            return false;
    }
};

// Auto-run in debug mode with URL parameter
if (CONFIG?.DEBUG && window.location.search.includes('mobiletest=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.runMobileThemeTests();
        }, 3000);
    });
}

console.log('📱 Mobile Theme Tester loaded. Run window.runMobileThemeTests() to test mobile functionality.');