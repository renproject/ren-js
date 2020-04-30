// tslint:disable: no-console react-this-binding-issue

import * as React from "react";

import GatewayJS from "@renproject/gateway";
import { SendParams } from "@renproject/interfaces";
import { SelectMarket } from "@renproject/react-components";
import { parse } from "qs";
import Web3 from "web3";
import { HttpProvider } from "web3-providers";

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


const startShiftIn = async (web3: Web3, gatewayJS: GatewayJS, amount: string, ethereumAddress: string, setTxHash: (txHash: string | null) => void, network: string, token: Token) => {
    const shiftInParams: SendParams = {
        web3Provider: await GatewayJS.utils.useBrowserWeb3(),
        sendToken: GatewayJS.Tokens[token].Mint,
        sendAmount: GatewayJS.utils.value(amount, "btc").sats(),
        sendTo: ethereumAddress,
    };

    // if (shiftInParams.confirmations === 0) {
    //     setTxHash(null);
    // }

    const result = await gatewayJS.open(shiftInParams).result()
        .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); });

    console.log(result);

    // if (shiftInParams.confirmations === 0) {
    //     if (!result || (Object.keys(result).length === 0 && result.constructor === Object)) {
    //         throw new Error(`Expected valid result from GatewayJS`);
    //     }

    //     const numberToHex = (n: BigNumber | number): string => {
    //         const hex = strip0x(n.toString(16));
    //         const padding = "0".repeat(64 - hex.length);
    //         return "0x" + padding + hex;
    //     };

    //     const contractCalls = shiftInParams.contractCalls;
    //     if (!contractCalls) {
    //         throw new Error("No contract calls found");
    //     }

    //     const lastContractCall = contractCalls[contractCalls.length - 1];
    //     if (!lastContractCall || !lastContractCall.contractParams) {
    //         throw new Error("No contract call found");
    //     }

    //     const confirmationFee = numberToHex(new BigNumber(lastContractCall.contractParams[0].value));
    //     const amountAfterFees = numberToHex(new BigNumber((result as UnmarshalledMintTx).autogen.amount));
    //     const nHash = (result as UnmarshalledMintTx).autogen.nhash;

    //     // tslint:disable-next-line: no-constant-condition
    //     while (true) {
    //         const logs = await web3.eth.getPastLogs({
    //             address: lastContractCall.sendTo,
    //             fromBlock: "0",
    //             toBlock: "latest",
    //             topics: [web3.utils.sha3("LogConfirmationlessShiftIn(bytes32,uint256,uint256,address,bool)"), nHash, amountAfterFees, confirmationFee],
    //         });

    //         if (logs.length > 0) {
    //             setTxHash(logs[0].transactionHash);
    //             break;
    //         }
    //         await sleep(1000);
    //     }
    // }
};

const startShiftOut = async (web3: Web3, gatewayJS: GatewayJS, amount: string, recipient: string, token: Token) => {
    gatewayJS.burnAndRelease({
        web3Provider: await GatewayJS.utils.useBrowserWeb3(),

        // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
        sendToken: GatewayJS.Tokens[token as "BTC" | "ZEC" | "BCH"].Burn,
        sendTo: recipient,
        sendAmount: GatewayJS.utils.value(amount, "btc").sats(),
    }).result()
        .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); })
        .then(console.log)
        .catch(console.error);
};

const recoverTrades = async (web3: Web3, gatewayJS: GatewayJS) => {
    // Re-open incomplete trades
    const previousGateways = await gatewayJS.getGateways();
    for (const trade of Array.from(previousGateways.values())) {
        gatewayJS
            .recoverTransfer(web3.currentProvider, trade)
            .pause()
            .result()
            .on("status", (status) => { console.log(`[GOT STATUS] ${status}`); })
            .then(console.log)
            .catch(console.error);
    }
};

type Token = "BTC" | "ZEC" | "BCH";
export const Tokens = new Map<Token, { symbol: Token; name: string }>()
    .set("BTC", { symbol: "BTC", name: "Bitcoin" })
    .set("ZEC", { symbol: "ZEC", name: "Zcash" })
    .set("BCH", { symbol: "BCH", name: "Bitcoin Cash" });


export const GatewayExample = ({ web3 }: { web3: Web3 }) => {
    const [top, setTop] = React.useState<Token>("BTC");

    React.useEffect(() => {
        if (window.ethereum) {
            window.ethereum.enable().catch(console.error);
        }
    });

    const context = { lib: new Web3(web3.currentProvider) };

    // useWeb3Network(process.env.REACT_APP_ETHEREUM_NODE || "", {
    //     gsn: { signKey: useEphemeralKey() }
    //     // tslint:disable-next-line: no-any
    // } as any);

    const urlParameters = parse(window.location.search, { ignoreQueryPrefix: true });

    const network = urlParameters.network || "testnet";
    const isTestnet = network === "testnet" || network === "devnet";

    // If the network is changed, `sendTo` should be changed too.
    const gatewayJS = React.useMemo(() => new GatewayJS(
        network,
        { endpoint: urlParameters.endpoint || undefined },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ), []);

    React.useEffect(() => {
        (async () => {

            recoverTrades(context.lib as unknown as Web3, gatewayJS).catch(console.error);
        })().catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [ethereumAddress, setEthereumAddress] = React.useState("");
    const [amount, setAmount] = React.useState("");

    const isPending = React.useMemo(() => {
        return !ethereumAddress || ethereumAddress === "";
    }, [ethereumAddress]);
    const isMint = React.useMemo(() => {
        return ethereumAddress.match(/^(0x)[0-9a-fA-Z]{40}$/);
    }, [ethereumAddress]);

    const [errorMessage, setErrorMessage] = React.useState(null as string | null);

    const [txHash, setTxHash] = React.useState(undefined as undefined | null | string);

    const onSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // if (!validAddress) {
        //     setErrorMessage("Please enter a valid Ethereum address.");
        //     return;
        // }
        if (!amount) {
            setErrorMessage("Please enter a valid amount.");
            return;
        }
        setErrorMessage(null);
        try {
            if (isMint) {
                await startShiftIn(context.lib as unknown as Web3, gatewayJS, amount, ethereumAddress, setTxHash, network, top);
            } else {
                await startShiftOut(context.lib as unknown as Web3, gatewayJS, amount, ethereumAddress, top);
            }
        } catch (error) {
            console.error(error);
            setErrorMessage(String(error.message || error.error || JSON.stringify(error)));
        }
    }, [network, top, context.lib, gatewayJS, amount, ethereumAddress, isMint]);

    const onMarketChange = React.useCallback((token) => { setTop(token as Token); }, [setTop]);

    return <>
        <form onSubmit={onSubmit} className={`test-environment ${txHash === null ? "disabled" : ""}`}>
            <p className="box">Send {isTestnet ? "Testnet" : ""} {top} to/from an Ethereum address{isTestnet ? <> (Kovan)</> : <></>}.</p>
            <style>{`
            .Select--currency__control {
                border-radius: 4px !important;
            }

            .Select--currency__value-container {
                height: 44px;
            }

            .Select--currency__single-value, .Select--currency__input {
                margin-top: -5px;
            }
            `}</style>
            <SelectMarket
                top
                thisToken={top}
                otherToken={""}
                allTokens={Tokens}
                key={"top"}
                onMarketChange={onMarketChange}
                getMarket={() => { return undefined; }}
            />

            <div className="send">
                <input value={ethereumAddress} onChange={(e) => { setEthereumAddress(e.target.value); }} placeholder={`Enter ${isTestnet ? "Kovan" : "Ethereum"} (mint) or ${isTestnet ? "Testnet" : ""} Bitcoin (burn) address`} />
            </div>

            <div className="send">
                <div className="send">
                    <input value={amount} onChange={(e) => { setAmount(e.target.value); }} placeholder="Amount" />
                    <div className="box">BTC</div>
                </div>
                <button disabled={txHash === null} type="submit" className={`blue ${!amount || /* !validAddress */ false ? "disabled" : ""}`}>{isPending ? "Mint or burn" : isMint ? "Mint" : "Burn"}</button>
            </div>
            {errorMessage ? <p className="box red">{errorMessage}</p> : <></>}
            {txHash === null ? <p>Submitting to Ethereum...</p> : <></>}
            {typeof txHash === "string" ? <p>Submitted! <a href={`https://${isTestnet ? "kovan." : ""}etherscan.io/tx/${txHash}`}>Etherscan</a></p> : <></>}
        </form>
    </>;
};
