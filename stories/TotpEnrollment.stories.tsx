import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TotpEnrollment } from "../src/components";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/**
 * TOTP (authenticator app) MFA enrollment. Not a WebAuthn ceremony, so no
 * unsupported-browser state. Unlike PasskeyButton/CredentialList, its
 * `success` state IS demonstrated here — enrollment only depends on two
 * plain fetch calls, no native ceremony to fake.
 */
const meta = {
  title: "components/TotpEnrollment",
  component: TotpEnrollment,
  tags: ["autodocs"],
} satisfies Meta<typeof TotpEnrollment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Set up authenticator app" }),
    ).toBeInTheDocument();
  },
};

export const Loading: Story = {
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = () => new Promise(() => {});
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", {
      name: "Set up authenticator app",
    });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
  },
};

export const ErrorState: Story = {
  name: "Error",
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = async (_url, init) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      return body?.code
        ? jsonResponse({ error: "Invalid authentication code" }, { status: 400 })
        : jsonResponse({ uri: "otpauth://totp/PasskeyForge:demo?secret=ABCDEF" });
    };
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Set up authenticator app" }),
    );
    const input = await canvas.findByLabelText("Enter the 6-digit code");
    await userEvent.type(input, "000000");
    await userEvent.click(canvas.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(
        canvas.getByText("Invalid authentication code"),
      ).toBeInTheDocument(),
    );
    await expect(input.getAttribute("aria-describedby")).toBeTruthy();
  },
};

export const Enrolled: Story = {
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = async (_url, init) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      return body?.code
        ? jsonResponse({ verified: true, totpEnabled: true })
        : jsonResponse({ uri: "otpauth://totp/PasskeyForge:demo?secret=ABCDEF" });
    };
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Set up authenticator app" }),
    );
    const input = await canvas.findByLabelText("Enter the 6-digit code");
    await userEvent.type(input, "123456");
    await userEvent.click(canvas.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(
        canvas.getAllByText("Authenticator app enrolled.").length,
      ).toBeGreaterThan(0),
    );
  },
};
