import { mintMachine as mm } from "./machines/mint";
import { burnMachine as bm } from "./machines/burn";
import { mintConfig } from "./configs/genericMint";
import { burnConfig } from "./configs/genericBurn";

export * from "./machines/burn";
export * from "./machines/mint";
export * from "./machines/deposit";

export * from "./configs/genericMint";
export * from "./configs/genericBurn";

export * from "./types/transaction";

// We can pre-configure these as it is easy to override the config
export const mintMachine = mm.withConfig(mintConfig);
export const burnMachine = bm.withConfig(burnConfig);
