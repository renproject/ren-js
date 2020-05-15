import * as React from "react";

import { lighten } from "polished";
import styled from "styled-components";

import infoIcon from "../../images/icons/info.svg";
import { classNames } from "../../lib/utils";
import { pulseAnimation } from "../../scss/animations";
import { Tooltip } from "../views/tooltip/Tooltip";

export const ProgressPulse = styled.div`
            background-color: white !important;
            color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
            border-radius: 50%;
            display: block;
            animation: ${p => pulseAnimation("6px", p.theme.primaryColor)};
        `;



export const ProgressItem = ({ name, label, target, progress, pulse, tooltip }: { name?: React.ReactChild, label?: string | number, target: number, progress: number, pulse?: boolean, tooltip?: string }) =>
    <div className={classNames(`ren-progress-bar--item`, progress >= target ? "ren-progress-bar--item--done" : "", Math.floor(progress + 1) === target ? "ren-progress-bar--item--current" : "")}>
        {pulse && Math.floor(progress + 1) === target ?
            <ProgressPulse className="ren-progress-bar--number">{label || (target)}</ProgressPulse> :
            <div className="ren-progress-bar--number">{label || (target)}</div>
        }
        <div className="ren-progress-bar--label"><div className="ren-progress-bar--label--inner">{name} {tooltip ? <Tooltip contents={tooltip}><img alt={`Tooltip: ${tooltip}`} src={infoIcon} /></Tooltip> : null}</div></div>
    </div>;

const width = (progress: number, itemsLength: number) => {
    if (itemsLength === 1) {
        return `0`; // { percent: 0, px: 0 };
    }

    // Progress bar's width is based on the progress percentage.
    // const percent = Math.min(100 * (progress / (itemsLength - 1)), 100);
    // Remove 8px for the first circle, and 16px for each following circle.
    // const px = -8 - 16 * (Math.min(progress - 1, 0));

    return `calc(${Math.min(progress, itemsLength - 1)} * calc(calc(100% - 16px) / ${itemsLength - 1}))`;

    // return { percent, px };
};

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    items: Array<{ name?: string, label?: string, tooltip?: string }>;
    progress: number;
    pulse?: boolean;
}

export const ProgressBar = ({ items, progress, pulse, className, ...props }: Props) => {
    const blueBarWidth = width(progress, items.length);
    const greyBarWidth = width(items.length - 1, items.length);
    return <div {...props} className={classNames("ren-progress-bar", className)}>
        <div className="progress-bar--blue" style={{ width: blueBarWidth }} />
        <div className="progress-bar--gray" style={{ width: greyBarWidth }} />
        <div className="progress-bar--items">
            {items.map((item, index) =>
                <ProgressItem key={index} target={index + 1} progress={progress} name={item.name} label={item.label} tooltip={item.tooltip} pulse={pulse} />
            )}
        </div>
    </div>;
};
