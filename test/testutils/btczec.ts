// tslint:disable: no-console

import * as bitcoin from "bitgo-utxo-lib";

import axios from "axios";
import {
    PrivateKey as BPrivateKey, Script as BScript, Transaction as BTransaction,
} from "bitcore-lib";
import {
    PrivateKey as ZPrivateKey, Script as ZScript, Transaction as ZTransaction,
} from "bitcore-lib-zcash";
import qrcode from "qrcode-terminal";
import chalk from "chalk";

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
        console.log(`Unable to submit to Mercury (${(error.response && error.response.data && error.response.data.error && error.response.data.error.message) || error}). Trying chain.so...`);
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
};

export const sendBTC = (
    network: NetworkDetails,
    rawPrivateKey: string,
) => async (gatewayAddress: string, amount: number) => {
    if (USE_QRCODE) {
        // Generate a QR code with the payment details - an alternative
        qrcode.generate(`bitcoin:${gatewayAddress}?amount=${amount / 10 ** 8}`, { small: true });
        console.log(`Please deposit ${amount / 10 ** 8} BTC to ${gatewayAddress}`);
    } else {
        const privateKey = new BPrivateKey(rawPrivateKey, network.bitcoinNetwork);
        const srcAddress = privateKey.toAddress();

        // Deposit asset to gateway address.
        const utxos = await getBitcoinUTXOs(network)(srcAddress.toString(), 0);
        const bitcoreUTXOs = [];
        let utxoAmount = 0;
        for (const utxo of utxos) {
            if (utxoAmount >= amount) {
                break;
            }
            const bitcoreUTXO = new BTransaction.UnspentOutput({
                txId: utxo.txid,
                outputIndex: utxo.output_no,
                address: srcAddress,
                script: new BScript(utxo.script_hex),
                satoshis: utxo.value,
            });
            bitcoreUTXOs.push(bitcoreUTXO);
            utxoAmount += utxo.value;
        }

        const transaction = new BTransaction().from(bitcoreUTXOs).to(gatewayAddress, amount).change(srcAddress).sign(privateKey);

        await sendRawTransaction(transaction.toString(), network.mercuryURL.btc, network.chainSoName.btc);
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
        throw new Error("Insufficient balance to broadcast transaction");
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
