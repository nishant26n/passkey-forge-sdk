import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CredentialList } from "../src/components";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const SAMPLE_CREDENTIALS = [
  {
    id: "1",
    credentialID: "cred-1",
    aaguid: null,
    name: "Work laptop",
    createdAt: "2026-01-01",
    lastUsedAt: "2026-02-01",
    transports: JSON.stringify(["internal"]),
  },
  {
    id: "2",
    credentialID: "cred-2",
    aaguid: null,
    name: null,
    createdAt: "2026-01-05",
    lastUsedAt: null,
    transports: JSON.stringify(["hybrid"]),
  },
];

/**
 * Lists and revokes the current user's passkeys. Not a WebAuthn ceremony —
 * plain authenticated list/delete — so there's no unsupported-browser
 * state to demonstrate here.
 */
const meta = {
  title: "components/CredentialList",
  component: CredentialList,
  tags: ["autodocs"],
} satisfies Meta<typeof CredentialList>;

export default meta;
type Story = StoryObj<typeof meta>;

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
    await expect(canvas.getByText("Loading…")).toBeInTheDocument();
  },
};

export const ErrorState: Story = {
  name: "Error",
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = async () =>
      jsonResponse({ error: "Failed to load credentials" }, { status: 500 });
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByText("Failed to load credentials"),
      ).toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
  },
};

export const Empty: Story = {
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = async () => jsonResponse({ credentials: [] });
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("No passkeys yet.")).toBeInTheDocument(),
    );
  },
};

export const Populated: Story = {
  beforeEach: async () => {
    const original = window.fetch;
    window.fetch = async (_url, init) =>
      init?.method === "DELETE"
        ? jsonResponse({ revoked: true })
        : jsonResponse({ credentials: SAMPLE_CREDENTIALS });
    return () => {
      window.fetch = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText("Work laptop")).toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole("button", { name: "Remove Work laptop" }),
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Work laptop" }),
    );
    await waitFor(() =>
      expect(canvas.queryByText("Work laptop")).not.toBeInTheDocument(),
    );
  },
};
