import * as React from "react";

import { render } from "react-dom";
import reactElementToJSXString from "react-element-to-jsx-string";
import { HashRouter, Link, Route } from "react-router-dom";

import "./styles/examples.scss";

const titled = (s: string) =>
    s.replace(/([A-Z])/g, " $1").replace(/^[a-z]/, (l) => l.toUpperCase());

const examples = {
    basic: {
        blocky: [require("./blocky/examples/1").default],
        console: [require("./console/examples/1").default],
        currencyIcon: [require("./currencyIcon/examples/1").default],
        infoLabel: [require("./infoLabel/examples/1").default],
        loading: [require("./loading/examples/1").default],
        searchField: [require("./searchField/examples/1").default],
        tokenIcons: [require("./tokenIcon/examples/1").default],
        tokenIconsWhite: [require("./tokenIcon/examples/2").default],
        feedback: [require("./feedback/examples/1").default],
        dropdown: [require("./dropdown/examples/1").default],
    },
    combined: {
        selectMarket: [require("./selectMarket/examples/1").default],
        tokenValueInput: [require("./tokenValueInput/examples/1").default],
    },
};

const Home = () => {
    return (
        <>
            {Object.keys(examples).map((category) => (
                <details open>
                    <summary>{titled(category)}</summary>
                    <div className="example-group">
                        {Object.keys(examples[category]).map((exampleGroup) => {
                            const title = titled(exampleGroup);
                            return examples[category][exampleGroup].map(
                                (example: () => JSX.Element, index: number) => (
                                    <Link
                                        className="example--preview"
                                        to={`/${exampleGroup}-${index + 1}`}
                                        key={`/${exampleGroup}-${index}`}
                                    >
                                        <div className="example-group--box">
                                            <h3>{title}</h3>
                                            <div className="example-group--body">
                                                <div className="example--preview--inner">
                                                    {React.createElement(
                                                        example,
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ),
                            );
                        })}
                    </div>
                </details>
            ))}
        </>
    );
};

declare global {
    // tslint:disable-next-line: no-any
    const Prism: any;
}

const withSourceCode = (element: () => JSX.Element) => {
    const jsx = element();
    const highlight = () => Prism.highlightAll();
    return () => (
        <>
            {jsx}
            <details className="example--source-code" onClick={highlight}>
                <summary>Source code</summary>
                <pre>
                    <code className="language-jsx">
                        {reactElementToJSXString(jsx)}
                    </code>
                </pre>
            </details>
        </>
    );
};

const App = () => {
    return (
        <HashRouter>
            <div className="themed-app">
                <div className="examples theme-light">
                    <Link to="/">
                        <p className="home-button">Home</p>
                    </Link>
                    <Route path="/" exact component={Home} />
                    {Object.keys(examples).map((category) =>
                        Object.keys(examples[category]).map((exampleGroup) => (
                            <div key={exampleGroup}>
                                {examples[category][exampleGroup].map(
                                    (
                                        example: () => JSX.Element,
                                        index: number,
                                    ) => (
                                        <Route
                                            path={`/${exampleGroup}-${
                                                index + 1
                                            }`}
                                            component={withSourceCode(example)}
                                        />
                                    ),
                                )}
                            </div>
                        )),
                    )}
                </div>
            </div>
        </HashRouter>
    );
};

const rootElement = document.getElementById("root");
render(<App />, rootElement);
