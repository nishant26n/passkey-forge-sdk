import { PasskeyError } from "./types";

/**
 * Shared fetch+parse+error-mapping logic behind postJson/getJson/deleteJson.
 * Throws a PasskeyError carrying the server's own `{ error }` message
 * (matching the convention most WebAuthn backends already use) when the
 * response isn't ok, and a distinct `network_error` when the request never
 * reached the server at all (including AbortController cancellation).
 */
async function requestJson(
  method: "GET" | "POST" | "DELETE",
  url: string,
  body: unknown | undefined,
  init?: RequestInit,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      ...init,
      headers:
        body === undefined
          ? init?.headers
          : {
              "Content-Type": "application/json",
              ...init?.headers,
            },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PasskeyError(
      "Network error. Check your connection and try again.",
      "network_error",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Something went wrong. Try again.";
    throw new PasskeyError(message, "server_error", response.status);
  }

  return data;
}

/** POSTs JSON and returns the parsed body. */
export async function postJson(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<unknown> {
  return requestJson("POST", url, body, init);
}

/** GETs and returns the parsed JSON body. */
export async function getJson(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  return requestJson("GET", url, undefined, init);
}

/** DELETEs and returns the parsed JSON body. */
export async function deleteJson(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  return requestJson("DELETE", url, undefined, init);
}
