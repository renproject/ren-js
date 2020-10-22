import * as React from "react";

import { faBitcoin, faEthereum } from "@fortawesome/free-brands-svg-icons";
import {
    FontAwesomeIcon,
    Props as FAProps,
} from "@fortawesome/react-fontawesome";

export enum Currency {
    AUD = "aud",
    CNY = "cny",
    GBP = "gbp",
    EUR = "eur",
    JPY = "jpy",
    KRW = "krw",
    RUB = "rub",
    USD = "usd",

    ETH = "eth",
    BTC = "btc",
}

export const currencies = [
    { currency: Currency.AUD, description: "Australian Dollar (AUD)" },
    { currency: Currency.GBP, description: "British Pound (GBP)" },
    { currency: Currency.CNY, description: "Chinese Yuan (CNY)" },
    { currency: Currency.EUR, description: "Euro (EUR)" },
    { currency: Currency.JPY, description: "Japanese Yen (JPY)" },
    { currency: Currency.KRW, description: "Korean Won (KRW)" },
    { currency: Currency.RUB, description: "Russian Ruble (RUB)" },
    { currency: Currency.USD, description: "US Dollar (USD)" },

    { currency: Currency.ETH, description: "Ethereum (ETH)" },
    { currency: Currency.BTC, description: "Bitcoin (BTC)" },
];

interface Props extends Partial<FAProps> {
    currency: Currency;
}

export const textCurrencyIcon = (currency: Currency) => {
    // Note: Typescript will warn if the switch statement is non-exhaustive

    // tslint:disable-next-line: switch-default
    switch (currency) {
        case Currency.AUD:
            return "$";
        case Currency.CNY:
            return "¥";
        case Currency.GBP:
            return "£";
        case Currency.EUR:
            return "€";
        case Currency.JPY:
            return "¥";
        case Currency.KRW:
            return "₩";
        case Currency.RUB:
            return "₽";
        case Currency.USD:
            return "$";
        default:
            return "";
    }
};

export const CurrencyIcon = ({ currency, className, ...props }: Props) => {
    // Note: Typescript will warn if the switch statement is non-exhaustive

    // tslint:disable-next-line: switch-default
    switch (currency) {
        case Currency.AUD:
            return <>$</>;
        case Currency.CNY:
            return <>¥</>;
        case Currency.GBP:
            return <>£</>;
        case Currency.EUR:
            return <>€</>;
        case Currency.JPY:
            return <>¥</>;
        case Currency.KRW:
            return <>₩</>;
        case Currency.RUB:
            return <>₽</>;
        case Currency.USD:
            return <>$</>;
        case Currency.ETH:
            return (
                <FontAwesomeIcon
                    {...props}
                    className={["currency-icon", className].join(" ")}
                    icon={faEthereum}
                />
            );
        case Currency.BTC:
            return (
                <FontAwesomeIcon
                    {...props}
                    className={["currency-icon", className].join(" ")}
                    icon={faBitcoin}
                />
            );
    }
};
