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
        
        try {
            console.log('🏗️ Initializing Dependency Injection Container...');
            
            // Register core services
            this.registerCoreServices();
            
            // Register adapters
            this.registerAdapters();
            
            // Register repositories
            this.registerRepositories();
            
            // Register business services
            this.registerBusinessServices();
            
            // Initialize critical services
            await this.initializeCriticalServices();
            
            this.initialized = true;
            
            console.log('✅ DI Container initialized successfully');
            
            // Emit initialization event
            window.EventBus?.emit('app:initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize DI Container:', error);
            throw error;
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
        // Supabase Repository
        this.register('repository', (logger) => {
            const supabaseClient = window.supabase?.createClient(
                CONFIG.SUPABASE.URL,
                CONFIG.SUPABASE.ANON_KEY
            );
            
            if (!supabaseClient) {
                logger.warn('Supabase client not available, using mock repository');
                return new MockRepository(logger);
            }
            
            return new window.SupabaseRepository(supabaseClient, logger);
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
        // Auth Service
        this.register('authService', (repository, platformAdapter, logger) => {
            return new window.AuthService(repository, platformAdapter, logger);
        }, {
            singleton: true,
            dependencies: ['repository', 'platformAdapter', 'logger'],
            aliases: ['auth']
        });
        
        // User Service
        this.register('userService', (repository, logger) => {
            return new window.UserService(repository, logger);
        }, {
            singleton: true,
            dependencies: ['repository', 'logger'],
            aliases: ['users']
        });
        
        // Gift Service
        this.register('giftService', (repository, userService, logger) => {
            return new window.GiftService(repository, userService, logger);
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
        
        // Initialize Platform Adapter
        logger.info('Initializing platform adapter...');
        const platformAdapter = this.get('platformAdapter');
        await platformAdapter.initialize();
        
        // Initialize Repository
        logger.info('Initializing data repository...');
        const repository = this.get('repository');
        
        try {
            await repository.initialize();
        } catch (error) {
            logger.warn('Repository initialization failed, will use fallback mode', {
                error: error.message
            });
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