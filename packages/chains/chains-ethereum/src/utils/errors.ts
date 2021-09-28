const base = parseInt("REN-ETH", 36) << 4;

export enum ETHEREUM_ERROR {
    ASSET_NOT_SUPPORTED = base ^ 1,
    NETWORK_ERROR = base ^ 2,
}
