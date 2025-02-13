import http from 'node:http';
import { PostgresDatabaseAdapter as Postgres } from '@elizaos/adapter-postgres';
import {
    AgentRuntime,
    CacheManager,
    type Character,
    DbCacheAdapter,
    type ICacheManager,
    type IDatabaseAdapter,
    elizaLogger,
} from '@elizaos/core';
import { GitHubClient } from '@repo/client-github';
import { defaultCharacter } from './characters/default';
import { type AgentSettings, loadSettings } from './settings';

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

const initializeDatabase = async (
    url: string,
    character: Character,
): Promise<[Postgres, CacheManager]> => {
    elizaLogger.info('Initializing PostgreSQL connection...');

    const db = new Postgres({
        connectionString: url,
        parseInputs: true,
    });

    await db
        .init()
        .then(() => {
            elizaLogger.success('Successfully connected to PostgreSQL database');
        })
        .catch((error) => {
            elizaLogger.error('Failed to connect to PostgreSQL:', error);
        });

    elizaLogger.info('Using Database Cache...');

    if (!character?.id) {
        throw new Error('Postgres Cache requires id to be set in character definition');
    }

    const cache = new CacheManager(new DbCacheAdapter(db, character.id));

    return [db, cache];
};

const startRuntime = async (
    db: Postgres,
    cache: CacheManager,
    token: string,
    character: Character,
    githubClient: GitHubClient,
) => {
    const runtime: AgentRuntime = await createAgent(character, db, cache, token);

    await runtime.initialize();

    githubClient.registerAgent(runtime);

    return runtime;
};

const startAgent = async (
    settings: AgentSettings,
    character: Character,
    githubClient: GitHubClient,
) => {
    const [db, cache] = await initializeDatabase(settings.POSTGRES_URL, character);

    return startRuntime(db, cache, settings.OPENAI_TOKEN, character, githubClient).catch(
        (error) => {
            db.close();
            throw error;
        },
    );
};

const startAgents = async () => {
    const settings = await loadSettings();

    const githubClient = new GitHubClient(
        settings.GITHUB_APP_ID,
        settings.GITHUB_APP_KEY,
        settings.GITHUB_WEBHOOK_SECRET,
    );

    const characters: Character[] = [defaultCharacter];

    for (const character of characters) {
        await startAgent(settings, character, githubClient)
            .then((runtime) => {
                elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);
            })
            .catch((error) => {
                elizaLogger.error(`Error starting Character ${character.name}:`, error);
            });
    }

    const middleware = githubClient.createMiddleware();

    http.createServer(middleware).listen(3000, () => {
        elizaLogger.log('iAgent up & running');
    });
};

startAgents().catch(() => process.exit(1));

process.on('uncaughtException', (err) => {
    console.error('uncaughtException', err);
});

process.on('unhandledRejection', (err) => {
    console.error('unhandledRejection', err);
});
