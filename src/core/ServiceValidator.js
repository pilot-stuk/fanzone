// Service Validator - Ensures services are available and functional before use
// Prevents "Cannot read property of undefined" errors

class ServiceValidator {
    /**
     * Validate that a service exists and is functional
     * @param {Object} service - The service to validate
     * @param {String} name - The name of the service for error messages
     * @returns {boolean} - True if service is valid
     * @throws {Error} - If service is invalid or not ready
     */
    static validateService(service, name) {
        // Check if service exists
        if (!service) {
            const error = new Error(`${name} service is not available`);
            error.serviceName = name;
            error.validationType = 'missing';
            throw error;
        }
        
        // Check if service is an object
        if (typeof service !== 'object') {
            const error = new Error(`${name} service is invalid (not an object)`);
            error.serviceName = name;
            error.validationType = 'invalid_type';
            throw error;
        }
        
        // Check if service has initialization state
        if ('isInitialized' in service && !service.isInitialized) {
            const error = new Error(`${name} service is not initialized`);
            error.serviceName = name;
            error.validationType = 'not_initialized';
            throw error;
        }
        
        // Check if service has required methods (if it has an initialize method, it should be initialized)
        if (typeof service.initialize === 'function' && !service.isInitialized) {
            const error = new Error(`${name} service exists but is not properly initialized`);
            error.serviceName = name;
            error.validationType = 'initialization_required';
            throw error;
        }
        
        return true;
    }
    
    /**
     * Validate multiple services at once
     * @param {Array<{service: Object, name: String}>} services - Array of services to validate
     * @returns {Object} - Validation results
     */
    static validateServices(services) {
        const results = {
            valid: true,
            errors: [],
            warnings: []
        };
        
        services.forEach(({ service, name }) => {
            try {
                this.validateService(service, name);
            } catch (error) {
                results.valid = false;
                results.errors.push({
                    service: name,
                    error: error.message,
                    type: error.validationType
                });
            }
        });
        
        return results;
    }
    
    /**
     * Validate that a service method exists and is callable
     * @param {Object} service - The service containing the method
     * @param {String} methodName - The name of the method
     * @param {String} serviceName - The name of the service for error messages
     * @returns {boolean} - True if method is valid
     */
    static validateMethod(service, methodName, serviceName) {
        // First validate the service itself
        this.validateService(service, serviceName);
        
        // Check if method exists
        if (!(methodName in service)) {
            const error = new Error(`${serviceName}.${methodName} method does not exist`);
            error.serviceName = serviceName;
            error.methodName = methodName;
            error.validationType = 'missing_method';
            throw error;
        }
        
        // Check if method is a function
        if (typeof service[methodName] !== 'function') {
            const error = new Error(`${serviceName}.${methodName} is not a function`);
            error.serviceName = serviceName;
            error.methodName = methodName;
            error.validationType = 'invalid_method';
            throw error;
        }
        
        return true;
    }
    
    /**
     * Create a validated proxy for a service that checks methods before calling them
     * @param {Object} service - The service to wrap
     * @param {String} name - The name of the service
     * @returns {Proxy} - A proxy that validates method calls
     */
    static createValidatedProxy(service, name) {
        return new Proxy(service, {
            get(target, prop) {
                // Allow access to properties
                if (typeof target[prop] !== 'function') {
                    return target[prop];
                }
                
                // Wrap methods with validation
                return function(...args) {
                    try {
                        ServiceValidator.validateMethod(target, prop, name);
                        return target[prop].apply(target, args);
                    } catch (error) {
                        console.error(`Service validation failed for ${name}.${prop}:`, error);
                        
                        // Use ErrorHandler if available
                        if (window.ErrorHandler) {
                            window.ErrorHandler.handleInitError(error, `${name}.${prop}`);
                        }
                        
                        throw error;
                    }
                };
            }
        });
    }
    
    /**
     * Check if a service is available (soft check, doesn't throw)
     * @param {Object} service - The service to check
     * @returns {boolean} - True if service is available
     */
    static isServiceAvailable(service) {
        try {
            return !!(service && typeof service === 'object');
        } catch {
            return false;
        }
    }
    
    /**
     * Check if a service method is available (soft check, doesn't throw)
     * @param {Object} service - The service containing the method
     * @param {String} methodName - The name of the method
     * @returns {boolean} - True if method is available
     */
    static isMethodAvailable(service, methodName) {
        try {
            return !!(service && typeof service[methodName] === 'function');
        } catch {
            return false;
        }
    }
    
    /**
     * Get service health status
     * @param {Object} service - The service to check
     * @param {String} name - The name of the service
     * @returns {Object} - Health status object
     */
    static getServiceHealth(service, name) {
        const health = {
            name: name,
            available: false,
            initialized: false,
            healthy: false,
            issues: []
        };
        
        // Check availability
        if (!service) {
            health.issues.push('Service not available');
            return health;
        }
        
        health.available = true;
        
        // Check initialization
        if ('isInitialized' in service) {
            health.initialized = service.isInitialized;
            if (!service.isInitialized) {
                health.issues.push('Service not initialized');
            }
        } else {
            health.initialized = true; // Assume initialized if no flag
        }
        
        // Check for common methods
        const commonMethods = ['initialize', 'reset', 'dispose'];
        commonMethods.forEach(method => {
            if (method in service && typeof service[method] !== 'function') {
                health.issues.push(`Invalid ${method} method`);
            }
        });
        
        health.healthy = health.available && health.initialized && health.issues.length === 0;
        
        return health;
    }
    
    /**
     * Create a fallback wrapper for a service that provides default responses when service is unavailable
     * @param {Object} service - The service to wrap (may be null)
     * @param {String} name - The name of the service
     * @param {Object} fallbacks - Object with fallback methods
     * @returns {Object} - Wrapped service with fallbacks
     */
    static createFallbackWrapper(service, name, fallbacks = {}) {
        // If service is available and healthy, return it as-is
        if (this.isServiceAvailable(service)) {
            try {
                this.validateService(service, name);
                return service;
            } catch (error) {
                console.warn(`Service ${name} validation failed, using fallback wrapper:`, error);
            }
        }
        
        // Create a fallback proxy
        return new Proxy(fallbacks, {
            get(target, prop) {
                // Try to use the real service first
                if (service && prop in service) {
                    try {
                        const value = service[prop];
                        if (typeof value === 'function') {
                            return value.bind(service);
                        }
                        return value;
                    } catch (error) {
                        console.warn(`Error accessing ${name}.${prop}, using fallback:`, error);
                    }
                }
                
                // Use fallback if available
                if (prop in target) {
                    console.warn(`Using fallback for ${name}.${prop}`);
                    return target[prop];
                }
                
                // Return a no-op function for missing methods
                console.warn(`${name}.${prop} not available, returning no-op`);
                return () => {
                    console.warn(`${name}.${prop} called but not available`);
                    return null;
                };
            }
        });
    }
}

// Export for use in other modules
window.ServiceValidator = ServiceValidator;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServiceValidator;
}