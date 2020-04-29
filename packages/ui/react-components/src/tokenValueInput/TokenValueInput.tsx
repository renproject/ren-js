import * as React from "react";

import { InfoLabel } from "../infoLabel/InfoLabel";
import "./styles.scss";

const calculateStep = (valueIn: string | null) => {
    try {
        if (valueIn === "0" || !valueIn) {
            return 0.1;
        }
        let value = valueIn;

        // If the input ends with a "."
        if (value[value.length - 1] === ".") {
            value += "0";
        }

        const split = (`0${value}`).split(".");

        let stepE = 0;
        if (split.length === 1) {
            const valueLength = value.length;
            while (value[value.length - 1] === "0") {
                value = value.slice(0, value.length - 1);
                stepE += 1;
            }
            if (stepE === valueLength - 1) {
                stepE -= 1;
            }
        } else {
            stepE = -split[1].length;
            if (split[1] === (`${"0".repeat(split[1].length - 1)}1`)) {
                stepE -= 1;
            }
        }

        return 10 ** stepE;
    } catch (error) {
        return 1;
    }
};

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    title: string;
    value: string | null;
    subtext: React.ReactNode;
    hint: string | null;
    error: boolean;
    onValueChange: ((newValue: string, options: { blur: boolean }) => void) | null;
}

export const TokenValueInput = ({ title, hint, value, subtext, error, onValueChange, className, children }: Props) => {

    const handleChange = React.useCallback((event: React.FormEvent<HTMLInputElement>) => {
        if (onValueChange) {
            const element = (event.target as HTMLInputElement);
            const value = element.value;
            onValueChange(value, { blur: false });
        }
    }, [onValueChange]);

    const handleBlur = React.useCallback((event: React.FormEvent<HTMLInputElement>) => {
        if (onValueChange) {
            const element = (event.target as HTMLInputElement);
            const value = element.value;
            onValueChange(value, { blur: true });
        }
    }, [onValueChange]);

    const disabled = onValueChange === null;
    return <div className={["token-value", className].join(" ")}>
        <div className="token-value--left">
            <div className="order-value--title">
                <span>{title}</span>
                {hint && <InfoLabel>{hint}</InfoLabel>}
            </div>
            <span className={["token-value--item", disabled ? "disabled" : "", error ? "token-value--item--error" : ""].join(" ")}>
                <input
                    value={value === null ? "" : value}
                    type="number"
                    disabled={disabled}
                    placeholder="0"
                    min={0}
                    step={calculateStep(value)}
                    onChange={handleChange}
                    onBlur={handleBlur}
                // onKeyDown={console.log}
                />
            </span>
        </div>

        <div className="token-value--right">
            {children}
            <p className="order-value--subtext">
                {/* {error ? */}
                {/* <span className="order-value--warning"> */}
                {/* {error} */}
                {/* </span> : subtext} */}
                {subtext}
            </p>
        </div>
    </div>;
}
