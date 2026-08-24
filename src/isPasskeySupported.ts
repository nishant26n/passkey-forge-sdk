import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

/** Synchronous feature check: does this browser support WebAuthn at all? */
export function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn();
}

export type PasskeySupportDetails = {
  /** Whether the browser supports WebAuthn at all. */
  supported: boolean;
  /** Whether autofill-assisted (conditional mediation) login is supported. */
  conditionalMediation: boolean;
  /** Whether a platform authenticator (e.g. Touch ID, Windows Hello) is available. */
  platformAuthenticator: boolean;
};

/** Richer, async feature check for conditional UI and platform authenticator availability. */
export async function getPasskeySupportDetails(): Promise<PasskeySupportDetails> {
  const supported = browserSupportsWebAuthn();

  if (!supported) {
    return {
      supported: false,
      conditionalMediation: false,
      platformAuthenticator: false,
    };
  }

  const [conditionalMediation, platformAuthenticator] = await Promise.all([
    browserSupportsWebAuthnAutofill(),
    platformAuthenticatorIsAvailable(),
  ]);

  return { supported, conditionalMediation, platformAuthenticator };
}
