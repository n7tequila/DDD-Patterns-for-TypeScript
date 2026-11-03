export type Result<T, E extends { readonly kind: string }> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): { readonly ok: true; readonly value: T } => ({ ok: true, value });
export const err = <E extends { readonly kind: string }>(error: E): { readonly ok: false; readonly error: E } => ({
  ok: false,
  error,
});
