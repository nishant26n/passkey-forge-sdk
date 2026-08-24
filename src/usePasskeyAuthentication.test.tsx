import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@simplewebauthn/browser", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@simplewebauthn/browser")>();
  return {
    ...actual,
    browserSupportsWebAuthn: vi.fn(() => true),
    startAuthentication: vi.fn(),
  };
});

import * as browser from "@simplewebauthn/browser";
import { usePasskeyAuthentication } from "./usePasskeyAuthentication";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(browser.startAuthentication).mockReset();
  vi.mocked(browser.browserSupportsWebAuthn).mockReturnValue(true);
});

describe("usePasskeyAuthentication", () => {
  it("posts { email } when logging in with an email", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ challenge: "abc" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(browser.startAuthentication).mockResolvedValue({} as never);

    const { result } = renderHook(() => usePasskeyAuthentication());

    await act(async () => {
      await result.current.start({ email: "you@example.com" });
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ email: "you@example.com" });
  });

  it("posts { usernameless: true } for usernameless login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ challenge: "abc" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(browser.startAuthentication).mockResolvedValue({} as never);

    const { result } = renderHook(() => usePasskeyAuthentication());

    await act(async () => {
      await result.current.start({ usernameless: true });
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ usernameless: true });
  });

  it("goes idle -> pending -> success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ challenge: "abc" }))
        .mockResolvedValueOnce(jsonResponse({ ok: true })),
    );
    vi.mocked(browser.startAuthentication).mockResolvedValue({} as never);

    const { result } = renderHook(() => usePasskeyAuthentication());
    expect(result.current.status).toBe("idle");

    act(() => {
      void result.current.start({ usernameless: true });
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
  });
});
