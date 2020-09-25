import { EventEmitter } from "events";
import { RenNetwork } from "@renproject/interfaces";

export interface ConnectorUpdate<ChainProvider, ChainAccount> {
    provider: ChainProvider;
    renNetwork: RenNetwork;
    account?: ChainAccount;
}

export interface ConnectorInterface<ChainProvider, ChainAccount> {
    supportsTestnet: boolean;
    activate: () => Promise<ConnectorUpdate<ChainProvider, ChainAccount>>;

    getProvider: () => Promise<ChainProvider>;
    getAccount: () => Promise<ChainAccount>;
    getRenNetwork: () => Promise<RenNetwork>;
    deactivate: (reason?: string) => Promise<void>;
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

    emitDeactivate(reason?: string): void {
        if (this.debug) {
            console.log(`'${Events.DEACTIVATE}'`);
        }
        this.emit(Events.DEACTIVATE, reason);
    }
}
