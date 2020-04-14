import grey from "@material-ui/core/colors/grey";
import { createMuiTheme } from "@material-ui/core/styles";

export default createMuiTheme({
    palette: {
        primary: {
            light: "#6598ff",
            main: "#006bec",
            dark: "#0042b9",
            contrastText: "#fff",
        },
        // primary: blueGrey,
        secondary: grey,
    },
    typography: {
        fontFamily: [
            "Suisse Intl",
            "-apple-system",
            "BlinkMacSystemFont",
            "\"Segoe UI\"",
            "Roboto",
            "\"Helvetica Neue\"",
            "Arial",
            "sans-serif",
            "\"Apple Color Emoji\"",
            "\"Segoe UI Emoji\"",
            "\"Segoe UI Symbol\"",
        ].join(","),
    },
    overrides: {
        // Style sheet name ⚛️
        // MuiButton: {
        //   // Name of the rule
        //   text: {
        //     // Some CSS
        //     color: 'white',
        //   },
        // }
        // '.MuiOutlinedInput-root:hover':{
        //     borderColor: '#EBEBEB !important'
        // },
        MuiFilledInput: {
            root: {
                fontSize: 14,
                "& input": {
                    padding: 12,
                    paddingTop: 30,
                    paddingBottom: 16,
                },
                "& .MuiInputAdornment-root": {
                    paddingTop: 30,
                    paddingBottom: 16,
                },
                "& p": {
                    fontSize: 14,
                }
            },
            underline: {
                background: "#F5F2F7 !important",
                borderBottom: "0px solid transparent",
                borderRadius: 12,
                "&:hover": {
                    background: "#F5F2F7",
                },
                "&:before, &:after": {
                    display: "none"
                }
            }
        },
        MuiOutlinedInput: {
            root: {
                "& input": {
                },
            },
            notchedOutline: {
                borderRadius: 16,
                borderColor: "#DCE0E3 !important",
                borderWidth: "1px !important"
            }
        },
        MuiTextField: {

        },
        MuiButton: {
            root: {
                borderRadius: 12,
                width: "100%",
                "&.MuiButton-sizeLarge": {
                    minHeight: 60,
                }
            },
        },
        MuiDivider: {
            root: {
                backgroundColor: "#DCE0E3"
            }
        }
    }
});
