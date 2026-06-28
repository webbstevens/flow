import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Version-skew protection. After a redeploy, a returning visitor's browser
  // may hold the previous build's HTML/JS (the static document is edge-cached
  // with a long s-maxage). Without a deployment ID, tapping a <Link> tries to
  // soft-navigate into chunks that no longer exist on the server and silently
  // does nothing. Tagging each build with a deployment ID makes the client
  // detect the mismatch on navigation and perform a hard reload (fetching the
  // current build) instead of a dead client-side navigation. It also appends
  // ?dpl=<id> to asset URLs for cache busting.
  // Railway injects these at build time; falls back to undefined locally.
  deploymentId:
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.NEXT_DEPLOYMENT_ID ||
    undefined,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
