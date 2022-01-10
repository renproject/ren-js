import { Ethereum } from "../packages/chains/chains-ethereum/src";
import { BinanceSmartChain } from "../packages/chains/chains/src";
import RenJS from "../packages/ren/src";
import { RenNetwork } from "../packages/utils/build/main";
import { getEVMProvider } from "./testUtils";

const network = RenNetwork.Testnet;

const main = async () => {
    // Initialize Ethereum and BSC chains.
    const ethereum = new Ethereum({
        network,
        ...getEVMProvider(Ethereum, network),
    });
    const bsc = new BinanceSmartChain({
        network,
        ...getEVMProvider(BinanceSmartChain, network),
    });

    // Create RenJS instance. NOTE - chains must now be linked to RenJS using
    // `withChains`.
    const renJS = new RenJS(network).withChains(ethereum, bsc);

    // Create gateway. Gateway parameters are serializable.
    const gateway = await renJS.gateway({
        asset: ethereum.assets.DAI,
        from: ethereum.Account({ amount: 2, convertToWei: true }),
        to: bsc.Account(),
    });

    // `gateway.fees` exposes values and helpers for calculating fees.
    console.log(gateway.fees);

    // `gateway.inSetup` may contain multiple transactions.
    await gateway.inSetup.approval.submit({
        txConfig: {
            gasLimit: 1000000,
        },
    });
    // All transactions now follow a submit/wait pattern - see TxSubmitter
    // interface.
    await gateway.inSetup.approval.wait();

    // Transactions emit a `status`
    await gateway.in.submit().on("status", console.log);
    await gateway.in.wait(1);

    await new Promise<void>((resolve, reject) => {
        gateway.on("transaction", (tx) => {
            (async () => {
                // GatewayTransaction parameters are serializable. To re-create
                // the transaction, call `renJS.gatewayTransaction`.
                console.log(tx.params);

                // Wait for remaining confirmations for input transaction.
                await tx.in.wait();

                // RenVM transaction also follows the submit/wait pattern.
                await tx.renVM.submit().on("status", console.log);
                await tx.renVM.wait();

                // `submit` accepts a `txConfig` parameter for overriding
                // transaction config.
                await tx.out.submit({
                    txConfig: {
                        gasLimit: 1000000,
                    },
                });
                await tx.out.wait();

                // All transactions return a `ChainTransaction` object in the
                // status, with a `txid` field (base64) and a `txidFormatted`
                // field (chain-dependent)
                const outTx = tx.out.progress.transaction;
                console.log("Done:", outTx.txidFormatted);

                resolve();
            })().catch(reject);
        });
    });
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
