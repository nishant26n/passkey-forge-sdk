# use-passkey

[![npm version](https://img.shields.io/npm/v/use-passkey.svg)](https://www.npmjs.com/package/use-passkey)

A framework-agnostic set of React hooks for WebAuthn/passkeys: registration, login, credential management, and TOTP MFA enrollment. Wraps [`@simplewebauthn/browser`](https://simplewebauthn.dev) against a small REST contract — any backend built with `@simplewebauthn/server` that exposes the endpoints below can use it. `usePasskey()` (registration + login combined) is the quick-start API; see [Headless hooks](#headless-hooks) below for the split hooks plus credential listing and TOTP enrollment.

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

`usePasskey()` is now a thin composition of the two headless hooks below (`usePasskeyRegistration` + `usePasskeyAuthentication`) — it stays exactly as it is for existing code, but new code should prefer the split hooks directly.

## Headless hooks

Four additional hooks, each independently importable, all following the same shape: `{ start, status, error, reset }` (or the closest fit for that hook's flow), where `status` is a discriminated union — `"idle" | "pending" | "success" | "error"` — instead of a loose boolean.

### `usePasskeyRegistration` / `usePasskeyAuthentication`

The two ceremonies `usePasskey()` composes, available on their own:

```tsx
import { usePasskeyRegistration, usePasskeyAuthentication } from "use-passkey";

function AddPasskeyButton() {
  const { start, status, error, reset } = usePasskeyRegistration();

  return (
    <button onClick={() => start({ name: "Work laptop" })} disabled={status === "pending"}>
      {status === "pending" ? "Waiting for authenticator…" : "Add a passkey"}
    </button>
  );
}
```

```tsx
const { start, status, data } = usePasskeyAuthentication();
await start({ email: "you@example.com" }); // or start({ usernameless: true })
```

`start()` both returns a promise (throws `PasskeyError` on failure, same as `register`/`login`) and drives `status`/`data`/`error` for render-driven UIs. `reset()` clears a finished `success`/`error` state back to `idle` — it doesn't cancel an in-flight ceremony. Both hooks cancel any in-flight WebAuthn prompt on unmount (via `@simplewebauthn/browser`'s `WebAuthnAbortService`) and ignore stale state updates if the component unmounts mid-ceremony.

Same `endpoints`/`fetchOptions` shape as `usePasskey`, just split: `usePasskeyRegistration` uses `registerOptions`/`registerVerify`, `usePasskeyAuthentication` uses `authOptions`/`authVerify`.

### `useCredentialList`

Lists and revokes the current user's registered passkeys. Backed by `GET`/`DELETE` against a credentials REST contract (defaults: `GET /api/webauthn/credentials`, `DELETE /api/webauthn/credentials/:id` — override via `endpoints: { list, revoke }`, where `revoke` can be a path or `(id) => path`):

```tsx
import { useCredentialList } from "use-passkey";

function PasskeyList() {
  const { status, credentials, error, refresh, revoke, revokingIds } = useCredentialList();

  if (status === "pending") return <p>Loading…</p>;
  if (status === "error") return <p>{error?.message} <button onClick={refresh}>Retry</button></p>;

  return (
    <ul>
      {credentials?.map((c) => (
        <li key={c.id}>
          {c.name ?? "Passkey"}
          <button onClick={() => revoke(c.id)} disabled={revokingIds.includes(c.id)}>
            {revokingIds.includes(c.id) ? "Removing…" : "Remove"}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`revokingIds` is a list of in-flight credential ids, not a single shared boolean — revoking one credential doesn't spin every row's button, the same reasoning behind `isRegistering`/`isLoggingIn` being separate above. Fetches on mount by default (`autoFetch: false` to opt out); unmounting mid-fetch aborts the underlying request via `AbortController`.

### `useTotpEnrollment`

TOTP (authenticator app) MFA enrollment — a separate, non-WebAuthn flow: fetch an `otpauth://` URI, then confirm setup by verifying a 6-digit code. Backed by `POST /api/auth/totp/setup` (defaults, override via `endpoints: { setup, verify }`) and `POST /api/auth/totp/verify`:

```tsx
import { useTotpEnrollment } from "use-passkey";

const { uri, enrolled, status, error, setup, verify } = useTotpEnrollment();
await setup(); // uri is now set — render it as a QR code
await verify("123456"); // enrolled becomes true on success
```

### `isPasskeySupported` / `getPasskeySupportDetails`

Plain functions, not hooks:

```tsx
import { isPasskeySupported, getPasskeySupportDetails } from "use-passkey";

isPasskeySupported(); // sync boolean — does this browser support WebAuthn at all?

const { supported, conditionalMediation, platformAuthenticator } =
  await getPasskeySupportDetails();
// conditionalMediation: autofill-assisted (discoverable credential) login supported?
// platformAuthenticator: is a platform authenticator (Touch ID, Windows Hello, …) available?
```

## Styled components

A separate subpath, `use-passkey/components`, so the headless hooks above stay free of any styling dependency. Ships plain CSS (custom properties for theming, no Tailwind) — import it once alongside the components:

```bash
npm install use-passkey qrcode
```

`qrcode` is a direct dependency of the components entry only (used by `TotpEnrollment` to render a scannable QR code); it isn't pulled in if you only import from `use-passkey`.

```tsx
import { PasskeyButton, CredentialList, TotpEnrollment } from "use-passkey/components";
import "use-passkey/components/style.css";

<PasskeyButton action="register" name="Work laptop" onSuccess={() => console.log("added")} />
<PasskeyButton action="login" email="you@example.com" />
<CredentialList />
<TotpEnrollment onEnrolled={() => console.log("enrolled")} />
```

Every component renders real states for loading, error, and success; `PasskeyButton` additionally renders an unsupported-browser state (`CredentialList`/`TotpEnrollment` are plain authenticated REST calls, not WebAuthn ceremonies, so there's nothing to feature-detect for them). Theme by overriding the `--passkey-*` CSS custom properties (colors, radius, font, focus ring) — see `dist/components.css` for the full list; dark mode follows `prefers-color-scheme` out of the box.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test                # vitest — hook unit tests + jest-axe component checks
npm run build            # tsup -> dist/ (ESM + CJS + .d.ts, headless + components entries)
npm run storybook        # docs + interactive demo at localhost:6006
```

The Storybook demo (`stories/PasskeyDemo.tsx`) needs a real backend at the configured endpoints to complete a ceremony. Against no backend, clicking a button surfaces a `network_error` — which is itself worth seeing, since it's exactly the error shape a consumer's UI needs to handle. The `components/*.stories.tsx` files stub `window.fetch` directly in their `play` functions to demonstrate loading/error/success states without a backend.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → a11y → build → bundle-size on every push/PR, then `semantic-release` on pushes to `main` — releases are automated from [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `BREAKING CHANGE:` in the commit body, etc.) rather than manual `npm version`/`npm publish`. Version, changelog, and npm/GitHub releases are all derived from commit messages, so PR titles/commits merged to `main` need to follow that format.

## License

MIT
