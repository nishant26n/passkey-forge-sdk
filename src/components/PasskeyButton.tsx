import { useCallback, useId, useMemo, useRef } from "react";
import { isPasskeySupported } from "../isPasskeySupported";
import { usePasskeyAuthentication } from "../usePasskeyAuthentication";
import { usePasskeyRegistration } from "../usePasskeyRegistration";
import type {
  LoginParams,
  PasskeyEndpoints,
  PasskeyError,
  RegisterParams,
} from "../types";
import { AriaLiveStatus } from "./internal/AriaLiveStatus";
import { ErrorText } from "./internal/ErrorText";

type PasskeyButtonCommonProps = {
  /** Override any subset of the default `/api/webauthn/*` paths. */
  endpoints?: Partial<PasskeyEndpoints>;
  fetchOptions?: RequestInit;
  onSuccess?: (result: unknown) => void;
  onError?: (error: PasskeyError) => void;
  children?: React.ReactNode;
  className?: string;
};

export type PasskeyButtonProps =
  | ({ action: "register" } & RegisterParams & PasskeyButtonCommonProps)
  | ({ action: "login" } & LoginParams & PasskeyButtonCommonProps);

const DEFAULT_LABEL: Record<PasskeyButtonProps["action"], string> = {
  register: "Add a passkey",
  login: "Sign in with a passkey",
};

const PENDING_LABEL: Record<PasskeyButtonProps["action"], string> = {
  register: "Waiting for authenticator…",
  login: "Signing in…",
};

/**
 * A single ceremony-trigger button. `action` is fixed per instance — use
 * two PasskeyButtons (one per action) rather than changing `action` on one
 * instance across renders.
 */
export function PasskeyButton(props: PasskeyButtonProps) {
  const { endpoints, fetchOptions, className, children } = props;
  const options = useMemo(
    () => ({ endpoints, fetchOptions }),
    [endpoints, fetchOptions],
  );

  const registration = usePasskeyRegistration(options);
  const authentication = usePasskeyAuthentication(options);
  const ceremony = props.action === "register" ? registration : authentication;

  const buttonRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const supported = isPasskeySupported();

  const handleClick = useCallback(async () => {
    try {
      const result =
        props.action === "register"
          ? await registration.start({ name: props.name })
          : await authentication.start(
              props.usernameless ? { usernameless: true } : { email: props.email },
            );
      props.onSuccess?.(result);
    } catch (err) {
      props.onError?.(err as PasskeyError);
    } finally {
      buttonRef.current?.focus();
    }
  }, [props, registration, authentication]);

  const pending = ceremony.status === "pending";
  const liveMessage = !supported
    ? "Passkeys aren't supported in this browser."
    : pending
      ? PENDING_LABEL[props.action]
      : ceremony.status === "success"
        ? props.action === "register"
          ? "Passkey added."
          : "Signed in."
        : ceremony.status === "error"
          ? `${props.action === "register" ? "Adding passkey" : "Sign-in"} failed: ${ceremony.error?.message}`
          : "";

  if (!supported) {
    return (
      <div className={className}>
        <button type="button" className="passkey-button" disabled aria-disabled="true">
          {children ?? DEFAULT_LABEL[props.action]}
        </button>
        <p className="passkey-hint">Passkeys aren't supported in this browser.</p>
        <AriaLiveStatus message={liveMessage} />
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        className="passkey-button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={ceremony.status === "error" ? errorId : undefined}
      >
        {pending
          ? PENDING_LABEL[props.action]
          : (children ?? DEFAULT_LABEL[props.action])}
      </button>
      {ceremony.status === "error" && ceremony.error ? (
        <ErrorText id={errorId} message={ceremony.error.message} />
      ) : null}
      {ceremony.status === "success" ? (
        <p className="passkey-success-text">
          {props.action === "register" ? "Passkey added." : "Signed in."}
        </p>
      ) : null}
      <AriaLiveStatus message={liveMessage} />
    </div>
  );
}
