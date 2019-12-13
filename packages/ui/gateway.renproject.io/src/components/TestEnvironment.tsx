import * as React from "react";

import RenJS from "@renproject/ren";
import BigNumber from "bignumber.js";

const contractAddress = "0xa2aE9111634F5983e4e1C3E3823914841a4c7235";
const address = "0xa2aE9111634F5983e4e1C3E3823914841a4c7235";

const gatewayPopupUrl = process.env.REACT_APP_GATEWAY_POPUP_URL || "/#/";

export const TestEnvironment: React.FC<{}> = props => {
    const [stage, setStage] = React.useState<string>("ready");

    // Does this actually reduce the payload when not testing??
    const GatewayJS = require("gateway-js").default;
    const gw = new GatewayJS(gatewayPopupUrl);

    const startSwap = async (amount: BigNumber) => {
        const response = await gw.open({
            // Send BTC from the Bitcoin blockchain to the Ethereum blockchain.
            sendToken: RenJS.Tokens.BTC.Btc2Eth,

            // Amount of BTC we are sending (in Satoshis)
            sendAmount: amount.times(10 ** 8).toNumber(), // Convert to Satoshis

            // The contract we want to interact with
            sendTo: contractAddress,

            // The name of the function we want to call
            contractFn: "shiftIn",

            // Arguments expected for calling `deposit`
            contractParams: [
                {
                    name: "_to",
                    type: "address",
                    value: address,
                }
            ],
        });
        console.log(response);

    };

    const nextStage = () => {
        (async () => {
            switch (stage) {
                case "ready":  // Start the actual swap
                    setStage("confirming");
                    await startSwap(new BigNumber("0.123"));
                case "confirming":  // We have some confirmations but not enough
                    gw.debug("test", "confirming");
                    setStage("confirmed");
                    break;
                case "confirmed":  // We have enough confirmations
                    gw.debug("test", "confirmed");
                    setStage("renvm-signed");
                    break;
                case "renvm-signed":  // We will submit the utxos to RenVM
                    gw.debug("test", "renvm-signed");
                    setStage("submit-to-eth");
                    break;
                case "submit-to-eth":
                    gw.debug("test", "submit-to-eth");
                    setStage("eth-confirmed");
                    break;
                case "eth-confirmed":
                    gw.debug("test", "eth-confirmed");
                    setStage("ready");
                    break;
            }
        })().catch(console.error);
    };

    return (
        <div>
            <div>Testing environment</div>
            <div>
                <button disabled={stage !== "ready"} onClick={nextStage}>1. open popup</button>
            </div>
            <div>
                <button disabled={stage !== "confirming"} onClick={nextStage}>2. confirming</button>
            </div>
            <div>
                <button disabled={stage !== "confirmed"} onClick={nextStage}>3. confirmed</button>
            </div>
            <div>
                <button disabled={stage !== "renvm-signed"} onClick={nextStage}>4. renvm signed</button>
            </div>
            <div>
                <button disabled={stage !== "submit-to-eth"} onClick={nextStage}>5. submit to ethereum</button>
            </div>
            <div>
                <button disabled={stage !== "eth-confirmed"} onClick={nextStage}>6. confirmed on ethereum</button>
            </div>
        </div>
    );
};
