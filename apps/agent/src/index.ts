import { PostgresDatabaseAdapter } from '@elizaos/adapter-postgres';
import { RedisClient } from '@elizaos/adapter-redis';
import { DirectClient } from '@elizaos/client-direct';
import {
    AgentRuntime,
    CacheManager,
    type Character,
    DbCacheAdapter,
    type ICacheManager,
    type IDatabaseAdapter,
    elizaLogger,
} from '@elizaos/core';
import { defaultCharacter } from './characters/default';

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

type Optional<T> = T | undefined;

const initializeDatabase = () => {
    elizaLogger.info('Initializing PostgreSQL connection...');

    const postgresUrl = process.env.POSTGRES_URL;

    if (!postgresUrl) {
        throw new Error('POSTGRES_URL environment variable is not set');
    }

    const db = new PostgresDatabaseAdapter({
        connectionString: process.env.POSTGRES_URL,
        parseInputs: true,
    });

    db.init()
        .then(() => {
            elizaLogger.success('Successfully connected to PostgreSQL database');
        })
        .catch((error) => {
            elizaLogger.error('Failed to connect to PostgreSQL:', error);
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

const startAgent = async (character: Character, directClient: DirectClient) => {
    let db: Optional<PostgresDatabaseAdapter>;

    try {
        const token = process.env.OPENAI_API_KEY;

        if (!token) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }

        db = initializeDatabase();

        await db.init();

        const cache = initializeCache(character);

        const runtime: AgentRuntime = await createAgent(character, db, cache, token);

        await runtime.initialize();

        directClient.registerAgent(runtime);

        elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

        return runtime;
    } catch (error) {
        elizaLogger.error(`Error starting agent for character ${character.name}:`, error);
        elizaLogger.error(error);

        if (db) {
            await db.close();
        }

        throw error;
    }
};

const startAgents = async () => {
    const directClient = new DirectClient();
    const characters: Character[] = [defaultCharacter];

    try {
        for (const character of characters) {
            await startAgent(character, directClient);
        }
    } catch (error) {
        elizaLogger.error('Error starting agents:', error);
    }

    directClient.startAgent = async (character: Character) => {
        return startAgent(character, directClient);
    };

    directClient.start(3000);

    elizaLogger.log('iAgent up & running');
};

startAgents().catch((error) => {
    elizaLogger.error('Unhandled error in startAgents:', error);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('uncaughtException', err);
});

process.on('unhandledRejection', (err) => {
    console.error('unhandledRejection', err);
});
