import * as React from "react";

import Select from "react-select";

import { CustomGroup, CustomOption, CustomValue, OptionType } from "./Select";
import "./styles.scss";

interface Props<Token, MarketPair>
    extends React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
    > {
    top?: boolean;
    bottom?: boolean;
    white?: boolean;
    thisToken: Token;
    otherToken: Token;
    allTokens: Map<Token, { name: string; symbol: string }>;
    disabled?: boolean;
    onMarketChange(token: Token): void;
    getMarket(left: Token, right: Token): MarketPair | undefined;
}

/**
 * SelectMarket allows the user to select a market from two token dropdowns
 */
export const SelectMarket = <Token extends string, MarketPair extends string>({
    top,
    bottom,
    white,
    thisToken,
    otherToken,
    allTokens,
    disabled,
    onMarketChange,
    getMarket,
    className,
    ...props
}: Props<Token, MarketPair>) => {
    const handleChange = React.useCallback(
        // tslint:disable-next-line:no-any
        (event: any): void => {
            const newToken = event.value;
            onMarketChange(newToken);
        },
        [onMarketChange],
    );

    const listCurrencies = React.useCallback((): OptionType[] => {
        const list: OptionType[] = [];

        allTokens.forEach(({ symbol, name }, token: Token) => {
            list.push({
                field: "sendToken",
                label: `${symbol}`,
                name,
                symbol,
                value: token,
                white,
            });
        });
        return list;
    }, [allTokens]);

    const listPairs = React.useCallback(
        (listThisToken: Token): OptionType[] => {
            const availableList: OptionType[] = [];
            const unavailableList: OptionType[] = [];

            allTokens.forEach(({ symbol, name }, token) => {
                const enabled = getMarket(listThisToken, token);

                const list = enabled ? availableList : unavailableList;
                list.push({
                    field: "receiveToken",
                    label: `${symbol}`,
                    name,
                    symbol,
                    isDisabled: !enabled,
                    value: token,
                    white,
                });
            });
            return [
                {
                    label: "Available",
                    options: availableList,
                },
                {
                    label: "Not Available",
                    options: unavailableList,
                },
            ];
        },
        [allTokens],
    );

    // Retrieve the order inputs from the store.
    const customStyles = {
        // tslint:disable-next-line: no-any
        option: (provided: any, state: any) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? "rgba(0, 27, 58, 0.1)"
                : "transparent",
            "&:hover": {
                backgroundColor: "rgba(219, 224, 232, 0.3)",
            },
        }),
    };

    if (top) {
        const leftCurrencies = listCurrencies();

        return (
            <div {...props} className={["select--market", className].join(" ")}>
                <Select
                    className="Select--currency"
                    classNamePrefix="Select--currency"
                    name="quoteCode"
                    value={
                        leftCurrencies.find(
                            (option) => option.value === thisToken,
                        ) || null
                    }
                    onChange={handleChange}
                    options={leftCurrencies}
                    components={{
                        SingleValue: CustomValue,
                        Option: CustomOption,
                        Group: CustomGroup,
                    }}
                    isClearable={false}
                    backspaceRemovesValue={false}
                    styles={customStyles}
                    isDisabled={disabled}
                    // isDisabled={leftCurrencies.length <= 1}
                />
            </div>
        );
    } else {
        const rightCurrencies = listPairs(otherToken);
        let list = rightCurrencies;
        if (rightCurrencies[0].options && rightCurrencies[1].options) {
            list = rightCurrencies[0].options.concat(
                rightCurrencies[1].options,
            );
        }
        const error = !getMarket(otherToken, thisToken);

        return (
            <div
                className={[
                    "select--market",
                    "select--market--second",
                    error ? "select--market--error" : "",
                    className,
                ].join(" ")}
            >
                <Select
                    className="Select--currency"
                    classNamePrefix="Select--currency"
                    name="baseCode"
                    value={
                        list.find((option) => option.value === thisToken) ||
                        null
                    }
                    onChange={handleChange}
                    options={rightCurrencies}
                    // menuIsOpen
                    components={{
                        SingleValue: CustomValue,
                        Option: CustomOption,
                        Group: CustomGroup,
                    }}
                    isClearable={false}
                    backspaceRemovesValue={false}
                    styles={customStyles}
                    isDisabled={disabled}
                    // isDisabled={rightCurrencies.length <= 1}
                />
            </div>
        );
    }
};
