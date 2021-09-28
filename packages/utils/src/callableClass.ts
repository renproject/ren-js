/* eslint-disable @typescript-eslint/no-explicit-any */

// Let's assume "class X {}". X itself can be called with "new" keyword, thus it extends this type
type Constructor = new (...args: any[]) => any;

// Extracts argument types from class constructor
type ConstructorArgs<TConstructor extends Constructor> =
    TConstructor extends new (...args: infer TArgs) => any ? TArgs : never;

// Extracts class instance type from class constructor
type ConstructorClass<TConstructor extends Constructor> =
    TConstructor extends new (...args: any[]) => infer TClass ? TClass : never;

// This is what we want: to be able to create new class instances either with or without "new" keyword
export type CallableConstructor<TConstructor extends Constructor> =
    TConstructor &
        ((
            ...args: ConstructorArgs<TConstructor>
        ) => ConstructorClass<TConstructor>);

// export const Callable = <TConstructor extends Constructor>(t: TConstructor) =>
//     t as CallableConstructor<TConstructor>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function Callable<TConstructor extends Constructor>(
    type: TConstructor,
): CallableConstructor<TConstructor> {
    // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
    function constructor(
        ...args: ConstructorArgs<TConstructor>
    ): ConstructorClass<TConstructor> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return new type(...args);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    constructor.prototype = type.prototype;

    // TODO: Overwrite static values dynamically.
    (constructor as any).utils = (type as any).utils;
    (constructor as any).asset = (type as any).asset;
    (constructor as any).chain = (type as any).chain;
    (constructor as any).configMap = (type as any).configMap;

    return constructor as CallableConstructor<TConstructor>;
}
