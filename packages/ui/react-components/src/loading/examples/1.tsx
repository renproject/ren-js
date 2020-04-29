import * as React from "react";

import { Loading } from "../Loading";

export default () => <>
    <div style={{ background: "white", padding: "30px" }}>
        <Loading />
    </div>
    <div style={{ background: "black", padding: "30px" }}>
        <Loading alt />
    </div>
</>;

