import * as React from "react";

import { escapeRegExp, SearchField } from "../SearchField";

export default () => {
    const [searchInput, setSearchInput] = React.useState("");

    const entries = ["Apple", "Ape", "App", "Art", "Banana", "Barn"];


    const generateRows = (): React.ReactNode[] => {
        const searchTest = new RegExp(`^${escapeRegExp(searchInput)}`, "i");

        return entries
            .filter(entry => searchTest.test(entry))
            .map(entry => <p>{entry}</p>);
    };

    return <div>
        <SearchField placeholder="Search words" onSearchChange={setSearchInput} value={searchInput} autoFocus />
        {generateRows()}
    </div>;
};
