import { env } from "@/lib/env";

export type AzureOidcConfig = {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  redirectUri: string;
  authorizationUrl?: string;
};

export function getAzureOidcConfig(): AzureOidcConfig {
  const issuer =
    env.AZURE_AD_ISSUER ||
    (env.AZURE_AD_TENANT_ID
      ? `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/v2.0`
      : undefined);
  return {
    enabled: Boolean(issuer && env.AZURE_AD_CLIENT_ID),
    issuer,
    clientId: env.AZURE_AD_CLIENT_ID,
    redirectUri: `${env.APP_BASE_URL}/api/auth/azure/callback`,
    authorizationUrl: issuer
      ? `${issuer}/oauth2/v2.0/authorize`
      : undefined,
  };
}

export function assertAzureReadyForProduction() {
  if (env.AUTH_MODE === "azure" && !getAzureOidcConfig().enabled) {
    throw new Error("AUTH_MODE=azure requires AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID and client secret.");
  }
}
