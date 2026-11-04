/** A failed local request, shaped like the answer a server would give (a status and a message), so the screens read it the same way. */
export class LocalApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "LocalApiError";
    this.status = status;
  }
}

export const fail = (status: number, message: string): never => {
  throw new LocalApiError(status, message);
};
