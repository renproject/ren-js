// The details for a RenVM shard. The is currently only one shard that doesn't
// expire.
// There will be multiple levels of expiries - the `expiry` field will refer
// to the time (as seconds since Unix epoch) by which gateway transactions
// have to be submitted by. For mints and for contract-based releases, RenVM
// will then generate a signature which needs to be submitted by a second
// deadline.
export interface RenVMShard {
    gPubKey: string;

    expiry?: number;
}
