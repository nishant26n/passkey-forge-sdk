import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteJson, getJson, postJson } from "./request";
import { PasskeyError } from "./types";

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

describe("postJson", () => {
  it("returns the parsed body on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await postJson("/api/x", { a: 1 });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ a: 1 }),
      }),
    );
  });

  it("throws a network_error PasskeyError when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(postJson("/api/x", {})).rejects.toMatchObject({
      code: "network_error",
    });
  });

  it("throws a server_error PasskeyError carrying the server's message and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: "Bad request" }, { status: 400 }),
      ),
    );

    await expect(postJson("/api/x", {})).rejects.toMatchObject({
      code: "server_error",
      message: "Bad request",
      status: 400,
    });
  });

  it("falls back to a generic message when the error response has no {error} string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 })),
    );

    await expect(postJson("/api/x", {})).rejects.toBeInstanceOf(PasskeyError);
    await expect(postJson("/api/x", {})).rejects.toMatchObject({
      message: "Something went wrong. Try again.",
    });
  });
});

describe("getJson", () => {
  it("sends a GET with no body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getJson("/api/list");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });
});

describe("deleteJson", () => {
  it("sends a DELETE with no body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ revoked: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteJson("/api/list/1");

    expect(result).toEqual({ revoked: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});
