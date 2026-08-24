import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: vi.fn(),
  browserSupportsWebAuthnAutofill: vi.fn(),
  platformAuthenticatorIsAvailable: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("isPasskeySupported", () => {
  it("mirrors browserSupportsWebAuthn()", async () => {
    const { browserSupportsWebAuthn } = await import("@simplewebauthn/browser");
    const { isPasskeySupported } = await import("./isPasskeySupported");

    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
    expect(isPasskeySupported()).toBe(true);

    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    expect(isPasskeySupported()).toBe(false);
  });
});

describe("getPasskeySupportDetails", () => {
  it("short-circuits to all-false when WebAuthn itself is unsupported", async () => {
    const {
      browserSupportsWebAuthn,
      browserSupportsWebAuthnAutofill,
      platformAuthenticatorIsAvailable,
    } = await import("@simplewebauthn/browser");
    const { getPasskeySupportDetails } = await import("./isPasskeySupported");

    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);

    const details = await getPasskeySupportDetails();

    expect(details).toEqual({
      supported: false,
      conditionalMediation: false,
      platformAuthenticator: false,
    });
    expect(browserSupportsWebAuthnAutofill).not.toHaveBeenCalled();
    expect(platformAuthenticatorIsAvailable).not.toHaveBeenCalled();
  });

  it("reports the richer capabilities when WebAuthn is supported", async () => {
    const {
      browserSupportsWebAuthn,
      browserSupportsWebAuthnAutofill,
      platformAuthenticatorIsAvailable,
    } = await import("@simplewebauthn/browser");
    const { getPasskeySupportDetails } = await import("./isPasskeySupported");

    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
    vi.mocked(browserSupportsWebAuthnAutofill).mockResolvedValue(true);
    vi.mocked(platformAuthenticatorIsAvailable).mockResolvedValue(false);

    const details = await getPasskeySupportDetails();

    expect(details).toEqual({
      supported: true,
      conditionalMediation: true,
      platformAuthenticator: false,
    });
  });
});
