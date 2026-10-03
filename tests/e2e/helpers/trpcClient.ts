import { APIRequestContext } from "@playwright/test";

/** Standard tRPC (no transformer) HTTP envelope. */
export interface TrpcEnvelope<T> {
  result?: { data?: T };
  error?: { message: string; code: number; data?: { code?: string; httpStatus?: number; path?: string } };
}

export interface TrpcResponse<T> {
  status: number;
  body: TrpcEnvelope<T> | null;
  data: T | undefined;
  errorCode: string | undefined;
  errorMessage: string | undefined;
}

/**
 * Minimal tRPC-over-HTTP client for the real-backend suite.
 * Authenticates with raw Telegram initData in the Authorization header,
 * exactly like the mini-app (mini-app/src/app/_trpc/Provider.tsx).
 */
export class TRPCClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string,
    private readonly authorization: string | null
  ) {}

  async query<T>(path: string, input?: unknown): Promise<TrpcResponse<T>> {
    const url = new URL(`${this.baseURL}/api/trpc/${path}`);
    if (input !== undefined) url.searchParams.set("input", JSON.stringify(input));
    const response = await this.request.get(url.toString(), { headers: this.headers() });
    return this.parse<T>(response.status(), await response.text());
  }

  async mutation<T>(path: string, input?: unknown): Promise<TrpcResponse<T>> {
    const response = await this.request.post(`${this.baseURL}/api/trpc/${path}`, {
      headers: { ...this.headers(), "Content-Type": "application/json" },
      data: input === undefined ? {} : input,
    });
    return this.parse<T>(response.status(), await response.text());
  }

  private headers(): Record<string, string> {
    return this.authorization ? { Authorization: this.authorization } : {};
  }

  private parse<T>(status: number, text: string): TrpcResponse<T> {
    let body: TrpcEnvelope<T> | null = null;
    try {
      body = JSON.parse(text) as TrpcEnvelope<T>;
    } catch {
      body = null;
    }
    return {
      status,
      body,
      data: body?.result?.data,
      errorCode: body?.error?.data?.code,
      errorMessage: body?.error?.message,
    };
  }
}
