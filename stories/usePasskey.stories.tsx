import type { Meta, StoryObj } from "@storybook/react-vite";
import { PasskeyDemo } from "./PasskeyDemo";

/**
 * `usePasskey()` wraps `@simplewebauthn/browser`'s registration and login
 * ceremonies against a four-endpoint REST contract:
 *
 * ```
 * POST registerOptions   -> PublicKeyCredentialCreationOptionsJSON
 * POST registerVerify    -> { credential, name } -> your success shape
 * POST authOptions       -> { email } | { usernameless: true } -> PublicKeyCredentialRequestOptionsJSON
 * POST authVerify        -> the assertion -> your success shape
 * ```
 *
 * Any backend built with `@simplewebauthn/server` that exposes those four
 * routes works — [PasskeyForge](https://github.com/nishant26n/passkeyforge)'s
 * own `app/api/webauthn/**` routes are the reference implementation this
 * hook was extracted from.
 *
 * `isRegistering` and `isLoggingIn` are separate booleans on purpose: driving
 * two independent buttons off one shared "pending" flag makes both spin at
 * once when only one action is running — a real bug this hook's own
 * reference app hit and fixed before this package existed.
 *
 * The buttons below need a real backend at the configured endpoints to
 * complete a ceremony. Against no backend, expect a `network_error` — that's
 * exactly the error shape a consumer sees and is worth looking at.
 */
const meta = {
  title: "usePasskey",
  component: PasskeyDemo,
  tags: ["autodocs"],
  argTypes: {
    endpoints: {
      description:
        "Override any subset of the default /api/webauthn/* paths.",
    },
  },
} satisfies Meta<typeof PasskeyDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const CustomEndpoints: Story = {
  name: "Custom endpoint paths",
  args: {
    endpoints: {
      registerOptions: "/api/passkeys/register/start",
      registerVerify: "/api/passkeys/register/finish",
      authOptions: "/api/passkeys/login/start",
      authVerify: "/api/passkeys/login/finish",
    },
  },
};
