// import { providers, Wallet } from "ethers";

// import { Bitcoin, Ethereum } from "@renproject/chains";
// import RenJS from "@renproject/ren";

// // Test account - do not send real funds.
// const mnemonic =
//     "black magic humor turtle symptom liar salmon rally hurt concert tower run";

// const main = async () => {
//     const network = "testnet";

//     // Initialize Bitcoin and Ethereum.
//     const bitcoin = new Bitcoin({ network });
//     const ethereum = new Ethereum({
//         network,
//         provider: new providers.JsonRpcProvider(
//             Ethereum.configMap[network].config.rpcUrls[0],
//         ),
//         signer: Wallet.fromMnemonic(mnemonic),
//     });

//     // Create RenJS instance. NOTE - chains must now be linked to RenJS using
//     // `withChains`.
//     const renJS = new RenJS(network).withChains(bitcoin, ethereum);

//     // Create gateway - mints and burns are both initialized with `gateway`.
//     // Gateway parameters are serializable.
//     const gateway = await renJS.gateway({
//         asset: ethereum.assets.DAI, // "DAI"
//         from: bitcoin.GatewayAddress(),
//         to: ethereum.Account(),
//     });

//     // `gateway.fees` exposes values and helpers for calculating fees.
//     console.info(gateway.fees);

//     console.info(`Deposit ${gateway.params.asset} to ${gateway.gatewayAddress}`);

//     // NOTE: Event has been renamed from "deposit" to "transaction".
//     gateway.on("transaction", (tx) => {
//         (async () => {
//             // GatewayTransaction parameters are serializable. To re-create
//             // the transaction, call `renJS.gatewayTransaction`.
//             console.info(tx.params);

//             // Wait for remaining confirmations for input transaction.
//             await tx.in.wait();

//             // RenVM transaction also follows the submit/wait pattern.
//             await tx.renVM.submit().on("progress", console.info);
//             await tx.renVM.wait();

//             // `submit` accepts a `txConfig` parameter for overriding
//             // transaction config.
//             await tx.out.submit({
//                 txConfig: {
//                     gasLimit: 1000000,
//                 },
//             });
//             await tx.out.wait();

//             // All transactions return a `ChainTransaction` object in the
//             // progress, with a `txid` field (base64) and a `txHash`
//             // field (chain-dependent).
//             const outTx = tx.out.progress.transaction;
//             console.info("Done:", outTx.txHash);

//             // All chain classes expose a common set of helper functions (see
//             // `Chain` class.)
//             console.info(tx.toChain.transactionExplorerLink(outTx));
//         })().catch(console.error);
//     });
// };

// main().catch((error) => {
//     console.error(error);
//     process.exit(1);
// });
