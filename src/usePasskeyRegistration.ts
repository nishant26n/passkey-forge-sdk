import { useCallback, useMemo } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { isPasskeySupported } from "./isPasskeySupported";
import { useAsyncCeremony } from "./internal/useAsyncCeremony";
import { postJson } from "./request";
import {
  PasskeyError,
  type PasskeyEndpoints,
  type RegisterParams,
  type UsePasskeyOptions,
} from "./types";

const DEFAULT_ENDPOINTS: Pick<PasskeyEndpoints, "registerOptions" | "registerVerify"> = {
  registerOptions: "/api/webauthn/register/options",
  registerVerify: "/api/webauthn/register/verify",
};

/**
 * Headless passkey registration. Talks to a two-endpoint REST contract
 * (registerOptions/registerVerify) that any backend using
 * @simplewebauthn/server can implement.
 */
export function usePasskeyRegistration<TResult = unknown>(
  options: UsePasskeyOptions = {},
) {
  const endpoints = useMemo(
    () => ({ ...DEFAULT_ENDPOINTS, ...options.endpoints }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.endpoints?.registerOptions, options.endpoints?.registerVerify],
  );

  const run = useCallback(
    async (params: RegisterParams): Promise<TResult> => {
      if (!isPasskeySupported()) {
        throw new PasskeyError(
          "This browser doesn't support passkeys.",
          "unsupported",
        );
      }

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

      return (await postJson(
        endpoints.registerVerify,
        { credential: attestation, name: params.name },
        options.fetchOptions,
      )) as TResult;
    },
    [endpoints, options.fetchOptions],
  );

  const ceremony = useAsyncCeremony<RegisterParams, TResult>(run);

  const start = useCallback(
    (params: RegisterParams = {}) => ceremony.start(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ceremony.start],
  );

  return { ...ceremony, start };
}
