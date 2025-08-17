// Dependency Injection Container
// Implements Inversion of Control for loose coupling

class DIContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
        this.aliases = new Map();
        this.initialized = false;
    }
    
    /**
     * Register a service
     */
    register(name, factory, options = {}) {
        if (typeof factory !== 'function') {
            throw new Error(`Factory for ${name} must be a function`);
        }
        
        this.factories.set(name, {
            factory,
            singleton: options.singleton !== false,
            dependencies: options.dependencies || [],
            eager: options.eager || false
        });
        
        // Register aliases
        if (options.aliases) {
            options.aliases.forEach(alias => {
                this.aliases.set(alias, name);
            });
        }
        
        // Eager instantiation for singletons
        if (options.singleton !== false && options.eager) {
            this.get(name);
        }
        
        return this;
    }
    
    /**
     * Register a value directly
     */
    registerValue(name, value) {
        this.services.set(name, value);
        return this;
    }
    
    /**
     * Register a singleton instance
     */
    registerSingleton(name, instance) {
        this.singletons.set(name, instance);
        return this;
    }
    
    /**
     * Get a service
     */
    get(name) {
        // Check aliases
        const actualName = this.aliases.get(name) || name;
        
        // Check if it's a direct value
        if (this.services.has(actualName)) {
            return this.services.get(actualName);
        }
        
        // Check if singleton already exists
        if (this.singletons.has(actualName)) {
            return this.singletons.get(actualName);
        }
        
        // Check if factory exists
        const config = this.factories.get(actualName);
        
        if (!config) {
            throw new Error(`Service ${name} not registered`);
        }
        
        // Resolve dependencies
        const dependencies = config.dependencies.map(dep => this.get(dep));
        
        // Create instance
        const instance = config.factory(...dependencies);
        
        // Store singleton
        if (config.singleton) {
            this.singletons.set(actualName, instance);
        }
        
        return instance;
    }
    
    /**
     * Check if service is registered
     */
    has(name) {
        const actualName = this.aliases.get(name) || name;
        return this.services.has(actualName) || 
               this.singletons.has(actualName) || 
               this.factories.has(actualName);
    }
    
    /**
     * Create a scoped container
     */
    createScope() {
        const scope = new DIContainer();
        
        // Copy factories but not singletons
        this.factories.forEach((config, name) => {
            scope.factories.set(name, config);
        });
        
        // Copy aliases
        this.aliases.forEach((target, alias) => {
            scope.aliases.set(alias, target);
        });
        
        // Copy services
        this.services.forEach((value, name) => {
            scope.services.set(name, value);
        });
        
        return scope;
    }
    
    /**
     * Clear all registrations
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
        this.aliases.clear();
    }
    
    /**
     * Initialize all services for the application
     */
    async initializeApp() {
        if (this.initialized) {
            console.warn('DI Container already initialized');
            return;
        }
        
        let currentStep = 'starting';
        
        try {
            console.log('🏗️ Initializing Dependency Injection Container...');
            
            // Register core services
            currentStep = 'core_services';
            console.log('  📌 Registering core services...');
            this.registerCoreServices();
            console.log('  ✅ Core services registered');
            
            // Register adapters
            currentStep = 'adapters';
            console.log('  📌 Registering adapters...');
            this.registerAdapters();
            console.log('  ✅ Adapters registered');
            
            // Register repositories
            currentStep = 'repositories';
            console.log('  📌 Registering repositories...');
            this.registerRepositories();
            console.log('  ✅ Repositories registered');
            
            // Register business services
            currentStep = 'business_services';
            console.log('  📌 Registering business services...');
            this.registerBusinessServices();
            console.log('  ✅ Business services registered');
            
            // Initialize critical services
            currentStep = 'critical_services_init';
            console.log('  📌 Initializing critical services...');
            await this.initializeCriticalServices();
            console.log('  ✅ Critical services initialized');
            
            this.initialized = true;
            
            console.log('✅ DI Container initialized successfully');
            
            // Emit initialization event
            window.EventBus?.emit('app:initialized');
            
        } catch (error) {
            const enhancedError = new Error(`DI Container initialization failed at step: ${currentStep}. ${error.message}`);
            enhancedError.step = currentStep;
            enhancedError.originalError = error;
            
            console.error('❌ Failed to initialize DI Container:', enhancedError);
            console.error('  Failed at step:', currentStep);
            console.error('  Original error:', error);
            
            // Use ErrorHandler if available
            if (window.ErrorHandler) {
                window.ErrorHandler.handleInitError(enhancedError, `DIContainer.${currentStep}`);
            }
            
            throw enhancedError;
        }
    }
    
    /**
     * Register core services
     */
    registerCoreServices() {
        // Logger
        this.registerSingleton('logger', window.Logger);
        
        // Event Bus
        this.registerSingleton('eventBus', window.EventBus);
        
        // Config
        this.registerValue('config', window.CONFIG);
    }
    
    /**
     * Register adapters
     */
    registerAdapters() {
        // Telegram Adapter
        this.register('platformAdapter', () => {
            return window.TelegramAdapter;
        }, {
            singleton: true,
            aliases: ['telegram']
        });
    }
    
    /**
     * Register repositories
     */
    registerRepositories() {
        // Supabase Repository with enhanced initialization
        this.register('repository', (logger) => {
            // Check if Supabase is available
            if (!window.supabase) {
                logger.error('Supabase library not loaded! Check if script is included in index.html');
                throw new Error('Supabase library not available');
            }
            
            // Validate configuration
            if (!CONFIG.SUPABASE.URL || !CONFIG.SUPABASE.ANON_KEY) {
                logger.error('Supabase configuration missing!', {
                    hasUrl: !!CONFIG.SUPABASE.URL,
                    hasKey: !!CONFIG.SUPABASE.ANON_KEY
                });
                throw new Error('Supabase configuration is incomplete');
            }
            
            try {
                // Create Supabase client with proper error handling
                const supabaseClient = window.supabase.createClient(
                    CONFIG.SUPABASE.URL,
                    CONFIG.SUPABASE.ANON_KEY,
                    {
                        auth: {
                            persistSession: false // Disable session persistence for Mini App
                        },
                        realtime: {
                            params: {
                                eventsPerSecond: 2 // Reduce realtime load
                            }
                        }
                    }
                );
                
                if (!supabaseClient) {
                    throw new Error('Failed to create Supabase client');
                }
                
                logger.info('Supabase client created successfully', {
                    url: CONFIG.SUPABASE.URL.substring(0, 30) + '...',
                    hasAuth: !!supabaseClient.auth,
                    hasFrom: !!supabaseClient.from,
                    hasRpc: !!supabaseClient.rpc
                });
                
                // Create repository instance
                const repository = new window.SupabaseRepository(supabaseClient, logger);
                
                // Test connection immediately
                repository.initialize().catch(error => {
                    logger.error('Supabase repository initialization failed', error);
                });
                
                return repository;
                
            } catch (error) {
                logger.error('Failed to create Supabase client', error);
                logger.warn('Falling back to mock repository for development');
                return new MockRepository(logger);
            }
        }, {
            singleton: true,
            dependencies: ['logger'],
            aliases: ['dataRepository', 'supabase']
        });
    }
    
    /**
     * Register business services
     */
    registerBusinessServices() {
        // Auth Service with validation and fallback
        this.register('authService', (repository, platformAdapter, logger) => {
            // Validate critical dependencies
            if (window.ServiceValidator) {
                window.ServiceValidator.validateService(logger, 'Logger');
                // Repository and platformAdapter can be null in fallback mode
            }
            
            const authService = new window.AuthService(repository, platformAdapter, logger);
            
            // Provide fallback wrapper if repository is unavailable
            if (!repository && window.ServiceValidator) {
                console.warn('AuthService running with fallback (no repository)');
                return window.ServiceValidator.createFallbackWrapper(authService, 'AuthService', {
                    authenticate: async () => ({ 
                        success: true, 
                        user: JSON.parse(localStorage.getItem('fanzone_user') || '{}'),
                        offline: true 
                    }),
                    getCurrentUser: () => JSON.parse(localStorage.getItem('fanzone_user') || 'null'),
                    isAuthenticated: () => !!localStorage.getItem('fanzone_user'),
                    logout: () => localStorage.removeItem('fanzone_user')
                });
            }
            
            return authService;
        }, {
            singleton: true,
            dependencies: ['repository', 'platformAdapter', 'logger'],
            aliases: ['auth']
        });
        
        // User Service with validation and fallback
        this.register('userService', (repository, logger) => {
            // Validate critical dependencies
            if (window.ServiceValidator) {
                window.ServiceValidator.validateService(logger, 'Logger');
            }
            
            const userService = new window.UserService(repository, logger);
            
            // Provide fallback wrapper if repository is unavailable
            if (!repository && window.ServiceValidator) {
                console.warn('UserService running with fallback (no repository)');
                return window.ServiceValidator.createFallbackWrapper(userService, 'UserService', {
                    getUserProfile: async (userId) => JSON.parse(localStorage.getItem('fanzone_user') || 'null'),
                    getUserStats: async (userId) => ({ rank: null, totalGifts: 0, points: 0 }),
                    getLeaderboard: async () => [],
                    updateUserPoints: async (userId, points) => {
                        const user = JSON.parse(localStorage.getItem('fanzone_user') || '{}');
                        user.points = points;
                        localStorage.setItem('fanzone_user', JSON.stringify(user));
                        return user;
                    }
                });
            }
            
            return userService;
        }, {
            singleton: true,
            dependencies: ['repository', 'logger'],
            aliases: ['users']
        });
        
        // Gift Service with validation and fallback
        this.register('giftService', (repository, userService, logger) => {
            // Validate critical dependencies
            if (window.ServiceValidator) {
                window.ServiceValidator.validateService(logger, 'Logger');
                window.ServiceValidator.validateService(userService, 'UserService');
            }
            
            const giftService = new window.GiftService(repository, userService, logger);
            
            // Provide fallback wrapper if repository is unavailable
            if (!repository && window.ServiceValidator) {
                console.warn('GiftService running with fallback (no repository)');
                const sampleGifts = [
                    { id: 'gift-1', name: 'Welcome Gift', price_points: 10, current_supply: 0, max_supply: 100, category: 'special', image_url: 'https://via.placeholder.com/150', description: 'A special welcome gift' },
                    { id: 'gift-2', name: 'Trophy Gift', price_points: 50, current_supply: 0, max_supply: 50, category: 'trophy', image_url: 'https://via.placeholder.com/150', description: 'A trophy for champions' }
                ];
                
                return window.ServiceValidator.createFallbackWrapper(giftService, 'GiftService', {
                    getAvailableGifts: async () => sampleGifts,
                    getUserGifts: async (userId) => JSON.parse(localStorage.getItem('fanzone_user_gifts') || '[]'),
                    purchaseGift: async (userId, giftId) => {
                        const gifts = JSON.parse(localStorage.getItem('fanzone_user_gifts') || '[]');
                        gifts.push({ gift_id: giftId, obtained_at: new Date().toISOString() });
                        localStorage.setItem('fanzone_user_gifts', JSON.stringify(gifts));
                        return { success: true, message: 'Gift purchased (offline mode)' };
                    },
                    getSampleGifts: () => sampleGifts
                });
            }
            
            return giftService;
        }, {
            singleton: true,
            dependencies: ['repository', 'userService', 'logger'],
            aliases: ['gifts']
        });
    }
    
    /**
     * Initialize critical services
     */
    async initializeCriticalServices() {
        const logger = this.get('logger');
        let criticalErrors = [];
        
        // Initialize Platform Adapter with error handling
        try {
            logger.info('Initializing platform adapter...');
            const platformAdapter = this.get('platformAdapter');
            await platformAdapter.initialize();
            logger.info('✅ Platform adapter initialized');
        } catch (error) {
            const msg = 'Platform adapter initialization failed';
            logger.error(msg, error);
            criticalErrors.push({ service: 'platformAdapter', error, critical: false });
            
            // Platform adapter failure is not critical - app can work without Telegram
            if (window.ErrorHandler) {
                window.ErrorHandler.handleInitError(error, 'platformAdapter.init');
            }
        }
        
        // Initialize Repository with error handling
        try {
            logger.info('Initializing data repository...');
            const repository = this.get('repository');
            await repository.initialize();
            logger.info('✅ Repository initialized');
        } catch (error) {
            const msg = 'Repository initialization failed, using fallback mode';
            logger.warn(msg, { error: error.message });
            
            // Repository failure is not critical - app can work in offline mode
            if (window.ErrorHandler) {
                const errorInfo = window.ErrorHandler.handleInitError(error, 'repository.init');
                if (errorInfo.recoveryAction === 'offline_mode') {
                    window.ErrorHandler.enableOfflineMode();
                }
            }
        }
        
        // Check if any critical errors occurred
        const criticalFailures = criticalErrors.filter(e => e.critical);
        if (criticalFailures.length > 0) {
            const services = criticalFailures.map(e => e.service).join(', ');
            throw new Error(`Critical services failed to initialize: ${services}`);
        }
        
        // Initialize Auth Service
        logger.info('Initializing authentication...');
        const authService = this.get('authService');
        
        // Try to load stored auth first
        const hasStoredAuth = authService.loadStoredAuth();
        
        if (!hasStoredAuth) {
            // Authenticate with Telegram data
            try {
                await authService.authenticate();
            } catch (error) {
                logger.error('Authentication failed', error);
                throw new Error('Failed to authenticate user');
            }
        }
    }
    
    /**
     * Get service statistics
     */
    getStats() {
        return {
            services: this.services.size,
            singletons: this.singletons.size,
            factories: this.factories.size,
            aliases: this.aliases.size,
            initialized: this.initialized
        };
    }
}

// Mock Repository for fallback
class MockRepository {
    constructor(logger) {
        this.logger = logger;
        this.data = new Map();
    }
    
    async initialize() {
        this.logger.info('Mock repository initialized');
        return true;
    }
    
    async create(table, data) {
        const id = `${table}_${Date.now()}`;
        const record = { ...data, id };
        
        if (!this.data.has(table)) {
            this.data.set(table, new Map());
        }
        
        this.data.get(table).set(id, record);
        return record;
    }
    
    async read(table, id) {
        return this.data.get(table)?.get(id) || null;
    }
    
    async update(table, id, updates) {
        const record = this.data.get(table)?.get(id);
        
        if (!record) {
            throw new Error('Record not found');
        }
        
        const updated = { ...record, ...updates };
        this.data.get(table).set(id, updated);
        return updated;
    }
    
    async delete(table, id) {
        return this.data.get(table)?.delete(id) || false;
    }
    
    async query(table, filters = {}, options = {}) {
        const tableData = this.data.get(table);
        
        if (!tableData) {
            return options.single ? null : [];
        }
        
        let results = Array.from(tableData.values());
        
        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            results = results.filter(item => item[key] === value);
        });
        
        // Apply limit
        if (options.limit) {
            results = results.slice(0, options.limit);
        }
        
        return options.single ? results[0] || null : results;
    }
    
    async execute(functionName, params) {
        this.logger.warn(`Mock execution of ${functionName}`, params);
        
        // Mock purchase_gift function
        if (functionName === 'purchase_gift') {
            return {
                success: false,
                message: 'Database not available'
            };
        }
        
        return null;
    }
}

// Create global instance
window.DIContainer = new DIContainer();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DIContainer;
}