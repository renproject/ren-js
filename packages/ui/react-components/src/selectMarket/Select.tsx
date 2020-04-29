import * as React from "react";

import { OptionProps } from "react-select/src/components/Option";
import { SingleValueProps } from "react-select/src/components/SingleValue";
import { GroupProps } from "react-select/src/components/Group";

import { TokenIcon } from "../tokenIcon/TokenIcon";

export interface OptionType {
    label: string;
    field?: "receiveToken" | "sendToken";
    name?: string;
    // tslint:disable-next-line: no-any no-reserved-keywords
    symbol?: any;
    value?: string;
    isDisabled?: boolean;
    options?: OptionType[];
    white?: boolean;
}

export const CustomValue = <X extends OptionType>(props: SingleValueProps<X>) => {
    const { children, className, cx, getStyles, isDisabled, innerProps } = props;
    const option = props.data;
    return (
        <div
            css={getStyles('singleValue', props)}
            className={(cx as any)(
                {
                    'single-value': true,
                    'single-value--is-disabled': isDisabled,
                },
                className,
            )}
            {...innerProps}
        >
            {option.value &&
                <TokenIcon white={option.white} token={option.value} />
            }
            {children}
        </div>
    );
};

export const CustomOption = <X extends OptionType>(props: OptionProps<X>) => {
    const {
        children,
        className,
        cx,
        getStyles,
        isDisabled,
        isFocused,
        isSelected,
        innerRef,
        innerProps,
    } = props;
    const option = props.data;
    return (
        <div
            style={getStyles('option', props)}
            className={[(cx as any)(
                {
                    option: true,
                    'option--is-disabled': isDisabled,
                    'option--is-focused': isFocused,
                    'option--is-selected': isSelected,
                },
                className
            ), isSelected ? "Select--currency__option--selected" : ""].join(" ")}
            ref={innerRef}
            {...innerProps}
        >
            <TokenIcon white={option.white} token={option.value} />
            {children}
            <span>{option.name}</span>
        </div>
    );
};

export const CustomGroup = <X extends OptionType>(props: GroupProps<X>) => {
    const {
        children,
        className,
        cx,
        getStyles,
        Heading,
        label,
        selectProps,
    } = props;
    const {
        headingProps,
        theme
    } = props as any;
    return (
        <div
            style={getStyles('group', props)}
            className={[(cx as any)({ group: true }, className), label === "Not Available" ? "Select--currency__group--disabled" : ""].join(" ")}
        >
            <Heading
                {...headingProps}
                selectProps={selectProps}
                theme={theme}
                getStyles={getStyles}
                cx={cx}
            >
                {label}
            </Heading>
            <div>{children}</div>
        </div>
    );
};
