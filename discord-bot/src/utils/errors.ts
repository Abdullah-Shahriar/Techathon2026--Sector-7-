export class FriendlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FriendlyError";
  }
}

export function userFacingError(error: unknown): string {
  if (error instanceof FriendlyError) return error.message;
  if (error instanceof Error && error.message) return `Something went wrong: ${error.message}`;
  return "Something went wrong while handling that command.";
}
