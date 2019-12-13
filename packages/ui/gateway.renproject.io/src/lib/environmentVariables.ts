// User-configured
export const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
export const ETHEREUM_NODE = process.env.REACT_APP_ETHEREUM_NODE || `${"http"}://localhost:8545`;
export const NETWORK = process.env.REACT_APP_NETWORK || "testnet";
export const ENABLE_TEST_ENDPOINT = process.env.REACT_APP_ENABLE_TEST_ENDPOINT === "1" || process.env.NODE_ENV === "development";

// Not configured
export const SOURCE_VERSION = process.env.REACT_APP_SOURCE_VERSION;
export const ENVIRONMENT = ((process.env.NODE_ENV === "development") ? "development" : NETWORK) || "unknown";
export const IS_TESTNET = NETWORK !== "mainnet" && NETWORK !== "chaosnet";
