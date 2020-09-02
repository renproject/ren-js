import {
    ContractCall,
    EventType,
    MintChain,
    provider,
    RenNetwork,
    SyncOrPromise,
} from "@renproject/interfaces";
import { RenNetworkDetails } from "@renproject/networks";
import { Ox } from "@renproject/utils";
import BigNumber from "bignumber.js";

import { Callable } from "../class";
import { toBigNumber } from "../value";
import { Asset, EthereumBaseChain, Transaction } from "./base";

export class EthereumChain
    extends EthereumBaseChain
    implements MintChain<Transaction, Asset> {
    public getContractCalls:
        | ((
              eventType: EventType,
              asset: Asset,
              burnPayload?: string
          ) => SyncOrPromise<ContractCall[]>)
        | undefined;

    constructor(
        web3Provider: provider,
        renNetwork?: RenNetwork,
        renNetworkDetails?: RenNetworkDetails
    ) {
        super(web3Provider, renNetwork, renNetworkDetails, EthereumChain);
    }

    public contractCalls = (
        eventType: EventType,
        asset: Asset,
        burnPayload?: string
    ) =>
        this.getContractCalls
            ? this.getContractCalls(eventType, asset, burnPayload)
            : undefined;

    public Account = ({
        value,
        address,
    }: {
        value: BigNumber | string | number;
        address?: string;
    }): this => {
        this.getContractCalls = async (
            eventType: EventType,
            asset: Asset,
            burnPayload?: string
        ) => {
            if (!this.renNetwork || !this.renNetworkDetails) {
                throw new Error(
                    `Ethereum must be initialized before calling 'getContractCalls'`
                );
            }
            if (eventType === EventType.LockAndMint) {
                // Mint
                if (!address) {
                    throw new Error(`Must provide Ethereum recipient address`);
                }
                return [
                    {
                        sendTo: this.renNetworkDetails.addresses.gateways
                            .BasicAdapter.address,
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
                ];
            } else {
                // Burn

                if (!value) {
                    throw new Error(
                        `Send amount must be provided in order to send directly to an address.`
                    );
                }

                if (!burnPayload) {
                    throw new Error(`Must provide burn recipient address`);
                }

                const addressToHex = Ox(Buffer.from(burnPayload));

                const gateway = await this.getGatewayContractAddress(asset);

                return [
                    {
                        sendTo: gateway,
                        contractFn: "burn",
                        contractParams: [
                            {
                                type: "bytes" as const,
                                name: "_to",
                                value: addressToHex,
                            },
                            {
                                type: "uint256" as const,
                                name: "_amount",
                                value: toBigNumber(value).toFixed(),
                            },
                        ],
                        // txConfig,
                    },
                ];
            }
        };
        return this;
    };

    public Contract = (
        contractCall:
            | ContractCall
            | ((burnAddress: string, asset: string) => ContractCall)
    ): this => {
        this.getContractCalls = (
            _eventType: EventType,
            asset: Asset,
            burnPayload?: string
        ) => {
            if (!this.renNetwork) {
                throw new Error(
                    `Ethereum must be initialized before calling 'getContractCalls'`
                );
            }
            if (typeof contractCall === "function") {
                if (!burnPayload) {
                    throw new Error(`Must provide burn payload`);
                }
                const addressToHex = Ox(Buffer.from(burnPayload));
                return [contractCall(addressToHex, asset)];
            } else {
                return [contractCall];
            }
        };
        return this;
    };
}

export const Ethereum = Callable(EthereumChain);
