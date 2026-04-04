import { AUTH_TOKEN_KEY, AUTH_SESSION_KEY } from "./constants";
import type { LoginResponse, User, Client } from "@/app/login/type";

/**
 * Retrieves the full session object from localStorage.
 */
export function getStoredSession(): LoginResponse | null {
  if (typeof window === "undefined") return null;
  
  const sessionString = localStorage.getItem(AUTH_SESSION_KEY);
  if (!sessionString) return null;

  try {
    return JSON.parse(sessionString) as LoginResponse;
  } catch (error) {
    console.error("Failed to parse auth session from localStorage", error);
    return null;
  }
}

/**
 * Retrieves only the user details from the stored session.
 */
export function getStoredUser(): User | null {
  const session = getStoredSession();
  return session ? session.user : null;
}

/**
 * Retrieves only the client details from the stored session.
 */
export function getStoredClient(): Client | null {
  const session = getStoredSession();
  return session ? session.client : null;
}

/**
 * Retrieves the stored auth token.
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Clears the session and token from localStorage.
 */
export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
