import 'server-only';

import { REQUIRED_ENV_VARS, OPTIONAL_ENV_VARS, DEFAULT_ONCADE_API_BASE_URL } from '../constants';
import type {
  DemoEnvironmentSummaryDto,
  DemoEnvVarStatus,
  DemoLinkingConfigDto,
  DemoPlanConfigDto,
} from './config.types';
import { getPlanFetchWarning, resolveDemoPlanConfig } from './planConfig.server';

const ENV_DESCRIPTIONS: Record<string, string> = {
  DEMO_PLAN_ITEM_ID: 'Purchase item identifier used when redirecting to the Oncade store checkout.',
  DEMO_WEBHOOK_SECRET: 'Secret phrase required to validate webhook requests in the demo.',
  DEMO_SERVER_API_KEY: 'Oncade server API key used when initiating real account linking sessions.',
  DEMO_GAME_ID: 'Game identifier associated with the server API key.',
  DEMO_API_BASE_URL: 'Optional: override for the Oncade API base URL (defaults to sandbox).',
};

function mapEnvVar(name: string): DemoEnvVarStatus {
  const value = process.env[name]?.trim();
  return {
    name,
    configured: Boolean(value),
    description: ENV_DESCRIPTIONS[name] ?? 'Environment configuration value',
  };
}

function buildLinkingConfig(): DemoLinkingConfigDto {
  const apiBaseUrl = process.env.DEMO_API_BASE_URL?.trim() || DEFAULT_ONCADE_API_BASE_URL;
  const hasServerApiKey = Boolean(process.env.DEMO_SERVER_API_KEY?.trim());
  const hasGameId = Boolean(process.env.DEMO_GAME_ID?.trim());

  return {
    apiBaseUrl,
    hasServerApiKey,
    hasGameId,
  };
}

export async function getDemoEnvironmentSummary(): Promise<DemoEnvironmentSummaryDto> {
  const required = REQUIRED_ENV_VARS.map(mapEnvVar);
  const optional = OPTIONAL_ENV_VARS.map(mapEnvVar);

  const warnings: string[] = [];
  const linking = buildLinkingConfig();

  if (!required.find((envVar) => envVar.name === 'DEMO_WEBHOOK_SECRET')?.configured) {
    warnings.push('Webhook secret is not configured. Webhook signature validation will fail.');
  }
  if (!linking.hasServerApiKey) {
    warnings.push('Server API key is missing. Plan details and account linking requests will fail.');
  }
  if (!linking.hasGameId) {
    warnings.push('Game identifier is missing. Plan details and account linking requests will fail.');
  }
  if (!required.find((envVar) => envVar.name === 'DEMO_PLAN_ITEM_ID')?.configured) {
    warnings.push('Plan checkout item identifier is missing. Subscription checkout redirect will fail.');
  }

  let plan: DemoPlanConfigDto | null = null;
  if (linking.hasServerApiKey && linking.hasGameId) {
    plan = await resolveDemoPlanConfig({ forceRefresh: true });
    const planWarning = getPlanFetchWarning();
    if (planWarning) {
      warnings.push(planWarning);
    }
  }

  return {
    plan,
    required,
    optional,
    warnings,
    linking,
  };
}

interface OncadeIntegrationConfig {
  readonly apiBaseUrl: string;
  readonly serverApiKey: string;
  readonly gameId: string;
}

export function getOncadeIntegrationConfig(): OncadeIntegrationConfig {
  const serverApiKey = process.env.DEMO_SERVER_API_KEY?.trim();
  const gameId = process.env.DEMO_GAME_ID?.trim();
  if (!serverApiKey) {
    throw new Error('DEMO_SERVER_API_KEY is required to initiate account linking sessions.');
  }
  if (!gameId) {
    throw new Error('DEMO_GAME_ID is required to initiate account linking sessions.');
  }

  const apiBaseUrl = process.env.DEMO_API_BASE_URL?.trim() || DEFAULT_ONCADE_API_BASE_URL;

  return {
    apiBaseUrl,
    serverApiKey,
    gameId,
  };
}
