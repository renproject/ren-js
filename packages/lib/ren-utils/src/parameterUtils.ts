import { BurnAndReleaseParams, Chain, LockAndMintParams, SendParams } from "@renproject/interfaces";

import {
    parseRenContract, resolveInToken, resolveOutToken, resolveSendTo, utils,
} from "./renVMUtils";
import { NetworkDetails } from "./types/networks";
import { toBigNumber } from "./utils";

/**
 * `resolveSendCall` simplifies the arguments required by RenJS by allowing
 * developers to pass in a non-contract address as the `sendTo` field.
 * This function checks if this is the case and makes the required changes to
 * the parameters;
 */
export const resolveSendCall = (network: NetworkDetails, params: SendParams): LockAndMintParams | BurnAndReleaseParams => {

    const { sendTo, sendAmount, txConfig, ...restOfParams } = params;

    // The contract call hasn't been provided - but `sendTo` has. We overwrite
    // the contract call with a simple adapter call.

    if (!sendTo) {
        throw new Error(`"sendTo" parameter must be provided.`);
    }

    const shiftIn = String(sendTo).match(/^(0x)[0-9a-fA-Z]{40}$/);

    const sendToken = shiftIn ? resolveInToken(params.sendToken) : resolveOutToken(params.sendToken);

    const renContract = parseRenContract(sendToken);
    if (renContract.to === Chain.Ethereum) {

        let shifter: string;
        let shiftedToken: string;
        if (network.contracts.version === "0.0.3") {
            shifter = network.contracts.addresses.shifter[`${renContract.asset}Shifter`]._address;
            shiftedToken = network.contracts.addresses.shifter[`z${renContract.asset}`]._address;
        } else {
            shifter = network.contracts.addresses.shifter[`${renContract.asset}Gateway` as "BTCGateway"]._address;
            shiftedToken = network.contracts.addresses.shifter[`Ren${renContract.asset}`]._address;
        }

        // Shift in
        return {
            ...restOfParams,
            suggestedAmount: sendAmount,
            contractCalls: [{
                sendTo: network.contracts.addresses.shifter.BasicAdapter.address,
                contractFn: network.contracts.version === "0.0.3" ? "shiftIn" : "mint",
                contractParams: [
                    { type: "string", name: "_symbol", value: network.contracts.version === "0.0.3" ? "z" + renContract.asset : renContract.asset },
                    { type: "address", name: "_address", value: sendTo },
                ],
                txConfig,
            }],
        };
    } else {
        // Shift out

        if (!sendAmount) {
            throw new Error(`Send amount must be provided in order to send directly to an address.`);
        }

        const token = parseRenContract(sendToken).asset as "BTC" | "ZEC" | "BCH";
        const addressToHex = utils[token].addressToHex(sendTo);

        // const shiftedTokenAddress = await getTokenAddress(network, web3, sendToken);
        // const approve = {
        //     sendTo: shiftedTokenAddress,
        //     contractFn: "approve",
        //     contractParams: [
        //         { type: "address" as const, name: "spender", value: network.contracts.addresses.shifter.BasicAdapter.address },
        //         { type: "uint256" as const, name: "amount", value: toBigNumber(sendAmount).toFixed() },
        //     ],
        //     txConfig,
        // };

        let shifter: string;
        if (network.contracts.version === "0.0.3") {
            shifter = network.contracts.addresses.shifter[`${token.toUpperCase()}Shifter`]._address;
        } else {
            shifter = network.contracts.addresses.shifter[`${token.toUpperCase()}Gateway`]._address;
        }

        return {
            ...restOfParams,
            suggestedAmount: sendAmount,
            contractCalls: [
                // approve,
                {
                    sendTo: shifter,
                    contractFn: network.contracts.version === "0.0.3" ? "shiftOut" : "burn",
                    contractParams: [
                        { type: "bytes" as const, name: "_to", value: addressToHex },
                        { type: "uint256" as const, name: "_amount", value: toBigNumber(sendAmount).toFixed() },
                    ],
                    // txConfig: { gas: 200000, ...txConfig },
                    txConfig,
                }
            ]
        };
    }
};

export const processLockAndMintParams = (_network: NetworkDetails, _params: LockAndMintParams): LockAndMintParams => {
    const processors: Array<(params: LockAndMintParams) => LockAndMintParams> = [
        resolveSendTo<LockAndMintParams>({ shiftIn: true }),
        // resolveContractCall<LockAndMintParams>(_network),
    ];

    return processors.reduce((params, processor) => processor(params), _params as LockAndMintParams);
};
export const processShiftInParams = processLockAndMintParams;

export const processBurnAndReleaseParams = (_network: NetworkDetails, _params: BurnAndReleaseParams): BurnAndReleaseParams => {
    const processors: Array<(params: BurnAndReleaseParams) => BurnAndReleaseParams> = [
        resolveSendTo<BurnAndReleaseParams>({ shiftIn: false }),
        // resolveContractCall<BurnAndReleaseParams>(_network),
    ];

    return processors.reduce((params, processor) => processor(params), _params as BurnAndReleaseParams);
};
export const processShiftOutParams = processBurnAndReleaseParams;
