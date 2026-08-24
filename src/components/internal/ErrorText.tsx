/**
 * Renders error text with a stable id so callers can wire aria-describedby
 * from the control that produced the error — never color alone. No
 * role="alert" here: the sibling AriaLiveStatus region already announces
 * the same failure, and double live regions would double-announce it.
 */
export function ErrorText({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="passkey-error-text">
      {message}
    </p>
  );
}
