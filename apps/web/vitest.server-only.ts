// Vitest runs server-side modules outside the Next.js compiler, where the
// framework's `server-only` marker is not resolved. Alias that marker to this
// no-op module in test configs so unit/integration tests can exercise server
// helpers without weakening production's server-only boundaries.
export {};
