import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postJson } from "./request";
import { toPasskeyError } from "./toPasskeyError";
import type {
  PasskeyError,
  TotpEndpoints,
  UseTotpEnrollmentOptions,
} from "./types";

const DEFAULT_ENDPOINTS: TotpEndpoints = {
  setup: "/api/auth/totp/setup",
  verify: "/api/auth/totp/verify",
};

/**
 * TOTP (authenticator app) MFA enrollment: fetch an otpauth:// URI, then
 * confirm the user has it set up by verifying a code. Backed by a
 * two-endpoint REST contract (see TotpEndpoints) — separate from the
 * WebAuthn ceremony hooks since this isn't a passkey ceremony.
 */
export function useTotpEnrollment(options: UseTotpEnrollmentOptions = {}) {
  const endpoints = useMemo<TotpEndpoints>(
    () => ({ ...DEFAULT_ENDPOINTS, ...options.endpoints }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.endpoints?.setup, options.endpoints?.verify],
  );
  const fetchOptions = options.fetchOptions;

  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [uri, setUri] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState<PasskeyError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const setup = useCallback(async (): Promise<{ uri: string }> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setStatus("pending");

    try {
      const data = (await postJson(endpoints.setup, {}, {
        ...fetchOptions,
        signal: controller.signal,
      })) as { uri: string };

      if (mountedRef.current) {
        setUri(data.uri);
        setStatus("idle");
      }
      return data;
    } catch (err) {
      const passkeyError = toPasskeyError(err);
      if (mountedRef.current) {
        setError(passkeyError);
        setStatus("error");
      }
      throw passkeyError;
    }
  }, [endpoints, fetchOptions]);

  const verify = useCallback(
    async (
      code: string,
    ): Promise<{ verified: boolean; totpEnabled: boolean }> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setStatus("pending");

      try {
        const data = (await postJson(
          endpoints.verify,
          { code },
          { ...fetchOptions, signal: controller.signal },
        )) as { verified: boolean; totpEnabled: boolean };

        if (mountedRef.current) {
          setEnrolled(data.totpEnabled);
          setStatus("idle");
        }
        return data;
      } catch (err) {
        const passkeyError = toPasskeyError(err);
        if (mountedRef.current) {
          setError(passkeyError);
          setStatus("error");
        }
        throw passkeyError;
      }
    },
    [endpoints, fetchOptions],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setUri(null);
    setEnrolled(false);
    setError(null);
  }, []);

  return { status, uri, enrolled, error, setup, verify, reset };
}
