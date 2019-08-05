declare module "truffle-hdwallet-provider" {
    const HDWalletProvider;
    type HDWalletProvider = any;
    export default HDWalletProvider;
}

declare module "web3-eth-contract" {
    export type Contract = any;
}

declare module "bitgo-utxo-lib";