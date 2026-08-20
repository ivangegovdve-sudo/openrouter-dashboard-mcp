export type DashboardRequestErrorKind =
  | "unreachable"
  | "timeout"
  | "http_error"
  | "non_json"
  | "invalid_payload"
  | "configuration_error";

export type DashboardRequestErrorOptions = {
  retryable: boolean;
  status?: number;
};

export class DashboardRequestError extends Error {
  readonly kind: DashboardRequestErrorKind;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    kind: DashboardRequestErrorKind,
    message: string,
    options: DashboardRequestErrorOptions,
  ) {
    super(message);
    this.name = "DashboardRequestError";
    this.kind = kind;
    this.retryable = options.retryable;
    if (options.status !== undefined) this.status = options.status;
  }

  toJSON(): {
    kind: DashboardRequestErrorKind;
    message: string;
    retryable: boolean;
    status?: number;
  } {
    return this.status === undefined
      ? { kind: this.kind, message: this.message, retryable: this.retryable }
      : {
          kind: this.kind,
          message: this.message,
          retryable: this.retryable,
          status: this.status,
        };
  }
}
