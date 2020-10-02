/// <reference types="chai" />

declare module "chai-bignumber" {
    function chaiBigNumber(bignumber: any): (chai: any, utils: any) => void;

    namespace chaiBigNumber {
    }

    export = chaiBigNumber;
}

declare namespace Chai {

    // For BDD API
    interface Assertion extends LanguageChains, NumericComparison, TypeComparison {
        bignumber: BigNumberAssert;
    }

    // For Assert API
    interface Assert {
        bignumber: BigNumberAssert;
    }

    export interface BigNumberAssert {
        equal(actual?: any, expected?: any, msg?: string): void;
        at: {
            most(actual?: any, expected?: any, msg?: string): void;
            least(actual?: any, expected?: any, msg?: string): void;
        }
    }
}
