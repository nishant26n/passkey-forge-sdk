# use-passkey

[![npm version](https://img.shields.io/npm/v/use-passkey.svg)](https://www.npmjs.com/package/use-passkey)

A framework-agnostic React hook for WebAuthn/passkey registration and login. Wraps [`@simplewebauthn/browser`](https://simplewebauthn.dev) against a small REST contract — any backend built with `@simplewebauthn/server` that exposes the four endpoints below can use it.

Extracted from [PasskeyForge](https://github.com/nishant26n/passkeyforge)'s own passkey UI — and PasskeyForge now runs on this package instead of its own inline copy of the same logic, so the extraction is exercised by a real app in production, not just by the Storybook demo in this repo.

## Install

```bash
npm install use-passkey @simplewebauthn/browser
```

`react` (>=18) is a peer dependency; `@simplewebauthn/browser` is a direct dependency.

## The contract

```
POST registerOptions   ->  PublicKeyCredentialCreationOptionsJSON
POST registerVerify    ->  { credential, name } -> your success shape
POST authOptions       ->  { email } | { usernameless: true } -> PublicKeyCredentialRequestOptionsJSON
POST authVerify        ->  the assertion -> your success shape
```

Defaults match PasskeyForge's own routes (`/api/webauthn/register/options`, etc.) — override any subset via `endpoints`.

## Usage

```tsx
import { usePasskey } from "use-passkey";

function LoginForm() {
  const { login, isLoggingIn, error } = usePasskey();

  return (
    <button
      onClick={() => login({ email: "you@example.com" })}
      disabled={isLoggingIn}
    >
      {isLoggingIn ? "Signing in…" : "Sign in with a passkey"}
    </button>
  );
}
```

```tsx
// Usernameless / discoverable-credential login — no email needed.
await login({ usernameless: true });
```

```tsx
// Registration (must be called from an authenticated session server-side —
// this hook doesn't handle auth, only the ceremony).
const { register, isRegistering } = usePasskey();
await register({ name: "Work laptop" });
```

### Custom endpoints

```tsx
const { register, login } = usePasskey({
  endpoints: {
    registerOptions: "/api/passkeys/register/start",
    registerVerify: "/api/passkeys/register/finish",
    authOptions: "/api/passkeys/login/start",
    authVerify: "/api/passkeys/login/finish",
  },
  // If your API is on a different origin and needs cookies sent cross-site:
  fetchOptions: { credentials: "include" },
});
```

### Error handling

Both `register()` and `login()` throw a `PasskeyError` on failure (`code`, `message`, and `status` if it came from an HTTP response) — the same error also lands in the hook's `error` state, so you can render it without a try/catch if that's simpler:

```tsx
const { register, error } = usePasskey();

// error?.code is one of:
//   "unsupported"        — browser doesn't support WebAuthn at all
//   "network_error"      — the request never reached the server
//   "server_error"       — the server responded with an error
//   "ceremony_cancelled"  — user dismissed the passkey prompt
//   "already_registered" — this authenticator is already registered
```

### Why `isRegistering` / `isLoggingIn` are separate

A single shared `pending` boolean across a register button and a login button makes both spin at once when only one is actually running. This isn't hypothetical — it's a real bug PasskeyForge's own login page shipped and had to fix (two buttons, one `pending` flag, both spinners lit on every click) before this hook existed. Keeping the two flags independent here means anyone using this hook gets that fix for free instead of rediscovering it.

For the same reason, PasskeyForge's login page — which has two independent passkey buttons (email-first and usernameless) — calls `usePasskey()` **twice**, once per button, rather than sharing one instance:

```tsx
const emailAuth = usePasskey();
const usernamelessAuth = usePasskey();
```

Each hook instance's state is local to that call, so this gives each button its own `isLoggingIn`/`error` for free instead of building a second flag by hand.

## Development

```bash
npm install
npm run typecheck
npm run build          # tsup -> dist/ (ESM + CJS + .d.ts)
npm run storybook       # docs + interactive demo at localhost:6006
```

The Storybook demo (`stories/PasskeyDemo.tsx`) needs a real backend at the configured endpoints to complete a ceremony. Against no backend, clicking a button surfaces a `network_error` — which is itself worth seeing, since it's exactly the error shape a consumer's UI needs to handle.

## License

MIT
