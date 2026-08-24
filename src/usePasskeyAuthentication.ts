import { useCallback, useMemo } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { isPasskeySupported } from "./isPasskeySupported";
import { useAsyncCeremony } from "./internal/useAsyncCeremony";
import { postJson } from "./request";
import {
  PasskeyError,
  type LoginParams,
  type PasskeyEndpoints,
  type UsePasskeyOptions,
} from "./types";

const DEFAULT_ENDPOINTS: Pick<PasskeyEndpoints, "authOptions" | "authVerify"> = {
  authOptions: "/api/webauthn/auth/options",
  authVerify: "/api/webauthn/auth/verify",
};

/**
 * Headless passkey authentication. Talks to a two-endpoint REST contract
 * (authOptions/authVerify) that any backend using @simplewebauthn/server
 * can implement.
 */
export function usePasskeyAuthentication<TResult = unknown>(
  options: UsePasskeyOptions = {},
) {
  const endpoints = useMemo(
    () => ({ ...DEFAULT_ENDPOINTS, ...options.endpoints }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.endpoints?.authOptions, options.endpoints?.authVerify],
  );

  const run = useCallback(
    async (params: LoginParams): Promise<TResult> => {
      if (!isPasskeySupported()) {
        throw new PasskeyError(
          "This browser doesn't support passkeys.",
          "unsupported",
        );
      }

      const body = params.usernameless
        ? { usernameless: true }
        : { email: params.email };

      const optionsJSON = await postJson(
        endpoints.authOptions,
        body,
        options.fetchOptions,
      );

      const assertion = await startAuthentication({
        optionsJSON: optionsJSON as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });

      return (await postJson(
        endpoints.authVerify,
        assertion,
        options.fetchOptions,
      )) as TResult;
    },
    [endpoints, options.fetchOptions],
  );

  return useAsyncCeremony<LoginParams, TResult>(run);
}
