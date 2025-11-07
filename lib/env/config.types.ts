export interface DemoEnvVarStatus {
  readonly name: string;
  readonly configured: boolean;
  readonly description: string;
}

export interface DemoPlanConfigDto {
  readonly code: string;
  readonly name: string;
  readonly priceUsd: number;
  readonly interval: string;
  readonly itemId: string;
}

export interface DemoLinkingConfigDto {
  readonly apiBaseUrl: string;
  readonly hasServerApiKey: boolean;
  readonly hasGameId: boolean;
}

export interface DemoEnvironmentSummaryDto {
  readonly plan: DemoPlanConfigDto | null;
  readonly required: readonly DemoEnvVarStatus[];
  readonly optional: readonly DemoEnvVarStatus[];
  readonly warnings: readonly string[];
  readonly linking: DemoLinkingConfigDto;
}
