// Utility functions for FanZone Telegram Mini App
// This file contains shared utility functions used across the application

const Utils = {
    
    // ======================
    // DOM Manipulation
    // ======================
    
    /**
     * Get element by ID with error handling
     */
    getElementById(id) {
        const element = document.getElementById(id);
        if (!element && CONFIG.DEBUG) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    },
    
    /**
     * Show/hide elements with animation
     */
    showElement(element, animation = 'fade-in') {
        if (typeof element === 'string') {
            element = this.getElementById(element);
        }
        if (element) {
            element.style.display = 'block';
            element.classList.add(animation);
        }
    },
    
    hideElement(element) {
        if (typeof element === 'string') {
            element = this.getElementById(element);
        }
        if (element) {
            element.style.display = 'none';
        }
    },
    
    // ======================
    // Data Formatting
    // ======================
    
    /**
     * Format points with proper separators
     */
    formatPoints(points) {
        if (typeof points !== 'number') return '0';
        return points.toLocaleString();
    },
    
    /**
     * Format time ago from timestamp
     */
    timeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        
        return time.toLocaleDateString();
    },
    
    /**
     * Truncate text with ellipsis
     */
    truncateText(text, maxLength = 50) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    },
    
    // ======================
    // UI Feedback
    // ======================
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
        // Remove existing toasts
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${this.getToastIcon(type)}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        
        // Add styles
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--tg-theme-bg-color);
            color: var(--tg-theme-text-color);
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideDown 0.3s ease;
            border-left: 4px solid ${this.getToastColor(type)};
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    },
    
    getToastColor(type) {
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800',
            info: '#3390ec'
        };
        return colors[type] || colors.info;
    },
    
    /**
     * Show loading state
     */
    showLoading(text = CONFIG.MESSAGES.INFO.LOADING) {
        const loading = this.getElementById('loading');
        if (loading) {
            loading.querySelector('p').textContent = text;
            this.showElement(loading);
        }
    },
    
    hideLoading() {
        const loading = this.getElementById('loading');
        if (loading) {
            this.hideElement(loading);
        }
    },
    
    /**
     * Show error overlay
     */
    showError(message, onRetry = null) {
        const errorOverlay = this.getElementById('error-message');
        const errorText = this.getElementById('error-text');
        const retryBtn = this.getElementById('retry-btn');
        
        if (errorOverlay && errorText) {
            errorText.textContent = message;
            this.showElement(errorOverlay);
            
            if (retryBtn) {
                retryBtn.onclick = () => {
                    this.hideElement(errorOverlay);
                    if (onRetry) onRetry();
                };
            }
        }
    },
    
    // ======================
    // Local Storage
    // ======================
    
    /**
     * Safe localStorage operations
     */
    setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },
    
    getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage error:', e);
            return defaultValue;
        }
    },
    
    removeStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },
    
    // ======================
    // Validation
    // ======================
    
    /**
     * Validate user input
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    },
    
    isValidPoints(points) {
        return typeof points === 'number' && 
               points >= 0 && 
               points <= CONFIG.POINTS.MAX_POINTS;
    },
    
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input.replace(/<script[^>]*>.*?<\/script>/gi, '')
                   .replace(/<[^>]+>/g, '')
                   .trim();
    },
    
    // ======================
    // Telegram Integration
    // ======================
    
    /**
     * Telegram Web App utilities
     */
    isTelegramWebApp() {
        return !!(window.Telegram && window.Telegram.WebApp);
    },
    
    getTelegramUser() {
        if (this.isTelegramWebApp()) {
            return window.Telegram.WebApp.initDataUnsafe?.user;
        }
        return null;
    },
    
    sendTelegramData(data) {
        if (this.isTelegramWebApp()) {
            window.Telegram.WebApp.sendData(JSON.stringify(data));
        }
    },
    
    hapticFeedback(type = 'light') {
        if (this.isTelegramWebApp() && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
        }
    },
    
    // ======================
    // Performance
    // ======================
    
    /**
     * Debounce function calls
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // ======================
    // Error Handling
    // ======================
    
    /**
     * Log errors with context
     */
    logError(error, context = '') {
        const errorInfo = {
            message: error.message || error,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        if (CONFIG.DEBUG) {
            console.error('FanZone Error:', errorInfo);
        }
        
        // In production, you could send this to an error tracking service
        // For MVP, we'll just store locally for debugging
        const errorLog = this.getStorage('error_log', []);
        errorLog.push(errorInfo);
        
        // Keep only last 50 errors
        if (errorLog.length > 50) {
            errorLog.splice(0, errorLog.length - 50);
        }
        
        this.setStorage('error_log', errorLog);
    },
    
    // ======================
    // Random Utilities
    // ======================
    
    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    /**
     * Sleep function for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success');
            return true;
        } catch (e) {
            this.showToast('Failed to copy', 'error');
            return false;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}

// Global access
window.Utils = Utils;