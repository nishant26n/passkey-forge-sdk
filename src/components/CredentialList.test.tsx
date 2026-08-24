import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CredentialList } from "./CredentialList";

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

describe("CredentialList", () => {
  it("renders an empty state with no accessibility violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ credentials: [] })),
    );
    const { container } = render(<CredentialList />);

    await waitFor(() =>
      expect(screen.getByText("No passkeys yet.")).toBeInTheDocument(),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders a populated list with a per-row Remove button, no accessibility violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          credentials: [
            {
              id: "1",
              credentialID: "cred-1",
              aaguid: null,
              name: "Work laptop",
              createdAt: "2026-01-01",
              lastUsedAt: null,
              transports: null,
            },
          ],
        }),
      ),
    );
    const { container } = render(<CredentialList />);

    await waitFor(() =>
      expect(screen.getByText("Work laptop")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Remove Work laptop" }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders an error state with a Retry button linked via aria-describedby", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: "Failed to load credentials" }, { status: 500 })),
    );
    const { container } = render(<CredentialList />);

    await waitFor(() =>
      expect(screen.getByText("Failed to load credentials")).toBeInTheDocument(),
    );

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry.getAttribute("aria-describedby")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("moves focus to the heading after a revoke removes the focused row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          credentials: [
            {
              id: "1",
              credentialID: "cred-1",
              aaguid: null,
              name: "Work laptop",
              createdAt: "2026-01-01",
              lastUsedAt: null,
              transports: null,
            },
          ],
        }),
      ),
    );
    render(<CredentialList />);
    const user = userEvent.setup();

    const removeButton = await screen.findByRole("button", {
      name: "Remove Work laptop",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ revoked: true })),
    );
    await user.click(removeButton);

    await waitFor(() =>
      expect(screen.getByText("Passkeys")).toHaveFocus(),
    );
  });
});
