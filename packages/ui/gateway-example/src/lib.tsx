// tslint:disable: no-console react-this-binding-issue

import { LockAndMintParams, RenContract, RenNetwork } from "@renproject/interfaces";
import { Ox, payloadToMintABI, randomNonce, strip0x } from "@renproject/utils";
import BigNumber from "bignumber.js";

// tslint:disable-next-line: no-any
type Web3 = any;

export const DEFAULT_CONFIRMATIONLESS_FEE = new BigNumber(10000);

export const confirmationlessShifters = {
    [RenNetwork.Devnet]: "0xeaC1449abA83Fc6B6ed0442e5C86A485D8C43B75",
};

export const to0Conf = (web3: Web3, network: string | RenNetwork, params: LockAndMintParams): LockAndMintParams => {

    if (!params.contractCalls) {
        return params;
    }

    if (params.sendToken !== RenContract.Btc2Eth) {
        throw new Error(`Confirmationless is currently only supported for BTC.`);
    }

    // TODO: Don't hard-code
    const confirmationlessShifter = confirmationlessShifters[network];

    if (!confirmationlessShifter) {
        throw new Error(`Confirmationless is currently only supported for 'devnet'`);
    }

    const fee = DEFAULT_CONFIRMATIONLESS_FEE;

    // if (params.requiredAmount) {
    //     const requiredAmount = toBigNumber(params.requiredAmount.toString());
    //     // TODO: Consider shift in fee.
    //     if (requiredAmount.lte(fee.plus(DEFAULT_SHIFT_FEE))) {
    //         throw new Error(`Required amount (${requiredAmount.toString()}) is less than confirmationlessFee (${fee.toString()}) and mint fee.`);
    //     }
    // }

    const lastCallIndex = params.contractCalls.length - 1;
    if (lastCallIndex === -1) {
        throw new Error(`No contract calls provided for confirmationless shift.`);
    }

    const { contractFn, contractParams, sendTo, txConfig } = params.contractCalls[lastCallIndex];

    if (!contractParams || contractParams.length === 0 || !contractParams[0].name.match(/^_?shifter$/i)) {
        throw new Error(`Confirmationless shift requires the contract's first parameter to be called 'shifter' or '_shifter'`);
    }

    const ABI = payloadToMintABI(contractFn, (contractParams || []));

    const contract = new web3.eth.Contract(ABI, sendTo);

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

    params.confirmations = params.confirmations === undefined ? 0 : params.confirmations;

    return params;
};

