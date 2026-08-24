import { useState } from "react";
import { usePasskey, type UsePasskeyOptions } from "../src";

export type PasskeyDemoProps = {
  endpoints?: UsePasskeyOptions["endpoints"];
};

/**
 * A minimal reference UI built on usePasskey(). Requires a real backend
 * implementing the four-endpoint contract (see the package README, or
 * PasskeyForge's own app/api/webauthn/** routes) to actually complete a
 * ceremony — against no backend, expect a network_error, which is itself
 * useful to see: it shows exactly what a consumer's error state looks like.
 */
export function PasskeyDemo({ endpoints }: PasskeyDemoProps) {
  const { register, login, isRegistering, isLoggingIn, error } = usePasskey({
    endpoints,
  });
  const [result, setResult] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function handleRegister() {
    setResult(null);
    try {
      const data = await register({ name: "Storybook demo" });
      setResult(JSON.stringify(data, null, 2));
    } catch {
      // usePasskey already captured this in `error` — nothing else to do.
    }
  }

  async function handleLogin() {
    setResult(null);
    try {
      const data = email
        ? await login({ email })
        : await login({ usernameless: true });
      setResult(JSON.stringify(data, null, 2));
    } catch {
      // same as above
    }
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 360,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <button type="button" onClick={handleRegister} disabled={isRegistering}>
        {isRegistering ? "Registering…" : "Register a passkey"}
      </button>

      <input
        type="email"
        placeholder="you@example.com (blank = usernameless)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 8 }}
      />

      <button type="button" onClick={handleLogin} disabled={isLoggingIn}>
        {isLoggingIn ? "Signing in…" : "Sign in with a passkey"}
      </button>

      {error ? (
        <p style={{ color: "crimson", fontSize: 14 }}>
          [{error.code}] {error.message}
        </p>
      ) : null}

      {result ? (
        <pre
          style={{
            background: "#f4f4f5",
            padding: 12,
            borderRadius: 8,
            fontSize: 12,
            overflowX: "auto",
          }}
        >
          {result}
        </pre>
      ) : null}
    </div>
  );
}
