import { List, Map } from "immutable";

import { evenHex, strip0x } from "../blockchain/common";
// tslint:disable: no-unused-variable
import { Chain } from "../index";
import { Lightnode } from "./darknode";
import {
    HealthResponse, JSONRPCResponse, ReceiveMessageRequest, ReceiveMessageResponse,
    SendMessageRequest, SendMessageResponse,
} from "./types";

// tslint:enable: no-unused-variable

const NewMultiAddress = (multiAddress: string) => multiAddress;

const _localNode = [
    NewMultiAddress("/ip4/0.0.0.0/tcp/18515/ren/8MJF6WEFR5SM7g652Uj52LH5GAfgGE"),
];

const _devnetNodes = [
    NewMultiAddress("/ip4/13.56.169.110/tcp/18515/8MJwRoUfhU2bRmuJUWPRoDuQPYK1Rj"),
    NewMultiAddress("/ip4/13.52.161.137/tcp/18515/8MGUXixUxCK1s8Fpko5pUfPFC3V2KK"),
    NewMultiAddress("/ip4/13.57.71.179/tcp/18515/8MJzChiEMBffzvSvxi2qWrB6zQeNaF"),
    NewMultiAddress("/ip4/52.9.86.59/tcp/18515/8MJxbKycNEm8epPfwyWbBMeuQrsvjb"),
    NewMultiAddress("/ip4/52.89.211.7/tcp/18515/8MHuJF93QbHtkRip46p4WMi6FcppXR"),
    NewMultiAddress("/ip4/52.37.221.167/tcp/18515/8MKWQvkAwTdjwJnZqgPbcgUfZn5bwV"),
    NewMultiAddress("/ip4/52.43.239.115/tcp/18515/8MHk4gGMYKDvaGjBpup5wSpZZ5Kc2j"),
    NewMultiAddress("/ip4/52.42.160.15/tcp/18515/8MGPBAL3kx7HYfvbzx5K7VCNn8PYvC"),
];

const _testnetNodes = [
    NewMultiAddress("/ip4/54.221.29.240/tcp/18515/8MJF6WEFR5SM7g652Uj52LH5GAfgGE"),
    NewMultiAddress("/ip4/34.213.51.170/tcp/18515/8MJFpCbi2jkVMLu4LdLywCPKuLdYFu"),
    NewMultiAddress("/ip4/34.205.143.11/tcp/18515/8MHAgaq5NcujBZy1SayoG1DtbjF8pH"),
    NewMultiAddress("/ip4/99.79.61.64/tcp/18515/8MJyd8wXBvC8xoinLxECskbUgMVrBy"),
    NewMultiAddress("/ip4/35.154.42.26/tcp/18515/8MJRT4E1yS1HN2JwZt9DRFkwCGuzcV"),
    NewMultiAddress("/ip4/34.220.215.156/tcp/18515/8MJ5yefA76JSeu4c7mSP5UBevuXr3N"),
    NewMultiAddress("/ip4/18.196.15.243/tcp/18515/8MHgw9WH3KAqwRv8GHHpBsdBai9Nw9"),
    NewMultiAddress("/ip4/18.231.179.161/tcp/18515/8MKJXQrye3EG5PEEwVebkaRXBUCn9g"),
];

const _testnetLightnode = [
    "https://lightnode-testnet.herokuapp.com",
];

const _devnetLightnode = [
    "https://lightnode-devnet.herokuapp.com",
];

export const lightnodes = _testnetLightnode;

// export const multiAddressToID = (multiAddress: MultiAddress): DarknodeID => {
//     const split = multiAddress.multiAddress.split("/");
//     return { id: split[split.length - 1] };
// };

export interface ShiftedInResponse {
    amount: string;
    txHash: string;
    r: string;
    s: string;
    v: string;
}

export interface ShiftedOutResponse {
    amount: string;
    txHash: string;
}

type ShifterResponse = JSONRPCResponse<{
    values: [
        {
            "type": "public",
            "name": "amount",
            "value": string, // "8d8126"
        },
        {
            "type": "public",
            "name": "txHash",
            "value": string, // "18343428f9b057102c4a6da8d8011514a5ea8be2f44af636bcd26a8ae4e2b719"
        },
        {
            "type": "public",
            "name": "r",
            "value": string, // "c762164060c7bbffbd0a76335d02ca8e69f792b13d8eb865a09690cc30aaf55e"
        },
        {
            "type": "public",
            "name": "s",
            "value": string, // "b3785c63afb91bb58e98a89552fdf3cb6034e5f349ab1f37f67d9e314fd4f506"
        },
        {
            "type": "public",
            "name": "v",
            "value": string, // "01"
        }
    ],
}>;

const promiseAll = async <a>(list: List<Promise<a>>, defaultValue: a): Promise<List<a>> => {
    let newList = List<a>();
    for (const entryP of list.toArray()) {
        try {
            newList = newList.push(await entryP);
        } catch (error) {
            newList = newList.push(defaultValue);
        }
    }
    return newList;
};

/**
 * DarknodeGroup allows sending messages to multiple darknodes
 */
export class DarknodeGroup {
    public bootstraps = List<string>();
    public darknodes = Map<string, Lightnode>();

    constructor(multiAddresses: string[] | string) {
        if (Array.isArray(multiAddresses)) {
            this.bootstraps = this.bootstraps.concat(multiAddresses);
            this.addLightnodes(multiAddresses);
        } else {
            this.addLightnodes([multiAddresses]);
        }
        this.bootstraps = this.bootstraps.concat(multiAddresses);
    }

    public getHealth = async (): Promise<List<HealthResponse | null>> => {
        return promiseAll<HealthResponse | null>(
            this.darknodes.valueSeq().map(darknode => darknode.getHealth()).toList(),
            null,
        );
    }

    public sendMessage = async (request: SendMessageRequest): Promise<List<{ result: SendMessageResponse, lightnode: string } | null>> => {
        return promiseAll(
            this.darknodes.valueSeq().map(async (darknode) => ({
                lightnode: darknode.lightnodeURL,
                result: await darknode.sendMessage(request),
            })).toList(),
            null,
        );
    }

    public receiveMessage = async (request: ReceiveMessageRequest): Promise<List<ReceiveMessageResponse | null>> => {
        return promiseAll<ReceiveMessageResponse | null>(
            this.darknodes.valueSeq().map(darknode => darknode.receiveMessage(request)).toList(),
            null,
        );
    }

    private readonly addLightnodes = (newLightnodes: string[]): this => {
        for (const lightnode of newLightnodes) {
            this.darknodes = this.darknodes.set(lightnode, new Lightnode(lightnode));
        }
        return this;
    }
}

// Generate a random nonce. Nonces are public. TODO: Use both
//  crypto.randomBytes() and window.crypto.getRandomValues() (depending on env)
// tslint:disable-next-line: insecure-random
export const randomNonce = () => Math.floor(Math.random() * 4294967295);

export class ShifterGroup extends DarknodeGroup {
    constructor(multiAddresses: string[] | string) {
        super(multiAddresses);
        // this.getHealth();
    }

    public submitDeposits = async (chain: Chain, address: string, commitmentHash: string): Promise<List<{ messageID: string, lightnode: string }>> => {
        // TODO: If one fails, still return the other.

        const method = chain === Chain.Bitcoin ? "MintZBTC"
            : chain === Chain.ZCash ? "MintZZEC" : undefined;

        if (!method) {
            throw new Error(`Minting ${chain} not supported`);
        }

        const results = await this.sendMessage({
            nonce: randomNonce(),
            to: "Shifter",
            signature: "",
            payload: {
                method: `ShiftIn${chain.toUpperCase()}`,
                args: [
                    // Adapter address
                    { name: "uid", type: "public", value: strip0x(address) },
                    { name: "commitment", type: "public", value: strip0x(commitmentHash) },
                ],
            },
        });

        if (results.filter(x => x !== null).size < 1) {
            throw new Error("Unable to send message to lightnodes.");
        }

        return results.filter(x => x !== null && x.result.result !== undefined).map((result) => ({
            // tslint:disable: no-non-null-assertion no-unnecessary-type-assertion
            lightnode: result!.lightnode,
            messageID: result!.result.result!.messageID,
            // tslint:enable: no-non-null-assertion no-unnecessary-type-assertion
        })).toList();
    }

    public submitWithdrawal = async (chain: Chain, to: string, valueHex: string): Promise<List<{ messageID: string, lightnode: string }>> => {
        const results = await this.sendMessage({
            nonce: randomNonce(),
            to: "Shifter",
            signature: "",
            payload: {
                method: `ShiftOut${chain.toUpperCase()}`,
                args: [
                    { name: "to", type: "public", value: strip0x(to) },
                    { name: "value", type: "public", value: evenHex(strip0x(valueHex)) }, // Hex should be: "2711"
                ],
            },
        });

        if (results.filter(x => x !== null).size < 1) {
            throw new Error("Unable to send message to lightnodes.");
        }

        return results.filter(x => x !== null && x.result.result !== undefined).map((result) => ({
            // tslint:disable: no-non-null-assertion no-unnecessary-type-assertion
            lightnode: result!.lightnode,
            messageID: result!.result.result!.messageID,
            // tslint:enable: no-non-null-assertion no-unnecessary-type-assertion
        })).toList();
    }

    public checkForResponse = async (messageID: string): Promise<ShiftedInResponse | ShiftedOutResponse> => {
        for (const node of this.darknodes.valueSeq().toArray()) {
            if (node) {
                try {
                    const response = await node.receiveMessage({ messageID }) as ShifterResponse;
                    // Error:
                    // { "jsonrpc": "2.0", "version": "0.1", "error": { "code": -32603, "message": "result not available", "data": null }, "id": null }
                    // Success:
                    // (TODO)
                    if (response.result && response.result.values) {
                        // tslint:disable-next-line: no-any
                        let ret = {};
                        for (const value of response.result.values) {
                            ret = { ...ret, [value.name]: value.value };
                        }
                        return ret as ShiftedInResponse | ShiftedOutResponse;
                    } else if (response.error) {
                        throw response.error;
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        }
        throw new Error(`Signature not available`);
    }
}
