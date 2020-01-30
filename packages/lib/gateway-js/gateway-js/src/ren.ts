export const RenGatewayContainerHTML = () => `
<div id="_ren_gatewayContainer" id="_ren_gatewayContainer">
    <style>
        #_ren_gatewayContainer {
            all: unset;
        }
    </style>
</div>
`;

const iframeHeight = 470 + 67; // Main div + progress div

export const RenElementHTML = (uniqueID: string, frameUrl: string, paused?: boolean) => `
<div class="_ren_gateway ${paused ? "_ren_gateway-minified" : ""}" id="_ren_gateway-${uniqueID}">
    <style>
    ._ren_overlay {
        width: 100vw;
        height: 100vh;
        top: 0;
        left: 0;
        position: absolute;
        background: rgba(0, 0, 0, 0.7);
        z-index:1000000;
    }

    ._ren_iframeShadow {
        box-shadow: 0 20px 40px 0 rgba(0,0,0,0.5);
        border-radius: 6px;
        background: white;
        position:absolute;
        left: calc(50vw - calc(460px / 2));
        top: calc(50vh - calc(${iframeHeight}px / 2));
        // transform: translate(-50%, -50%);
        width:460px;
        height:${iframeHeight}px;
        z-index:1000000;
        transition: all 300ms;
    }

    ._ren_gateway-minified ._ren_iframeShadow {
        top: 10px;
        // right: 10px;
        left: calc(100% - 250px - 10px);
        // transform: translate(0%, 0%);
        width:250px;
        height:50px;
        box-shadow: 0 5px 10px 0 rgba(0,0,0,0.5);
        z-index: 999999;
    }

    /* TODO: Use single CSS rule */
    ._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 1));
    }
    ._ren_gateway+._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 2));
    }
    ._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 3));
    }
    ._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 4));
    }
    ._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 5));
    }
    ._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 6));
    }
    ._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 7));
    }
    ._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway+._ren_gateway-minified ._ren_iframeShadow {
        top: calc(10px + calc(60px * 8));
    }

    ._ren_gateway-minified ._ren_overlay {
        display: none;
    }

    ._ren_iframe {
        border-radius: 6px;
        height: 100%;
        width: 100%;
        border: none;
    }
    </style>
    <div class="_ren_overlay"></div>
    <div class="_ren_iframeShadow" id="_ren_iframeShadow-${uniqueID}">
        <iframe class="_ren_iframe" id="_ren_iframe-${uniqueID}" ${/*style="background-color: transparent" allowtransparency="true"*/""} frameborder="0" src="${frameUrl}" ></iframe>
    </div>
</div>
`;
