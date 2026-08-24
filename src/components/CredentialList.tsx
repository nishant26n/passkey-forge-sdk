import { useCallback, useId, useRef } from "react";
import { useCredentialList } from "../useCredentialList";
import type { CredentialsEndpoints, PasskeyCredential } from "../types";
import { AriaLiveStatus } from "./internal/AriaLiveStatus";
import { ErrorText } from "./internal/ErrorText";

export type CredentialListProps = {
  endpoints?: Partial<CredentialsEndpoints>;
  fetchOptions?: RequestInit;
  className?: string;
  /** Renders a passkey's added/last-used date. Defaults to createdAt as-is. */
  formatDate?: (isoDate: string) => string;
  emptyMessage?: string;
};

function describeCredential(credential: PasskeyCredential) {
  return credential.name ?? (credential.transports.length > 0
    ? credential.transports.join(", ")
    : "Passkey");
}

/**
 * Lists the current user's registered passkeys and lets them be revoked.
 * Not a WebAuthn ceremony (plain authenticated list/delete), so it has no
 * unsupported-browser state.
 */
export function CredentialList({
  endpoints,
  fetchOptions,
  className,
  formatDate = (d) => d,
  emptyMessage = "No passkeys yet.",
}: CredentialListProps) {
  const { status, credentials, error, refresh, revoke, revokingIds } =
    useCredentialList({ endpoints, fetchOptions });

  const headingId = useId();
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const handleRevoke = useCallback(
    async (id: string, triggerButton: HTMLButtonElement) => {
      // Captured before the await, not after: checking activeElement once
      // the row is already gone is racy (its post-removal value is a timing
      // detail, not something to depend on). Whether *this* button held
      // focus at click time is the only thing that needs to be true.
      const wasFocused = document.activeElement === triggerButton;
      await revoke(id);
      if (wasFocused) {
        headingRef.current?.focus();
      }
    },
    [revoke],
  );

  const liveMessage =
    status === "pending"
      ? "Loading passkeys…"
      : status === "error"
        ? `Failed to load passkeys: ${error?.message}`
        : status === "success"
          ? `${credentials?.length ?? 0} passkey${credentials?.length === 1 ? "" : "s"} loaded.`
          : "";

  return (
    <div className={className}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="passkey-list-heading">
        Passkeys
      </h2>

      {status === "pending" && !credentials ? (
        <p className="passkey-hint">Loading…</p>
      ) : null}

      {status === "error" ? (
        <div>
          <ErrorText id={errorId} message={error?.message ?? "Failed to load passkeys."} />
          <button
            type="button"
            className="passkey-button passkey-button--secondary"
            onClick={refresh}
            aria-describedby={errorId}
          >
            Retry
          </button>
        </div>
      ) : null}

      {status === "success" && credentials?.length === 0 ? (
        <p className="passkey-hint">{emptyMessage}</p>
      ) : null}

      {credentials && credentials.length > 0 ? (
        <ul className="passkey-credential-list" aria-labelledby={headingId}>
          {credentials.map((credential) => {
            const revoking = revokingIds.includes(credential.id);
            return (
              <li key={credential.id} className="passkey-credential-row">
                <span>{describeCredential(credential)}</span>
                <span className="passkey-hint">
                  Added {formatDate(credential.createdAt)}
                  {credential.lastUsedAt
                    ? ` · Last used ${formatDate(credential.lastUsedAt)}`
                    : " · Never used"}
                </span>
                <button
                  type="button"
                  className="passkey-button passkey-button--danger"
                  onClick={(e) => handleRevoke(credential.id, e.currentTarget)}
                  disabled={revoking}
                  aria-busy={revoking}
                  aria-label={`Remove ${describeCredential(credential)}`}
                >
                  {revoking ? "Removing…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <AriaLiveStatus message={liveMessage} />
    </div>
  );
}
