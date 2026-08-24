import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteJson, getJson } from "./request";
import { toPasskeyError } from "./toPasskeyError";
import type {
  AsyncStatus,
  CredentialsEndpoints,
  PasskeyCredential,
  PasskeyError,
  UseCredentialListOptions,
} from "./types";

const DEFAULT_ENDPOINTS: CredentialsEndpoints = {
  list: "/api/webauthn/credentials",
  revoke: (credentialId) => `/api/webauthn/credentials/${credentialId}`,
};

/** Raw shape a GET /credentials response's rows take on the wire. */
type RawCredential = {
  id: string;
  credentialID: string;
  aaguid: string | null;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  transports: string | string[] | null;
};

function normalizeCredential(raw: RawCredential): PasskeyCredential {
  let transports: string[] = [];

  if (Array.isArray(raw.transports)) {
    transports = raw.transports;
  } else if (typeof raw.transports === "string") {
    try {
      const parsed = JSON.parse(raw.transports);
      if (Array.isArray(parsed)) transports = parsed;
    } catch {
      // Leave transports empty rather than surface a parse error for a
      // purely cosmetic field.
    }
  }

  return {
    id: raw.id,
    credentialID: raw.credentialID,
    aaguid: raw.aaguid,
    name: raw.name,
    createdAt: raw.createdAt,
    lastUsedAt: raw.lastUsedAt,
    transports,
  };
}

function revokeUrl(endpoints: CredentialsEndpoints, credentialId: string) {
  return typeof endpoints.revoke === "function"
    ? endpoints.revoke(credentialId)
    : endpoints.revoke;
}

/**
 * Lists the current user's registered passkeys and lets them be revoked.
 * Backed by GET/DELETE against a credentials REST contract (see
 * CredentialsEndpoints).
 */
export function useCredentialList(options: UseCredentialListOptions = {}) {
  const endpoints = useMemo<CredentialsEndpoints>(
    () => ({ ...DEFAULT_ENDPOINTS, ...options.endpoints }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.endpoints?.list, options.endpoints?.revoke],
  );
  const autoFetch = options.autoFetch ?? true;
  const fetchOptions = options.fetchOptions;

  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [credentials, setCredentials] = useState<PasskeyCredential[] | null>(
    null,
  );
  const [error, setError] = useState<PasskeyError | null>(null);
  // Per-credential, not a shared boolean — a single flag would spin every
  // row's revoke button whenever only one is actually in flight.
  const [revokingIds, setRevokingIds] = useState<string[]>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchList = useCallback(
    async (signal: AbortSignal) => {
      setError(null);
      setStatus("pending");

      try {
        const data = (await getJson(endpoints.list, {
          ...fetchOptions,
          signal,
        })) as { credentials: RawCredential[] };

        if (mountedRef.current) {
          setCredentials(data.credentials.map(normalizeCredential));
          setStatus("success");
        }
      } catch (err) {
        if (mountedRef.current && !signal.aborted) {
          setError(toPasskeyError(err));
          setStatus("error");
        }
      }
    },
    [endpoints, fetchOptions],
  );

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    await fetchList(controller.signal);
  }, [fetchList]);

  useEffect(() => {
    if (!autoFetch) return;

    const controller = new AbortController();
    void fetchList(controller.signal);

    return () => controller.abort();
  }, [autoFetch, fetchList]);

  const revoke = useCallback(
    async (credentialId: string) => {
      setRevokingIds((ids) => [...ids, credentialId]);
      setError(null);

      try {
        await deleteJson(revokeUrl(endpoints, credentialId), fetchOptions);

        if (mountedRef.current) {
          setCredentials(
            (current) => current?.filter((c) => c.id !== credentialId) ?? current,
          );
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(toPasskeyError(err));
        }
      } finally {
        if (mountedRef.current) {
          setRevokingIds((ids) => ids.filter((id) => id !== credentialId));
        }
      }
    },
    [endpoints, fetchOptions],
  );

  return { status, credentials, error, refresh, revoke, revokingIds };
}
