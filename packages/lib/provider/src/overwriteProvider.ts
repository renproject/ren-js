import { Provider } from "./jsonRPC";

// TODO: Look into errors caused by `extending` HttpProvider.

export class OverwriteProvider<
    // tslint:disable-next-line: no-any
    Requests extends { [event: string]: any } = {},
    // tslint:disable-next-line: no-any
    Responses extends { [event: string]: any } = {}
> implements Provider {
    // public readonly overrides: Map<string, Responses[keyof Responses]>;
    private readonly provider: Provider<Requests, Responses>;

    constructor(
        provider: Provider<Requests, Responses>,
        // _overrides: { [method: string]: Responses[keyof Responses] }
    ) {
        this.provider = provider;
    }

    public async sendMessage<Method extends string>(
        method: Method,
        request: Requests[Method],
        retry = 2,
    ): Promise<Responses[Method]> {
        const overrides = ({
            ren_queryShards: {
                shards: [
                    {
                        darknodesRootHash:
                            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                        gateways: [
                            {
                                asset: "BTC",
                                hosts: ["Ethereum"],
                                locked: "0",
                                origin: "Bitcoin",
                                pubKey:
                                    "Akwn5WEMcB2Ff/E0ZOoVks9uZRvG/eFD99AysymOc5fm",
                            },
                            {
                                asset: "ZEC",
                                hosts: ["Ethereum"],
                                locked: "0",
                                origin: "Zcash",
                                pubKey:
                                    "Akwn5WEMcB2Ff/E0ZOoVks9uZRvG/eFD99AysymOc5fm",
                            },
                            {
                                asset: "DOGE",
                                hosts: ["Ethereum"],
                                locked: "0",
                                origin: "Dogecoin",
                                pubKey:
                                    "Akwn5WEMcB2Ff/E0ZOoVks9uZRvG/eFD99AysymOc5fm",
                            },
                            {
                                asset: "BCH",
                                hosts: ["Ethereum"],
                                locked: "0",
                                origin: "BitcoinCash",
                                pubKey:
                                    "Akwn5WEMcB2Ff/E0ZOoVks9uZRvG/eFD99AysymOc5fm",
                            },
                            {
                                asset: "FIL",
                                hosts: ["Ethereum"],
                                locked: "0",
                                origin: "Filecoin",
                                pubKey:
                                    "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
                            },
                            {
                                asset: "LUNA",
                                hosts: ["Ethereum"],
                                locked: "0",
                                origin: "Terra",
                                pubKey:
                                    "Akwn5WEMcB2Ff_E0ZOoVks9uZRvG_eFD99AysymOc5fm",
                            },
                        ],
                        gatewaysRootHash:
                            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                        primary: true,
                        pubKey: "Akwn5WEMcB2Ff/E0ZOoVks9uZRvG/eFD99AysymOc5fm",
                    },
                ],
            },
            // tslint:disable-next-line: no-any
        } as any) as { [method: string]: Responses[keyof Responses] };
        return (overrides[method]
            ? overrides[method]
            : await this.provider.sendMessage(
                  method,
                  request,
                  retry,
              )) as Responses[Method];
    }
}
