import { PasskeyError } from "./types";

/**
 * POSTs JSON and returns the parsed body. Throws a PasskeyError carrying the
 * server's own `{ error }` message (matching the convention most WebAuthn
 * backends already use) when the response isn't ok, and a distinct
 * `network_error` when the request never reached the server at all.
 */
export async function postJson(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      body: JSON.stringify(body),
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
