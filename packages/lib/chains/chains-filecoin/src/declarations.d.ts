declare module "elliptic";
declare module "blakejs";
declare module "@glif/filecoin-address";
declare module "@glif/filecoin-rpc-client" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FilecoinClient: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type FilecoinClient = any;

    export default FilecoinClient;
}
