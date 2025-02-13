import { elizaLogger, settings } from '@elizaos/core';
import { z } from 'zod';

export const settingsSchema = z.object({
    POSTGRES_URL: z.string().min(1, 'Postgres URL is required'),
    OPENAI_TOKEN: z.string().min(1, 'OpenAI Token is required'),
    GITHUB_APP_ID: z.string().min(1, 'Github App ID is required'),
    GITHUB_APP_KEY: z.string().min(1, 'Github Secret Key is required'),
    GITHUB_WEBHOOK_SECRET: z.string().min(1, 'Github Webhook Secret is required'),
});

export type AgentSettings = z.infer<typeof settingsSchema>;

export async function loadSettings(): Promise<AgentSettings> {
    const config = {
        POSTGRES_URL: settings.POSTGRES_URL,
        OPENAI_TOKEN: settings.OPENAI_TOKEN,
        GITHUB_APP_ID: settings.GITHUB_APP_ID,
        GITHUB_APP_KEY: settings.GITHUB_APP_KEY,
        GITHUB_WEBHOOK_SECRET: settings.GITHUB_WEBHOOK_SECRET,
    };

    return settingsSchema.parseAsync(config).catch(handleError);
}

const handleError = (error: Error) => {
    if (error instanceof z.ZodError) {
        const errorMessages = error.errors
            .map((err) => `-> ${err.path.join('.')}: ${err.message}`)
            .join('\n');

        const message = `Settings validation failed:\n${errorMessages}`;

        elizaLogger.error(message);

        throw new Error(message);
    }

    elizaLogger.error(`Failed to load Settings: ${error}`);

    throw error;
};
