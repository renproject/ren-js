import {
    Logger,
    MintChain,
    provider,
    RenContract,
    RenNetwork,
    RenTokens,
} from "@renproject/interfaces";
import { RenNetworkDetails, RenNetworkDetailsMap } from "@renproject/networks";
import { parseRenContract } from "@renproject/utils";
import Web3 from "web3";
import { sha3 } from "web3-utils";

export const getTokenName = (
    tokenOrContract: RenTokens | RenContract
): RenTokens => {
    switch (tokenOrContract) {
        case "BTC":
            return "BTC";
        case "ZEC":
            return "ZEC";
        case "BCH":
            return "BCH";
        case "ETH":
            throw new Error(`Unexpected token ${tokenOrContract}`);
        default:
            return getTokenName(parseRenContract(tokenOrContract).asset);
    }
};

export const getTokenAddress = async (
    network: RenNetworkDetails,
    web3: Web3,
    tokenOrContract: RenTokens | RenContract
): Promise<string> => {
    try {
        const registry = new web3.eth.Contract(
            network.addresses.gateways.GatewayRegistry.abi,
            network.addresses.gateways.GatewayRegistry.address
        );
        return await registry.methods
            .getTokenBySymbol(getTokenName(tokenOrContract))
            .call();
    } catch (error) {
        (
            error || {}
        ).error = `Error looking up ${tokenOrContract} token address: ${error.message}`;
        throw error;
    }
};

export const getGatewayAddress = async (
    network: RenNetworkDetails,
    web3: Web3,
    tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")
) => {
    try {
        const registry = new web3.eth.Contract(
            network.addresses.gateways.GatewayRegistry.abi,
            network.addresses.gateways.GatewayRegistry.address
        );
        return await registry.methods
            .getGatewayBySymbol(getTokenName(tokenOrContract))
            .call();
    } catch (error) {
        (
            error || {}
        ).error = `Error looking up ${tokenOrContract}Gateway address: ${error.message}`;
        throw error;
    }
};

export const findTransactionBySigHash = async (
    network: RenNetworkDetails,
    web3: Web3,
    tokenOrContract: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH"),
    sigHash: string,
    logger?: Logger
): Promise<string | undefined> => {
    try {
        const gatewayAddress = await getGatewayAddress(
            network,
            web3,
            tokenOrContract
        );
        const gatewayContract = new web3.eth.Contract(
            network.addresses.gateways.Gateway.abi,
            gatewayAddress
        );
        // We can skip the `status` check and call `getPastLogs` directly - for now both are called in case
        // the contract
        const status = await gatewayContract.methods.status(sigHash).call();
        if (status) {
            const recentRegistrationEvents = await web3.eth.getPastLogs({
                address: gatewayAddress,
                fromBlock: "1",
                toBlock: "latest",
                // topics: [sha3("LogDarknodeRegistered(address,uint256)"), "0x000000000000000000000000" +
                // address.slice(2), null, null] as any,
                topics: [
                    sha3("LogMint(address,uint256,uint256,bytes32)"),
                    null,
                    null,
                    sigHash,
                ] as string[],
            });
            if (!recentRegistrationEvents.length) {
                throw new Error(
                    `Mint has been submitted but no log was found.`
                );
            }
            const log = recentRegistrationEvents[0];
            return log.transactionHash;
        }
    } catch (error) {
        // tslint:disable-next-line: no-console
        if (logger) logger.error(error);
        // Continue with transaction
    }
    return;
};

type Transaction = string;
type Asset = "eth";

export class Ethereum implements MintChain<Transaction, Asset> {
    public name = "ethereum";
    private web3: Web3 | undefined;
    private renNetwork: RenNetwork | undefined;
    private renNetworkDetails: RenNetworkDetails | undefined;

    // public readonly getTokenAddress = (
    //     web3: Web3,
    //     token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")
    // ) => getTokenAddress(stringToNetwork(this.network), web3, token);
    // public readonly getGatewayAddress = (
    //     web3: Web3,
    //     token: RenTokens | RenContract | Asset | ("BTC" | "ZEC" | "BCH")
    // ) => getGatewayAddress(stringToNetwork(this.network), web3, token);

    constructor(web3Provider: provider) {
        if (!(this instanceof Ethereum)) return new Ethereum(web3Provider);

        this.web3 = new Web3(web3Provider);
    }

    /**
     * See [LockChain.initialize].
     */
    initialize = (renNetwork: RenNetwork): void => {
        this.renNetwork = renNetwork;
        this.renNetworkDetails = RenNetworkDetailsMap[renNetwork];
    };

    // Supported assets

    /**
     * `supportsAsset` should return true if the asset is native to the
     * MintChain.
     *
     * @example
     * ethereum.supportsAsset = asset => asset === "ETH";
     */
    supportsAsset = (asset: Asset): boolean => {
        return asset === "eth";
    };

    /**
     * `assetDecimals` should return the number of decimals of the asset.
     *
     * If the asset is not supported, an error should be thrown.
     *
     * @example
     * ethereum.assetDecimals = asset => {
     *     if (asset === "ETH") { return 18; }
     *     throw new Error(`Unsupported asset ${asset}`);
     * }
     */
    assetDecimals = (asset: Asset): number => {
        if (asset === "eth") {
            return 18;
        }
        throw new Error(`Unsupported asset ${asset}`);
    };

    submitMint = async (
        _asset: Asset,
        _signature: string
    ): Promise<Transaction> => {
        throw new Error("unimplemented");
    };

    findTransactionBySigHash = async (
        _asset: Asset,
        _sigHash: string
    ): Promise<Transaction | null> => {
        throw new Error("unimplemented");
    };

    resolveTokenGatewayContract = async (token: RenTokens): Promise<string> => {
        if (!this.renNetworkDetails || !this.web3) {
            throw new Error(`Ethereum object not initialized`);
        }
        return getGatewayAddress(this.renNetworkDetails, this.web3, token);
    };
}
