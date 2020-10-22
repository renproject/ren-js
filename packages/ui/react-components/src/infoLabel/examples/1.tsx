import * as React from "react";

import { InfoLabel, LabelLevel } from "../InfoLabel";

export default () => (
    <>
        <p style={{ marginTop: "50px" }}>
            Hover to see information: <InfoLabel>Some information</InfoLabel>
        </p>
        <p style={{ marginTop: "50px" }}>
            Hover to the warning:{" "}
            <InfoLabel level={LabelLevel.Warning}>A warning</InfoLabel>
        </p>
    </>
);
