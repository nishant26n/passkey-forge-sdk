import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@simplewebauthn/browser", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@simplewebauthn/browser")>();
  return {
    ...actual,
    browserSupportsWebAuthn: vi.fn(() => true),
  };
});

import { usePasskey } from "./usePasskey";

function errorResponse(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePasskey", () => {
  it("error reflects whichever of register()/login() failed most recently, not always register()", async () => {
    // Both calls fail at the first (options) request, before any WebAuthn
    // ceremony runs, with distinguishable messages per endpoint.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("register")
            ? errorResponse("register endpoint failed")
            : errorResponse("login endpoint failed"),
        ),
      ),
    );

    const { result } = renderHook(() => usePasskey());

    await act(async () => {
      await result.current.register().catch(() => {});
    });
    expect(result.current.error?.message).toBe("register endpoint failed");

    await act(async () => {
      await result.current.login({ usernameless: true }).catch(() => {});
    });

    // Regression guard: a naive `registration.error ?? authentication.error`
    // wrapper would keep showing register's (now stale) error here, since
    // registration.error is still set. Correct behavior tracks whichever
    // action ran most recently.
    expect(result.current.error?.message).toBe("login endpoint failed");
  });

  it("isRegistering and isLoggingIn are independent flags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse("failed")),
    );
    const { result } = renderHook(() => usePasskey());

    expect(result.current.isRegistering).toBe(false);
    expect(result.current.isLoggingIn).toBe(false);

    await act(async () => {
      await result.current.register().catch(() => {});
    });

    expect(result.current.isRegistering).toBe(false);
    expect(result.current.isLoggingIn).toBe(false);
  });
});
