// Re-export from auth.tsx to keep both @/lib/auth (resolves to .ts first) and
// direct .tsx imports working. The implementation lives in auth.tsx.
export * from "./auth.tsx";
