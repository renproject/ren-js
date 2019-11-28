// tslint:disable:no-any
import * as React from "react";

// import { Loading } from "@renproject/react-components";
import { Container, Subscribe } from "unstated";

// import { PersistContainer } from "unstated-persist";

interface AnyConnectedProps {
    containers: Array<Container<any>>;
}
export interface ConnectedProps<Containers extends any[]> {
    containers: Containers;
}

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

type GetContainers<Props> = Props extends ConnectedProps<infer Containers> ?
    Containers : never;
type GetContainerClasses<Props> = Props extends ConnectedProps<Array<infer ContainerInstance>> ?
    Array<new (...params: any[]) => ContainerInstance> : never;

// const isBootstrapped = (container: Container<any> | PersistContainer<any>): boolean => {
//     return (container as any).persist === undefined || container.state._persist_version !== undefined;
// }

// Somewhat typesafe version of https://github.com/goncy/unstated-connect
export const connect = <Props extends AnyConnectedProps>(_containers: GetContainerClasses<Props>) =>
    (Component: React.ComponentClass<Props & ConnectedProps<GetContainers<Props>>> | React.StatelessComponent<Props & ConnectedProps<GetContainers<Props>>>) => (props: Omit<Props, "containers">) => (
        <Subscribe to={_containers}>
            {(...containers) =>
                // containers.every(isBootstrapped) ?
                <Component {...({ ...props, containers } as unknown as Props & ConnectedProps<GetContainers<Props>>)} />
                // : <Loading />
            }
        </Subscribe>
    );
