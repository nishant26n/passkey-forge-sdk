import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { PasskeyButton } from "../src/components";

/**
 * A single ceremony-trigger button backed by usePasskeyRegistration /
 * usePasskeyAuthentication. `unsupported`, `pending`, and `error` states
 * below are real, not simulated — they come from actually running the
 * component against a stubbed browser/network, not from injected props.
 *
 * `success` isn't included as its own story: reaching it for real needs a
 * live backend plus an actual passkey ceremony (same limitation the
 * usePasskey Storybook demo already documents) — no state is faked here
 * for the sake of having a fourth story.
 */
const meta = {
  title: "components/PasskeyButton",
  component: PasskeyButton,
  tags: ["autodocs"],
} satisfies Meta<typeof PasskeyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { action: "register", name: "Work laptop" },
};

export const Unsupported: Story = {
  args: { action: "register" },
  beforeEach: async () => {
    const original = window.PublicKeyCredential;
    // @ts-expect-error -- deliberately removing WebAuthn support for this story
    delete window.PublicKeyCredential;
    return () => {
      window.PublicKeyCredential = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button")).toBeDisabled();
    await expect(
      canvas.getByText("Passkeys aren't supported in this browser."),
    ).toBeInTheDocument();
  },
};

export const Pending: Story = {
  args: { action: "register" },
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = () => new Promise(() => {}); // never resolves
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    await expect(button).toBeDisabled();
  },
};

export const ErrorState: Story = {
  name: "Error",
  args: { action: "register" },
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = async () =>
      new Response(JSON.stringify({ error: "Something went wrong" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button"));
    await waitFor(() =>
      expect(canvas.getByText("Something went wrong")).toBeInTheDocument(),
    );
    const button = canvas.getByRole("button");
    const describedBy = button.getAttribute("aria-describedby");
    await expect(describedBy).toBeTruthy();
  },
};
