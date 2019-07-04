import { newPromiEvent } from "./lib/promievent";
import { RenVMNetwork, ShiftedOutResponse } from "./lightnode/renVMNetwork";
import { Token } from "./types/assets";

export class ShiftOutObject {
    private readonly renVMNetwork: RenVMNetwork;
    private readonly sendToken: Token;
    private readonly burnReference: string;

    constructor(renVMNetwork: RenVMNetwork, sendToken: Token, burnReference: string) {
        this.renVMNetwork = renVMNetwork;
        this.sendToken = sendToken;
        this.burnReference = burnReference;
    }

    public submitToRenVM = () => {
        const promiEvent = newPromiEvent<ShiftedOutResponse>();

        (async () => {
            const messageID = await this.renVMNetwork.submitWithdrawal(this.sendToken, this.burnReference);
            promiEvent.emit("messageID", messageID);

            return await this.renVMNetwork.waitForResponse(messageID) as ShiftedOutResponse;
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }
}
