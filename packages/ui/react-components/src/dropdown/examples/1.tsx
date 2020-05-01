import * as React from "react";

import { currencies, Currency, CurrencyIcon } from "../../currencyIcon/CurrencyIcon";
import { Dropdown } from "../Dropdown";

const getCurrencyOptions = () => {
    const options = new Map<string, React.ReactNode>();

    for (const currency of currencies) {
        options.set(currency.currency, <>
            <CurrencyIcon currency={currency.currency} />
            {" "}{currency.description}
        </>);
    }

    return options;
};

const currencyOptions = getCurrencyOptions();

export default () => {
    const [quoteCurrency, setQuoteCurrency] = React.useState(Currency.AUD as string);

    return <Dropdown
        selected={{
            value: quoteCurrency,
            render: <>
                <CurrencyIcon currency={quoteCurrency as Currency} />
                {" "}{quoteCurrency.toUpperCase()}
            </>
        }}
        options={currencyOptions}
        setValue={setQuoteCurrency}
    />;
};
