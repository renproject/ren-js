// Type definitions for bitcore-lib 0.15
// Project: https://github.com/bitpay/bitcore-lib
// Definitions by: Lautaro Dragan <https://github.com/lautarodragan>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// TypeScript Version: 2.2

/// <reference types="node" />

declare module "bitcore-lib" {

    enum Opcode {
        OP_FALSE = 0,
        OP_0 = 0,
        OP_PUSHDATA1 = 76,
        OP_PUSHDATA2 = 77,
        OP_PUSHDATA4 = 78,
        OP_1NEGATE = 79,
        OP_RESERVED = 80,
        OP_TRUE = 81,
        OP_1 = 81,
        OP_2 = 82,
        OP_3 = 83,
        OP_4 = 84,
        OP_5 = 85,
        OP_6 = 86,
        OP_7 = 87,
        OP_8 = 88,
        OP_9 = 89,
        OP_10 = 90,
        OP_11 = 91,
        OP_12 = 92,
        OP_13 = 93,
        OP_14 = 94,
        OP_15 = 95,
        OP_16 = 96,
        OP_NOP = 97,
        OP_VER = 98,
        OP_IF = 99,
        OP_NOTIF = 100,
        OP_VERIF = 101,
        OP_VERNOTIF = 102,
        OP_ELSE = 103,
        OP_ENDIF = 104,
        OP_VERIFY = 105,
        OP_RETURN = 106,
        OP_TOALTSTACK = 107,
        OP_FROMALTSTACK = 108,
        OP_2DROP = 109,
        OP_2DUP = 110,
        OP_3DUP = 111,
        OP_2OVER = 112,
        OP_2ROT = 113,
        OP_2SWAP = 114,
        OP_IFDUP = 115,
        OP_DEPTH = 116,
        OP_DROP = 117,
        OP_DUP = 118,
        OP_NIP = 119,
        OP_OVER = 120,
        OP_PICK = 121,
        OP_ROLL = 122,
        OP_ROT = 123,
        OP_SWAP = 124,
        OP_TUCK = 125,
        OP_CAT = 126,
        OP_SUBSTR = 127,
        OP_LEFT = 128,
        OP_RIGHT = 129,
        OP_SIZE = 130,
        OP_INVERT = 131,
        OP_AND = 132,
        OP_OR = 133,
        OP_XOR = 134,
        OP_EQUAL = 135,
        OP_EQUALVERIFY = 136,
        OP_RESERVED1 = 137,
        OP_RESERVED2 = 138,
        OP_1ADD = 139,
        OP_1SUB = 140,
        OP_2MUL = 141,
        OP_2DIV = 142,
        OP_NEGATE = 143,
        OP_ABS = 144,
        OP_NOT = 145,
        OP_0NOTEQUAL = 146,
        OP_ADD = 147,
        OP_SUB = 148,
        OP_MUL = 149,
        OP_DIV = 150,
        OP_MOD = 151,
        OP_LSHIFT = 152,
        OP_RSHIFT = 153,
        OP_BOOLAND = 154,
        OP_BOOLOR = 155,
        OP_NUMEQUAL = 156,
        OP_NUMEQUALVERIFY = 157,
        OP_NUMNOTEQUAL = 158,
        OP_LESSTHAN = 159,
        OP_GREATERTHAN = 160,
        OP_LESSTHANOREQUAL = 161,
        OP_GREATERTHANOREQUAL = 162,
        OP_MIN = 163,
        OP_MAX = 164,
        OP_WITHIN = 165,
        OP_RIPEMD160 = 166,
        OP_SHA1 = 167,
        OP_SHA256 = 168,
        OP_HASH160 = 169,
        OP_HASH256 = 170,
        OP_CODESEPARATOR = 171,
        OP_CHECKSIG = 172,
        OP_CHECKSIGVERIFY = 173,
        OP_CHECKMULTISIG = 174,
        OP_CHECKMULTISIGVERIFY = 175,
        OP_CHECKLOCKTIMEVERIFY = 177,
        OP_CHECKSEQUENCEVERIFY = 178,
        OP_NOP1 = 176,
        OP_NOP2 = 177,
        OP_NOP3 = 178,
        OP_NOP4 = 179,
        OP_NOP5 = 180,
        OP_NOP6 = 181,
        OP_NOP7 = 182,
        OP_NOP8 = 183,
        OP_NOP9 = 184,
        OP_NOP10 = 185,
        OP_PUBKEYHASH = 253,
        OP_PUBKEY = 254,
        OP_INVALIDOPCODE = 255,
    }

    export namespace encoding {
        class Base58 {
            constructor(data?: { buf: Buffer } | string);
            set(data: { buf: Buffer } | string): void;

            validCharacters: Function;
            encode: Function;
            decode: Function;
        }

        class Base58Check {
            validChecksum: Function;
            decode: Function;
            checksum: Function;
            encode: Function;
        }

        class BufferWriter {
            varintBufNum: Function;
            varintBufBN: Function
        }
        const BufferReader: () => BufferWriter;
        const Varint: Function
    }

    export namespace crypto {
        class BN { }

        namespace ECDSA {
            function sign(message: Buffer, key: PrivateKey): Signature;
            function verify(hashbuf: Buffer, sig: Signature, pubkey: PublicKey, endian?: 'little'): boolean;
        }

        namespace Hash {
            function sha1(buffer: Buffer): Buffer;
            function sha256(buffer: Buffer): Buffer;
            function sha256sha256(buffer: Buffer): Buffer;
            function sha256ripemd160(buffer: Buffer): Buffer;
            function sha512(buffer: Buffer): Buffer;
            function ripemd160(buffer: Buffer): Buffer;

            function sha256hmac(data: Buffer, key: Buffer): Buffer;
            function sha512hmac(data: Buffer, key: Buffer): Buffer;
        }

        namespace Random {
            function getRandomBuffer(size: number): Buffer;
        }

        namespace Point { }

        class Signature {
            static fromDER(sig: Buffer): Signature;
            static fromString(data: string): Signature;
            SIGHASH_ALL: number;
            toString(): string;
        }
    }

    export namespace Transaction {
        class UnspentOutput {
            static fromObject(o: object): UnspentOutput;

            readonly address: Address;
            readonly txId: string;
            readonly outputIndex: number;
            readonly script: Script;
            readonly satoshis: number;

            constructor(data: object);

            inspect(): string;
            toObject(): this;
            toString(): string;
        }

        class Output {
            readonly script: Script;
            readonly satoshis: number;

            constructor(data: object);

            setScript(script: Script | string | Buffer): this;
            inspect(): string;
            toObject(): object;
        }

        class Input {
            readonly prevTxId: Buffer;
            readonly outputIndex: number;
            readonly sequenceNumber: number;
            readonly script: Script;
            readonly output?: Output;
        }
    }

    export class Transaction {
        inputs: Transaction.Input[];
        outputs: Transaction.Output[];
        readonly id: string;
        readonly hash: string;
        nid: string;

        constructor(serialized?: any);

        from(utxos: Transaction.UnspentOutput[]): this;
        to(address: Address[] | Address | string, amount: number): this;
        change(address: Address | string): this;
        fee(amount: number): this;
        feePerKb(amount: number): this;
        sign(privateKey: PrivateKey | string): this;
        applySignature(sig: crypto.Signature): this;
        addInput(input: Transaction.Input): this;
        addOutput(output: Transaction.Output): this;
        addData(value: Buffer): this;
        lockUntilDate(time: Date | number): this;
        lockUntilBlockHeight(height: number): this;

        hasWitnesses(): boolean;
        getFee(): number;
        getChangeOutput(): Transaction.Output | null;
        getLockTime(): Date | number;

        verify(): string | boolean;
        isCoinbase(): boolean;

        enableRBF(): this;
        isRBF(): boolean;

        inspect(): string;
        serialize(): string;
    }

    export class Block {
        hash: string;
        height: number;
        transactions: Transaction[];
        header: {
            time: number;
            prevHash: string;
        };

        constructor(data: Buffer | object);
    }

    export class PrivateKey {
        readonly publicKey: PublicKey;
        readonly network: Networks.Network;

        toAddress(): Address;
        toPublicKey(): PublicKey;
        toString(): string;
        toObject(): object;
        toJSON(): object;
        toWIF(): string;

        constructor(key?: string, network?: Networks.Network);
    }

    export class PublicKey {
        constructor(source: string);

        static fromPrivateKey(privateKey: PrivateKey): PublicKey;

        toBuffer(): Buffer;
        toDER(): Buffer;
    }

    export class HDPrivateKey {
        readonly hdPublicKey: HDPublicKey;

        constructor(data?: string | Buffer | object);

        derive(arg: string | number, hardened?: boolean): HDPrivateKey;
        deriveChild(arg: string | number, hardened?: boolean): HDPrivateKey;
        deriveNonCompliantChild(arg: string | number, hardened?: boolean): HDPrivateKey;

        toString(): string;
        toObject(): object;
        toJSON(): object;
    }

    export class HDPublicKey {
        readonly xpubkey: Buffer;
        readonly network: Networks.Network;
        readonly depth: number;
        readonly publicKey: PublicKey;
        readonly fingerPrint: Buffer;

        constructor(arg: string | Buffer | object);

        derive(arg: string | number, hardened?: boolean): HDPublicKey;
        deriveChild(arg: string | number, hardened?: boolean): HDPublicKey;

        toString(): string;
    }

    export namespace Script {
        const types: {
            DATA_OUT: string;
        };
        function buildMultisigOut(publicKeys: PublicKey[], threshold: number, opts: object): Script;
        function buildWitnessMultisigOutFromScript(script: Script): Script;
        function buildMultisigIn(pubkeys: PublicKey[], threshold: number, signatures: Buffer[], opts: object): Script;
        function buildP2SHMultisigIn(pubkeys: PublicKey[], threshold: number, signatures: Buffer[], opts: object): Script;
        function buildPublicKeyHashOut(address: Address): Script;
        function buildPublicKeyOut(pubkey: PublicKey): Script;
        function buildDataOut(data: string | Buffer, encoding?: string): Script;
        function buildScriptHashOut(script: Script): Script;
        function buildPublicKeyIn(signature: crypto.Signature | Buffer, sigtype: number): Script;
        function buildPublicKeyHashIn(publicKey: PublicKey, signature: crypto.Signature | Buffer, sigtype: number): Script;

        function fromAddress(address: string | Address): Script;

        function empty(): Script;
    }

    export class Script {
        [x: string]: any;
        constructor(data?: string | object);

        set(obj: object): this;

        toBuffer(): Buffer;
        toASM(): string;
        toString(): string;
        toHex(): string;

        isPublicKeyHashOut(): boolean;
        isPublicKeyHashIn(): boolean;

        getPublicKey(): Buffer;
        getPublicKeyHash(): Buffer;

        isPublicKeyOut(): boolean;
        isPublicKeyIn(): boolean;

        isScriptHashOut(): boolean;
        isWitnessScriptHashOut(): boolean;
        isWitnessPublicKeyHashOut(): boolean;
        isWitnessProgram(): boolean;
        isScriptHashIn(): boolean;
        isMultisigOut(): boolean;
        isMultisigIn(): boolean;
        isDataOut(): boolean;

        getData(): Buffer;
        isPushOnly(): boolean;

        classify(): string;
        classifyInput(): string;
        classifyOutput(): string;

        isStandard(): boolean;

        prepend(obj: any): this;
        add(obj: any): this;

        hasCodeseparators(): boolean;
        removeCodeseparators(): this;

        equals(script: Script): boolean;

        getAddressInfo(): Address | boolean;
        findAndDelete(script: Script): this;
        checkMinimalPush(i: number): boolean;
        getSignatureOperationsCount(accurate: boolean): number;

        toAddress(): Address;
    }

    export interface Util {
        readonly buffer: {
            reverse(a: any): any;
        };
    }

    export namespace Networks {
        interface Network {
            readonly name: string;
            readonly alias: string;
        }

        const livenet: Network;
        const mainnet: Network;
        const testnet: Network;

        function add(data: any): Network;
        function remove(network: Network): void;
        function get(args: string | number | Network, keys: string | string[]): Network;
    }

    export class Address {
        readonly hashBuffer: Buffer;
        readonly network: Networks.Network;
        readonly type: string;
        toString(): string;
        toBuffer(): Buffer;

        constructor(data: Buffer | Uint8Array | string | object, network?: Networks.Network, type?: string);
    }

    export class Unit {
        static fromBTC(amount: number): Unit;
        static fromMilis(amount: number): Unit;
        static fromBits(amount: number): Unit;
        static fromSatoshis(amount: number): Unit;

        constructor(amount: number, unitPreference: string);

        toBTC(): number;
        toMilis(): number;
        toBits(): number;
        toSatoshis(): number;
    }

}

declare module "bitcore-lib-zcash" {

    enum Opcode {
        OP_FALSE = 0,
        OP_0 = 0,
        OP_PUSHDATA1 = 76,
        OP_PUSHDATA2 = 77,
        OP_PUSHDATA4 = 78,
        OP_1NEGATE = 79,
        OP_RESERVED = 80,
        OP_TRUE = 81,
        OP_1 = 81,
        OP_2 = 82,
        OP_3 = 83,
        OP_4 = 84,
        OP_5 = 85,
        OP_6 = 86,
        OP_7 = 87,
        OP_8 = 88,
        OP_9 = 89,
        OP_10 = 90,
        OP_11 = 91,
        OP_12 = 92,
        OP_13 = 93,
        OP_14 = 94,
        OP_15 = 95,
        OP_16 = 96,
        OP_NOP = 97,
        OP_VER = 98,
        OP_IF = 99,
        OP_NOTIF = 100,
        OP_VERIF = 101,
        OP_VERNOTIF = 102,
        OP_ELSE = 103,
        OP_ENDIF = 104,
        OP_VERIFY = 105,
        OP_RETURN = 106,
        OP_TOALTSTACK = 107,
        OP_FROMALTSTACK = 108,
        OP_2DROP = 109,
        OP_2DUP = 110,
        OP_3DUP = 111,
        OP_2OVER = 112,
        OP_2ROT = 113,
        OP_2SWAP = 114,
        OP_IFDUP = 115,
        OP_DEPTH = 116,
        OP_DROP = 117,
        OP_DUP = 118,
        OP_NIP = 119,
        OP_OVER = 120,
        OP_PICK = 121,
        OP_ROLL = 122,
        OP_ROT = 123,
        OP_SWAP = 124,
        OP_TUCK = 125,
        OP_CAT = 126,
        OP_SUBSTR = 127,
        OP_LEFT = 128,
        OP_RIGHT = 129,
        OP_SIZE = 130,
        OP_INVERT = 131,
        OP_AND = 132,
        OP_OR = 133,
        OP_XOR = 134,
        OP_EQUAL = 135,
        OP_EQUALVERIFY = 136,
        OP_RESERVED1 = 137,
        OP_RESERVED2 = 138,
        OP_1ADD = 139,
        OP_1SUB = 140,
        OP_2MUL = 141,
        OP_2DIV = 142,
        OP_NEGATE = 143,
        OP_ABS = 144,
        OP_NOT = 145,
        OP_0NOTEQUAL = 146,
        OP_ADD = 147,
        OP_SUB = 148,
        OP_MUL = 149,
        OP_DIV = 150,
        OP_MOD = 151,
        OP_LSHIFT = 152,
        OP_RSHIFT = 153,
        OP_BOOLAND = 154,
        OP_BOOLOR = 155,
        OP_NUMEQUAL = 156,
        OP_NUMEQUALVERIFY = 157,
        OP_NUMNOTEQUAL = 158,
        OP_LESSTHAN = 159,
        OP_GREATERTHAN = 160,
        OP_LESSTHANOREQUAL = 161,
        OP_GREATERTHANOREQUAL = 162,
        OP_MIN = 163,
        OP_MAX = 164,
        OP_WITHIN = 165,
        OP_RIPEMD160 = 166,
        OP_SHA1 = 167,
        OP_SHA256 = 168,
        OP_HASH160 = 169,
        OP_HASH256 = 170,
        OP_CODESEPARATOR = 171,
        OP_CHECKSIG = 172,
        OP_CHECKSIGVERIFY = 173,
        OP_CHECKMULTISIG = 174,
        OP_CHECKMULTISIGVERIFY = 175,
        OP_CHECKLOCKTIMEVERIFY = 177,
        OP_CHECKSEQUENCEVERIFY = 178,
        OP_NOP1 = 176,
        OP_NOP2 = 177,
        OP_NOP3 = 178,
        OP_NOP4 = 179,
        OP_NOP5 = 180,
        OP_NOP6 = 181,
        OP_NOP7 = 182,
        OP_NOP8 = 183,
        OP_NOP9 = 184,
        OP_NOP10 = 185,
        OP_PUBKEYHASH = 253,
        OP_PUBKEY = 254,
        OP_INVALIDOPCODE = 255,
    }

    export namespace encoding {
        class Base58 {
            constructor(data?: { buf: Buffer } | string);
            set(data: { buf: Buffer } | string): void;

            validCharacters: Function;
            encode: Function;
            decode: Function;
        }

        class Base58Check {
            validChecksum: Function;
            decode: Function;
            checksum: Function;
            encode: Function;
        }

        class BufferWriter {
            varintBufNum: Function;
            varintBufBN: Function
        }
        const BufferReader: () => BufferWriter;
        const Varint: Function;
    }

    export namespace crypto {
        class BN { }

        namespace ECDSA {
            function sign(message: Buffer, key: PrivateKey): Signature;
            function verify(hashbuf: Buffer, sig: Signature, pubkey: PublicKey, endian?: 'little'): boolean;
        }

        namespace Hash {
            function sha1(buffer: Buffer): Buffer;
            function sha256(buffer: Buffer): Buffer;
            function sha256sha256(buffer: Buffer): Buffer;
            function sha256ripemd160(buffer: Buffer): Buffer;
            function sha512(buffer: Buffer): Buffer;
            function ripemd160(buffer: Buffer): Buffer;

            function sha256hmac(data: Buffer, key: Buffer): Buffer;
            function sha512hmac(data: Buffer, key: Buffer): Buffer;
        }

        namespace Random {
            function getRandomBuffer(size: number): Buffer;
        }

        namespace Point { }

        class Signature {
            static fromDER(sig: Buffer): Signature;
            static fromString(data: string): Signature;
            SIGHASH_ALL: number;
            toString(): string;
        }
    }

    export namespace Transaction {
        class UnspentOutput {
            static fromObject(o: object): UnspentOutput;

            readonly address: Address;
            readonly txId: string;
            readonly outputIndex: number;
            readonly script: Script;
            readonly satoshis: number;

            constructor(data: object);

            inspect(): string;
            toObject(): this;
            toString(): string;
        }

        class Output {
            readonly script: Script;
            readonly satoshis: number;

            constructor(data: object);

            setScript(script: Script | string | Buffer): this;
            inspect(): string;
            toObject(): object;
        }

        class Input {
            readonly prevTxId: Buffer;
            readonly outputIndex: number;
            readonly sequenceNumber: number;
            readonly script: Script;
            readonly output?: Output;
        }
    }

    export class Transaction {
        inputs: Transaction.Input[];
        outputs: Transaction.Output[];
        readonly id: string;
        readonly hash: string;
        nid: string;

        constructor(serialized?: any);

        from(utxos: Transaction.UnspentOutput[]): this;
        to(address: Address[] | Address | string, amount: number): this;
        change(address: Address | string): this;
        fee(amount: number): this;
        feePerKb(amount: number): this;
        sign(privateKey: PrivateKey | string): this;
        applySignature(sig: crypto.Signature): this;
        addInput(input: Transaction.Input): this;
        addOutput(output: Transaction.Output): this;
        addData(value: Buffer): this;
        lockUntilDate(time: Date | number): this;
        lockUntilBlockHeight(height: number): this;

        hasWitnesses(): boolean;
        getFee(): number;
        getChangeOutput(): Transaction.Output | null;
        getLockTime(): Date | number;

        verify(): string | boolean;
        isCoinbase(): boolean;

        enableRBF(): this;
        isRBF(): boolean;

        inspect(): string;
        serialize(): string;
    }

    export class Block {
        hash: string;
        height: number;
        transactions: Transaction[];
        header: {
            time: number;
            prevHash: string;
        };

        constructor(data: Buffer | object);
    }

    export class PrivateKey {
        readonly publicKey: PublicKey;
        readonly network: Networks.Network;

        toAddress(): Address;
        toPublicKey(): PublicKey;
        toString(): string;
        toObject(): object;
        toJSON(): object;
        toWIF(): string;

        constructor(key?: string, network?: Networks.Network);
    }

    export class PublicKey {
        constructor(source: string);

        static fromPrivateKey(privateKey: PrivateKey): PublicKey;

        toBuffer(): Buffer;
        toDER(): Buffer;
    }

    export class HDPrivateKey {
        readonly hdPublicKey: HDPublicKey;

        constructor(data?: string | Buffer | object);

        derive(arg: string | number, hardened?: boolean): HDPrivateKey;
        deriveChild(arg: string | number, hardened?: boolean): HDPrivateKey;
        deriveNonCompliantChild(arg: string | number, hardened?: boolean): HDPrivateKey;

        toString(): string;
        toObject(): object;
        toJSON(): object;
    }

    export class HDPublicKey {
        readonly xpubkey: Buffer;
        readonly network: Networks.Network;
        readonly depth: number;
        readonly publicKey: PublicKey;
        readonly fingerPrint: Buffer;

        constructor(arg: string | Buffer | object);

        derive(arg: string | number, hardened?: boolean): HDPublicKey;
        deriveChild(arg: string | number, hardened?: boolean): HDPublicKey;

        toString(): string;
    }

    export namespace Script {
        const types: {
            DATA_OUT: string;
        };
        function buildMultisigOut(publicKeys: PublicKey[], threshold: number, opts: object): Script;
        function buildWitnessMultisigOutFromScript(script: Script): Script;
        function buildMultisigIn(pubkeys: PublicKey[], threshold: number, signatures: Buffer[], opts: object): Script;
        function buildP2SHMultisigIn(pubkeys: PublicKey[], threshold: number, signatures: Buffer[], opts: object): Script;
        function buildPublicKeyHashOut(address: Address): Script;
        function buildPublicKeyOut(pubkey: PublicKey): Script;
        function buildDataOut(data: string | Buffer, encoding?: string): Script;
        function buildScriptHashOut(script: Script): Script;
        function buildPublicKeyIn(signature: crypto.Signature | Buffer, sigtype: number): Script;
        function buildPublicKeyHashIn(publicKey: PublicKey, signature: crypto.Signature | Buffer, sigtype: number): Script;

        function fromAddress(address: string | Address): Script;

        function empty(): Script;
    }

    export class Script {
        [x: string]: any;
        constructor(data?: string | object);

        set(obj: object): this;

        toBuffer(): Buffer;
        toASM(): string;
        toString(): string;
        toHex(): string;

        isPublicKeyHashOut(): boolean;
        isPublicKeyHashIn(): boolean;

        getPublicKey(): Buffer;
        getPublicKeyHash(): Buffer;

        isPublicKeyOut(): boolean;
        isPublicKeyIn(): boolean;

        isScriptHashOut(): boolean;
        isWitnessScriptHashOut(): boolean;
        isWitnessPublicKeyHashOut(): boolean;
        isWitnessProgram(): boolean;
        isScriptHashIn(): boolean;
        isMultisigOut(): boolean;
        isMultisigIn(): boolean;
        isDataOut(): boolean;

        getData(): Buffer;
        isPushOnly(): boolean;

        classify(): string;
        classifyInput(): string;
        classifyOutput(): string;

        isStandard(): boolean;

        prepend(obj: any): this;
        add(obj: any): this;

        hasCodeseparators(): boolean;
        removeCodeseparators(): this;

        equals(script: Script): boolean;

        getAddressInfo(): Address | boolean;
        findAndDelete(script: Script): this;
        checkMinimalPush(i: number): boolean;
        getSignatureOperationsCount(accurate: boolean): number;

        toAddress(): Address;
    }

    export interface Util {
        readonly buffer: {
            reverse(a: any): any;
        };
    }

    export namespace Networks {
        interface Network {
            readonly name: string;
            readonly alias: string;
        }

        const livenet: Network;
        const mainnet: Network;
        const testnet: Network;

        function add(data: any): Network;
        function remove(network: Network): void;
        function get(args: string | number | Network, keys: string | string[]): Network;
    }

    export class Address {
        readonly hashBuffer: Buffer;
        readonly network: Networks.Network;
        readonly type: string;
        toString(): string;
        toBuffer(): Buffer;

        constructor(data: Buffer | Uint8Array | string | object, network?: Networks.Network, type?: string);
    }

    export class Unit {
        static fromBTC(amount: number): Unit;
        static fromMilis(amount: number): Unit;
        static fromBits(amount: number): Unit;
        static fromSatoshis(amount: number): Unit;

        constructor(amount: number, unitPreference: string);

        toBTC(): number;
        toMilis(): number;
        toBits(): number;
        toSatoshis(): number;
    }
}