import { RedisClient } from '@elizaos/adapter-redis';
import { SupabaseDatabaseAdapter } from '@elizaos/adapter-supabase';
import {
    AgentRuntime,
    CacheManager,
    type Character,
    DbCacheAdapter,
    type ICacheManager,
    type IDatabaseAdapter,
    elizaLogger,
    settings,
} from '@elizaos/core';

const createAgent = async (
    character: Character,
    db: IDatabaseAdapter,
    cache: ICacheManager,
    token: string,
): Promise<AgentRuntime> => {
    elizaLogger.log(`Creating runtime for character ${character.name}`);

    return new AgentRuntime({
        databaseAdapter: db,
        token,
        modelProvider: character.modelProvider,
        evaluators: [],
        character,
        plugins: [],
        providers: [],
        actions: [],
        services: [],
        managers: [],
        cacheManager: cache,
    });
};

const initializeDatabase = () => {
    elizaLogger.info('Initializing Supabase connection...');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY environment variable is not set');
    }

    const db = new SupabaseDatabaseAdapter(supabaseUrl, supabaseKey);

    db.init()
        .then(() => {
            elizaLogger.success('Successfully connected to Supabase database');
        })
        .catch((error) => {
            elizaLogger.error('Failed to connect to Supabase:', error);
        });

    return db;
};

const initializeCache = (character: Character) => {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is not set');
    }

    elizaLogger.info('Connecting to Redis...');

    const redisClient = new RedisClient(redisUrl);

    if (!character?.id) {
        throw new Error('CacheStore.REDIS requires id to be set in character definition');
    }

    return new CacheManager(new DbCacheAdapter(redisClient, character.id));
};

const startAgent = async (character: Character) => {
    const token = process.env.OPENAI_API_KEY;

    if (!token) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const db = initializeDatabase();

    await db.init();

    const cache = initializeCache(character);

    const runtime: AgentRuntime = await createAgent(character, db, cache, token);

    await runtime.initialize();
};

const startAgents = async () => {
    const characters: Character[] = [];

    for (const character of characters) {
        await startAgent(character);
    }
};
