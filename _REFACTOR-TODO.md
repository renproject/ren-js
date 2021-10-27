TODO:

## Filter `notInPayload` from Ethereum payloads

```ts
// Last contract call
const { contractParams, sendTo } = contractCalls[contractCalls.length - 1];

const filteredContractParams = contractParams
    ? contractParams.filter((contractParam) => !contractParam.notInPayload)
    : contractParams;
```

TXs for testing:

BTC/toEthereum
fMQMORkbXx93bBZTgNG3OwYWlX1ZiF5pQHONa1Gfy_Q

BTC/fromEthereum
c0BuEGzuHEGsqdKQjcQOxwKyvpqGeOYE3FI7x2EIzFk

---

## Fix signature in RenJS

```ts
const [r, s, v] = [
    out.sig.slice(0, 32),
    out.sig.slice(32, 64),
    out.sig[64] % 27,
];
out.signature = signatureToBuffer(fixSignatureSimple(r, s, v));
```

# Interface

```ts
const bitcoin = new Bitcoin();
const ethereum = new Ethereum(web3.currentProvider);
const bsc = new BinanceSmartChain(web3.currentProvider);

const renJS = new RenJS("https://rpc.renproject.io").withChains(
    bitcoin,
    ethereum,
    bsc,
);

const gateway = renJS.Gateway({
    from: bitcoin.Deposits(),
    to: ethereum.Contract<{ override: string }>(
        ({ amount, nHash, signature, override }) => ({
            address: "",
            abi: ABI,
            method: "mint",
            params: [override, amount, nHash, signature],
        }),
    ),
});

gateway.on("transaction", transactionHandler);

switch (gateway.status) {
    case "to_token_account_required":
        await gateway.to.createTokenAccount.submit();
        await gateway.to.createTokenAccount.wait();
        break;

    // Contract-based gateway

    case "from_approval_required":
        await gateway.from.approval.submit();
        await gateway.from.approval.wait();
        break;

    case "from_transaction_required":
        await gateway.from.tx.submit();
        await gateway.from.tx.wait();
        break;

    case "done":
        return;

    // Deposit-based gateway

    case "from_deposit_required":
        const gatewayAddress = gateway.gatewayAddress();
        showGatewayAddress(gatewayAddress);
        return;
}

const transactionHandler = (tx: GatewayTransaction) => {
    console.log(tx.hash);

    console.log(tx.in.chain.formatTransaction(tx.in.txhash, tx.in.txid));
    await tx.in.wait();

    await tx.signed();

    if (!tx.out.details) {
        await tx.out.submit({
            params: {
                blah: "1",
            },
        });
        console.log(tx.out.chain.formatTransaction(tx.out.txhash, tx.out.txid));
        await tx.out.wait();
    }
};
```

```ts
import { BinanceSmartChain, Ethereum } from "@renproject/chains-ethereum";
import { RenNetwork } from "@renproject/utils";
import RenJS from "@renproject/ren";
import { getEVMChain } from "./testUtils";

const NETWORK = RenNetwork.Testnet;

const main = async () => {
    const ethereum = getEVMChain(Ethereum as any, NETWORK);
    const bsc = getEVMChain(BinanceSmartChain, NETWORK);

    const renJS = new RenJS(NETWORK).withChains(ethereum, bsc);

    const params = {
        asset: "DAI",
        from: bsc.Account("1000000000000000000"),
        to: ethereum.Account(),
    };

    const gateway = await renJS.gateway(params);

    gateway.setup.approval.submit();

    // For h2h call in.submit rather than showing gateway address
    await gateway.from.submit();

    gateway.on("transaction", (tx) => {
        (async () => {
            await tx.refreshStatus();

            await tx.from.wait().on("status", console.log);
            await tx.signed();
            if (await tx.to.submit) {
                await tx.to.submit().on("transaction", console.log);
            }
            return tx.to.wait().on("status", console.log);
        })();
    });
};
```

# Defining Ethereum payloads:

List of magic values:

-   \_\_RENVM_TOKEN_ADDRESS\_\_
-   \_\_RENVM_GATEWAY_ADDRESS\_\_
-   \_\_RENVM_ACCOUNT\_\_
-   \_\_RENVM_GATEWAY\_\_
-   \_\_RENVM_ASSET\_\_
-   \_\_RENVM_SIGNATURE\_\_
-   \_\_RENVM_SIGNATURE_R\_\_
-   \_\_RENVM_SIGNATURE_S\_\_
-   \_\_RENVM_SIGNATURE_V\_\_
-   \_\_RENVM_AMOUNT\_\_

Types of payloads:

```
{
    type: "contract",
    params: {
        to: address,
        params: [{
            name: "test",
            type: "string",
            value: "Test!",
            notInPayload: true,
        }],
    }
}

{
    type: "approve",
    params: {
        to: EvmParams.RenTokenAddress,

    }
}
```
