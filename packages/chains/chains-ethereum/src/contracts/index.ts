import { Provider } from "@ethersproject/providers";
import { utils } from "@renproject/utils";
import { Contract, Signer } from "ethers";

import { AbiItem } from "../utils/abi";
import BasicBridgeJSON from "./ABIs/BasicBridge.json";
import ERC20JSON from "./ABIs/ERC20.json";
import GatewayRegistryJSON from "./ABIs/GatewayRegistryV2.json";
import LockGatewayJSON from "./ABIs/LockGatewayV3.json";
import MintGatewayJSON from "./ABIs/MintGatewayV3.json";
import TransferWithLogJSON from "./ABIs/TransferWithLog.json";
import { ERC20 } from "./typechain/ERC20";
import { GatewayRegistryV2 } from "./typechain/GatewayRegistryV2";
import { LockGatewayV3 } from "./typechain/LockGatewayV3";
import { MintGatewayV3 } from "./typechain/MintGatewayV3";

export const BasicBridgeABI = BasicBridgeJSON as AbiItem[];
export const ERC20ABI = ERC20JSON as AbiItem[];
export const GatewayRegistryABI = GatewayRegistryJSON as AbiItem[];
export const LockGatewayABI = LockGatewayJSON as AbiItem[];
export const MintGatewayABI = MintGatewayJSON as AbiItem[];
export const TransferWithLogABI = TransferWithLogJSON as AbiItem[];

export const findABIMethod = (abi: AbiItem[], name: string): AbiItem => {
    const first = abi.filter((item) => item.name === name)[0];
    if (!first) {
        throw new Error(`No ABI entry found for "${name}".`);
    }
    return first;
};

export const getEventTopic = (abiItem: AbiItem): Uint8Array => {
    const parameters =
        abiItem.inputs && abiItem.inputs.length > 0
            ? abiItem.inputs.map((input) => input.type).join(",")
            : "";
    if (!abiItem.name) {
        throw new Error(
            `No name found in ABI item (parameters: ${parameters}).`,
        );
    }
    const eventSignature = `${abiItem.name}(${parameters})`;
    return utils.keccak256(utils.fromUTF8String(eventSignature));
};

export const getMintGatewayInstance = (
    signerOrProvider: Signer | Provider,
    address: string,
): MintGatewayV3 =>
    new Contract(address, MintGatewayABI, signerOrProvider) as MintGatewayV3;

export const getLockGatewayInstance = (
    signerOrProvider: Signer | Provider,
    address: string,
): LockGatewayV3 =>
    new Contract(address, LockGatewayABI, signerOrProvider) as LockGatewayV3;

export const getGatewayRegistryInstance = (
    signerOrProvider: Signer | Provider,
    address: string,
): GatewayRegistryV2 =>
    new Contract(
        address,
        GatewayRegistryABI,
        signerOrProvider,
    ) as GatewayRegistryV2;

export const getERC20Instance = (
    signerOrProvider: Signer | Provider,
    address: string,
): ERC20 => new Contract(address, ERC20ABI, signerOrProvider) as ERC20;
