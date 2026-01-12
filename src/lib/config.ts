export interface Env {
  ALLOWED_ORIGINS?: string;
  TRUSTED_HOSTS?: string;
}

export interface ProxyConfig {
  allowedOrigins: string[];
  proxyBaseUrl: string;
  maxContentLength: number;
  trustedHosts?: string[];
}

const DEFAULT_CONFIG: Partial<ProxyConfig> = {
  maxContentLength: 5 * 1024 * 1024 * 1024, // 5GB
};

export function parseConfig(env: Env, requestUrl: URL): ProxyConfig {
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim()
  ) || ["*"];

  const trustedHosts = env.TRUSTED_HOSTS?.split(",").map((h) => h.trim());

  return {
    ...DEFAULT_CONFIG,
    allowedOrigins,
    proxyBaseUrl: requestUrl.origin,
    maxContentLength: DEFAULT_CONFIG.maxContentLength!,
    trustedHosts,
  };
}
