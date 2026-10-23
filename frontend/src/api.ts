export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export const SESSION_CHANGED = "animetrack:session-changed";
export const SESSION_EXPIRED = "animetrack:session-expired";
let csrfRequest: Promise<string> | null = null;
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("animetrack-session");
channel?.addEventListener("message", () => {
  resetCsrf();
  window.dispatchEvent(new Event(SESSION_CHANGED));
});
if (import.meta.hot) import.meta.hot.dispose(() => channel?.close());
export function announceSessionChange() {
  channel?.postMessage("changed");
}
export function resetCsrf() {
  csrfRequest = null;
}

async function fetchResponse(path: string, options: RequestInit = {}) {
  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  try {
    return await fetch(`/api${path}`, { ...options, signal });
  } catch {
    if (timeout.aborted)
      throw new ApiError("The request timed out. Please try again.", 0);
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0,
    );
  }
}
async function getCsrf() {
  if (!csrfRequest) {
    csrfRequest = (async () => {
      const response = await fetchResponse("/auth/csrf");
      if (!response.ok)
        throw new ApiError(
          "Could not establish a secure session. Please try again.",
          response.status,
        );
      const data = (await response.json()) as { token: string };
      return data.token;
    })().catch((error) => {
      resetCsrf();
      throw error;
    });
  }
  return csrfRequest;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retryCsrf = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method.toUpperCase()))
    headers.set("X-CSRF-TOKEN", await getCsrf());
  const response = await fetchResponse(path, { ...options, headers });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      detail?: string;
      code?: string;
    } | null;
    if (response.status === 400 && problem?.code === "csrf" && retryCsrf) {
      resetCsrf();
      return api<T>(path, options, false);
    }
    if (response.status === 401) {
      resetCsrf();
      if (!path.startsWith("/auth/"))
        window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
    throw new ApiError(
      problem?.detail ??
        (response.status === 401
          ? "Your session has expired. Sign in again to continue."
          : "Something went wrong. Please try again."),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      "The server returned an unexpected response. Please try again.",
      502,
    );
  }
}
