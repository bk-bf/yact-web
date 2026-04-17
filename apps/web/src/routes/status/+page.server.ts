import { redirect } from "@sveltejs/kit";

// Deprecated 2026-04-17: replaced by /dashboard.  Keep the redirect so any
// saved bookmarks or links to /status still work.
export function load() {
  throw redirect(301, "/dashboard");
}
