// Comprehensive Error Handler for FanZone Application
// Provides detailed error logging and user-friendly feedback

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxErrorLogSize = 100;
        this.errorCallbacks = new Map();
        this.isDebugMode = window.CONFIG?.DEBUG || false;
    }
    
    /**
     * Handle initialization errors with context-specific messages
     */
    handleInitError(error, context) {
        const errorInfo = this.categorizeError(error);
        
        // Log detailed error for debugging
        this.logError(error, context, errorInfo);
        
        // Show user-friendly message
        this.showUserMessage(errorInfo);
        
        // Attempt recovery if possible
        this.attemptRecovery(errorInfo, context);
        
        return errorInfo;
    }
    
    /**
     * Categorize error and provide specific information
     */
    categorizeError(error) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        const errorStack = error?.stack || '';
        
        let category = 'unknown';
        let userMessage = 'An unexpected error occurred. Please refresh and try again.';
        let technicalDetails = errorMessage;
        let recoveryPossible = false;
        let recoveryAction = null;
        
        // Telegram-related errors
        if (errorMessage.toLowerCase().includes('telegram') || 
            errorMessage.includes('WebApp') ||
            errorMessage.includes('platform')) {
            category = 'telegram';
            userMessage = 'Telegram connection failed. Please ensure you\'re opening this from the Telegram app.';
            recoveryPossible = true;
            recoveryAction = 'fallback_mode';
        }
        // Database/Supabase errors
        else if (errorMessage.toLowerCase().includes('database') || 
                 errorMessage.includes('supabase') ||
                 errorMessage.includes('repository')) {
            category = 'database';
            userMessage = 'Database connection failed. Some features may be limited. The app will work in offline mode.';
            recoveryPossible = true;
            recoveryAction = 'offline_mode';
        }
        // Service initialization errors
        else if (errorMessage.includes('service') || 
                 errorMessage.includes('DIContainer') ||
                 errorMessage.includes('Missing required')) {
            category = 'service';
            userMessage = 'Some app services failed to load. Please refresh the page to try again.';
            technicalDetails = `Service error: ${errorMessage}`;
        }
        // Network errors
        else if (errorMessage.toLowerCase().includes('network') || 
                 errorMessage.includes('fetch') ||
                 errorMessage.includes('timeout')) {
            category = 'network';
            userMessage = 'Network connection problem. Please check your internet connection and try again.';
            recoveryPossible = true;
            recoveryAction = 'retry';
        }
        // Authentication errors
        else if (errorMessage.toLowerCase().includes('auth') || 
                 errorMessage.includes('login') ||
                 errorMessage.includes('user')) {
            category = 'authentication';
            userMessage = 'Authentication failed. Please try logging in again.';
            recoveryPossible = true;
            recoveryAction = 'reauth';
        }
        // File loading errors
        else if (errorMessage.includes('Failed to load') || 
                 errorMessage.includes('script') ||
                 errorMessage.includes('404')) {
            category = 'loading';
            userMessage = 'Some app files failed to load. Please clear your cache and refresh.';
        }
        
        return {
            category,
            userMessage,
            technicalDetails,
            errorMessage,
            errorStack,
            timestamp: new Date().toISOString(),
            recoveryPossible,
            recoveryAction
        };
    }
    
    /**
     * Log error with full details
     */
    logError(error, context, errorInfo) {
        const logEntry = {
            ...errorInfo,
            context,
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error
        };
        
        // Add to error log
        this.errorLog.push(logEntry);
        if (this.errorLog.length > this.maxErrorLogSize) {
            this.errorLog.shift();
        }
        
        // Console logging with formatting
        console.group(`❌ Error in ${context}`);
        console.error('Category:', errorInfo.category);
        console.error('Message:', errorInfo.errorMessage);
        console.error('User Message:', errorInfo.userMessage);
        
        if (this.isDebugMode) {
            console.error('Technical Details:', errorInfo.technicalDetails);
            console.error('Stack:', errorInfo.errorStack);
            console.error('Recovery:', errorInfo.recoveryPossible ? errorInfo.recoveryAction : 'Not possible');
        }
        
        console.error('Full Error:', error);
        console.groupEnd();
        
        // Emit error event if EventBus is available
        if (window.EventBus) {
            window.EventBus.emit('error:logged', logEntry);
        }
    }
    
    /**
     * Show user-friendly error message
     */
    showUserMessage(errorInfo) {
        // Try to use app's toast system
        if (window.FanZoneApp?.showToast) {
            window.FanZoneApp.showToast(errorInfo.userMessage, 'error', 5000);
        }
        
        // Update error element if it exists
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'flex';
            const errorText = document.getElementById('error-text');
            if (errorText) {
                errorText.textContent = errorInfo.userMessage;
            }
            
            // Add recovery button if possible
            if (errorInfo.recoveryPossible) {
                const retryBtn = document.getElementById('retry-btn');
                if (retryBtn) {
                    retryBtn.textContent = this.getRecoveryButtonText(errorInfo.recoveryAction);
                    retryBtn.onclick = () => this.executeRecovery(errorInfo.recoveryAction);
                }
            }
        }
        
        // Show detailed error in debug mode
        if (this.isDebugMode) {
            this.showDebugInfo(errorInfo);
        }
    }
    
    /**
     * Show debug information panel
     */
    showDebugInfo(errorInfo) {
        let debugPanel = document.getElementById('debug-error-panel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'debug-error-panel';
            debugPanel.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: #fff;
                border: 2px solid #dc3545;
                border-radius: 8px;
                padding: 15px;
                max-width: 400px;
                max-height: 300px;
                overflow-y: auto;
                z-index: 10000;
                font-family: monospace;
                font-size: 12px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;
            document.body.appendChild(debugPanel);
        }
        
        debugPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #dc3545;">Debug Error Info</strong>
                <button onclick="this.parentElement.parentElement.remove()" style="border: none; background: none; cursor: pointer;">✕</button>
            </div>
            <div><strong>Category:</strong> ${errorInfo.category}</div>
            <div><strong>Time:</strong> ${new Date(errorInfo.timestamp).toLocaleTimeString()}</div>
            <div><strong>Message:</strong> ${errorInfo.errorMessage}</div>
            <div><strong>Recovery:</strong> ${errorInfo.recoveryPossible ? errorInfo.recoveryAction : 'None'}</div>
            <details>
                <summary>Stack Trace</summary>
                <pre style="font-size: 10px; overflow-x: auto;">${errorInfo.errorStack}</pre>
            </details>
        `;
    }
    
    /**
     * Attempt automatic recovery
     */
    attemptRecovery(errorInfo, context) {
        if (!errorInfo.recoveryPossible) return;
        
        console.log(`🔧 Attempting recovery: ${errorInfo.recoveryAction}`);
        
        switch (errorInfo.recoveryAction) {
            case 'fallback_mode':
                this.enableFallbackMode();
                break;
            case 'offline_mode':
                this.enableOfflineMode();
                break;
            case 'retry':
                this.scheduleRetry(context);
                break;
            case 'reauth':
                this.triggerReauthentication();
                break;
        }
    }
    
    /**
     * Execute recovery action
     */
    executeRecovery(action) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        switch (action) {
            case 'fallback_mode':
                console.log('Enabling fallback mode...');
                this.enableFallbackMode();
                window.location.reload();
                break;
            case 'offline_mode':
                console.log('Enabling offline mode...');
                this.enableOfflineMode();
                window.location.reload();
                break;
            case 'retry':
                console.log('Retrying...');
                window.location.reload();
                break;
            case 'reauth':
                console.log('Re-authenticating...');
                this.triggerReauthentication();
                break;
        }
    }
    
    /**
     * Enable fallback mode (no Telegram features)
     */
    enableFallbackMode() {
        localStorage.setItem('fanzone_fallback_mode', 'true');
        console.log('✅ Fallback mode enabled - Telegram features disabled');
    }
    
    /**
     * Enable offline mode (no database features)
     */
    enableOfflineMode() {
        localStorage.setItem('fanzone_offline_mode', 'true');
        console.log('✅ Offline mode enabled - Using local storage');
    }
    
    /**
     * Schedule retry after delay
     */
    scheduleRetry(context, delay = 3000) {
        console.log(`⏱️ Scheduling retry for ${context} in ${delay}ms...`);
        setTimeout(() => {
            console.log(`🔄 Retrying ${context}...`);
            window.location.reload();
        }, delay);
    }
    
    /**
     * Trigger re-authentication
     */
    triggerReauthentication() {
        console.log('🔐 Triggering re-authentication...');
        localStorage.removeItem('fanzone_user');
        localStorage.removeItem('fanzone_auth_token');
        if (window.FanZoneApp?.authService) {
            window.FanZoneApp.authService.logout();
        }
        window.location.reload();
    }
    
    /**
     * Get recovery button text
     */
    getRecoveryButtonText(action) {
        const texts = {
            'fallback_mode': 'Continue Without Telegram',
            'offline_mode': 'Use Offline Mode',
            'retry': 'Try Again',
            'reauth': 'Login Again'
        };
        return texts[action] || 'Try Again';
    }
    
    /**
     * Register error callback
     */
    onError(category, callback) {
        if (!this.errorCallbacks.has(category)) {
            this.errorCallbacks.set(category, []);
        }
        this.errorCallbacks.get(category).push(callback);
    }
    
    /**
     * Get error log
     */
    getErrorLog() {
        return [...this.errorLog];
    }
    
    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
    }
    
    /**
     * Export error log for debugging
     */
    exportErrorLog() {
        const data = JSON.stringify(this.errorLog, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fanzone-errors-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Create singleton instance
window.ErrorHandler = new ErrorHandler();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}