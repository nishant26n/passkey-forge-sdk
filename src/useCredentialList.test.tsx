import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCredentialList } from "./useCredentialList";

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

const RAW_CREDENTIALS = [
  {
    id: "1",
    credentialID: "cred-1",
    aaguid: null,
    name: "Work laptop",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: null,
    transports: JSON.stringify(["internal", "hybrid"]),
  },
  {
    id: "2",
    credentialID: "cred-2",
    aaguid: null,
    name: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    lastUsedAt: null,
    transports: null,
  },
];

describe("useCredentialList", () => {
  it("fetches on mount and normalizes the JSON-string-encoded transports field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ credentials: RAW_CREDENTIALS })),
    );

    const { result } = renderHook(() => useCredentialList());

    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.credentials).toEqual([
      expect.objectContaining({ id: "1", transports: ["internal", "hybrid"] }),
      expect.objectContaining({ id: "2", transports: [] }),
    ]);
  });

  it("does not fetch on mount when autoFetch is false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ credentials: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useCredentialList({ autoFetch: false }));

    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tracks revocation per-credential-id, not as a single shared flag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ credentials: RAW_CREDENTIALS })),
    );
    const { result } = renderHook(() => useCredentialList());
    await waitFor(() => expect(result.current.status).toBe("success"));

    let resolveDelete!: () => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveDelete = () => resolve(jsonResponse({ revoked: true }));
        }),
      ),
    );

    let revokePromise: Promise<void>;
    act(() => {
      revokePromise = result.current.revoke("1");
    });

    await waitFor(() => expect(result.current.revokingIds).toEqual(["1"]));
    // Credential "2" is untouched while only "1" is revoking.
    expect(result.current.credentials?.map((c) => c.id)).toEqual(["1", "2"]);

    await act(async () => {
      resolveDelete();
      await revokePromise;
    });

    expect(result.current.revokingIds).toEqual([]);
    expect(result.current.credentials?.map((c) => c.id)).toEqual(["2"]);
  });

  it("leaves the list untouched and surfaces an error when revoke fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ credentials: RAW_CREDENTIALS })),
    );
    const { result } = renderHook(() => useCredentialList());
    await waitFor(() => expect(result.current.status).toBe("success"));

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: "You cannot revoke your only authentication method" }, { status: 400 }),
        ),
    );

    await act(async () => {
      await result.current.revoke("1");
    });

    expect(result.current.credentials?.map((c) => c.id)).toEqual(["1", "2"]);
    expect(result.current.error?.message).toBe(
      "You cannot revoke your only authentication method",
    );
    expect(result.current.revokingIds).toEqual([]);
  });
});
