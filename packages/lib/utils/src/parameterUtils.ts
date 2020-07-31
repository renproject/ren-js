export const x = 0;

// import { BurnAndReleaseParams, LockAndMintParams } from "@renproject/interfaces";

// import { parseRenContract, resolveInToken, resolveOutToken } from "./renVMUtils";
// import { utils } from "./utils";
// import { toBigNumber } from "./value";

// /**
//  * `resolveSendCall` simplifies the arguments required by RenJS by allowing
//  * developers to pass in a non-contract address as the `sendTo` field.
//  * This function checks if this is the case and makes the required changes to
//  * the parameters;
//  */
// export const resolveSendCall = (network: RenNetwork, params: SendParams, lockAndMint?: boolean): LockAndMintParams | BurnAndReleaseParams => {

//     const { sendTo, sendAmount, suggestedAmount, txConfig, ...restOfParams } = params;

//     const amount = sendAmount || suggestedAmount;

//     // The contract call hasn't been provided - but `sendTo` has. We overwrite
//     // the contract call with a simple adapter call.

//     if (!sendTo) {
//         throw new Error(`"sendTo" parameter must be provided.`);
//     }

//     lockAndMint = lockAndMint === undefined ? !!String(sendTo).match(/^(0x)[0-9a-fA-Z]{40}$/) : lockAndMint;

//     const sendToken = lockAndMint ? resolveInToken(params.sendToken) : resolveOutToken(params.sendToken);

//     const renContract = parseRenContract(sendToken);
//     if (renContract.to === Chain.Ethereum) {
//         // Mint
//         return {
//             ...restOfParams,
//             suggestedAmount: amount,
//             contractCalls: [{
//                 sendTo: network.addresses.gateways.BasicAdapter.address,
//                 contractFn: "mint",
//                 contractParams: [
//                     { type: "string", name: "_symbol", value: renContract.asset },
//                     { type: "address", name: "_address", value: sendTo },
//                 ],
//                 txConfig,
//             }],
//         };
//     } else {
//         // Burn

//         if (!amount) {
//             throw new Error(`Send amount must be provided in order to send directly to an address.`);
//         }

//         const token = parseRenContract(sendToken).asset as "BTC" | "ZEC" | "BCH";
//         const addressToHex = utils[token].addressToHex(sendTo);

//         // const tokenAddress = await getTokenAddress(network, web3, sendToken);
//         // const approve = {
//         //     sendTo: tokenAddress,
//         //     contractFn: "approve",
//         //     contractParams: [
//         //         { type: "address" as const, name: "spender", value: network.addresses.gateways.BasicAdapter.address },
//         //         { type: "uint256" as const, name: "amount", value: toBigNumber(amount).toFixed() },
//         //     ],
//         //     txConfig,
//         // };

//         const gateway: string = network.addresses.gateways[`${token.toUpperCase()}Gateway`]._address;

//         return {
//             ...restOfParams,
//             suggestedAmount: amount,
//             contractCalls: [
//                 // approve,
//                 {
//                     sendTo: gateway,
//                     contractFn: "burn",
//                     contractParams: [
//                         { type: "bytes" as const, name: "_to", value: addressToHex },
//                         { type: "uint256" as const, name: "_amount", value: toBigNumber(amount).toFixed() },
//                     ],
//                     // txConfig: { gas: 200000, ...txConfig },
//                     txConfig,
//                 }
//             ]
//         };
//     }
// };

// export const processLockAndMintParams = (_network: RenNetwork, _params: LockAndMintParams): LockAndMintParams => {
//     const processors: Array<(params: LockAndMintParams) => LockAndMintParams> = [
//         resolveSendTo<LockAndMintParams>({ isMint: true }),
//         // resolveContractCall<LockAndMintParams>(_network),
//     ];

//     return processors.reduce((params, processor) => processor(params), _params as LockAndMintParams);
// };

// export const processBurnAndReleaseParams = (_network: RenNetwork, _params: BurnAndReleaseParams): BurnAndReleaseParams => {
//     const processors: Array<(params: BurnAndReleaseParams) => BurnAndReleaseParams> = [
//         resolveSendTo<BurnAndReleaseParams>({ isMint: false }),
//         // resolveContractCall<BurnAndReleaseParams>(_network),
//     ];

//     return processors.reduce((params, processor) => processor(params), _params as BurnAndReleaseParams);
// };
