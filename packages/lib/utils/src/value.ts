/**
 * The `value` function converts between different cryptocurrency units.
 * See `value.spec.ts` for example usage.
 */

import { NumberValue } from "@renproject/interfaces";
import BigNumber from "bignumber.js";

const convert = (
    valueIn: BigNumber,
    fromUnit: BigNumber,
    toUnit: BigNumber
) => {
    return valueIn.multipliedBy(fromUnit).dividedBy(toUnit);
};

export const toBigNumber = (valueIn: NumberValue): BigNumber =>
    BigNumber.isBigNumber(valueIn)
        ? new BigNumber(valueIn)
        : new BigNumber(valueIn.toString());
export const toFixed = (input: {
    readonly toFixed?: () => string;
    readonly toString: () => string;
}) => (input.toFixed ? input.toFixed() : input.toString());

class BaseValue<T extends { [unit: string]: BigNumber }> {
    private readonly value: BigNumber;
    private readonly unitTypes: T;
    constructor(unitTypes: T, valueIn: NumberValue, unit: keyof T) {
        this.unitTypes = unitTypes;
        this.value = convert(
            toBigNumber(valueIn),
            this.unitTypes[unit],
            new BigNumber("1")
        );
    }
    public to = (unit: keyof T): BigNumber =>
        convert(
            this.value,
            new BigNumber("1"),
            // tslint:disable-next-line: no-use-before-declare
            this.unitTypes[resolveUnit(unit as string) as keyof T]
        );
}

// BTC /////////////////////////////////////////////////////////////////////////

const BTCUnits = {
    sats: new BigNumber("0.00000001"),
    ubtc: new BigNumber("0.000001"),
    mbtc: new BigNumber("0.001"),
    btc: new BigNumber("1"),
};

class BTCValue extends BaseValue<typeof BTCUnits> {
    public static units = BTCUnits;
    public static synonyms = [
        { synonyms: ["bitcoin", "bitcoins", "tbtc"], unit: "btc" as "btc" },
    ]; // tbtc is used to indicate testnet btc
    constructor(valueIn: NumberValue, unit: keyof typeof BTCUnits) {
        super(BTCUnits, valueIn, unit);
    }
    public sats = () => this.to("sats");
    public btc = () => this.to("btc");
    public _smallest = () => this.to("sats");
    public _readable = () => this.to("btc");
}

// BCH /////////////////////////////////////////////////////////////////////////

const BCHUnits = {
    sats: new BigNumber("0.00000001"),
    ubch: new BigNumber("0.000001"),
    mbch: new BigNumber("0.001"),
    bch: new BigNumber("1"),
};

class BCHValue extends BaseValue<typeof BCHUnits> {
    public static units = BCHUnits;
    public static synonyms = [
        { synonyms: ["bitcoin-cash", "bcash", "tbch"], unit: "btc" as "bch" },
    ];
    constructor(valueIn: NumberValue, unit: keyof typeof BCHUnits) {
        super(BCHUnits, valueIn, unit);
    }
    public sats = () => this.to("sats");
    public bch = () => this.to("bch");
    public _smallest = () => this.to("sats");
    public _readable = () => this.to("bch");
}

// ZEC /////////////////////////////////////////////////////////////////////////

const ZECUnits = {
    zats: new BigNumber("0.00000001"),
    uzec: new BigNumber("0.000001"),
    mzec: new BigNumber("0.001"),
    zec: new BigNumber("1"),
};

class ZECValue extends BaseValue<typeof ZECUnits> {
    public static units = ZECUnits;
    public static synonyms = [
        { synonyms: ["zcash", "tzec", "taz"], unit: "zec" as "zec" },
    ];
    constructor(valueIn: NumberValue, unit: keyof typeof ZECUnits) {
        super(ZECUnits, valueIn, unit);
    }
    public zats = () => this.to("zats");
    public zec = () => this.to("zec");
    public _smallest = () => this.to("zats");
    public _readable = () => this.to("zec");
}

// Sats ////////////////////////////////////////////////////////////////////////

const SatsUnits = {
    sats: new BigNumber("0.00000001"),
    bch: new BigNumber("1"),
    btc: new BigNumber("1"),
};

class SatsValue extends BaseValue<typeof SatsUnits> {
    public static units = SatsUnits;
    public static synonyms = [{}];
    constructor(valueIn: NumberValue, unit: keyof typeof SatsUnits) {
        super(SatsUnits, valueIn, unit);
    }
    public sats = () => this.to("sats");
    public btc = () => this.to("btc");
    public bch = () => this.to("bch");
    public _smallest = () => this.to("sats");
    public _readable = () => this.to("btc");
}

// ETH /////////////////////////////////////////////////////////////////////////

const ETHUnits = {
    wei: new BigNumber("0.000000000000000001"),
    kwei: new BigNumber("0.000000000000001"),
    mwei: new BigNumber("0.000000000001"),
    gwei: new BigNumber("0.000000001"),
    finney: new BigNumber("0.001"),
    eth: new BigNumber("1"),
};

class ETHValue extends BaseValue<typeof ETHUnits> {
    public static units = ETHUnits;
    public static synonyms = [
        { synonyms: ["ethereum", "ether", "keth"], unit: "eth" as "eth" },
    ];
    constructor(valueIn: NumberValue, unit: keyof typeof ETHUnits) {
        super(ETHUnits, valueIn, unit);
    }
    public wei = () => this.to("wei");
    public eth = () => this.to("eth");
    public _smallest = () => this.to("wei");
    public _readable = () => this.to("eth");
}

////////////////////////////////////////////////////////////////////////////////
// General /////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

const valueClasses = [BTCValue, BCHValue, ZECValue, ETHValue];
type Units =
    | keyof typeof BTCUnits
    | keyof typeof BCHUnits
    | keyof typeof ZECUnits
    | keyof typeof SatsUnits
    | keyof typeof ETHUnits;

export type Value<Unit = ""> = Unit extends "sats"
    ? SatsValue
    : Unit extends keyof typeof BTCUnits
    ? BTCValue
    : Unit extends keyof typeof BCHUnits
    ? BCHValue
    : Unit extends keyof typeof ZECUnits
    ? ZECValue
    : Unit extends keyof typeof ETHUnits
    ? ETHValue
    : BTCValue | BCHValue | ZECValue | SatsValue | ETHValue;

const resolveUnit = (unitIn: string): Units => {
    const unit = unitIn.toLowerCase().replace(/µ/, "u");

    // Satoshis
    if (unit.slice(0, 3) === "sat") {
        return "sats";
    }

    for (const ValueClass of valueClasses) {
        // Check if the unit belongs to the class
        if (new Set(Object.keys(ValueClass.units)).has(unit)) {
            return unit as keyof typeof ValueClass.units;
        }

        // Handle synonyms
        for (const { synonyms, unit: synonymUnit } of ValueClass.synonyms) {
            if (new Set(synonyms).has(unit)) {
                return synonymUnit;
            }
        }
    }

    throw new Error(`Unknown unit "${unitIn}"`);
};

export const value = <Unit extends Units>(
    valueIn: NumberValue,
    unitIn: Unit
): Value<Unit> => {
    const unit = resolveUnit(unitIn);

    // Satoshis
    if (unit === "sats") {
        return new SatsValue(valueIn, "sats") as Value<Unit>;
    }

    for (const ValueClass of valueClasses) {
        // Check if the unit belongs to the class
        if (new Set(Object.keys(ValueClass.units)).has(unit)) {
            return new ValueClass(
                valueIn,
                unit as keyof typeof ValueClass.units
            ) as Value<Unit>;
        }
    }

    throw new Error(`Unknown unit "${unitIn}"`);
};
