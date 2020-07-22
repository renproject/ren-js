// User-configured
export const SENTRY_DSN: string | undefined = (process.env.NODE_ENV === "development") ? undefined : process.env.REACT_APP_SENTRY_DSN;
export const ETHEREUM_NODE: string = process.env.REACT_APP_ETHEREUM_NODE || `${"http"}://localhost:8545`;
export const DEFAULT_NETWORK: string = process.env.REACT_APP_NETWORK || "testnet";

// Not configured
export const SOURCE_VERSION: string | undefined = process.env.REACT_APP_SOURCE_VERSION;
export const SENTRY_ENVIRONMENT: string = ((process.env.NODE_ENV === "development") ? "development" : DEFAULT_NETWORK) || "unknown";
