import {
    ContractCall,
    MintChain,
    OverwritableBurnAndReleaseParams,
    OverwritableLockAndMintParams,
    SyncOrPromise,
} from "@renproject/interfaces";
import { Callable, Ox, toBigNumber } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { provider } from "web3-providers";

import { Address, EthereumBaseChain, Transaction } from "./base";
import { EthereumConfig } from "./networks";

export class EthereumClass extends EthereumBaseChain
    implements MintChain<Transaction, Address> {
    public _getParams:
        | ((
              asset: string,
              burnPayload?: string,
          ) => SyncOrPromise<
              | OverwritableBurnAndReleaseParams
              | OverwritableLockAndMintParams
              | undefined
          >)
        | undefined;

    constructor(web3Provider: provider, renNetworkDetails?: EthereumConfig) {
        super(web3Provider, renNetworkDetails);
    }

    public getMintParams = (
        asset: string,
    ): SyncOrPromise<OverwritableLockAndMintParams | undefined> =>
        this._getParams ? this._getParams(asset) : undefined;

    public getBurnParams = (
        asset: string,
        burnPayload?: string,
    ): SyncOrPromise<OverwritableBurnAndReleaseParams | undefined> =>
        this._getParams ? this._getParams(asset, burnPayload) : undefined;

    public Address = (address: string) => this.Account({ address });

    public Account = ({
        value,
        address,
    }: {
        value?: BigNumber | string | number;
        address?: string;
    }): this => {
        this._getParams = async (
            asset: string,
            burnPayload?: string,
        ): Promise<{ contractCalls: ContractCall[] }> => {
            if (!this.renNetworkDetails || !this.web3) {
                throw new Error(
                    `Ethereum must be initialized before calling 'getContractCalls'`,
                );
            }
            if (!value) {
                // Mint
                if (!address) {
                    throw new Error(`Must provide Ethereum recipient address`);
                }

                // Resolve .ens name
                if (/.*\.ens/.exec(address)) {
                    address = await this.web3.eth.ens.getAddress(address);
                }

                return {
                    contractCalls: [
                        {
                            sendTo: this.renNetworkDetails.addresses
                                .BasicAdapter,
                            contractFn: "mint",
                            contractParams: [
                                {
                                    type: "string",
                                    name: "_symbol",
                                    value: asset,
                                },
                                {
                                    type: "address",
                                    name: "_address",
                                    value: address,
                                },
                            ],
                            // txConfig,
                        },
                    ],
                };
            } else {
                // Burn

                if (!value) {
                    throw new Error(
                        `Send amount must be provided in order to send directly to an address.`,
                    );
                }

                if (!burnPayload) {
                    throw new Error(`Must provide burn recipient address`);
                }

                const addressToBuffer = Buffer.from(burnPayload);

                const gateway = await this.getGatewayContractAddress(asset);

                return {
                    contractCalls: [
                        {
                            sendTo: gateway,
                            contractFn: "burn",
                            contractParams: [
                                {
                                    type: "bytes" as const,
                                    name: "_to",
                                    value: Ox(addressToBuffer),
                                },
                                {
                                    type: "uint256" as const,
                                    name: "_amount",
                                    value: toBigNumber(value).toFixed(),
                                },
                            ],
                            // txConfig,
                        },
                    ],
                };
            }
        };

        return this;
    };

    public Contract = (
        contractCall:
            | ContractCall
            | ((burnAddress: string, asset: string) => ContractCall),
    ): this => {
        this._getParams = (asset: string, burnPayload?: string) => {
            if (!this.renNetworkDetails) {
                throw new Error(
                    `Ethereum must be initialized before calling 'getContractCalls'`,
                );
            }
            if (typeof contractCall === "function") {
                if (!burnPayload) {
                    throw new Error(`Must provide burn payload`);
                }
                const addressToBuffer = Buffer.from(burnPayload);
                return {
                    contractCalls: [contractCall(Ox(addressToBuffer), asset)],
                };
            } else {
                return { contractCalls: [contractCall] };
            }
        };

        return this;
    };

    public Transaction = (transaction: Transaction) => {
        this._getParams = (_asset: string, _burnPayload?: string) => {
            return {
                transaction,
            };
        };
        return this;
    };

    public BurnNonce = (burnNonce: Buffer | string | number) => {
        this._getParams = (_asset: string, _burnPayload?: string) => {
            return {
                burnNonce,
            };
        };
        return this;
    };
}

export type Ethereum = EthereumBaseChain;
export const Ethereum = Callable(EthereumClass);
