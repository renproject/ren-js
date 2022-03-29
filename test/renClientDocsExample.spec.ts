import { providers, Wallet } from "ethers";
import { EthereumBaseChain } from "packages/chains/chains-ethereum/build/main/base";

import { BinanceSmartChain, Ethereum } from "../packages/chains/chains/src";
import RenJS from "../packages/ren/src";
import { RenNetwork } from "../packages/utils";

const network = RenNetwork.Testnet;

// const main = async () => {
//     // Initialize Ethereum and BSC chains.
//     const ethereum = new Ethereum({
//         network,
//         ...getEVMProvider(Ethereum, network),
//     });
//     const bsc = new BinanceSmartChain({
//         network,
//         ...getEVMProvider(BinanceSmartChain, network),
//     });

//     // Create RenJS instance. NOTE - chains must now be linked to RenJS using
//     // `withChains`.
//     const renJS = new RenJS(network).withChains(ethereum, bsc);

//     // Create gateway - mints and burns are both initialized with `gateway`.
//     // Gateway parameters are serializable.
//     const gateway = await renJS.gateway({
//         asset: ethereum.assets.DAI,
//         from: ethereum.Account({ amount: 2, convertUnit: true }),
//         to: bsc.Account(),
//     });

//     // `gateway.fees` exposes values and helpers for calculating fees.
//     // console.log(gateway.fees);

//     // `gateway.setup` may contain multiple transactions.
//     await gateway.inSetup.approval.submit({
//         txConfig: {
//             gasLimit: 1000000,
//         },
//     });
//     // All transactions now follow a submit/wait pattern - see TxSubmitter
//     // interface.
//     await gateway.inSetup.approval.wait();

//     // Transactions emit a `progress` whenever an update is available
//     // (confirmations, errors, etc.)
//     await gateway.in.submit().on("progress", console.log);
//     await gateway.in.wait(1);

//     // NOTE: Event has been renamed to `"transaction"`.
//     gateway.on("transaction", (tx) => {
//         (async () => {
//             // GatewayTransaction parameters are serializable. To re-create
//             // the transaction, call `renJS.gatewayTransaction`.
//             console.log(tx.params);

//             // Wait for remaining confirmations for input transaction.
//             await tx.in.wait();

//             // RenVM transaction also follows the submit/wait pattern.
//             await tx.renVM.submit().on("progress", console.log);
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
//             // progress field, with a `txid` field (base64) and a
//             // `txidFormatted` field (chain-dependent).
//             const outTx = tx.out.progress.transaction;
//             console.log("Done:", outTx.txidFormatted);

//             // All chain classes expose a common set of helper functions (see
//             // `Chain` class.)
//             console.log(tx.toChain.transactionExplorerLink(outTx));
//         })().catch(console.error);
//     });
// };

// // Test account - do not send real funds.
// const mnemonic =
//     "black magic humor turtle symptom liar salmon rally hurt concert tower run";

// // Get EVM-chain provider using public JSON-RPC endpoint.
// export const getEVMProvider = (
//     ChainClass: typeof EthereumBaseChain,
//     network: RenNetwork,
// ) => {
//     // `configMap[network].network` is the same interface as used by
//     // `wallet_switchEthereumChain`.
//     const urls = ChainClass.configMap[network].network.rpcUrls;
//     let rpcUrl = urls[0];
//     const provider = new providers.JsonRpcProvider(rpcUrl);
//     const signer = Wallet.fromMnemonic(mnemonic).connect(provider);
//     return {
//         provider,
//         signer,
//     };
// };

// main().catch((error) => {
//     console.error(error);
//     process.exit(1);
// });
