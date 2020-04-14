import {
    newPromiEvent, Ox, PromiEvent, BurnAndReleaseParams, TxStatus, UnmarshalledBurnTx,
} from "@renproject/interfaces";
import { ResponseQueryBurnTx } from "@renproject/rpc";
import {
    extractBurnReference, extractError, forwardEvents, generateShiftOutTxHash, ignoreError,
    NetworkDetails, payloadToABI, processBurnAndReleaseParams, renTxHashToBase64, RenWeb3Events,
    resolveOutToken, Web3Events, withDefaultAccount,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { TransactionConfig } from "web3-core";

import { ShifterNetwork, unmarshalBurnTx } from "./shifterNetwork";

export class BurnAndRelease {
    private readonly params: BurnAndReleaseParams;
    private readonly renVMNetwork: ShifterNetwork;
    private readonly network: NetworkDetails;

    constructor(_renVMNetwork: ShifterNetwork, _network: NetworkDetails, _params: BurnAndReleaseParams) {
        this.renVMNetwork = _renVMNetwork;
        this.network = _network;
        this.params = processBurnAndReleaseParams(this.network, _params);
    }

    public createTransactions = (txConfig?: TransactionConfig): TransactionConfig[] => {
        const contractCalls = this.params.contractCalls || [];

        return contractCalls.map(contractCall => {

            const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

            const params = [
                ...(contractParams || []).map(value => value.value),
            ];

            const ABI = payloadToABI(contractFn, (contractParams || []));
            // tslint:disable-next-line: no-any
            const web3: Web3 = new (Web3 as any)();
            const contract = new web3.eth.Contract(ABI);

            const data = contract.methods[contractFn](
                ...params,
            ).encodeABI();

            return {
                to: sendTo,
                data,

                ...txConfigParam,
                ...{
                    value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                    gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                },

                ...txConfig,
            };
        });
    }

    public readFromEthereum = (txConfig?: TransactionConfig): PromiEvent<BurnAndRelease, Web3Events & RenWeb3Events> => {

        const promiEvent = newPromiEvent<BurnAndRelease, Web3Events & RenWeb3Events>();

        (async () => {

            if (this.params.renTxHash) {
                return this;
            }

            const { web3Provider, contractCalls } = this.params;
            let { burnReference } = this.params;
            let ethTxHash = this.params.ethTxHash;

            // There are three parameter configs:
            // Situation (1): A `burnReference` is provided
            // Situation (2): Contract call details are provided
            // Situation (3): A txHash is provided

            // For (1), we don't have to do anything.
            if (!burnReference && burnReference !== 0) {

                if (!web3Provider) {
                    throw new Error("Must provide burn reference ID or web3 provider.");
                }

                const web3 = new Web3(web3Provider);

                // Handle situation (2)
                // Make a call to the provided contract and Pass on the
                // transaction hash.
                if (contractCalls) {

                    for (let i = 0; i < contractCalls.length; i++) {
                        const contractCall = contractCalls[i];
                        const last = i === contractCalls.length - 1;

                        const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

                        const callParams = [
                            ...(contractParams || []).map(value => value.value),
                        ];

                        const ABI = payloadToABI(contractFn, contractParams);
                        const contract = new web3.eth.Contract(ABI, sendTo);

                        const tx = contract.methods[contractFn](
                            ...callParams,
                        ).send(await withDefaultAccount(web3, {
                            ...txConfigParam,
                            ...{
                                value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                                gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                            },

                            ...txConfig,
                        }));

                        if (last) {
                            forwardEvents(tx, promiEvent);
                        }

                        ethTxHash = await new Promise((resolve, reject) => tx
                            .on("transactionHash", resolve)
                            .catch((error: Error) => {
                                // tslint:disable-next-line: no-console
                                try { if (ignoreError(error)) { console.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
                                reject(error);
                            })
                        );
                    }
                }

                if (!ethTxHash) {
                    throw new Error("Must provide txHash or contract call details.");
                }

                burnReference = await extractBurnReference(web3, ethTxHash);
            }

            this.params.burnReference = burnReference;

            return this;

        })().then(promiEvent.resolve).catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            // tslint:disable-next-line: no-console
            try { if (ignoreError(error)) { console.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
            promiEvent.reject(error);
        });

        return promiEvent;
    }

    public renTxHash = () => {
        const renTxHash = this.params.renTxHash;
        if (renTxHash) {
            return renTxHashToBase64(renTxHash);
        }

        if (!this.params.burnReference && this.params.burnReference !== 0) {
            throw new Error("Must call `readFromEthereum` before calling `renTxHash`");
        }
        const burnReference = new BigNumber(this.params.burnReference).toFixed();
        return generateShiftOutTxHash(resolveOutToken(this.params.sendToken), burnReference);
    }

    public queryTx = async () =>
        unmarshalBurnTx(await this.renVMNetwork.queryTX(Ox(Buffer.from(this.renTxHash(), "base64"))))

    public submitToRenVM = (): PromiEvent<UnmarshalledBurnTx, { renTxHash: [string], status: [TxStatus] }> => {
        const promiEvent = newPromiEvent<UnmarshalledBurnTx, { renTxHash: [string], status: [TxStatus] }>();

        (async () => {
            const { burnReference } = this.params;
            if (!this.params.renTxHash && (!burnReference && burnReference !== 0)) {
                throw new Error("Must call `readFromEthereum` before calling `submitToRenVM`");
            }

            const renTxHash = this.renTxHash();

            // const renTxHash = await this.renVMNetwork.submitTokenFromEthereum(this.params.sendToken, burnReference);
            promiEvent.emit("renTxHash", renTxHash);

            const response = await this.renVMNetwork.waitForTX<ResponseQueryBurnTx>(
                Ox(Buffer.from(renTxHash, "base64")),
                (status) => {
                    promiEvent.emit("status", status);
                },
                () => promiEvent._isCancelled(),
            );
            return unmarshalBurnTx(response);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }
}
