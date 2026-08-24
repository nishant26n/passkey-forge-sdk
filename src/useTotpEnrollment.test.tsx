import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTotpEnrollment } from "./useTotpEnrollment";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTotpEnrollment", () => {
  it("setup() stores the returned uri", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ uri: "otpauth://totp/x" })),
    );
    const { result } = renderHook(() => useTotpEnrollment());

    await act(async () => {
      await result.current.setup();
    });

    expect(result.current.uri).toBe("otpauth://totp/x");
    expect(result.current.status).toBe("idle");
  });

  it("verify() sets enrolled from the response's totpEnabled field", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ verified: true, totpEnabled: true })),
    );
    const { result } = renderHook(() => useTotpEnrollment());

    await act(async () => {
      await result.current.verify("123456");
    });

    expect(result.current.enrolled).toBe(true);
  });

  it("surfaces a bad-code error without touching uri/enrolled", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ uri: "otpauth://totp/x" }))
        .mockResolvedValueOnce(
          jsonResponse({ error: "Invalid authentication code" }, { status: 400 }),
        ),
    );
    const { result } = renderHook(() => useTotpEnrollment());

    await act(async () => {
      await result.current.setup();
    });
    await act(async () => {
      await result.current.verify("000000").catch(() => {});
    });

    expect(result.current.error?.message).toBe("Invalid authentication code");
    expect(result.current.enrolled).toBe(false);
    expect(result.current.uri).toBe("otpauth://totp/x");
    expect(result.current.status).toBe("error");
  });

  it("reset() clears uri, enrolled, and error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ uri: "otpauth://totp/x" })),
    );
    const { result } = renderHook(() => useTotpEnrollment());

    await act(async () => {
      await result.current.setup();
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.uri).toBeNull();
    expect(result.current.enrolled).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});
