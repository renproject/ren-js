import { normalizeSignature, pack, TypedPackValue } from "@renproject/utils";

import { ResponseQueryTx } from "./methods";
import { RenVMTransaction } from "./types/core";

export const unmarshalRenVMTransaction = <
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Input = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Output = any,
    TypedInput extends TypedPackValue = TypedPackValue,
    TypedOutput extends TypedPackValue = TypedPackValue,
>(
    tx: ResponseQueryTx<TypedInput, TypedOutput>["tx"],
): RenVMTransaction<Input, Output> => {
    // If the transaction has a signature output, apply standard signature fixes.
    const out = pack.unmarshal.unmarshalTypedPackValue(tx.out);
    if (out && out.sig && out.sig instanceof Uint8Array && out.sig.length > 0) {
        out.sig = normalizeSignature(out.sig);
    }

    return {
        version: parseInt(tx.version),
        hash: tx.hash,
        selector: tx.selector,
        in: pack.unmarshal.unmarshalTypedPackValue(tx.in),
        out,
    };
};
