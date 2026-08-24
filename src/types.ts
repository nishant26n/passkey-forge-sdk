/**
 * The REST contract this hook talks to. Any backend that implements these
 * four endpoints with the shapes @simplewebauthn/server produces/expects
 * can use it — nothing here is specific to any one app.
 *
 *   POST registerOptions  -> PublicKeyCredentialCreationOptionsJSON
 *   POST registerVerify   -> whatever your backend returns on success
 *   POST authOptions      -> PublicKeyCredentialRequestOptionsJSON
 *   POST authVerify       -> whatever your backend returns on success
 */
export type PasskeyEndpoints = {
  registerOptions: string;
  registerVerify: string;
  authOptions: string;
  authVerify: string;
};

export type UsePasskeyOptions = {
  /** Override any subset of the default `/api/webauthn/*` paths. */
  endpoints?: Partial<PasskeyEndpoints>;
  /**
   * Merged into every fetch() call — e.g. `{ credentials: "include" }` if
   * your API lives on a different origin than the page and needs cookies
   * sent cross-site.
   */
  fetchOptions?: RequestInit;
};

export type RegisterParams = {
  /** Optional label for the credential (e.g. "Work laptop"), if your
   * backend's registerVerify endpoint accepts one. */
  name?: string;
};

export type LoginParams =
  | { email: string; usernameless?: false }
  | { usernameless: true; email?: undefined };

/** Shared status shape for the headless hooks. */
export type AsyncStatus = "idle" | "pending" | "success" | "error";

/**
 * The REST contract useCredentialList talks to.
 *
 *   GET  list          -> { credentials: PasskeyCredential[] }
 *   DELETE revoke(id)   -> whatever your backend returns on success
 */
export type CredentialsEndpoints = {
  list: string;
  /** A path, or a function producing one from a credential id. */
  revoke: string | ((credentialId: string) => string);
};

export type UseCredentialListOptions = {
  /** Override any subset of the default `/api/webauthn/credentials*` paths. */
  endpoints?: Partial<CredentialsEndpoints>;
  fetchOptions?: RequestInit;
  /** Fetch the list on mount. Defaults to true. */
  autoFetch?: boolean;
};

/** A single passkey credential, as returned by GET credentials. */
export type PasskeyCredential = {
  id: string;
  credentialID: string;
  aaguid: string | null;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  /** Normalized to an array — the wire shape may JSON-encode this as a string. */
  transports: string[];
};

/**
 * The REST contract useTotpEnrollment talks to.
 *
 *   POST setup   -> { uri }  (an otpauth:// URI)
 *   POST verify  -> { code } -> { verified, totpEnabled }
 */
export type TotpEndpoints = {
  setup: string;
  verify: string;
};

export type UseTotpEnrollmentOptions = {
  /** Override any subset of the default `/api/auth/totp/*` paths. */
  endpoints?: Partial<TotpEndpoints>;
  fetchOptions?: RequestInit;
};

export type PasskeyErrorCode =
  | "unsupported"
  | "network_error"
  | "server_error"
  | "ceremony_cancelled"
  | "already_registered";

export class PasskeyError extends Error {
  code: PasskeyErrorCode;
  /** The HTTP status of the failing response, if the error came from one. */
  status?: number;

  constructor(message: string, code: PasskeyErrorCode, status?: number) {
    super(message);
    this.name = "PasskeyError";
    this.code = code;
    this.status = status;
  }
}
