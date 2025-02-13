import fs from 'node:fs';
import { type AgentRuntime, elizaLogger } from '@elizaos/core';
import { App } from '@octokit/app';
import { createNodeMiddleware } from '@octokit/webhooks';

export class GitHubClient {
    private agents: Map<string, AgentRuntime>;
    private app: App;

    constructor(appId: string, keyPath: string, webhookSecret: string) {
        this.agents = new Map();

        const privateKey = fs.readFileSync(keyPath, 'utf8');

        this.app = new App({
            appId,
            privateKey,
            webhooks: {
                secret: webhookSecret,
            },
        });

        this.app.webhooks.on('issues.opened', this.handleOpenIssue);

        this.app.webhooks.onError((error) => {
            elizaLogger.error('Error processing the Github Webhook:', error);
        });
    }

    private handleOpenIssue({ id, name, payload }: { id: string; name: string; payload: object }) {
        elizaLogger.info(id, name, payload);
    }

    public registerAgent(runtime: AgentRuntime) {
        this.agents.set(runtime.agentId, runtime);
    }

    public unregisterAgent(runtime: AgentRuntime) {
        this.agents.delete(runtime.agentId);
    }

    public createMiddleware() {
        return createNodeMiddleware(this.app.webhooks, { path: '/api/webhook' });
    }
}
