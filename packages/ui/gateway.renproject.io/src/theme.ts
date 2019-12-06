import createTheme from "styled-components-theme";

export const colors = {
    primaryColor: "#006fe8"
};

export const theme = createTheme(...Object.keys(colors));
