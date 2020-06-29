import { lighten } from "polished";
import React from "react";
import styled from "styled-components";

import { pulseAnimation } from "../../scss/animations";
import infoIcon from "../../scss/images/info.svg";
import { Tooltip } from "../views/tooltip/Tooltip";

const RenProgressBar = styled.div`
    height: 100%;
    height: 54px;
`;

const ProgressBarItems = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    font-size: 1.2rem;
    color: rgba(0, 0, 0, 0.4);
    z-index: 100;
    height: 100%;
    height: 54px;
`;

const ProgressBarBar = styled.div`
    height: 1px;
    position: relative;
    z-index: 0;
    left: 8px;
`;

const ProgressBarBlue = styled(ProgressBarBar)`
    background: linear-gradient(-90deg, #00A8F5 0%, #006FE8 100%);
    top: 22px;
    z-index: 1;
`;

const ProgressBarGray = styled(ProgressBarBar)`
    background: #707575;
    top: 21px;
`;

const RenProgressBarLabel = styled.div`
    width: 0px;
    height: 18px;
`;

const RenProgressBarLabelInner = styled.div`
    width: 100px;
    text-align: center;
    margin-left: -50px;
`;

const RenProgressBarItem = styled.div`
    display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center;
    z-index: 2;

    &:last-child::before {
        width: 0;
    }
`;

const RenProgressBarNumber = styled.div<{ isDone: boolean, isTarget: boolean }>`
    height: 16px;
    width: 16px;
    border-radius: 100%;
    text-align: center;
    font-size: 9px;
    margin: 10px 0;
    margin-bottom: 6px;
    padding-top: 1px;
    color: ${props => (props.isDone || props.isTarget) ? "white" : "#87888C"};
    border: 1px solid ${props => (props.isDone || props.isTarget) ? "#006fe8" : "#707575"};;
    z-index: 2;
    background: ${props => (props.isDone || props.isTarget) ? "#006fe8" : "white"};
`;

export const ProgressPulse = styled(RenProgressBarNumber)`
            background-color: white !important;
            color: ${p => lighten(0.1, p.theme.primaryColor)} !important;
            border-radius: 50%;
            display: block;
            animation: ${p => pulseAnimation("6px", p.theme.primaryColor)};
        `;

export const ProgressItem = ({ name, label, target, progress, pulse, tooltip }: { name?: React.ReactChild, label?: string | number, target: number, progress: number, pulse?: boolean, tooltip?: string }) => {
    const isDone = progress >= target;
    const isTarget = Math.floor(progress + 1) === target;
    return (<RenProgressBarItem>
        {pulse && isTarget ?
            <ProgressPulse isDone={isDone} isTarget={isTarget}>{label || (target)}</ProgressPulse> :
            <RenProgressBarNumber isDone={isDone} isTarget={isTarget}>{label || (target)}</RenProgressBarNumber>
        }
        <RenProgressBarLabel><RenProgressBarLabelInner>{name} {tooltip ? <Tooltip contents={tooltip}><img alt={`Tooltip: ${tooltip}`} src={infoIcon} /></Tooltip> : null}</RenProgressBarLabelInner></RenProgressBarLabel>
    </RenProgressBarItem>);
};

const width = (progress: number, itemsLength: number) => {
    if (itemsLength === 1) {
        return `0`; // { percent: 0, px: 0 };
    }

    // Progress bar's width is based on the progress percentage.
    // const percent = Math.min(100 * (progress / (itemsLength - 1)), 100);
    // Remove 8px for the first circle, and 16px for each following circle.
    // const px = -8 - 16 * (Math.min(progress - 1, 0));

    return `calc(${Math.min(progress, itemsLength - 1)} * calc(calc(100% - 16px) / ${itemsLength - 1}))`;
};

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    items: Array<{ name?: string, label?: string, tooltip?: string }>;
    progress: number;
    pulse?: boolean;
}

export const ProgressBar = ({ items, progress, pulse, className, ref, ...props }: Props) => {
    const blueBarWidth = width(progress, items.length);
    const greyBarWidth = width(items.length - 1, items.length);
    return <RenProgressBar ref={ref as ((instance: HTMLDivElement | null) => void) | React.RefObject<HTMLDivElement> | null | undefined} {...props} className={className}>
        <ProgressBarBlue style={{ width: blueBarWidth }} />
        <ProgressBarGray style={{ width: greyBarWidth }} />
        <ProgressBarItems>
            {items.map((item, index) =>
                <ProgressItem key={index} target={index + 1} progress={progress} name={item.name} label={item.label} tooltip={item.tooltip} pulse={pulse} />
            )}
        </ProgressBarItems>
    </RenProgressBar>;
};
