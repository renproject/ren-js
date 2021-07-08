export const findBurnByNonce = async (
    network: EthereumConfig,
    web3: Web3,
    asset: string,
    nonce: Buffer | string | number,
): Promise<BurnDetails<EthTransaction>> => {
    const gatewayAddress = await getGatewayAddress(network, web3, asset);

    const nonceBuffer = Buffer.isBuffer(nonce)
        ? Buffer.from(nonce)
        : new BN(nonce).toArrayLike(Buffer, "be", 32);

    const burnEvents = await web3.eth.getPastLogs({
        address: gatewayAddress,
        fromBlock: "1",
        toBlock: "latest",
        topics: [eventTopics.LogBurn, Ox(nonceBuffer)] as string[],
    });

    if (!burnEvents.length) {
        throw Error(`Burn not found for nonce ${Ox(nonceBuffer)}`);
    }
    if (burnEvents.length > 1) {
        // WARNING: More than one burn with the same nonce.
    }

    return parseBurnEvent(web3, burnEvents[0]);
};
