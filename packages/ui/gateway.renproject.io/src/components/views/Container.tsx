import React from "react";
import styled from "styled-components";

import { classNames } from "../../lib/className";

type DivProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export const Container: React.FC<{ mini?: boolean; } & DivProps> = ({ mini, className, children, ...props }) =>
    <div {...props} className={classNames("gateway-container", mini ? "container--paused" : "", className)}>
        {children}
    </div>;

export const ContainerBody: React.FC<DivProps> = ({ className, children, ...props }) =>
    <div {...props} className={classNames("container--body", className)}>{children}</div>;

export const ContainerDetails: React.FC<DivProps> = ({ className, children, ...props }) =>
    <div {...props} className={classNames("container--body--details", className)}>{children}</div>;

export const ContainerHeader: React.FC<{ icon: React.ReactNode } & DivProps> = ({ icon, className, ...props }) =>
    <div {...props} className={classNames("container--body--header", className)}>
        <div className="container--body--header--banner"></div>
        <div className="container--body--icon">{icon}</div>
    </div>;

export const ContainerBottom: React.FC<DivProps> = ({ className, children, ...props }) =>
    <div {...props} className={classNames("container--bottom", className)}>{children}</div>;

export const ContainerButtons: React.FC<DivProps> = ({ className, children, ...props }) =>
    <div {...props} className={classNames("container--buttons", className)}>{children}</div>;
