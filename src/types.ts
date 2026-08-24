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
