import { EventEmitter } from "events";
import { RenNetwork } from "@renproject/interfaces";

interface ConnectorUpdate<ChainProvider, ChainAccount> {
    provider: ChainProvider;
    renNetwork: RenNetwork;
    account?: ChainAccount;
}

export interface ConnectorInterface<ChainProvider, ChainId, ChainAccount> {
    supportsTestnet: boolean;
    activate: () => Promise<ConnectorUpdate<ChainProvider, ChainAccount>>;

    getProvider: () => Promise<ChainProvider>;
    getAccount: () => Promise<ChainAccount>;
    getChainId: () => Promise<ChainId>;
    deactivate: () => void;
    emitter: ConnectorEmitter<ChainProvider, ChainAccount>;
}

export enum Events {
    UPDATE = "CONNECTOR_UPDATE",
    ERROR = "CONNECTOR_ERROR",
    DEACTIVATE = "CONNECTOR_DEACTIVATE",
}

export class ConnectorEmitter<CP, CA> extends EventEmitter {
    constructor(readonly debug: boolean) {
        super();
    }
    emitUpdate(update: ConnectorUpdate<CP, CA>): void {
        if (this.debug) {
            console.log(`'${Events.UPDATE}'`, update);
        }
        this.emit(Events.UPDATE, update);
    }

    emitError(error: Error): void {
        if (this.debug) {
            console.log(`'${Events.ERROR}'`, error);
        }
        this.emit(Events.ERROR, error);
    }

    emitDeactivate(): void {
        if (this.debug) {
            console.log(`'${Events.DEACTIVATE}'`);
        }
        this.emit(Events.DEACTIVATE);
    }
}
