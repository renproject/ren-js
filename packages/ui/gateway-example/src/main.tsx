// tslint:disable: no-console react-this-binding-issue

import * as React from "react";

import GatewayJS from "@renproject/gateway";
import { SendParams } from "@renproject/interfaces";
import { SelectMarket } from "@renproject/react-components";
import { stringToNetwork } from "@renproject/utils";
import BigNumber from "bignumber.js";
import { parse } from "qs";
import Web3 from "web3";
import { HttpProvider } from "web3-providers";

import { ReactComponent as MetaMaskLogo } from "./metamask.svg";

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

    // const shiftInParams: LockAndMintParamsSimple = {
    //     sendToken: GatewayJS.Tokens.BTC.Btc2Eth,
    //     suggestedAmount: GatewayJS.utils.value(amount, "btc").sats().toString(), // Convert to Satoshis
    //     sendTo: await gatewayJS.getGatewayAddress(web3, "BTC"),
    //     contractFn: "mint",
    //     contractParams: [],
    //     web3Provider: web3.currentProvider,
    // };

    // const shiftInParams: LockAndMintParamsSimple = {
    //     sendToken: GatewayJS.Tokens.BTC.Btc2Eth,
    //     suggestedAmount: GatewayJS.utils.value(amount, "btc").sats().toString(), // Convert to Satoshis
    //     sendTo: "0xE2cAd8EF34E8db287e8daF0eDd169CC9f89E2797",
    //     contractFn: "deposit",
    //     contractParams: [],
    //     web3Provider: web3.currentProvider,
    // };

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
        .on("status", (status) => { console.debug(`[GOT STATUS] ${status}`); });

    console.debug(result);

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
        .on("status", (status) => { console.debug(`[GOT STATUS] ${status}`); })
        .then(console.debug)
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
            .on("status", (status) => { console.debug(`[GOT STATUS] ${status}`); })
            .then(console.debug)
            .catch(console.error);
    }
};

type Token = "BTC" | "ZEC" | "BCH";
export const Tokens = new Map<Token, { symbol: Token; name: string }>()
    .set("BTC", { symbol: "BTC", name: "Bitcoin" })
    .set("ZEC", { symbol: "ZEC", name: "Zcash" })
    .set("BCH", { symbol: "BCH", name: "Bitcoin Cash" });


export const GatewayExample = ({ web3: injectedWeb3 }: { web3: Web3 }) => {
    const [token, setToken] = React.useState<Token>("BTC");

    React.useEffect(() => {
        if (window.ethereum) {
            window.ethereum.enable().catch(console.error);
        }
    });

    const context = { lib: new Web3(injectedWeb3.currentProvider) };
    const contextWeb3 = context.lib as unknown as Web3;

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

            recoverTrades(contextWeb3, gatewayJS).catch(console.error);
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
        if (new BigNumber(amount).lte(0.00005)) {
            setErrorMessage("Amount must be greater than 0.00005");
            return;
        }
        setErrorMessage(null);
        try {
            if (isMint) {
                await startShiftIn(contextWeb3, gatewayJS, amount, ethereumAddress, setTxHash, network, token);
            } else {
                await startShiftOut(contextWeb3, gatewayJS, amount, ethereumAddress, token);
            }
        } catch (error) {
            console.error(error);
            setErrorMessage(String(error.message || error.error || JSON.stringify(error)));
        }
    }, [network, token, gatewayJS, amount, ethereumAddress, isMint, contextWeb3]);

    const onMarketChange = React.useCallback((token) => { setToken(token as Token); }, [setToken]);

    const useMetaMaskAccount = React.useCallback(async () => {
        try {
            setEthereumAddress((await contextWeb3.eth.getAccounts())[0]);
        } catch (error) {
            console.error(error);
        }
    }, [contextWeb3, setEthereumAddress]);

    const [gettingMaxValue, setGettingMaxValue] = React.useState(false);
    const burnMaximumValue = React.useCallback(async () => {
        setGettingMaxValue(true);
        try {
            const web3Address = (await contextWeb3.eth.getAccounts())[0];
            const tokenAddress = await gatewayJS.getTokenAddress(contextWeb3, token);
            const tokenContract = new contextWeb3.eth.Contract(stringToNetwork(network).addresses.erc.ERC20.abi, tokenAddress);
            const decimals = await tokenContract.methods.decimals().call();
            const balance = await tokenContract.methods.balanceOf(web3Address).call();
            setAmount(new BigNumber(balance).div(new BigNumber(10).exponentiatedBy(new BigNumber(decimals).toNumber())).toFixed());
        } catch (error) {
            console.error(error);
        }
        setGettingMaxValue(false);
    }, [contextWeb3, setAmount, gatewayJS, setGettingMaxValue, network, token]);

    return <>
        <form onSubmit={onSubmit} className={`test-environment ${txHash === null ? "disabled" : ""}`}>
            <p className="box">Send {isTestnet ? "Testnet" : ""} {token} to/from an Ethereum address{isTestnet ? <> (Kovan)</> : <></>}.</p>
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
                thisToken={token}
                otherToken={""}
                allTokens={Tokens}
                key={"top"}
                onMarketChange={onMarketChange}
                getMarket={() => { return undefined; }}
            />

            <div className="send">
                <input value={ethereumAddress} onChange={(e) => { setEthereumAddress(e.target.value); }} placeholder={`Enter ${isTestnet ? "Kovan" : "Ethereum"} (mint) or ${isTestnet ? "Testnet" : ""} Bitcoin (burn) address`} />
                <div role="button" className="box box-action" onClick={useMetaMaskAccount}><MetaMaskLogo /></div>
            </div>

            <div className="send">
                <div className="send">
                    <input value={amount} onChange={(e) => { setAmount(e.target.value); }} placeholder="Amount" />
                    {!isPending && !isMint ? <div role="button" className={`box box-action box-blue ${gettingMaxValue ? "disabled" : ""}`} onClick={gettingMaxValue ? undefined : burnMaximumValue}>max</div> : <></>}
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
