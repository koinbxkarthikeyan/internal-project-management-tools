/** The label of a button while it works: the words, then three dots that rise one after another (a soft wave). The dots are hidden from screen readers; the button says "busy" itself. */
export default function LoadingLabel({ children }: { children: string }) {
  return (
    <span className="anim-label-in inline-flex items-center gap-1.5">
      {children}
      <span className="loading-dots inline-flex items-center gap-[3px]" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}
