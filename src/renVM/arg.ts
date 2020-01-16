export interface Arg<name extends string, type extends string, valueType> {
    name: name;
    type: type;
    value: valueType; // "8d8126"
}

// tslint:disable-next-line: no-any
export type Args = Array<Arg<string, string, any>>;
