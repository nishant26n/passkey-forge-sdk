import { useEffect, useId, useRef, useState } from "react";
import { toDataURL } from "qrcode";
import { useTotpEnrollment } from "../useTotpEnrollment";
import type { TotpEndpoints } from "../types";
import { AriaLiveStatus } from "./internal/AriaLiveStatus";
import { ErrorText } from "./internal/ErrorText";

export type TotpEnrollmentProps = {
  endpoints?: Partial<TotpEndpoints>;
  fetchOptions?: RequestInit;
  className?: string;
  onEnrolled?: () => void;
};

/**
 * TOTP (authenticator app) MFA enrollment: request a QR code, then confirm
 * setup with a 6-digit code. Not a WebAuthn ceremony, so no
 * unsupported-browser state.
 */
export function TotpEnrollment({
  endpoints,
  fetchOptions,
  className,
  onEnrolled,
}: TotpEnrollmentProps) {
  const { status, uri, enrolled, error, setup, verify } = useTotpEnrollment({
    endpoints,
    fetchOptions,
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const errorId = useId();
  const codeInputId = useId();
  const setupButtonRef = useRef<HTMLButtonElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uri) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    toDataURL(uri)
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        // Leave qrDataUrl null — the "Generating QR code…" hint stays put
        // rather than crashing the component over a rendering failure.
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    if (uri) codeInputRef.current?.focus();
  }, [uri]);

  useEffect(() => {
    if (enrolled) onEnrolled?.();
  }, [enrolled, onEnrolled]);

  const pending = status === "pending";

  const handleSetup = async () => {
    try {
      await setup();
    } catch {
      setupButtonRef.current?.focus();
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await verify(code);
      setCode("");
    } catch {
      codeInputRef.current?.focus();
    }
  };

  const liveMessage = enrolled
    ? "Authenticator app enrolled."
    : pending
      ? "Working…"
      : status === "error"
        ? `Failed: ${error?.message}`
        : "";

  if (enrolled) {
    return (
      <div className={className}>
        <p role="status">Authenticator app enrolled.</p>
        <AriaLiveStatus message={liveMessage} />
      </div>
    );
  }

  if (!uri) {
    return (
      <div className={className}>
        <button
          ref={setupButtonRef}
          type="button"
          className="passkey-button"
          onClick={handleSetup}
          disabled={pending}
          aria-busy={pending}
          aria-describedby={status === "error" ? errorId : undefined}
        >
          {pending ? "Setting up…" : "Set up authenticator app"}
        </button>
        {status === "error" && error ? (
          <ErrorText id={errorId} message={error.message} />
        ) : null}
        <AriaLiveStatus message={liveMessage} />
      </div>
    );
  }

  return (
    <div className={className}>
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="Scan this QR code with your authenticator app"
          className="passkey-totp-qr"
          width={200}
          height={200}
        />
      ) : (
        <p className="passkey-hint">Generating QR code…</p>
      )}

      <form onSubmit={handleVerify}>
        <label htmlFor={codeInputId}>Enter the 6-digit code</label>
        <input
          ref={codeInputRef}
          id={codeInputId}
          className="passkey-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={pending}
          aria-describedby={status === "error" ? errorId : undefined}
          required
        />
        <button
          type="submit"
          className="passkey-button"
          disabled={pending || code.length !== 6}
          aria-busy={pending}
        >
          {pending ? "Verifying…" : "Verify"}
        </button>
      </form>

      {status === "error" && error ? (
        <ErrorText id={errorId} message={error.message} />
      ) : null}
      <AriaLiveStatus message={liveMessage} />
    </div>
  );
}
