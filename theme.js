// Telegram Theme Management and Mobile UI Optimization for FanZone
// Handles dynamic theming, responsive design, and Telegram-specific UI patterns

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.isInitialized = false;
        this.themeParams = {};
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;
        this.orientationChangeHandlers = [];
        this.resizeHandlers = [];
        
        // Mobile breakpoints
        this.breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024
        };
        
        // Telegram-specific theme variables
        this.defaultThemeParams = {
            bg_color: '#ffffff',
            text_color: '#000000',
            hint_color: '#707579',
            link_color: '#3390ec',
            button_color: '#3390ec',
            button_text_color: '#ffffff',
            secondary_bg_color: '#f4f4f5',
            header_bg_color: '#ffffff',
            accent_text_color: '#3390ec',
            section_bg_color: '#ffffff',
            section_header_text_color: '#707579',
            subtitle_text_color: '#707579',
            destructive_text_color: '#ff3b30'
        };
        
        // Bind methods
        this.init = this.init.bind(this);
        this.applyTheme = this.applyTheme.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleOrientationChange = this.handleOrientationChange.bind(this);
    }
    
    // ======================
    // Initialization
    // ======================
    
    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('🎨 Initializing Theme Manager...');
            
            // Initialize Telegram theme
            await this.initializeTelegramTheme();
            
            // Setup viewport and responsive handlers
            this.setupViewportHandling();
            
            // Setup mobile-specific optimizations
            this.setupMobileOptimizations();
            
            // Apply initial theme
            this.applyTheme();
            
            // Setup animations and transitions
            this.setupAnimations();
            
            // Setup Telegram-specific UI patterns
            this.setupTelegramUIPatterns();
            
            this.isInitialized = true;
            
            if (CONFIG.DEBUG) {
                console.log('🎨 Theme Manager initialized:', {
                    theme: this.currentTheme,
                    viewport: `${this.viewportWidth}x${this.viewportHeight}`,
                    isMobile: this.isMobile(),
                    isTablet: this.isTablet()
                });
            }
            
        } catch (error) {
            console.error('❌ Theme Manager initialization failed:', error);
            // Fallback to basic theme
            this.applyFallbackTheme();
        }
    }
    
    async initializeTelegramTheme() {
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            
            // Get theme parameters
            this.themeParams = { ...this.defaultThemeParams, ...tg.themeParams };
            
            // Detect theme mode
            this.currentTheme = tg.colorScheme || 'light';
            
            // Apply dark mode adjustments if needed
            if (this.currentTheme === 'dark') {
                this.applyDarkModeAdjustments();
            }
            
            // Listen for theme changes
            tg.onEvent('themeChanged', () => {
                this.handleThemeChange();
            });
            
            // Apply Telegram-specific settings
            tg.expand();
            tg.enableClosingConfirmation();
            
            if (CONFIG.DEBUG) {
                console.log('📱 Telegram WebApp initialized:', {
                    colorScheme: tg.colorScheme,
                    themeParams: this.themeParams,
                    viewportHeight: tg.viewportHeight,
                    isExpanded: tg.isExpanded
                });
            }
            
        } else {
            console.warn('⚠️ Telegram WebApp not available, using default theme');
            this.themeParams = this.defaultThemeParams;
        }
    }
    
    // ======================
    // Theme Application
    // ======================
    
    applyTheme() {
        const root = document.documentElement;
        
        // Apply Telegram theme variables
        Object.entries(this.themeParams).forEach(([key, value]) => {
            const cssVar = `--tg-theme-${key.replace(/_/g, '-')}`;
            root.style.setProperty(cssVar, value);
        });
        
        // Apply derived colors and gradients
        this.applyDerivedColors();
        
        // Update theme class
        document.body.className = document.body.className.replace(/theme-\\w+/g, '');
        document.body.classList.add(`theme-${this.currentTheme}`);
        
        // Apply mobile-specific theme adjustments
        if (this.isMobile()) {
            this.applyMobileThemeAdjustments();
        }
        
        // Trigger theme change event
        this.dispatchThemeChangeEvent();
    }
    
    applyDerivedColors() {
        const root = document.documentElement;
        
        // Create gradient variations
        const buttonColor = this.themeParams.button_color || '#3390ec';
        const bgColor = this.themeParams.bg_color || '#ffffff';
        const textColor = this.themeParams.text_color || '#000000';
        
        // Button variations
        root.style.setProperty('--button-hover-color', this.adjustColorBrightness(buttonColor, -10));
        root.style.setProperty('--button-active-color', this.adjustColorBrightness(buttonColor, -20));
        
        // Background variations
        root.style.setProperty('--bg-elevated', this.adjustColorBrightness(bgColor, this.currentTheme === 'dark' ? 10 : -2));
        root.style.setProperty('--bg-overlay', this.addAlpha(textColor, 0.1));
        
        // Shadow colors based on theme
        const shadowColor = this.currentTheme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)';
        root.style.setProperty('--shadow-color', shadowColor);
        root.style.setProperty('--shadow', `0 2px 8px ${shadowColor}`);
        root.style.setProperty('--shadow-elevated', `0 4px 16px ${shadowColor}`);
    }
    
    applyDarkModeAdjustments() {
        // Adjust default colors for better dark mode experience
        this.themeParams = {
            ...this.themeParams,
            bg_color: this.themeParams.bg_color || '#212121',
            text_color: this.themeParams.text_color || '#ffffff',
            secondary_bg_color: this.themeParams.secondary_bg_color || '#181818',
            hint_color: this.themeParams.hint_color || '#707579'
        };
    }
    
    applyMobileThemeAdjustments() {
        const root = document.documentElement;
        
        // Mobile-specific spacing and sizing
        root.style.setProperty('--mobile-padding', '16px');
        root.style.setProperty('--mobile-gap', '12px');
        root.style.setProperty('--touch-target-size', '44px');
        
        // Adjust font sizes for mobile
        if (this.viewportWidth <= this.breakpoints.mobile) {
            root.style.setProperty('--base-font-size', '14px');
            root.style.setProperty('--h1-font-size', '20px');
            root.style.setProperty('--h2-font-size', '18px');
            root.style.setProperty('--small-font-size', '11px');
        }
    }
    
    applyFallbackTheme() {
        console.log('🔄 Applying fallback theme...');
        this.themeParams = this.defaultThemeParams;
        this.currentTheme = 'light';
        this.applyTheme();
    }
    
    // ======================
    // Responsive Design
    // ======================
    
    setupViewportHandling() {
        // Handle viewport changes
        window.addEventListener('resize', Utils.debounce(this.handleResize, 150));
        window.addEventListener('orientationchange', this.handleOrientationChange);
        
        // Setup viewport meta tag for mobile
        this.setupViewportMeta();
        
        // Handle safe area insets
        this.handleSafeAreaInsets();
    }
    
    setupViewportMeta() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        
        // Telegram-optimized viewport settings
        viewport.content = 'width=device-width, initial-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover';
    }
    
    handleSafeAreaInsets() {
        const root = document.documentElement;
        
        // Apply safe area insets
        root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
        root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
        root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
        root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
    }
    
    handleResize() {
        const oldWidth = this.viewportWidth;
        const oldHeight = this.viewportHeight;
        
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;
        
        // Re-apply mobile theme adjustments if breakpoint changed
        const oldIsMobile = oldWidth <= this.breakpoints.mobile;
        const newIsMobile = this.viewportWidth <= this.breakpoints.mobile;
        
        if (oldIsMobile !== newIsMobile) {
            this.applyMobileThemeAdjustments();
        }
        
        // Update CSS custom properties
        const root = document.documentElement;
        root.style.setProperty('--viewport-width', `${this.viewportWidth}px`);
        root.style.setProperty('--viewport-height', `${this.viewportHeight}px`);
        
        // Trigger resize handlers
        this.resizeHandlers.forEach(handler => {
            try {
                handler(this.viewportWidth, this.viewportHeight);
            } catch (error) {
                console.error('Resize handler error:', error);
            }
        });
        
        if (CONFIG.DEBUG) {
            console.log('📐 Viewport resized:', {
                from: `${oldWidth}x${oldHeight}`,
                to: `${this.viewportWidth}x${this.viewportHeight}`,
                isMobile: this.isMobile()
            });
        }
    }
    
    handleOrientationChange() {
        // Wait for orientation change to complete
        setTimeout(() => {
            this.handleResize();
            
            // Trigger orientation change handlers
            this.orientationChangeHandlers.forEach(handler => {
                try {
                    handler(screen.orientation?.angle || 0);
                } catch (error) {
                    console.error('Orientation handler error:', error);
                }
            });
        }, 100);
    }
    
    // ======================
    // Mobile Optimizations
    // ======================
    
    setupMobileOptimizations() {
        if (this.isMobile()) {
            // Prevent zoom on input focus
            this.preventZoomOnInputFocus();
            
            // Optimize touch scrolling
            this.optimizeTouchScrolling();
            
            // Setup touch feedback
            this.setupTouchFeedback();
            
            // Handle keyboard appearance
            this.handleVirtualKeyboard();
        }
    }
    
    preventZoomOnInputFocus() {
        // Add larger font size to inputs to prevent zoom on iOS
        const style = document.createElement('style');
        style.textContent = `
            input, textarea, select {
                font-size: 16px !important;
            }
            @media (max-width: 480px) {
                input, textarea, select {
                    font-size: 16px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    optimizeTouchScrolling() {
        // Apply smooth scrolling
        document.documentElement.style.setProperty('-webkit-overflow-scrolling', 'touch');
        document.documentElement.style.setProperty('scroll-behavior', 'smooth');
        
        // Optimize momentum scrolling
        const scrollableElements = document.querySelectorAll('.page-content, .gifts-grid, .leaderboard-list, .collection-grid');
        scrollableElements.forEach(element => {
            element.style.setProperty('-webkit-overflow-scrolling', 'touch');
        });
    }
    
    setupTouchFeedback() {
        // Add touch feedback to interactive elements
        const interactiveSelectors = [
            '.btn', '.nav-btn', '.tab-btn', '.filter-btn',
            '.gift-card', '.leaderboard-item', '.collection-item'
        ];
        
        interactiveSelectors.forEach(selector => {
            document.addEventListener('touchstart', (e) => {
                if (e.target.closest(selector)) {
                    e.target.closest(selector).classList.add('touch-active');
                }
            }, { passive: true });
            
            document.addEventListener('touchend', (e) => {
                if (e.target.closest(selector)) {
                    setTimeout(() => {
                        e.target.closest(selector)?.classList.remove('touch-active');
                    }, 150);
                }
            }, { passive: true });
        });
    }
    
    handleVirtualKeyboard() {
        // Handle viewport height changes due to virtual keyboard
        const initialViewportHeight = window.innerHeight;
        
        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            const heightDifference = initialViewportHeight - currentHeight;
            
            // Detect virtual keyboard
            const isKeyboardOpen = heightDifference > 150;
            
            document.body.classList.toggle('keyboard-open', isKeyboardOpen);
            
            if (isKeyboardOpen) {
                // Adjust layout for keyboard
                document.documentElement.style.setProperty('--keyboard-height', `${heightDifference}px`);
            } else {
                document.documentElement.style.removeProperty('--keyboard-height');
            }
        });
    }
    
    // ======================
    // Animations and Transitions
    // ======================
    
    setupAnimations() {
        // Add CSS for smooth animations
        const animationsCSS = `
            /* Smooth transitions for all interactive elements */
            .btn, .nav-btn, .tab-btn, .filter-btn,
            .gift-card, .leaderboard-item, .collection-item {
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            /* Touch feedback */
            .touch-active {
                transform: scale(0.95);
                opacity: 0.8;
            }
            
            /* Page transitions */
            .page {
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            
            .page:not(.active) {
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
            }
            
            /* Loading animations */
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            @keyframes slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .slide-in-up {
                animation: slideInUp 0.3s ease-out;
            }
            
            /* Skeleton loading */
            .skeleton {
                background: linear-gradient(90deg, var(--tg-theme-secondary-bg-color) 25%, transparent 50%, var(--tg-theme-secondary-bg-color) 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
            }
            
            @keyframes skeleton-loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        
        this.addStyles('theme-animations', animationsCSS);
        
        // Setup scroll-triggered animations
        this.setupScrollAnimations();
    }
    
    setupScrollAnimations() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('slide-in-up');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '50px 0px'
            });
            
            // Observe elements that should animate in
            const animateElements = document.querySelectorAll('.gift-card, .leaderboard-item, .collection-item, .stat-card');
            animateElements.forEach(el => observer.observe(el));
        }
    }
    
    // ======================
    // Telegram UI Patterns
    // ======================
    
    setupTelegramUIPatterns() {
        // Setup bottom sheet modals
        this.setupBottomSheets();
        
        // Setup Telegram-style buttons
        this.setupTelegramButtons();
        
        // Setup haptic feedback
        this.setupHapticFeedback();
        
        // Setup main button integration
        this.setupMainButton();
    }
    
    setupBottomSheets() {
        // Create bottom sheet container if not exists
        if (!document.getElementById('bottom-sheet-container')) {
            const container = document.createElement('div');
            container.id = 'bottom-sheet-container';
            container.className = 'bottom-sheet-container';
            document.body.appendChild(container);
        }
        
        // Add bottom sheet styles
        const bottomSheetCSS = `
            .bottom-sheet-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999;
                pointer-events: none;
            }
            
            .bottom-sheet {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--tg-theme-bg-color);
                border-radius: 12px 12px 0 0;
                padding: 20px;
                transform: translateY(100%);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                box-shadow: 0 -4px 16px var(--shadow-color);
            }
            
            .bottom-sheet.open {
                transform: translateY(0);
            }
            
            .bottom-sheet-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: auto;
            }
            
            .bottom-sheet-backdrop.open {
                opacity: 1;
            }
            
            .bottom-sheet-handle {
                width: 36px;
                height: 4px;
                background: var(--tg-theme-hint-color);
                border-radius: 2px;
                margin: 0 auto 16px;
                opacity: 0.5;
            }
        `;
        
        this.addStyles('bottom-sheets', bottomSheetCSS);
    }
    
    setupTelegramButtons() {
        // Enhanced button styles for Telegram feel
        const telegramButtonCSS = `
            .btn-telegram {
                background: var(--tg-theme-button-color);
                color: var(--tg-theme-button-text-color);
                border: none;
                border-radius: 8px;
                padding: 12px 24px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                min-height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .btn-telegram:hover {
                background: var(--button-hover-color);
                transform: translateY(-1px);
            }
            
            .btn-telegram:active {
                background: var(--button-active-color);
                transform: translateY(0);
            }
            
            .btn-telegram.secondary {
                background: var(--tg-theme-secondary-bg-color);
                color: var(--tg-theme-text-color);
            }
            
            .btn-telegram.destructive {
                background: var(--tg-theme-destructive-text-color);
                color: white;
            }
        `;
        
        this.addStyles('telegram-buttons', telegramButtonCSS);
    }
    
    setupHapticFeedback() {
        // Enhanced haptic feedback integration
        window.addEventListener('click', (e) => {
            const target = e.target.closest('.btn, .nav-btn, .tab-btn, .filter-btn');
            if (target && window.Telegram?.WebApp?.HapticFeedback) {
                const hapticType = target.dataset.haptic || 'light';
                window.Telegram.WebApp.HapticFeedback.impactOccurred(hapticType);
            }
        });
    }
    
    setupMainButton() {
        if (window.Telegram?.WebApp?.MainButton) {
            const mainButton = window.Telegram.WebApp.MainButton;
            
            // Configure main button for key actions
            mainButton.setParams({
                text: 'Browse Gifts',
                color: this.themeParams.button_color,
                textColor: this.themeParams.button_text_color
            });
            
            // Show main button on certain pages
            this.updateMainButtonForPage();
            
            // Listen for page changes to update main button
            document.addEventListener('pagechange', (e) => {
                this.updateMainButtonForPage(e.detail.page);
            });
        }
    }
    
    updateMainButtonForPage(page = 'gifts') {
        if (!window.Telegram?.WebApp?.MainButton) return;
        
        const mainButton = window.Telegram.WebApp.MainButton;
        
        switch (page) {
            case 'gifts':
                mainButton.setParams({ text: 'Refresh Gifts' });
                mainButton.onClick(() => window.GiftsManager?.refresh());
                mainButton.show();
                break;
            case 'leaderboard':
                mainButton.setParams({ text: 'Refresh Rankings' });
                mainButton.onClick(() => window.LeaderboardManager?.refresh());
                mainButton.show();
                break;
            case 'profile':
                mainButton.setParams({ text: 'Share Profile' });
                mainButton.onClick(() => window.ProfileManager?.shareProfile());
                mainButton.show();
                break;
            default:
                mainButton.hide();
        }
    }
    
    // ======================
    // Theme Change Handling
    // ======================
    
    handleThemeChange() {
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            
            // Update theme parameters
            this.themeParams = { ...this.defaultThemeParams, ...tg.themeParams };
            this.currentTheme = tg.colorScheme || 'light';
            
            // Apply new theme
            this.applyTheme();
            
            if (CONFIG.DEBUG) {
                console.log('🎨 Theme changed:', {
                    colorScheme: this.currentTheme,
                    themeParams: this.themeParams
                });
            }
        }
    }
    
    dispatchThemeChangeEvent() {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: this.currentTheme,
                themeParams: this.themeParams,
                isMobile: this.isMobile()
            }
        });
        document.dispatchEvent(event);
    }
    
    // ======================
    // Utility Methods
    // ======================
    
    isMobile() {
        return this.viewportWidth <= this.breakpoints.mobile;
    }
    
    isTablet() {
        return this.viewportWidth > this.breakpoints.mobile && this.viewportWidth <= this.breakpoints.tablet;
    }
    
    isDesktop() {
        return this.viewportWidth > this.breakpoints.tablet;
    }
    
    adjustColorBrightness(color, percent) {
        // Convert hex to RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Adjust brightness
        const newR = Math.max(0, Math.min(255, r + (r * percent / 100)));
        const newG = Math.max(0, Math.min(255, g + (g * percent / 100)));
        const newB = Math.max(0, Math.min(255, b + (b * percent / 100)));
        
        // Convert back to hex
        return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
    }
    
    addAlpha(color, alpha) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    addStyles(id, css) {
        // Remove existing styles with this ID
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }
        
        // Add new styles
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
    }
    
    onResize(handler) {
        this.resizeHandlers.push(handler);
    }
    
    onOrientationChange(handler) {
        this.orientationChangeHandlers.push(handler);
    }
    
    // Public API for showing bottom sheets
    showBottomSheet(content, options = {}) {
        const container = document.getElementById('bottom-sheet-container');
        if (!container) return;
        
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'bottom-sheet-backdrop';
        backdrop.onclick = () => this.hideBottomSheet();
        
        // Create sheet
        const sheet = document.createElement('div');
        sheet.className = 'bottom-sheet';
        sheet.innerHTML = `
            <div class="bottom-sheet-handle"></div>
            ${content}
        `;
        
        container.appendChild(backdrop);
        container.appendChild(sheet);
        
        // Show with animation
        requestAnimationFrame(() => {
            backdrop.classList.add('open');
            sheet.classList.add('open');
        });
        
        return sheet;
    }
    
    hideBottomSheet() {
        const container = document.getElementById('bottom-sheet-container');
        if (!container) return;
        
        const backdrop = container.querySelector('.bottom-sheet-backdrop');
        const sheet = container.querySelector('.bottom-sheet');
        
        if (backdrop && sheet) {
            backdrop.classList.remove('open');
            sheet.classList.remove('open');
            
            setTimeout(() => {
                backdrop.remove();
                sheet.remove();
            }, 300);
        }
    }
    
    // Get current theme info
    getThemeInfo() {
        return {
            theme: this.currentTheme,
            themeParams: this.themeParams,
            viewport: {
                width: this.viewportWidth,
                height: this.viewportHeight,
                isMobile: this.isMobile(),
                isTablet: this.isTablet(),
                isDesktop: this.isDesktop()
            },
            breakpoints: this.breakpoints
        };
    }
}

// Create global instance
window.ThemeManager = new ThemeManager();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.ThemeManager.init();
    });
} else {
    window.ThemeManager.init();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}

console.log('🎨 Theme Manager loaded successfully.');