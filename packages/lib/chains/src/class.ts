// Let's assume "class X {}". X itself can be called with "new" keyword, thus it extends this type
type Constructor = new (...args: Array<any>) => any;

// Extracts argument types from class constructor
type ConstructorArgs<
    TConstructor extends Constructor
> = TConstructor extends new (...args: infer TArgs) => any ? TArgs : never;

// Extracts class instance type from class constructor
type ConstructorClass<
    TConstructor extends Constructor
> = TConstructor extends new (...args: Array<any>) => infer TClass
    ? TClass
    : never;

// This is what we want: to be able to create new class instances either with or without "new" keyword
export type CallableConstructor<
    TConstructor extends Constructor
> = TConstructor &
    ((
        ...args: ConstructorArgs<TConstructor>
    ) => ConstructorClass<TConstructor>);

// export const Callable = <TConstructor extends Constructor>(t: TConstructor) =>
//     t as CallableConstructor<TConstructor>;

export function Callable<TConstructor extends Constructor>(
    type: TConstructor
): CallableConstructor<TConstructor> {
    function createInstance(
        ...args: ConstructorArgs<TConstructor>
    ): ConstructorClass<TConstructor> {
        return new type(...args);
    }

    createInstance.prototype = type.prototype;
    return createInstance as CallableConstructor<TConstructor>;
}
