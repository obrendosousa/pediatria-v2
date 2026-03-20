type EvolutionMethod = 'POST' | 'GET' | 'DELETE' | 'PUT' | 'PATCH';

export interface EvolutionConfig {
  baseUrl: string;
  instance: string;
  apiKey: string;
}

export function getEvolutionConfig(instanceEnvKey: string = 'EVOLUTION_INSTANCE'): EvolutionConfig {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const instance = process.env[instanceEnvKey];

  // Procura API key específica da instância, ex: EVOLUTION_ATENDIMENTO_API_KEY
  // Fallback para EVOLUTION_API_KEY (chave global)
  const instanceApiKeyEnv = instanceEnvKey.replace(/_INSTANCE$/, '_API_KEY');
  const apiKey = process.env[instanceApiKeyEnv] || process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !instance || !apiKey) {
    throw new Error(
      `Evolution API não configurada (EVOLUTION_API_URL, ${instanceEnvKey}, ${instanceApiKeyEnv} ou EVOLUTION_API_KEY)`
    );
  }

  return { baseUrl, instance, apiKey };
}

export function buildEvolutionEndpoint(pathTemplate: string, config?: EvolutionConfig): string {
  const cfg = config ?? getEvolutionConfig();
  const cleanPath = pathTemplate.startsWith('/') ? pathTemplate : `/${pathTemplate}`;
  const encodedInstance = encodeURIComponent(cfg.instance);
  return `${cfg.baseUrl}${cleanPath.replace('{instance}', encodedInstance)}`;
}

interface EvolutionRequestOptions {
  method?: EvolutionMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function evolutionRequest<T = unknown>(
  pathTemplate: string,
  options: EvolutionRequestOptions = {}
): Promise<{ ok: boolean; status: number; data: T | Record<string, unknown> | string | null }> {
  const cfg = getEvolutionConfig();
  const endpoint = buildEvolutionEndpoint(pathTemplate, cfg);

  const res = await fetch(endpoint, {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.apiKey,
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(30_000),
  });

  const contentType = res.headers.get('content-type') ?? '';
  let data: T | Record<string, unknown> | string | null = null;
  if (contentType.includes('application/json')) {
    data = (await res.json().catch(() => ({} as Record<string, unknown>))) as
      | T
      | Record<string, unknown>;
  } else {
    data = await res.text().catch(() => '');
  }

  return { ok: res.ok, status: res.status, data };
}
