// Supabase Repository following Repository Pattern
// Handles all database operations with proper error handling and fallbacks

class SupabaseRepository extends window.Interfaces.IDataRepository {
    constructor(supabaseClient, logger) {
        super();
        this.client = supabaseClient;
        this.logger = logger;
        this.isConnected = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }
    
    /**
     * Initialize and test connection
     */
    async initialize() {
        try {
            if (!this.client) {
                throw new Error('Supabase client not provided');
            }
            
            // Test connection with a simple query
            const { error } = await this.client
                .from('users')
                .select('count')
                .limit(1)
                .single();
            
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            
            this.isConnected = true;
            this.logger.info('Supabase connection established');
            
            return true;
            
        } catch (error) {
            this.logger.error('Failed to initialize Supabase connection', error);
            this.isConnected = false;
            throw error;
        }
    }
    
    /**
     * Create a record in the database
     */
    async create(table, data) {
        return this.executeWithRetry(async () => {
            this.logger.debug(`Creating record in ${table}`, data);
            
            const { data: result, error } = await this.client
                .from(table)
                .insert([data])
                .select()
                .single();
            
            if (error) {
                this.handleDatabaseError(error, 'create', { table, data });
            }
            
            this.logger.debug(`Created record in ${table}`, result);
            return result;
        });
    }
    
    /**
     * Read a record from the database
     */
    async read(table, id) {
        return this.executeWithRetry(async () => {
            this.logger.debug(`Reading record from ${table}`, { id });
            
            const { data, error } = await this.client
                .from(table)
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Record not found
                }
                this.handleDatabaseError(error, 'read', { table, id });
            }
            
            return data;
        });
    }
    
    /**
     * Update a record in the database
     */
    async update(table, id, data) {
        return this.executeWithRetry(async () => {
            this.logger.debug(`Updating record in ${table}`, { id, data });
            
            // Add updated_at timestamp if table has it
            const updateData = {
                ...data,
                updated_at: new Date().toISOString()
            };
            
            const { data: result, error } = await this.client
                .from(table)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            
            if (error) {
                this.handleDatabaseError(error, 'update', { table, id, data });
            }
            
            this.logger.debug(`Updated record in ${table}`, result);
            return result;
        });
    }
    
    /**
     * Delete a record from the database
     */
    async delete(table, id) {
        return this.executeWithRetry(async () => {
            this.logger.debug(`Deleting record from ${table}`, { id });
            
            const { error } = await this.client
                .from(table)
                .delete()
                .eq('id', id);
            
            if (error) {
                this.handleDatabaseError(error, 'delete', { table, id });
            }
            
            this.logger.debug(`Deleted record from ${table}`, { id });
            return true;
        });
    }
    
    /**
     * Query records from the database
     */
    async query(table, filters = {}, options = {}) {
        return this.executeWithRetry(async () => {
            this.logger.debug(`Querying ${table}`, { filters, options });
            
            let query = this.client.from(table).select(options.select || '*');
            
            // Apply filters
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        query = query.in(key, value);
                    } else {
                        query = query.eq(key, value);
                    }
                }
            });
            
            // Apply ordering
            if (options.orderBy) {
                query = query.order(options.orderBy, {
                    ascending: options.ascending !== false
                });
            }
            
            // Apply limit
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            // Apply offset
            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
            }
            
            // Single result
            if (options.single) {
                query = query.single();
            }
            
            const { data, error } = await query;
            
            if (error) {
                if (error.code === 'PGRST116' && options.single) {
                    return null; // No record found
                }
                this.handleDatabaseError(error, 'query', { table, filters, options });
            }
            
            return data;
        });
    }
    
    /**
     * Execute a database function/stored procedure
     */
    async execute(functionName, params = {}) {
        return this.executeWithRetry(async () => {
            this.logger.debug(`Executing function ${functionName}`, params);
            
            const { data, error } = await this.client.rpc(functionName, params);
            
            if (error) {
                this.handleDatabaseError(error, 'execute', { functionName, params });
            }
            
            this.logger.debug(`Function ${functionName} executed`, data);
            return data;
        });
    }
    
    /**
     * Execute with retry logic
     */
    async executeWithRetry(operation, attempts = this.retryAttempts) {
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                const isLastAttempt = attempt === attempts;
                const isRetryable = this.isRetryableError(error);
                
                if (isLastAttempt || !isRetryable) {
                    throw error;
                }
                
                this.logger.warn(`Retrying operation (attempt ${attempt}/${attempts})`, {
                    error: error.message
                });
                
                // Wait before retrying with exponential backoff
                await this.wait(this.retryDelay * Math.pow(2, attempt - 1));
            }
        }
    }
    
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        const retryableErrors = [
            'network',
            'timeout',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'fetch'
        ];
        
        const errorMessage = error.message?.toLowerCase() || '';
        return retryableErrors.some(keyword => errorMessage.includes(keyword));
    }
    
    /**
     * Handle database errors with context
     */
    handleDatabaseError(error, operation, context) {
        const errorInfo = {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            operation,
            context
        };
        
        // Check for specific error types
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('RLS')) {
            const rlsError = new Error('Database permission denied. Check Row Level Security policies.');
            rlsError.code = 'RLS_ERROR';
            rlsError.originalError = errorInfo;
            throw rlsError;
        }
        
        if (error.code === '23505' || error.message?.includes('duplicate')) {
            const duplicateError = new Error('Duplicate record. This item already exists.');
            duplicateError.code = 'DUPLICATE_ERROR';
            duplicateError.originalError = errorInfo;
            throw duplicateError;
        }
        
        if (error.code === '23503' || error.message?.includes('foreign key')) {
            const fkError = new Error('Referenced record not found.');
            fkError.code = 'FK_ERROR';
            fkError.originalError = errorInfo;
            throw fkError;
        }
        
        // Generic database error
        const dbError = new Error(error.message || 'Database operation failed');
        dbError.code = error.code || 'DB_ERROR';
        dbError.originalError = errorInfo;
        throw dbError;
    }
    
    /**
     * Wait for specified milliseconds
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Subscribe to real-time changes
     */
    subscribeToChanges(table, filters = {}, callback) {
        if (!this.client) {
            this.logger.warn('Cannot subscribe to changes: Supabase client not available');
            return null;
        }
        
        const channel = this.client
            .channel(`${table}_changes`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table,
                    filter: this.buildRealtimeFilter(filters)
                },
                (payload) => {
                    this.logger.debug(`Realtime event on ${table}`, payload);
                    callback(payload);
                }
            )
            .subscribe();
        
        return channel;
    }
    
    /**
     * Build filter string for realtime subscriptions
     */
    buildRealtimeFilter(filters) {
        const filterParts = [];
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                filterParts.push(`${key}=eq.${value}`);
            }
        });
        
        return filterParts.join('&');
    }
    
    /**
     * Unsubscribe from real-time changes
     */
    unsubscribe(channel) {
        if (channel) {
            this.client.removeChannel(channel);
        }
    }
    
    /**
     * Check if connected to database
     */
    isConnected() {
        return this.isConnected;
    }
    
    /**
     * Get Supabase client (for advanced operations)
     */
    getClient() {
        return this.client;
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseRepository;
}

// Global access
window.SupabaseRepository = SupabaseRepository;