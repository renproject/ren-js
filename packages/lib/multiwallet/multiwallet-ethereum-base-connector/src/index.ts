import { ConnectorInterface } from "@renproject/multiwallet-base-connector";
import { provider } from "web3-providers";
import { Address } from "@renproject/chains-ethereum/build/main";

export abstract class EthereumBaseConnectorInterface
    implements ConnectorInterface<provider, Address> {
    abstract activate: ConnectorInterface<provider, Address>["activate"];
}
