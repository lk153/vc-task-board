/** An error that maps straight to an HTTP response: `{ error: { code, message } }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const unauthorized = (message = "Sign in to continue.") =>
  new HttpError(401, "unauthorized", message);

export const forbidden = (message = "You don't have permission to do that.", code = "forbidden") =>
  new HttpError(403, code, message);

/** Also used for boards you're not a member of, so their existence isn't revealed. */
export const notFound = (message = "Not found.") => new HttpError(404, "not_found", message);

export const conflict = (message: string, code = "conflict") => new HttpError(409, code, message);

export const gone = (message: string, code: string) => new HttpError(410, code, message);

export const invalid = (message: string) => new HttpError(422, "invalid", message);
