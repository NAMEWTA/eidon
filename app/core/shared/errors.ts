export class CoreError extends Error {
  constructor(
    message: string,
    public readonly code = "core_error",
  ) {
    super(message);
    this.name = "CoreError";
  }
}
