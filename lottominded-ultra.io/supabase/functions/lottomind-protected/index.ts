// The protected entry point reuses the audited LottoMind router. The router
// selects its protected allowlist from this function's request-path prefix,
// while Supabase verifies the caller JWT before this module runs.
import "../lottomind-api/index.ts";
