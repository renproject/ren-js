import {
    BigNumber, BurnContractCallSimple, Chain, DetailedContractCall, Ox, RenContract, RenNetwork,
    ShiftInFromDetails, ShiftInFromDetailsConfirmationless, ShiftInParams, ShiftInParamsAll,
    ShiftOutParams, ShiftOutParamsAll, ShiftOutParamsCommon, strip0x,
} from "@renproject/ren-js-common";
import Web3 from "web3";

// import { Contract } from "web3-eth-contract";
import { parseRenContract } from "../types/assets";
import { NetworkDetails } from "../types/networks";
import { payloadToShiftInABI } from "./abi";
import { getTokenAddress, getTokenName, randomNonce, toBigNumber, utils } from "./utils";

// TODO: Fetch from contract
export const DEFAULT_SHIFT_FEE = new BigNumber(10000);
export const DEFAULT_CONFIRMATIONLESS_FEE = new BigNumber(10000);

export const resolveSendTo = <T extends ShiftInParamsAll | ShiftOutParamsAll>({ shiftIn }: { shiftIn: T extends ShiftOutParamsAll ? false : true }) => (params: T): typeof params => {
    if ((params as ShiftInFromDetails | ShiftOutParamsCommon).sendToken) {
        (params as ShiftInFromDetails | ShiftOutParamsCommon).sendToken = ((): RenContract => {
            const token = (params as ShiftInFromDetails | ShiftOutParamsCommon).sendToken;
            switch (token) {
                case "BTC":
                    return shiftIn ? RenContract.Btc2Eth : RenContract.Eth2Btc;
                case "BCH":
                    return shiftIn ? RenContract.Bch2Eth : RenContract.Eth2Bch;
                case "ZEC":
                    return shiftIn ? RenContract.Zec2Eth : RenContract.Eth2Zec;
                default:
                    return token;
            }
        })();
    }
    return params;
};

/**
 * `resolveContractCall` simplifies the arguments required by RenJS by allowing
 * developers to pass in a non-contract address as the `sendTo` field.
 * This function checks if this is the case and makes the required changes to
 * the parameters;
 */
export const resolveContractCall = <T extends ShiftInParamsAll | ShiftOutParamsAll>(network: NetworkDetails) => (params: T): T => {

    if ((params as ShiftOutParamsAll).burnReference || (params as ShiftOutParamsAll).ethTxHash) {
        // Burn already submitted to Ethereum.
        return params;
    }

    if (params.contractCalls) {
        // Check that the params are accompanied by a function name
        for (const singleContractCall of params.contractCalls) {
            if (typeof singleContractCall === "function" || singleContractCall.hasOwnProperty("then")) {
                continue;
            }
            if (!(singleContractCall as DetailedContractCall).sendTo) {
                throw new Error("Send address must be provided with contract parameters.");
            }
            if (!(singleContractCall as DetailedContractCall).contractFn) {
                throw new Error("Contract function name must be provided with contract parameters.");
            }
        }

        return params;
    }

    const { sendTo, contractParams, contractFn, txConfig, ...restOfParams } = (params as unknown as DetailedContractCall);

    if (!sendTo) {
        return params;
    }

    // Check that the params are accompanied by a function name
    if (contractParams && !contractFn) {
        throw new Error("Contract function name must be provided with contract parameters.");
    }

    // Check if the RenJS has been passed in the contract call details
    if (contractFn) {
        return {
            ...restOfParams,
            contractCalls: [{
                sendTo,
                contractParams: contractParams || [],
                contractFn,
                txConfig,
            }],
        } as unknown as T;
    }

    // The contract call hasn't been provided - but `sendTo` has. We overwrite
    // the contract call with a simple adapter call.

    const sendToken = params.sendToken;
    if (!sendToken) {
        throw new Error(`Send token must be provided in order to send directly to an address.`);
    }

    const renContract = parseRenContract(sendToken);
    if (renContract.to === Chain.Ethereum) {
        // Shift in
        return {
            ...restOfParams,
            contractCalls: [{
                sendTo: network.contracts.addresses.shifter.BasicAdapter.address,
                contractFn: "shiftIn",
                contractParams: [
                    { type: "address", name: "_shifterRegistry", value: network.contracts.addresses.shifter.ShifterRegistry.address },
                    { type: "string", name: "_symbol", value: getTokenName(renContract.asset) },
                    { type: "address", name: "_address", value: sendTo },
                ],
                txConfig,
            }],
        } as unknown as T;
    } else {
        // Shift out

        const { sendAmount, ...restOfBurnParams } = (restOfParams as BurnContractCallSimple);

        if (!sendAmount) {
            throw new Error(`Send amount must be provided in order to send directly to an address.`);
        }

        const addressToHex = utils[parseRenContract(sendToken).asset as "BTC" | "ZEC" | "BCH"].addressToHex(sendTo);

        // tslint:disable-next-line: no-any
        const approve = async (web3Provider: any) => {
            const web3 = new Web3(web3Provider);
            const shiftedTokenAddress = await getTokenAddress(network, web3, sendToken);
            return {
                sendTo: shiftedTokenAddress,
                contractFn: "approve",
                contractParams: [
                    { type: "address", name: "spender", value: network.contracts.addresses.shifter.BasicAdapter.address },
                    { type: "uint256", name: "amount", value: toBigNumber(sendAmount).toFixed() },
                ],
                txConfig,
            };
        };

        return {
            ...restOfBurnParams,
            contractCalls: [
                approve,
                {
                    sendTo: network.contracts.addresses.shifter.BasicAdapter.address,
                    contractFn: "shiftOut",
                    contractParams: [
                        { type: "address", name: "_shifterRegistry", value: network.contracts.addresses.shifter.ShifterRegistry.address },
                        { type: "string", name: "_symbol", value: getTokenName(renContract.asset) },
                        { type: "bytes", name: "_to", value: addressToHex },
                        { type: "uint256", name: "_amount", value: toBigNumber(sendAmount).toFixed() },
                    ],
                    txConfig: { gas: 200000, ...txConfig },
                }]
        } as unknown as T;
    }
};

export const confirmationlessShifters = {
    [RenNetwork.Devnet]: "0xeaC1449abA83Fc6B6ed0442e5C86A485D8C43B75",
};

export const processConfirmationlessParams = (network: NetworkDetails) => (params: ShiftInParamsAll) => {

    if (params.confirmationless && params.contractCalls) {

        if (params.sendToken !== RenContract.Btc2Eth) {
            throw new Error(`Confirmationless is currently only supported for BTC.`);
        }

        // TODO: Don't hard-code
        const confirmationlessShifter = confirmationlessShifters[network.name];

        if (!confirmationlessShifter) {
            throw new Error(`Confirmationless is currently only supported for 'devnet'`);
        }

        const passedInFee = (params as unknown as ShiftInFromDetailsConfirmationless).confirmationlessFee;
        const fee = passedInFee ? toBigNumber(passedInFee) : DEFAULT_CONFIRMATIONLESS_FEE;

        if (params.requiredAmount) {
            const requiredAmount = toBigNumber(params.requiredAmount);
            // TODO: Consider shift in fee.
            if (requiredAmount.lte(fee.plus(DEFAULT_SHIFT_FEE))) {
                throw new Error(`Required amount (${requiredAmount.toString()}) is less than confirmationlessFee (${fee.toString()}) and mint fee.`);
            }
        }

        const lastCallIndex = params.contractCalls.length - 1;
        if (lastCallIndex === -1) {
            throw new Error(`No contract calls provided for confirmationless shift.`);
        }

        const { contractFn, contractParams, sendTo, txConfig } = params.contractCalls[lastCallIndex];

        if (!contractParams || contractParams.length === 0 || !contractParams[0].name.match(/^_?shifter$/i)) {
            throw new Error(`Confirmationless shift requires the contract's first parameter to be called 'shifter' or '_shifter'`);
        }

        const ABI = payloadToShiftInABI(contractFn, (contractParams || []));

        const contract = new (new Web3("")).eth.Contract(ABI, sendTo);

        const nHashPlaceholder = randomNonce();
        const forwardedValue = new BigNumber(0);
        const forwardedSig = Buffer.from([]);

        // Overwrite the shifter being passed to the contract.
        contractParams[0].value = confirmationlessShifter;

        const encodedFunctionCall: string = contract.methods[contractFn](
            ...(contractParams || []).map(value => value.value),
            Ox(forwardedValue.toString(16)), // _amount: BigNumber
            Ox(nHashPlaceholder),
            // Ox(this.response.args.n), // _nHash: string
            forwardedSig, // _sig: string
        ).encodeABI();

        const [encodedFunctionCallBeforeNHash, encodedFunctionCallAfterNHash] = encodedFunctionCall.split(strip0x(nHashPlaceholder)).map(Ox);

        params.contractCalls[lastCallIndex] = {
            // TODO: Don't hard-code
            sendTo: confirmationlessShifter,
            contractFn: "composeShiftIn",
            contractParams: [
                { type: "uint256", name: "_confirmationFee", value: fee.toString() },
                { type: "address", name: "_targetContract", value: sendTo },
                { type: "bytes", name: "_targetCallBeforeNHash", value: encodedFunctionCallBeforeNHash },
                { type: "bytes", name: "_targetCallAfterNHash", value: encodedFunctionCallAfterNHash },
            ],
            txConfig,
        };

        // `confirmationless` is set to false so that the parameters aren't
        // transformed twice.
        params.confirmationless = false;
    }
    return params;
};

export const processShiftInParams = (_network: NetworkDetails, _params: ShiftInParams): ShiftInParamsAll => {
    const processors: Array<(params: ShiftInParamsAll) => ShiftInParamsAll> = [
        resolveSendTo<ShiftInParamsAll>({ shiftIn: true }),
        resolveContractCall<ShiftInParamsAll>(_network),
        processConfirmationlessParams(_network),
    ];

    return processors.reduce((params, processor) => processor(params), _params as ShiftInParamsAll);
};

export const processShiftOutParams = (_network: NetworkDetails, _params: ShiftOutParams): ShiftOutParamsAll => {
    const processors: Array<(params: ShiftOutParamsAll) => ShiftOutParamsAll> = [
        resolveSendTo<ShiftOutParamsAll>({ shiftIn: false }),
        resolveContractCall<ShiftOutParamsAll>(_network),
    ];

    return processors.reduce((params, processor) => processor(params), _params as ShiftOutParamsAll);
};

// Type generics are not playing well.

// export const processParameters = <T extends ShiftInParams | ShiftOutParams, K extends ShiftInParamsAll | ShiftOutParamsAll>(_network: NetworkDetails, _params: T, { shiftIn }: { shiftIn: T extends ShiftOutParams ? false : true }): K => {
//     return resolveContractCall(_network, resolveSendTo(_params, { shiftIn }) as K);
// };
