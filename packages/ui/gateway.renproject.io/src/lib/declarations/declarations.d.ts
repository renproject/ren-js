declare module "@ledgerhq/hw-transport-u2f";
declare module "@ledgerhq/web3-subprovider";
declare module "web3-provider-engine";
declare module "web3-provider-engine/subproviders/fetch";
declare module "web3-provider-engine/subproviders/nonce-tracker";
declare module "web3-provider-engine/util/create-payload";
declare module "wallet-address-validator";

declare module "*.scss" {
    const content: { [className: string]: string };
    export = content;
}
