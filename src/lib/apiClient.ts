import { sessionStore } from "@/lib/auth/sessionStore";
import { LocalApiError, localRequest } from "@/lib/localApi";

/**
 * The one door every service goes through. There is no server: a request is answered by the local data layer in src/lib/localApi, from the
 * data kept in this browser, and nothing is sent over the network. The shape (`apiClient.get("/items", { params })` answering `{ data }`) is
 * unchanged, so the services and screens did not have to change.
 */
type Options = { params?: Record<string, unknown> };

const answer = async <T>(promise: Promise<{ data: T }>) => {
  try {
    return await promise;
  } catch (err) {
    // The signed-in account is gone (deleted, or the saved login is stale): drop the login so the app returns to the sign-in page.
    if (err instanceof LocalApiError && err.status === 401) sessionStore.write(null);
    throw err;
  }
};

export const apiClient = {
  get: <T = unknown>(url: string, options?: Options) => answer(localRequest<T>("GET", url, { params: options?.params })),
  post: <T = unknown>(url: string, data?: unknown) => answer(localRequest<T>("POST", url, { data })),
  patch: <T = unknown>(url: string, data?: unknown) => answer(localRequest<T>("PATCH", url, { data })),
  delete: <T = unknown>(url: string) => answer(localRequest<T>("DELETE", url)),
};

/** Human-readable message for a failed request. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong";
}

/** The HTTP-style status of a failed request (400, 401, 403, 404, 409, 429, ...), when it has one. */
export function getErrorStatus(err: unknown): number | undefined {
  return err instanceof LocalApiError ? err.status : undefined;
}

/** A short reason the screens react to: "sprint_running" and "duplicate" for a 409, "sprint_closed" for a change to a closed sprint. */
export function getErrorCode(err: unknown): string | undefined {
  const status = getErrorStatus(err);
  const message = getErrorMessage(err);
  if (status === 409) return /running/i.test(message) ? "sprint_running" : "duplicate";
  if ((status === 400 || status === 403) && /closed|read-only|read only/i.test(message)) return "sprint_closed";
  return undefined;
}
