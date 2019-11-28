import { sleep } from "@renproject/react-components";
import RenVM, {
    btcAddressFrom, Chain, NetworkChaosnet, NetworkDetails, NetworkDevnet, NetworkLocalnet,
    NetworkTestnet, Ox, ShiftInObject, Signature, Tokens as ShiftActions, TxStatus, UTXO,
    zecAddressFrom,
} from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Container } from "unstated";
import Web3 from "web3";
import { TransactionReceipt } from "web3-core";

import { syncGetDEXReserveAddress } from "../lib/contractAddresses";
import { NETWORK } from "../lib/environmentVariables";
import { _catchBackgroundErr_ } from "../lib/errors";
import {
    getAdapter, getReserve, HistoryEvent, NULL_BYTES32, ShiftInStatus, ShiftOutStatus, Token,
} from "./generalTypes";

const BitcoinTx = (hash: string) => ({ hash, chain: Chain.Bitcoin });
const ZCashTx = (hash: string) => ({ hash, chain: Chain.Zcash });
const BCashTx = (hash: string) => ({ hash, chain: Chain.BCash });
const EthereumTx = (hash: string) => ({ hash, chain: Chain.Ethereum });

export let network: NetworkDetails = NetworkTestnet;
switch (NETWORK) {
    case "development":
        network = NetworkLocalnet; break;
    case "devnet":
        network = NetworkDevnet; break;
    case "testnet":
        network = NetworkTestnet; break;
    case "chaosnet":
        network = NetworkChaosnet; break;
}

const initialState = {
    sdkRenVM: null as null | RenVM,
    sdkAddress: null as string | null,
    sdkWeb3: null as Web3 | null,
    sdkNetworkID: 0,
    network,
    order: null as HistoryEvent | null,
};

/**
 * The SDKContainer is responsible for talking to the RenVM SDK. It stores the
 * associated state and exposes functions to interact with the SDK.
 *
 * The main two interactions are shifting in (trading BTC to DAI), and shifting
 * out (trading DAI to BTC).
 */
export class SDKContainer extends Container<typeof initialState> {
    public state = initialState;

    public order = (id: string): HistoryEvent | undefined => {
        return this.state.order || undefined;
    }

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState({
            sdkWeb3: web3,
            sdkNetworkID: networkID,
            sdkRenVM: new RenVM(network),
            sdkAddress: address,
        });
    }

    public updateOrder = async (order: Partial<HistoryEvent>) => {
        // tslint:disable-next-line: no-object-literal-type-assertion
        await this.setState({ order: ({ ...this.state.order, ...order } as HistoryEvent) });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Trading DAI to BTC //////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Trading DAI to BTC involves three steps:
    // 1. Approve transfer of the DAI token
    // 2. Swap DAI for zBTC and burn the zBTC
    // 3. Submit the burn to the darknodes

    // public approveTokenTransfer = async (orderID: string) => {

    //     // TODO: Check that the sdkAddress is the same as the address in the
    //     // commitment - otherwise this step fails.

    //     const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID, network: networkDetails } = this.state;
    //     if (!web3 || !address) {
    //         throw new Error("Web3 address is not defined");
    //     }
    //     const order = this.order(orderID);
    //     if (!order) {
    //         throw new Error("Order not set");
    //     }

    //     // let amountBN: BigNumber;
    //     let tokenInstance: ERC20Detailed;
    //     let receivingAddress: string;

    //     const dex = getExchange(web3, networkID);

    //     const srcToken = order.commitment.sendToken === ShiftActions.ZEC.Zec2Eth ? Token.ZEC : order.commitment.sendToken === ShiftActions.BCH.Bch2Eth ? Token.BCH : Token.BTC;
    //     const amountBN = order.commitment.sendAmount;
    //     const srcTokenDetails = Tokens.get(srcToken);
    //     if (!srcTokenDetails) {
    //         throw new Error(`Unable to retrieve details for ${srcToken}`);
    //     }
    //     // amountBN = new BigNumber(srcAmount).multipliedBy(new BigNumber(10).exponentiatedBy(srcTokenDetails.decimals));

    //     tokenInstance = getERC20(web3, networkDetails, syncGetTokenAddress(networkID, srcToken));

    //     receivingAddress = syncGetDEXAdapterAddress(networkID);

    //     // Check the allowance of the token.
    //     // If it's not sufficient, approve the required amount.
    //     // NOTE: Some tokens require the allowance to be 0 before being able to
    //     // approve a new amount.
    //     const allowance = new BigNumber((await tokenInstance.methods.allowance(address, receivingAddress).call()).toString());
    //     if (allowance.lt(amountBN)) {
    //         // We don't have enough allowance so approve more
    //         const promiEvent = tokenInstance.methods.approve(
    //             receivingAddress,
    //             amountBN.toString()
    //         ).send({ from: address });
    //         await new Promise((resolve, reject) => promiEvent.on("transactionHash", async (transactionHash: string) => {
    //             resolve(transactionHash);
    //         }).catch((error: Error) => {
    //             if (error && error.message && String(error.message).match(/Invalid "from" address/)) {
    //                 error.message += ` (from address: ${address})`;
    //             }
    //             reject(error);
    //         }));
    //     }
    // }

    public getReceipt = async (web3: Web3, transactionHash: string) => {
        // Wait for confirmation
        let receipt;
        while (!receipt || !receipt.blockHash) {
            receipt = await web3.eth.getTransactionReceipt(transactionHash);
            if (receipt && receipt.blockHash) {
                break;
            }
            await sleep(3 * 1000);
        }

        // Status might be undefined - so check against `false` explicitly.
        if (receipt.status === false) {
            throw new Error(`Transaction was reverted. { "transactionHash": "${transactionHash}" }`);
        }

        return receipt;
    }

    public submitBurnToEthereum = async (orderID: string, retry = false) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!web3 || !renVM || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        // if (retry) {
        //     await this.approveTokenTransfer(orderID);
        // }

        // If there's a previous transaction and `retry` isn't set, reuse tx.
        let transactionHash = order.inTx && !retry ? order.inTx.hash : null;

        if (!transactionHash) {
            const promiEvent = renVM.shiftOut({
                web3Provider: web3.currentProvider,
                sendToken: order.commitment.sendToken,
                sendTo: order.commitment.sendTo,
                contractFn: order.commitment.contractFn,
                contractParams: order.commitment.contractParams,
            }).readFromEthereum();

            promiEvent.catch((error: Error) => {
                throw error;
            });
            transactionHash = await new Promise<string>((resolve, reject) => promiEvent.on("transactionHash", resolve).catch(reject));
            await this.updateOrder({
                inTx: EthereumTx(transactionHash),
                status: ShiftOutStatus.SubmittedToEthereum,
            });
        }

        // Wait for confirmation
        await this.getReceipt(web3, transactionHash);

        await this.updateOrder({
            status: ShiftOutStatus.ConfirmedOnEthereum,
        });
    }

    public liquidityBalance = async (srcToken: Token) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID } = this.state;
        if (!web3 || !address) {
            return;
        }
        // const exchange = getExchange(web3, networkID);
        const reserveAddress = syncGetDEXReserveAddress(networkID, srcToken);
        const reserve = getReserve(web3, networkID, reserveAddress);
        return new BigNumber(await reserve.methods.balanceOf(address).call());
    }

    public submitBurnToRenVM = async (orderID: string, _resubmit = false) => {
        // if (resubmit) {
        //     await this.updateOrder({ status: ShiftOutStatus.ConfirmedOnEthereum, messageID: null });
        // }

        const { sdkWeb3: web3, sdkRenVM: renVM } = this.state;
        if (!web3 || !renVM) {
            throw new Error(`Invalid values required to submit deposit`);
        }

        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        if (!order.inTx) {
            throw new Error(`Invalid values required to submit deposit`);
        }

        const shiftOutObject = await renVM.shiftOut({
            web3Provider: web3.currentProvider,
            sendToken: order.commitment.sendToken,
            txHash: order.inTx.hash
        }).readFromEthereum();

        const response = await shiftOutObject.submitToRenVM()
            .on("messageID", (messageID: string) => {
                this.updateOrder({
                    messageID,
                    status: ShiftOutStatus.SubmittedToRenVM,
                }).catch(_catchBackgroundErr_);
            })
            .on("status", (renVMStatus: TxStatus) => {
                this.updateOrder({
                    renVMStatus,
                }).catch(_catchBackgroundErr_);
            });
        // tslint:disable-next-line: no-any
        const address = (response as unknown as any).tx.args[1].value;
        await this.updateOrder({
            outTx: order.commitment.sendToken === ShiftActions.ZEC.Eth2Zec ?
                ZCashTx(zecAddressFrom(address, "base64")) :
                order.commitment.sendToken === ShiftActions.BCH.Eth2Bch ?
                    // BCashTx(bchAddressFrom(address, "base64")) :
                    BCashTx(address) :
                    BitcoinTx(btcAddressFrom(address, "base64")),
            status: ShiftOutStatus.ReturnedFromRenVM,
        }).catch(_catchBackgroundErr_);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Trading BTC to DAI //////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Trading BTC to DAI involves the following steps:
    // 1. Generate a gateway address
    // 2. Wait for a deposit to the address
    // 3. Submit the deposit to RenVM and retrieve back a signature
    // 4. Submit the signature to Ethereum, creating zBTC & swapping it for DAI

    public shiftInObject = (orderID: string): ShiftInObject => {
        const { sdkRenVM: renVM, sdkNetworkID: networkID } = this.state;
        if (!renVM) {
            throw new Error("Invalid parameters passed to `generateAddress`");
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        return renVM.shiftIn({
            sendToken: order.commitment.sendToken,
            sendTo: order.commitment.sendTo,
            sendAmount: order.commitment.sendAmount,
            contractFn: order.commitment.contractFn,
            contractParams: order.commitment.contractParams,
            nonce: order.nonce,
            messageID: order.messageID || undefined,
        });
    }

    // Takes a commitment as bytes or an array of primitive types and returns
    // the deposit address
    public generateAddress = (orderID: string): string | undefined => {
        return this
            .shiftInObject(orderID)
            .addr();
    }

    // Retrieves unspent deposits at the provided address
    public waitForDeposits = async (orderID: string, onDeposit: (utxo: UTXO) => void) => {
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        const promise = this
            .shiftInObject(orderID)
            .waitForDeposit(2);
        promise.on("deposit", onDeposit);
        await promise;
        await this.updateOrder({ status: ShiftInStatus.Deposited });
    }

    // Submits the commitment and transaction to the darknodes, and then submits
    // the signature to the adapter address
    public submitMintToRenVM = async (orderID: string, _resubmit = false): Promise<Signature> => {
        // if (resubmit) {
        //     await this.updateOrder({ status: ShiftInStatus.Deposited, messageID: null });
        // }
        const onMessageID = (messageID: string) =>
            this.updateOrder({ messageID, status: ShiftInStatus.SubmittedToRenVM })
                .catch(console.error);
        const onStatus = (renVMStatus: TxStatus) => {
            this.updateOrder({
                renVMStatus,
            }).catch(console.error);
        };
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }
        const shiftInObject = this
            .shiftInObject(orderID)
            .waitForDeposit(2);
        await sleep(10 * 1000);
        const obj = await shiftInObject;
        const signature = await obj
            .submitToRenVM()
            .on("messageID", onMessageID)
            .on("status", onStatus);
        await this.updateOrder({
            inTx: BitcoinTx(Ox(Buffer.from(signature.response.args.utxo.txHash, "base64"))),
            status: ShiftInStatus.ReturnedFromRenVM,
        });
        return signature;
    }

    public submitMintToEthereum = async (orderID: string, retry = false) => {
        const { sdkAddress: address, sdkWeb3: web3, sdkNetworkID: networkID } = this.state;
        if (!web3 || !address) {
            throw new Error(`Invalid values required for swap`);
        }
        const order = this.order(orderID);
        if (!order) {
            throw new Error("Order not set");
        }

        let transactionHash = order.outTx && !retry ? order.outTx.hash : null;
        let receipt: TransactionReceipt;

        if (!transactionHash) {

            [receipt, transactionHash] = await new Promise<[TransactionReceipt, string]>(async (resolve, reject) => {
                const promiEvent = (await this.submitMintToRenVM(orderID)).submitToEthereum(web3.currentProvider);
                promiEvent.catch((error) => {
                    reject(error);
                });
                const txHash = await new Promise<string>((resolveTx, rejectTx) => promiEvent.on("transactionHash", resolveTx).catch(rejectTx));
                await this.updateOrder({
                    status: ShiftInStatus.SubmittedToEthereum,
                    outTx: EthereumTx(txHash),
                });

                // tslint:disable-next-line: no-any
                (promiEvent as any).once("confirmation", (_confirmations: number, newReceipt: TransactionReceipt) => { resolve([newReceipt, txHash]); });
            });
        } else {
            receipt = await this.getReceipt(web3, transactionHash);
        }

        await this.updateOrder({
            outTx: EthereumTx(transactionHash),
            status: ShiftInStatus.RefundedOnEthereum,
        });
        return;
    }
}
