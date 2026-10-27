import { STORAGE_KEYS } from "@/constants/auth";
import type { Session } from "@/types/auth";
import { createLocalStore } from "./localStore";

/**
 * The login: the access token the backend issued and the user it belongs to. The token is sent with every API
 * request (see lib/apiClient.ts); the backend decides when it stops working, and the app signs out on a 401.
 */
export const sessionStore = createLocalStore<Session | null>(STORAGE_KEYS.session, null);

export const setSession = (session: Session) => sessionStore.write(session);

export const clearSession = () => sessionStore.write(null);
