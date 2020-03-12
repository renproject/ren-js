// tslint:disable: no-console react-this-binding-issue

import * as React from "react";
import * as ReactDOM from "react-dom";

import { ThemeProvider, withStyles } from "@material-ui/styles";

import { GatewayExample } from "./main";
import "./style.scss";
import theme from "./theme";

const styles = () => ({
    warning: {
        // marginTop: theme.spacing(4),
        marginBottom: theme.spacing(1),
        paddingLeft: theme.spacing(3),
        paddingRight: theme.spacing(3),
        boxSizing: "border-box" as const,
        width: "100%",
        "& div": {
            background: "#DCE0E3",
        },
        "& span": {
            padding: theme.spacing(0.5),
            whiteSpace: "normal",
            // fontSize: 12
        },
    },
    content: {
        [theme.breakpoints.up("xs")]: {
            minHeight: "100vh"
        },
        paddingTop: theme.spacing(6),
        paddingLeft: theme.spacing(4),
        paddingRight: theme.spacing(4)
    },
    actions: {
        minHeight: "100%"
    },
    info: {
        fontSize: 12,
        paddingTop: theme.spacing(6),
        paddingLeft: theme.spacing(4),
        paddingRight: theme.spacing(4),
        marginBottom: theme.spacing(1),
        "& p": {
            marginBottom: 0
        }
    },
});


const Index = withStyles(styles)(() => {

    return <ThemeProvider theme={theme}><div className="test-background">
        <GatewayExample />
    </div></ThemeProvider>;
});

ReactDOM.render(<Index />, document.getElementById("root") as HTMLElement);
