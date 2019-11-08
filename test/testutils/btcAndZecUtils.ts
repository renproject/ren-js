// tslint:disable: no-console

import * as bitcoin from "bitgo-utxo-lib";

import axios from "axios";
import chalk from "chalk";
import qrcode from "qrcode-terminal";

import { getBitcoinUTXOs, getZcashUTXOs } from "../../src/index";
import { retryNTimes } from "../../src/lib/utils";
import { NetworkDetails } from "../../src/types/networks";

export const USE_QRCODE = false;

const sendRawTransaction = async (txHex: string, mercuryURL: string, chainSO: string) => {
    try {
        await retryNTimes(
            () => axios.post(
                mercuryURL,
                { jsonrpc: "2.0", method: "sendrawtransaction", params: [txHex] },
                { timeout: 5000 }
            ),
            5,
        );
    } catch (error) {
        console.log(`Unable to submit to Mercury (${(error.response && error.response.data && error.response.data.error && error.response.data.error.message) || error}). Trying BlockStream...`);

        try {
            await retryNTimes(
                () => axios.post(
                    `https://blockstream.info/testnet/api/tx`,
                    txHex,
                    { timeout: 5000 }
                ),
                5,
            );
        } catch (blockstreamError) {
            console.log(`Unable to submit to BlockStream (${(blockstreamError.response && blockstreamError.response.data && blockstreamError.response.data.error && blockstreamError.response.data.blockstreamError.message) || error}). Trying chain.so...`);
            try {
                console.log(txHex);
                await retryNTimes(
                    () => axios.post(`https://chain.so/api/v2/send_tx/${chainSO}`, { tx_hex: txHex }, { timeout: 5000 }),
                    5,
                );
            } catch (chainError) {
                console.error(`chain.so returned error ${chainError.message}`);
                console.log(`\n\n\nPlease check your balance balance!\n`);
                if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
                    error.message = `${error.message}: ${error.response.data.error.message}`;
                }
                throw error;
            }
        }
    }
};

// export const sendBTC = (
//     network: NetworkDetails,
//     rawPrivateKey: string,
// ) => async (gatewayAddress: string, amount: number) => {
//     if (USE_QRCODE) {
//         // Generate a QR code with the payment details - an alternative
//         qrcode.generate(`bitcoin:${gatewayAddress}?amount=${amount / 10 ** 8}`, { small: true });
//         console.log(`Please deposit ${amount / 10 ** 8} BTC to ${gatewayAddress}`);
//     } else {
//         const privateKey = new BPrivateKey(rawPrivateKey, network.bitcoinNetwork);
//         const srcAddress = privateKey.toAddress();

//         // Deposit asset to gateway address.
//         const utxos = await getBitcoinUTXOs(network)(srcAddress.toString(), 0);
//         utxos.reverse();
//         const bitcoreUTXOs = [];
//         let utxoAmount = 0;
//         for (const utxo of utxos) {
//             // if (utxoAmount >= amount) {
//             //     break;
//             // }
//             const bitcoreUTXO = new BTransaction.UnspentOutput({
//                 txId: utxo.txid,
//                 outputIndex: utxo.output_no,
//                 address: srcAddress,
//                 script: new BScript(utxo.script_hex),
//                 satoshis: utxo.value,
//             });
//             console.log({
//                 txId: utxo.txid,
//                 outputIndex: utxo.output_no,
//                 address: srcAddress,
//                 script: new BScript(utxo.script_hex),
//                 satoshis: utxo.value,
//             });
//             bitcoreUTXOs.push(bitcoreUTXO);
//             utxoAmount += utxo.value;
//             if (utxoAmount >= amount) {
//                 break;
//             }
//         }

//         const change = utxoAmount - amount - 10000;
//         console.log(`${chalk.magenta(`[INFO]`)} ${srcAddress} has ${chalk.magenta(`${change / 10 ** 8}`)} tBTC remaining`);

//         console.log(`amount: ${amount}`);
//         console.log(`change: ${change}`);

//         const transaction = new BTransaction().from(bitcoreUTXOs).to(gatewayAddress, amount).change(srcAddress).sign(privateKey);

//         await sendRawTransaction(transaction.toString(), network.mercuryURL.btc, network.chainSoName.btc);
//     }
// };

export const sendBTC = (
    network: NetworkDetails,
    rawPrivateKey: string,
) => async (gatewayAddress: string, amountSatoshis: number) => {
    if (USE_QRCODE) {
        // Generate a QR code with the payment details - an alternative
        qrcode.generate(`bitcoin:${gatewayAddress}?amount=${amountSatoshis / 10 ** 8}`, { small: true });
        console.log(`Please deposit ${amountSatoshis / 10 ** 8} BTC to ${gatewayAddress}`);
    } else {
        console.log(`Please deposit ${amountSatoshis / 10 ** 8} BTC to ${gatewayAddress}`);

        // const alice = bitcoin.ECPair.fromPrivateKeyBuffer(Buffer.from(keyHex, "hex"), );
        console.log(bitcoin.networks);
        const account = bitcoin.ECPair.fromWIF(rawPrivateKey, bitcoin.networks.testnet);

        const utxos = await getBitcoinUTXOs(network)(account.getAddress().toString(), 0);
        utxos.reverse();

        const fees = 10000;

        const tx = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        // tx.setVersion(bitcoin.Transaction.ZCASH_SAPLING_VERSION);  // 4
        // tx.setVersionGroupId(parseInt("0x892F2085", 16));

        const availableSatoshis = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

        if (availableSatoshis < amountSatoshis + fees) {
            throw new Error(`Insufficient balance to broadcast transaction. Have: ${availableSatoshis / 10 ** 8}, want ${(amountSatoshis + fees) / 10 ** 8}`);
        }

        // Add all inputs
        let sum = 0;
        const usedUTXOs = [];
        for (const utxo of utxos) {
            console.log(`Adding ${utxo.txid}, ${utxo.output_no}`);
            tx.addInput(utxo.txid, utxo.output_no);
            sum += utxo.value;
            usedUTXOs.push(utxo);
            if (sum >= amountSatoshis + fees) {
                break;
            }
        }

        // Add up balance
        const usedSatoshis = usedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);

        const change = usedSatoshis - amountSatoshis - fees;

        // Add outputs
        tx.addOutput(gatewayAddress, amountSatoshis);
        if (change > 0) {
            tx.addOutput(account.getAddress(), change);
        }

        console.log(`${chalk.magenta(`[INFO]`)} ${account.getAddress()} has ${chalk.magenta(`${(availableSatoshis - amountSatoshis - fees) / 10 ** 8}`)} tBTC remaining`);

        // Sign inputs
        usedUTXOs.map((utxo, i) => {
            tx.sign(i, account, "", bitcoin.Transaction.SIGHASH_SINGLE, utxo.value);
        });

        const built = tx.build();

        await sendRawTransaction(built.toHex(), network.mercuryURL.btc, network.chainSoName.btc);
    }
};

export const sendZEC = (
    network: NetworkDetails,
    rawPrivateKey: string,
) => async (gatewayAddress: string, amountSatoshis: number) => {
    console.log(`Please deposit ${amountSatoshis / 10 ** 8} ZEC to ${gatewayAddress}`);

    // const alice = bitcoin.ECPair.fromPrivateKeyBuffer(Buffer.from(keyHex, "hex"), );
    const account = bitcoin.ECPair.fromWIF(rawPrivateKey, bitcoin.networks.zcashTest);

    const utxos = await getZcashUTXOs(network)(account.getAddress().toString(), 0);

    const fees = 10000;

    const tx = new bitcoin.TransactionBuilder(bitcoin.networks.zcashTest);
    tx.setVersion(bitcoin.Transaction.ZCASH_SAPLING_VERSION);  // 4
    tx.setVersionGroupId(parseInt("0x892F2085", 16));

    // Add up balance
    const availableSatoshis = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

    if (availableSatoshis < amountSatoshis + fees) {
        throw new Error(`Insufficient balance to broadcast transaction. Have: ${availableSatoshis / 10 ** 8}, want ${(amountSatoshis + fees) / 10 ** 8}`);
    }

    const change = availableSatoshis - amountSatoshis - fees;

    // Add all inputs
    utxos.map(utxo => {
        tx.addInput(utxo.txid, utxo.output_no);
    });

    // Add outputs
    tx.addOutput(gatewayAddress, amountSatoshis);
    if (change > 0) { tx.addOutput(account.getAddress(), change); }

    console.log(`${chalk.magenta(`[INFO]`)} ${account.getAddress()} has ${chalk.magenta(`${change / 10 ** 8}`)} tZEC remaining`);

    // Sign inputs
    utxos.map((utxo, i) => {
        tx.sign(i, account, "", bitcoin.Transaction.SIGHASH_SINGLE, utxo.value);
    });

    const built = tx.build();

    await sendRawTransaction(built.toHex(), network.mercuryURL.zec, network.chainSoName.zec);
};
