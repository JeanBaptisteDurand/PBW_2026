import type { ZodTypeAny, z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface HttpClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: () => Record<string, string>;
  sign?: (body: string | undefined) => Record<string, string>;
}

export class ServiceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ServiceHttpError";
  }
}

export function createHttpClient(opts: HttpClientOptions) {
  const fetchImpl = opts.fetch ?? fetch;

  async function call<TResp extends ZodTypeAny>(
    method: HttpMethod,
    path: string,
    body: unknown,
    responseSchema: TResp,
  ): Promise<z.infer<TResp>> {
    const url = `${opts.baseUrl.replace(/\/$/, "")}${path}`;
    const bodyStr = body === undefined ? undefined : JSON.stringify(body);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(opts.headers ? opts.headers() : {}),
      ...(opts.sign ? opts.sign(bodyStr) : {}),
    };
    const res = await fetchImpl(url, { method, headers, body: bodyStr });
    const text = await res.text();
    const parsed = text.length > 0 ? JSON.parse(text) : undefined;
    if (!res.ok) {
      throw new ServiceHttpError(`${method} ${url} failed with ${res.status}`, res.status, parsed);
    }
    const result = responseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Response schema mismatch for ${path}: ${result.error.message}`);
    }
    return result.data;
  }

  return {
    get: <TResp extends ZodTypeAny>(path: string, schema: TResp) =>
      call("GET", path, undefined, schema),
    post: <TResp extends ZodTypeAny>(path: string, body: unknown, schema: TResp) =>
      call("POST", path, body, schema),
    put: <TResp extends ZodTypeAny>(path: string, body: unknown, schema: TResp) =>
      call("PUT", path, body, schema),
    delete: <TResp extends ZodTypeAny>(path: string, schema: TResp) =>
      call("DELETE", path, undefined, schema),
    patch: <TResp extends ZodTypeAny>(path: string, body: unknown, schema: TResp) =>
      call("PATCH", path, body, schema),
  };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
