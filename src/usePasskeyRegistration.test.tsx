import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@simplewebauthn/browser", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@simplewebauthn/browser")>();
  return {
    ...actual,
    browserSupportsWebAuthn: vi.fn(() => true),
    startRegistration: vi.fn(),
  };
});

import { WebAuthnAbortService, WebAuthnError } from "@simplewebauthn/browser";
import { usePasskeyRegistration } from "./usePasskeyRegistration";
import * as browser from "@simplewebauthn/browser";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(browser.startRegistration).mockReset();
  vi.mocked(browser.browserSupportsWebAuthn).mockReturnValue(true);
});

describe("usePasskeyRegistration", () => {
  it("goes idle -> pending -> success and carries the verify response as data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ challenge: "abc" }))
        .mockResolvedValueOnce(jsonResponse({ id: "cred-1" })),
    );
    vi.mocked(browser.startRegistration).mockResolvedValue({
      id: "cred-1",
    } as never);

    const { result } = renderHook(() => usePasskeyRegistration());
    expect(result.current.status).toBe("idle");

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.start({ name: "Work laptop" });
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    await expect(promise!).resolves.toEqual({ id: "cred-1" });
    expect(result.current.data).toEqual({ id: "cred-1" });
    expect(result.current.error).toBeNull();
  });

  it("fails fast with an unsupported error when the browser has no WebAuthn support", async () => {
    vi.mocked(browser.browserSupportsWebAuthn).mockReturnValue(false);

    const { result } = renderHook(() => usePasskeyRegistration());

    await act(async () => {
      await expect(result.current.start()).rejects.toMatchObject({
        code: "unsupported",
      });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.code).toBe("unsupported");
  });

  it("maps a cancelled ceremony to a ceremony_cancelled PasskeyError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ challenge: "abc" })),
    );
    const abortError = new WebAuthnError({
      message: "cancelled",
      code: "ERROR_CEREMONY_ABORTED",
      cause: new Error("cancelled"),
    });
    vi.mocked(browser.startRegistration).mockRejectedValue(abortError);

    const { result } = renderHook(() => usePasskeyRegistration());

    await act(async () => {
      await expect(result.current.start()).rejects.toMatchObject({
        code: "ceremony_cancelled",
      });
    });

    expect(result.current.error?.code).toBe("ceremony_cancelled");
  });

  it("reset() clears a finished error state back to idle", async () => {
    vi.mocked(browser.browserSupportsWebAuthn).mockReturnValue(false);
    const { result } = renderHook(() => usePasskeyRegistration());

    await act(async () => {
      await result.current.start().catch(() => {});
    });
    expect(result.current.status).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("cancels any in-flight ceremony via WebAuthnAbortService on unmount", () => {
    const cancelSpy = vi.spyOn(WebAuthnAbortService, "cancelCeremony");
    const { unmount } = renderHook(() => usePasskeyRegistration());

    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
