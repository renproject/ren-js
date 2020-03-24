// tslint:disable: no-console react-this-binding-issue

import * as React from "react";

import { useEphemeralKey, useWeb3Network } from "@openzeppelin/network/react";
import GatewayJS from "@renproject/gateway";
import {
    Ox, RenContract, RenNetwork, ShiftInParams, strip0x, toBigNumber, UnmarshalledMintTx,
} from "@renproject/interfaces";
import { DEFAULT_SHIFT_FEE, payloadToShiftInABI, randomNonce, sleep } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { parse } from "qs";
import { HttpProvider } from "web3-providers";
import Web3 from "web3";

import { to0Conf } from "./lib";

interface InjectedEthereum extends HttpProvider {
    enable: () => Promise<void>;
}

// tslint:disable-next-line: no-any
declare global {
    interface Window {
        ethereum?: InjectedEthereum;
        web3?: Web3 | undefined;
    }
}

const startShiftIn = async (web3: Web3, gatewayJS: GatewayJS, amount: string, ethereumAddress: string, setTxHash: (txHash: string | null) => void, network: string) => {

    const shiftInParams: ShiftInParams = to0Conf(web3, network, {
        web3Provider: web3.currentProvider,

        // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
        sendToken: GatewayJS.Tokens.BTC.Btc2Eth,

        suggestedAmount: GatewayJS.utils.value(amount, "btc").sats(),
        contractCalls: [{
            sendTo: "0x2Faa571A69aed0CdE2d3C96c0Dce9D2aa2E3806C", // network.contracts.addresses.shifter.BasicAdapter.address,
            contractFn: "shiftIn",
            contractParams: [
                { type: "address", name: "_shifter", value: await gatewayJS.getShifterAddress(web3, "BTC"), },
                { type: "address", name: "_shiftedToken", value: await gatewayJS.getTokenAddress(web3, "BTC"), },
                { type: "address", name: "_address", value: ethereumAddress },
            ],
        }],

        // The nonce is used to guarantee a unique deposit address.
        nonce: GatewayJS.utils.randomNonce(),

        confirmations: 0,

    });

    if (shiftInParams.confirmations === 0) {
        setTxHash(null);
    }

    const result = await gatewayJS.open(shiftInParams).result()
        .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); });

    console.log(result);

    if (shiftInParams.confirmations === 0) {
        if (!result || (Object.keys(result).length === 0 && result.constructor === Object)) {
            throw new Error(`Expected valid result from GatewayJS`);
        }

        const numberToHex = (n: BigNumber | number): string => {
            const hex = strip0x(n.toString(16));
            const padding = "0".repeat(64 - hex.length);
            return "0x" + padding + hex;
        };

        const contractCalls = shiftInParams.contractCalls;
        if (!contractCalls) {
            throw new Error("No contract calls found");
        }

        const lastContractCall = contractCalls[contractCalls.length - 1];
        if (!lastContractCall || !lastContractCall.contractParams) {
            throw new Error("No contract call found");
        }

        const confirmationFee = numberToHex(new BigNumber(lastContractCall.contractParams[0].value));
        const amountAfterFees = numberToHex(new BigNumber((result as UnmarshalledMintTx).autogen.amount));
        const nHash = (result as UnmarshalledMintTx).autogen.nhash;

        // tslint:disable-next-line: no-constant-condition
        while (true) {
            const logs = await web3.eth.getPastLogs({
                address: lastContractCall.sendTo,
                fromBlock: "0",
                toBlock: "latest",
                topics: [web3.utils.sha3("LogConfirmationlessShiftIn(bytes32,uint256,uint256,address,bool)"), nHash, amountAfterFees, confirmationFee],
            });

            if (logs.length > 0) {
                setTxHash(logs[0].transactionHash);
                break;
            }
            await sleep(1000);
        }
    }
};

// const startShiftOut = async (web3: Web3, gatewayJS: GatewayJS) => {
//     const amount = 0.000225; // BTC
//     const recipient = prompt("Enter ₿ Bitcoin address to receive BTC");
//     if (!recipient) { return; }

//     gatewayJS.send({
//         web3Provider: web3.currentProvider,

//         // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
//         sendToken: GatewayJS.Tokens.BTC.Eth2Btc,

//         // Amount of BTC we are sending (in Satoshis)
//         sendAmount: GatewayJS.utils.value(amount, "btc").sats().toFixed(),

//         // The contract we want to interact with
//         sendTo: recipient,
//     }).result()
//         .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); })
//         .then(console.log)
//         .catch(console.error);
// };

const recoverTrades = async (web3: Web3, gatewayJS: GatewayJS) => {
    // Re-open incomplete trades
    const previousGateways = await gatewayJS.getGateways();
    for (const trade of Array.from(previousGateways.values())) {
        gatewayJS
            .recoverShift(web3.currentProvider, trade)
            .pause()
            .result()
            .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); })
            .then(console.log)
            .catch(console.error);
    }
};

export const GatewayExample = () => {

    const context = useWeb3Network(process.env.REACT_APP_ETHEREUM_NODE || "", {
        gsn: { signKey: useEphemeralKey() }
        // tslint:disable-next-line: no-any
    } as any);

    const urlParameters = parse(window.location.search, { ignoreQueryPrefix: true });

    const network = urlParameters.network || "testnet";

    // If the network is changed, `sendTo` should be changed too.
    const gatewayJS = React.useMemo(() => new GatewayJS(
        network,
        { endpoint: urlParameters.endpoint || undefined },
    ), []);

    React.useEffect(() => {
        (async () => {

            recoverTrades(context.lib as unknown as Web3, gatewayJS).catch(console.error);
        })().catch(console.error);
    }, []);

    const [ethereumAddress, setEthereumAddress] = React.useState("");
    const [amount, setAmount] = React.useState("");

    const validAddress = React.useMemo(() => {
        return ethereumAddress.match(/^(0x)[0-9a-fA-Z]{40}$/);
    }, [ethereumAddress]);

    const [errorMessage, setErrorMessage] = React.useState(null as string | null);

    const [txHash, setTxHash] = React.useState(undefined as undefined | null | string);

    const onSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validAddress) {
            setErrorMessage("Please enter a valid Ethereum address.");
            return;
        }
        if (!amount) {
            setErrorMessage("Please enter a valid amount.");
            return;
        }
        setErrorMessage(null);
        try {
            await startShiftIn(context.lib as unknown as Web3, gatewayJS, amount, ethereumAddress, setTxHash, network);
        } catch (error) {
            setErrorMessage(String(error.message || error.error || JSON.stringify(error)));
        }
    }, [startShiftIn, context.lib, gatewayJS, amount, ethereumAddress, validAddress]);

    return <>
        <form onSubmit={onSubmit} className={`test-environment ${txHash === null ? "disabled" : ""}`}>
            <p className="box">Send Testnet BTC to an Ethereum address (Kovan).</p>

            <div className="send">
                <input value={ethereumAddress} onChange={(e) => { setEthereumAddress(e.target.value); }} placeholder="Ethereum address" />
            </div>

            <div className="send">
                <div className="send">
                    <input value={amount} onChange={(e) => { setAmount(e.target.value); }} placeholder="Amount" />
                    <div className="box">BTC</div>
                </div>
                <button disabled={txHash === null} type="submit" className={`blue ${!amount || !validAddress ? "disabled" : ""}`}>Send</button>
            </div>
            {errorMessage ? <p className="box red">{errorMessage}</p> : <></>}
            {txHash === null ? <p>Submitting to Ethereum...</p> : <></>}
            {typeof txHash === "string" ? <p>Submitted! <a href={`https://kovan.etherscan.io/tx/${txHash}`}>Etherscan</a></p> : <></>}
        </form>
    </>;
};
