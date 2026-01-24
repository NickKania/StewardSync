/**
 * Result type for mutations that can fail with user-facing errors.
 * This allows Convex to distinguish between expected validation errors
 * (which return success: false) and actual failures (which throw errors).
 */
export type Success<T> = {
  success: true;
  data: T;
};

export type Failure = {
  success: false;
  error: string;
};

export type Result<T> = Success<T> | Failure;

/**
 * Helper functions for creating Result objects
 */
export const success = <T>(data: T): Success<T> => ({
  success: true,
  data,
});

export const failure = (error: string): Failure => ({
  success: false,
  error,
});
