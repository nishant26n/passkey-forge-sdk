import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
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

import * as browser from "@simplewebauthn/browser";
import { PasskeyButton } from "./PasskeyButton";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(browser.browserSupportsWebAuthn).mockReturnValue(true);
});

describe("PasskeyButton", () => {
  it("renders an unsupported state with no accessibility violations", async () => {
    vi.mocked(browser.browserSupportsWebAuthn).mockReturnValue(false);
    const { container } = render(
      <PasskeyButton action="register" name="Work laptop" />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
    expect(
      screen.getAllByText("Passkeys aren't supported in this browser.")
        .length,
    ).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders an error state, linked via aria-describedby, with no accessibility violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: "Something went wrong" }, { status: 500 }),
      ),
    );
    const { container } = render(<PasskeyButton action="register" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByText("Something went wrong")).toBeInTheDocument(),
    );

    const button = screen.getByRole("button");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Something went wrong",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders a success state after registration completes, with no accessibility violations", async () => {
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

    const { container } = render(<PasskeyButton action="register" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getAllByText("Passkey added.").length).toBeGreaterThan(0),
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("returns focus to the button after a cancelled ceremony", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ challenge: "abc" })),
    );
    const { WebAuthnError } = await import("@simplewebauthn/browser");
    vi.mocked(browser.startRegistration).mockRejectedValue(
      new WebAuthnError({
        message: "cancelled",
        code: "ERROR_CEREMONY_ABORTED",
        cause: new Error("cancelled"),
      }),
    );

    render(<PasskeyButton action="register" />);
    const user = userEvent.setup();
    const button = screen.getByRole("button");

    await user.click(button);
    await waitFor(() => expect(button).toHaveFocus());
  });
});
