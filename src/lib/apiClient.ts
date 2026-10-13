import axios, { isAxiosError } from "axios";
import { sessionStore } from "@/lib/auth/sessionStore";

// The one place the backend address comes from (see .env.example). Every service goes through `apiClient`.
const baseURL = process.env.NEXT_PUBLIC_API_URL;

if (!baseURL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set. Add it to .env (see .env.example).");
}

// Passwords travel in request bodies (sign-in, create user, change / reset password), so outside local development
// the address must be https://.
if (process.env.NODE_ENV === "production" && baseURL.startsWith("http://")) {
  console.warn("NEXT_PUBLIC_API_URL uses http://. Use https:// in production so passwords are encrypted in transit.");
}

/** The single Axios instance every service uses. It sends the saved access token with each request. */
export const apiClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStore.read()?.token;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

// Sign-in calls answer 401 for "wrong code / password"; those are shown on the login screen, not treated as an expired login.
const isSignIn = (url?: string) => !!url && url.includes("/auth/sign-in");

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401 && !isSignIn(error.config?.url)) {
      // The token expired or the account was removed: drop the login so the app returns to the sign-in page.
      sessionStore.write(null);
    }
    return Promise.reject(error);
  },
);

type ApiErrorBody = { message?: string | string[]; error?: string; statusCode?: number };

/** Human-readable message for a failed request: the server's `message` (joined if it is a list), else a fallback. */
export function getErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const message = (err.response?.data as ApiErrorBody | undefined)?.message;
    if (Array.isArray(message) && message.length) return message.join(". ");
    if (typeof message === "string" && message) return message;
    if (!err.response) return "Can't reach the server. Check your connection and try again.";
    return `Request failed (${err.response.status})`;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

/** HTTP status of a failed request, if there was a response. */
export function getErrorStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}

/**
 * A short reason the screens react to. The backend sends a status and a message (no machine code), so it is worked
 * out from those: "sprint_running" and "duplicate" for a 409, "sprint_closed" for a change to a closed sprint.
 */
export function getErrorCode(err: unknown): string | undefined {
  const status = getErrorStatus(err);
  const message = getErrorMessage(err);
  if (status === 409) return /running/i.test(message) ? "sprint_running" : "duplicate";
  if ((status === 400 || status === 409) && /closed|read-only|read only/i.test(message)) return "sprint_closed";
  return undefined;
}
