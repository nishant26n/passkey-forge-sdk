import { useCallback, useState } from "react";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { usePasskeyAuthentication } from "./usePasskeyAuthentication";
import { usePasskeyRegistration } from "./usePasskeyRegistration";
import type { LoginParams, RegisterParams, UsePasskeyOptions } from "./types";

type LastAction = "registration" | "authentication" | null;

/**
 * A framework-agnostic passkey registration + login hook. Thin composition
 * of usePasskeyRegistration + usePasskeyAuthentication, kept for backward
 * compatibility — prefer the two split hooks in new code.
 *
 * `isRegistering` and `isLoggingIn` are two separate flags, not one shared
 * boolean: driving two independent buttons off a single "pending" state is
 * a real bug (both show a spinner when only one action is in flight) that
 * this hook's own reference implementation hit and fixed once already.
 *
 * `error` mirrors whichever of register()/login() failed most recently —
 * the same "last call wins" semantics this hook has always had, even
 * though the two ceremonies now track their errors independently
 * internally.
 */
export function usePasskey(options: UsePasskeyOptions = {}) {
  const registration = usePasskeyRegistration(options);
  const authentication = usePasskeyAuthentication(options);
  const [lastAction, setLastAction] = useState<LastAction>(null);

  const register = useCallback(
    (params: RegisterParams = {}) => {
      setLastAction("registration");
      return registration.start(params);
    },
    // registration.start is itself a stable useCallback reference; depending
    // on the whole `registration` object here would defeat that stability,
    // since the hook returns a fresh object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registration.start],
  );

  const login = useCallback(
    (params: LoginParams) => {
      setLastAction("authentication");
      return authentication.start(params);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authentication.start],
  );

  const error =
    lastAction === "registration"
      ? registration.error
      : lastAction === "authentication"
        ? authentication.error
        : null;

  return {
    register,
    login,
    isRegistering: registration.status === "pending",
    isLoggingIn: authentication.status === "pending",
    error,
    browserSupportsWebAuthn,
  };
}
