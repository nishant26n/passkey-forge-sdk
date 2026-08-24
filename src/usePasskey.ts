import { useCallback, useMemo, useState } from "react";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from "@simplewebauthn/browser";
import { postJson } from "./request";
import {
  PasskeyError,
  type LoginParams,
  type PasskeyEndpoints,
  type RegisterParams,
  type UsePasskeyOptions,
} from "./types";

const DEFAULT_ENDPOINTS: PasskeyEndpoints = {
  registerOptions: "/api/webauthn/register/options",
  registerVerify: "/api/webauthn/register/verify",
  authOptions: "/api/webauthn/auth/options",
  authVerify: "/api/webauthn/auth/verify",
};

function toPasskeyError(err: unknown): PasskeyError {
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

/**
 * A framework-agnostic passkey registration + login hook. Talks to a
 * four-endpoint REST contract (see PasskeyEndpoints) that any backend using
 * @simplewebauthn/server can implement — nothing here assumes a specific app.
 *
 * `isRegistering` and `isLoggingIn` are two separate flags, not one shared
 * boolean: driving two independent buttons off a single "pending" state is
 * a real bug (both show a spinner when only one action is in flight) that
 * this hook's own reference implementation hit and fixed once already.
 */
export function usePasskey(options: UsePasskeyOptions = {}) {
  const endpoints = useMemo<PasskeyEndpoints>(
    () => ({ ...DEFAULT_ENDPOINTS, ...options.endpoints }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      options.endpoints?.registerOptions,
      options.endpoints?.registerVerify,
      options.endpoints?.authOptions,
      options.endpoints?.authVerify,
    ],
  );

  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<PasskeyError | null>(null);

  const register = useCallback(
    async (params: RegisterParams = {}): Promise<unknown> => {
      if (!browserSupportsWebAuthn()) {
        const err = new PasskeyError(
          "This browser doesn't support passkeys.",
          "unsupported",
        );
        setError(err);
        throw err;
      }

      setError(null);
      setIsRegistering(true);

      try {
        const optionsJSON = await postJson(
          endpoints.registerOptions,
          {},
          options.fetchOptions,
        );

        const attestation = await startRegistration({
          optionsJSON: optionsJSON as Parameters<
            typeof startRegistration
          >[0]["optionsJSON"],
        });

        return await postJson(
          endpoints.registerVerify,
          { credential: attestation, name: params.name },
          options.fetchOptions,
        );
      } catch (err) {
        const passkeyError = toPasskeyError(err);
        setError(passkeyError);
        throw passkeyError;
      } finally {
        setIsRegistering(false);
      }
    },
    [endpoints, options.fetchOptions],
  );

  const login = useCallback(
    async (params: LoginParams): Promise<unknown> => {
      if (!browserSupportsWebAuthn()) {
        const err = new PasskeyError(
          "This browser doesn't support passkeys.",
          "unsupported",
        );
        setError(err);
        throw err;
      }

      setError(null);
      setIsLoggingIn(true);

      try {
        const body = params.usernameless
          ? { usernameless: true }
          : { email: params.email };

        const optionsJSON = await postJson(
          endpoints.authOptions,
          body,
          options.fetchOptions,
        );

        const assertion = await startAuthentication({
          optionsJSON: optionsJSON as Parameters<
            typeof startAuthentication
          >[0]["optionsJSON"],
        });

        return await postJson(
          endpoints.authVerify,
          assertion,
          options.fetchOptions,
        );
      } catch (err) {
        const passkeyError = toPasskeyError(err);
        setError(passkeyError);
        throw passkeyError;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [endpoints, options.fetchOptions],
  );

  return {
    register,
    login,
    isRegistering,
    isLoggingIn,
    error,
    browserSupportsWebAuthn,
  };
}
