import { useCallback, useEffect, useRef, useState } from "react";
import { WebAuthnAbortService } from "@simplewebauthn/browser";
import { toPasskeyError } from "../toPasskeyError";
import type { AsyncStatus, PasskeyError } from "../types";

/**
 * Shared plumbing behind usePasskeyRegistration / usePasskeyAuthentication:
 * status/data/error state, ignoring stale setState after unmount, and
 * cancelling any in-flight WebAuthn ceremony on unmount via the library's
 * own abort service (a real cancel of the native prompt, not just a
 * state-guard).
 */
export function useAsyncCeremony<TParams, TResult>(
  run: (params: TParams) => Promise<TResult>,
) {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [data, setData] = useState<TResult | null>(null);
  const [error, setError] = useState<PasskeyError | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      WebAuthnAbortService.cancelCeremony();
    };
  }, []);

  const start = useCallback(
    async (params: TParams): Promise<TResult> => {
      setError(null);
      setStatus("pending");

      try {
        const result = await run(params);
        if (mountedRef.current) {
          setData(result);
          setStatus("success");
        }
        return result;
      } catch (err) {
        const passkeyError = toPasskeyError(err);
        if (mountedRef.current) {
          setError(passkeyError);
          setStatus("error");
        }
        throw passkeyError;
      }
    },
    [run],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return { start, status, data, error, reset };
}
