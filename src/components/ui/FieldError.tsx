import type { HTMLAttributes } from "react";
import { AlertCircleIcon } from "./icons";

/**
 * The error message of a form field or form, the same everywhere: a rounded red-bordered box with an alert icon (`.field-error`
 * in styles/globals.css, coloured by the theme's danger tokens). Pass `id` when an input points at it with aria-describedby.
 */
export function FieldError({ children, className = "", ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p role="alert" {...rest} className={`field-error ${className}`.trim()}>
      <AlertCircleIcon width={16} height={16} aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
