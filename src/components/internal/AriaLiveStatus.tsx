/**
 * A visually-hidden aria-live region shared by every component so async
 * status changes get announced. `message` must change wording per
 * transition (not just re-render with the same text) — identical repeated
 * text doesn't reliably re-announce in every screen reader.
 */
export function AriaLiveStatus({ message }: { message: string }) {
  return (
    <span role="status" aria-live="polite" className="passkey-visually-hidden">
      {message}
    </span>
  );
}
