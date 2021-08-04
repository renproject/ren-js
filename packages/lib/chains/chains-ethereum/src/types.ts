import { Provider } from "@ethersproject/providers";
import {
    ExternalProvider,
    JsonRpcFetchFunc,
} from "@ethersproject/providers/lib/web3-provider";
import { ethers } from "ethers";

export type EthTransaction = string | null;
export type EthAddress = string;

/* eslint-disable @typescript-eslint/no-explicit-any */

export type EthProviderCompat =
    | string
    | {
          sendAsync?: (request: any, callback: any) => any;
          send?: (request: any, callback: any) => any;
      };

/* eslint-enable @typescript-eslint/no-explicit-any */

export type EthProvider =
    | EthProviderCompat
    | ExternalProvider
    | JsonRpcFetchFunc
    | {
          provider: Provider;
          signer: ethers.Signer;
      };
