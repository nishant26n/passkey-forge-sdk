import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

// jsdom has no <canvas> support, which qrcode's toDataURL needs — stub it
// so tests exercise the component's own logic, not the QR-rendering library.
vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub"),
}));

import { TotpEnrollment } from "./TotpEnrollment";

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

describe("TotpEnrollment", () => {
  it("renders the idle Set-up state with no accessibility violations", async () => {
    const { container } = render(<TotpEnrollment />);
    expect(
      screen.getByRole("button", { name: "Set up authenticator app" }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders a QR code and code input after setup succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ uri: "otpauth://totp/x" })),
    );
    render(<TotpEnrollment />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Set up authenticator app" }),
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText("Enter the 6-digit code"),
      ).toBeInTheDocument(),
    );
    expect(
      await screen.findByAltText(
        "Scan this QR code with your authenticator app",
      ),
    ).toBeInTheDocument();
  });

  it("renders an enrolled success state with no accessibility violations", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ uri: "otpauth://totp/x" }))
        .mockResolvedValueOnce(
          jsonResponse({ verified: true, totpEnabled: true }),
        ),
    );
    const { container } = render(<TotpEnrollment />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Set up authenticator app" }),
    );
    const input = await screen.findByLabelText("Enter the 6-digit code");
    await user.type(input, "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(
        screen.getAllByText("Authenticator app enrolled.").length,
      ).toBeGreaterThan(0),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders a bad-code error linked via aria-describedby", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ uri: "otpauth://totp/x" }))
        .mockResolvedValueOnce(
          jsonResponse({ error: "Invalid authentication code" }, { status: 400 }),
        ),
    );
    const { container } = render(<TotpEnrollment />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Set up authenticator app" }),
    );
    const input = await screen.findByLabelText("Enter the 6-digit code");
    await user.type(input, "000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(screen.getByText("Invalid authentication code")).toBeInTheDocument(),
    );
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
});
