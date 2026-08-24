import { WebAuthnError } from "@simplewebauthn/browser";
import { PasskeyError } from "./types";

/** Maps any error thrown by a WebAuthn ceremony or a request helper to a PasskeyError. */
export function toPasskeyError(err: unknown): PasskeyError {
  if (err instanceof PasskeyError) return err;

  if (err instanceof WebAuthnError) {
    if (err.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
      return new PasskeyError(
        "This device already has a passkey registered.",
        "already_registered",
      );
    }
    if (err.code === "ERROR_CEREMONY_ABORTED") {
      return new PasskeyError(
        "The passkey prompt was cancelled.",
        "ceremony_cancelled",
      );
    }
    return new PasskeyError(err.message, "ceremony_cancelled");
  }

  if (err instanceof Error) {
    return new PasskeyError(err.message, "server_error");
  }

  return new PasskeyError("Something went wrong.", "server_error");
}
