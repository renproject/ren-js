/* eslint-disable no-console */

import { LogLevel, RenNetwork } from "@renproject/interfaces";
import RenJS from "@renproject/ren";
import { blue } from "chalk";

const logLevel = LogLevel.Log;

const main = async () => {
    const renJS = new RenJS(RenNetwork.MainnetVDot3, { logLevel });

    let n = 330683;
    while (n > 0) {
        const { blocks } = (await renJS.renVM.sendMessage(
            "ren_queryBlocks" as never,
            {
                blockHeight: String(n - 1 - 15),
                n: String(16),
            } as never,
        )) as any;
        for (const block of blocks) {
            console.log(blue(block.height), block);
            if (
                block.extrinsics.coreTxs.length > 0 ||
                Object.keys(block.extrinsics.shardTxs.txs).length > 1 ||
                block.extrinsics.shardTxs.txs[
                    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                ].length > 0 ||
                block.extrinsics.shardTxs.txs[
                    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                ] === undefined ||
                block.extrinsics.state !==
                    "BJBA8OzMqacKKLK0bPWP72OaKVa_7dNFRvufuVZuISU"
            ) {
                break;
            }
        }
        n = blocks.reduce(
            (min: number, b: any) => Math.min(min, parseInt(b.height)),
            n,
        );
    }
};

main().catch(console.error);
