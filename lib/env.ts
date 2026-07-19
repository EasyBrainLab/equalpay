import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().optional(),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  AUTH_MODE: z.enum(["local", "azure"]).default("local"),
  SESSION_SECRET: z.string().default("dev-session-secret-change-me"),
  FIELD_ENCRYPTION_MASTER_KEY_B64: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_ISSUER: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const isProd = env.NODE_ENV === "production";
