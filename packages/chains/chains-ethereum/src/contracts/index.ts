import { Contract } from "ethers";

import { Provider } from "@ethersproject/providers";
import { keccak256 } from "@renproject/utils";

import { AbiItem } from "../utils/abi";
import ERC20JSON from "./ABIs/ERC20.json";
import GatewayRegistryJSON from "./ABIs/GatewayRegistryV2.json";
import LockGatewayJSON from "./ABIs/LockGatewayV3.json";
import MintGatewayJSON from "./ABIs/MintGatewayV3.json";
import { ERC20 } from "./typechain/ERC20";
import { GatewayRegistryV2 } from "./typechain/GatewayRegistryV2";
import { LockGatewayV3 } from "./typechain/LockGatewayV3";
import { MintGatewayV3 } from "./typechain/MintGatewayV3";

export const MintGatewayABI = MintGatewayJSON as AbiItem[];
export const LockGatewayABI = LockGatewayJSON as AbiItem[];
export const GatewayRegistryABI = GatewayRegistryJSON as AbiItem[];
export const ERC20ABI = ERC20JSON as AbiItem[];

export const findABIMethod = (abi: AbiItem[], name: string) => {
    const first = abi.filter((item) => item.name === name)[0];
    if (!first) {
        throw new Error(`No ABI entry found for "${name}".`);
    }
    return first;
};

export const getEventTopic = (abiItem: AbiItem) => {
    const parameters =
        abiItem.inputs?.map((input) => input.type).join(",") || "";
    const eventSignature = `${abiItem.name}(${parameters})`;
    return keccak256(Buffer.from(eventSignature));
};

export const getMintGatewayInstance = (
    provider: Provider,
    address: string,
): MintGatewayV3 => {
    return new Contract(address, MintGatewayABI, provider) as MintGatewayV3;
};

export const getLockGatewayInstance = (
    provider: Provider,
    address: string,
): LockGatewayV3 => {
    return new Contract(address, LockGatewayABI, provider) as LockGatewayV3;
};

export const getGatewayRegistryInstance = (
    provider: Provider,
    address: string,
): GatewayRegistryV2 => {
    return new Contract(
        address,
        GatewayRegistryABI,
        provider,
    ) as GatewayRegistryV2;
};

export const getERC20Instance = (
    provider: Provider,
    address: string,
): ERC20 => {
    return new Contract(address, ERC20ABI, provider) as ERC20;
};
