// Logger Service for consistent logging and error tracking
// Follows Single Responsibility Principle

class Logger extends window.Interfaces.ILogger {
    constructor(config = {}) {
        super();
        this.config = {
            enabled: config.enabled !== false,
            level: config.level || 'info',
            console: config.console !== false,
            storage: config.storage || false,
            remote: config.remote || false,
            maxLogs: config.maxLogs || 1000
        };
        
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        
        this.logs = [];
        this.errorCount = 0;
        this.warningCount = 0;
    }
    
    /**
     * Log a message
     */
    log(level, message, context = {}) {
        if (!this.config.enabled) return;
        
        const levelValue = this.levels[level] || 1;
        const configLevelValue = this.levels[this.config.level] || 1;
        
        if (levelValue < configLevelValue) return;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            stack: level === 'error' ? new Error().stack : undefined
        };
        
        // Add to logs array
        this.addToLogs(logEntry);
        
        // Console output
        if (this.config.console) {
            this.logToConsole(logEntry);
        }
        
        // Storage
        if (this.config.storage) {
            this.logToStorage(logEntry);
        }
        
        // Remote logging
        if (this.config.remote) {
            this.logToRemote(logEntry);
        }
        
        // Emit event
        window.EventBus?.emit('log:created', logEntry);
    }
    
    /**
     * Log error
     */
    error(message, error = null, context = {}) {
        this.errorCount++;
        
        const errorContext = {
            ...context,
            errorMessage: error?.message,
            errorStack: error?.stack,
            errorCode: error?.code,
            errorName: error?.name
        };
        
        this.log('error', message, errorContext);
        
        // Emit error event
        window.EventBus?.emit('error:occurred', {
            message,
            error,
            context: errorContext
        });
    }
    
    /**
     * Log warning
     */
    warn(message, context = {}) {
        this.warningCount++;
        this.log('warn', message, context);
    }
    
    /**
     * Log info
     */
    info(message, context = {}) {
        this.log('info', message, context);
    }
    
    /**
     * Log debug
     */
    debug(message, context = {}) {
        this.log('debug', message, context);
    }
    
    /**
     * Add log entry to internal array
     */
    addToLogs(logEntry) {
        this.logs.push(logEntry);
        
        // Limit log size
        if (this.logs.length > this.config.maxLogs) {
            this.logs.shift();
        }
    }
    
    /**
     * Log to console
     */
    logToConsole(logEntry) {
        const { level, message, context, timestamp } = logEntry;
        const time = new Date(timestamp).toLocaleTimeString();
        
        const styles = {
            debug: 'color: #888; font-style: italic;',
            info: 'color: #2196F3;',
            warn: 'color: #FF9800; font-weight: bold;',
            error: 'color: #F44336; font-weight: bold;'
        };
        
        const emoji = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌'
        };
        
        const style = styles[level] || '';
        const icon = emoji[level] || '📝';
        
        // Format message
        const formattedMessage = `%c[${time}] ${icon} ${message}`;
        
        // Choose console method
        const consoleMethod = console[level] || console.log;
        
        // Log with context if available
        if (Object.keys(context).length > 0) {
            consoleMethod(formattedMessage, style, context);
        } else {
            consoleMethod(formattedMessage, style);
        }
    }
    
    /**
     * Log to local storage
     */
    logToStorage(logEntry) {
        try {
            const storageKey = 'fanzone_logs';
            const existingLogs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            existingLogs.push(logEntry);
            
            // Limit storage size
            if (existingLogs.length > this.config.maxLogs) {
                existingLogs.shift();
            }
            
            localStorage.setItem(storageKey, JSON.stringify(existingLogs));
        } catch (error) {
            // Storage might be full or unavailable
            console.warn('Failed to save log to storage:', error);
        }
    }
    
    /**
     * Log to remote server
     */
    async logToRemote(logEntry) {
        // In production, send logs to a logging service
        // For MVP, we'll just track critical errors
        
        if (logEntry.level === 'error') {
            try {
                // You could send to Google Analytics or a logging service
                if (window.gtag && CONFIG.ANALYTICS?.GA4_ID) {
                    window.gtag('event', 'exception', {
                        description: logEntry.message,
                        fatal: false
                    });
                }
            } catch (error) {
                // Ignore remote logging errors
            }
        }
    }
    
    /**
     * Get all logs
     */
    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        
        return [...this.logs];
    }
    
    /**
     * Clear logs
     */
    clearLogs() {
        this.logs = [];
        this.errorCount = 0;
        this.warningCount = 0;
        
        // Clear storage
        if (this.config.storage) {
            try {
                localStorage.removeItem('fanzone_logs');
            } catch (error) {
                // Ignore
            }
        }
    }
    
    /**
     * Get logs from storage
     */
    getStoredLogs() {
        try {
            const storageKey = 'fanzone_logs';
            return JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Export logs
     */
    exportLogs(format = 'json') {
        const logs = this.getLogs();
        
        if (format === 'json') {
            return JSON.stringify(logs, null, 2);
        }
        
        if (format === 'csv') {
            const headers = ['Timestamp', 'Level', 'Message', 'Context'];
            const rows = logs.map(log => [
                log.timestamp,
                log.level,
                log.message,
                JSON.stringify(log.context)
            ]);
            
            return [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');
        }
        
        if (format === 'text') {
            return logs.map(log => 
                `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}\n` +
                (Object.keys(log.context).length > 0 ? `Context: ${JSON.stringify(log.context)}\n` : '')
            ).join('\n');
        }
        
        return logs;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const levels = { debug: 0, info: 0, warn: 0, error: 0 };
        
        this.logs.forEach(log => {
            levels[log.level]++;
        });
        
        return {
            total: this.logs.length,
            levels,
            errorCount: this.errorCount,
            warningCount: this.warningCount,
            oldestLog: this.logs[0]?.timestamp,
            newestLog: this.logs[this.logs.length - 1]?.timestamp
        };
    }
    
    /**
     * Set log level
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.config.level = level;
        }
    }
    
    /**
     * Enable/disable logging
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
    }
    
    /**
     * Create a child logger with context
     */
    child(context) {
        const parent = this;
        
        return {
            log: (level, message, additionalContext = {}) => 
                parent.log(level, message, { ...context, ...additionalContext }),
            error: (message, error, additionalContext = {}) => 
                parent.error(message, error, { ...context, ...additionalContext }),
            warn: (message, additionalContext = {}) => 
                parent.warn(message, { ...context, ...additionalContext }),
            info: (message, additionalContext = {}) => 
                parent.info(message, { ...context, ...additionalContext }),
            debug: (message, additionalContext = {}) => 
                parent.debug(message, { ...context, ...additionalContext })
        };
    }
    
    /**
     * Time a function execution
     */
    async time(label, fn) {
        const start = performance.now();
        
        try {
            const result = await fn();
            const duration = performance.now() - start;
            
            this.debug(`${label} completed`, { duration: `${duration.toFixed(2)}ms` });
            
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            
            this.error(`${label} failed`, error, { duration: `${duration.toFixed(2)}ms` });
            
            throw error;
        }
    }
    
    /**
     * Create a performance mark
     */
    mark(label) {
        if (performance.mark) {
            performance.mark(label);
        }
        
        this.debug(`Performance mark: ${label}`);
    }
    
    /**
     * Measure between marks
     */
    measure(label, startMark, endMark) {
        if (performance.measure) {
            try {
                performance.measure(label, startMark, endMark);
                const entries = performance.getEntriesByName(label);
                const duration = entries[entries.length - 1]?.duration;
                
                this.debug(`Performance measure: ${label}`, { 
                    duration: `${duration?.toFixed(2)}ms` 
                });
                
                return duration;
            } catch (error) {
                this.warn(`Failed to measure ${label}`, { error: error.message });
            }
        }
        
        return null;
    }
}

// Create singleton instance with config
window.Logger = new Logger({
    enabled: true,
    level: CONFIG?.DEBUG ? 'debug' : 'info',
    console: true,
    storage: true,
    remote: false
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}