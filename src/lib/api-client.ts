/** Error returned by our API: `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** JSON fetch against our own API. Throws ApiError for non-2xx responses. */
export async function api<T>(
  path: string,
  { method = "GET", body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network", "You appear to be offline. Check your connection.");
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code ?? "error",
      data?.error?.message ?? "Something went wrong. Please try again.",
    );
  }
  return data as T;
}
