// tslint:disable
import * as Immutable from "immutable";

/**
 * Create a new class that can be instantiated. All instances of the class
 * will be immutable, and will be guaranteed to have all properties of the
 * interface T. Default values for these properties can be specified. Using
 * the getter and setter methods are type safe.
 *
 * @param data An object defining the default value for instances of the
 *             class that will be returned.
 *
 * @return A class that can be used to instantiate immutable objects.
 */
export const Record = <T>(data: Pick<T, keyof T>) => {
    // The returned class inherits from the Immutable.Record class, using the
    // data argument to specify the default property values.
    return class extends Immutable.Record(data as any) {
        public constructor(inner?: Partial<T>) {
            super(Immutable.fromJS(inner || {}));
        }
        /**
         * A type safe getter.
         *
         * @param key The name of the property to get. It must be a property that
         *            exists in T.
         *
         * @return The value associated with the property.
         */
        public get<K extends string & keyof T, V extends T[K]>(key: K): V {
            return super.get(key);
        }
        /**
         * A type safe setter.
         *
         * @param key The name of the property to set. It must be a property that
         *            exists in T.
         *
         * @return A new instance that has all of the property values of the
         *         original instance, except for the property value that was set.
         */
        public set<K extends (string & keyof T) & never /* FIXME */, V extends T[K]>(key: K, value: V): this {
            return super.set(key, value) as this;
        }
        /**
         * A type safe merge.
         *
         * @param inner An object of properties, and associated values, that will
         *              be set.
         *
         * @return A new instance that has all of the property values of the
         *         original instance, except for the property values that were
         *         merged.
         */
        public merge<K extends keyof T, V extends T[K]>(inner: Partial<T> | {
            [key in K]: V;
        }): this {
            return super.merge(inner as any) as this;
        }
    } as any as RecordInterface<T>;
};

// An interface to which the return class will be cast.
type RecordInterface<T> = new (inner?: Partial<T>) => Props<T> & Methods<T>;

// An interface of the properties that the class will have.
type Props<T> = {
    readonly [P in keyof T]: T[P];
};
// An interface of the methods that the class will have.
export interface Methods<T> {
    get<K extends keyof T, V extends T[K]>(key: K): V;
    set<K extends keyof T, V extends T[K]>(key: K, value: V): this;
    merge<K extends keyof T, V extends T[K]>(inner: Partial<T> | {
        [key in K]: V;
    }): this;
    toJS(): any;
}
