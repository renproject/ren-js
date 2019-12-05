export const RenGatewayContainerHTML = () => `
<div id="_ren_gatewayContainer" id="_ren_gatewayContainer">
    <style>
        #_ren_gatewayContainer {
            all: unset;
        }
    </style>
</div>
`;

export const RenElementHTML = (uniqueID: string) => `
<div class="_ren_gateway" id="_ren_gateway-${uniqueID}">
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
        background:#fff;
        position:absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width:460px;
        height:410px;
        z-index:1000000;
        transition: all 300ms;
    }

    ._ren_gateway-minified ._ren_iframeShadow {
        top: 10px;
        right: 10px;
        left: unset;
        transform: translate(0%, 0%);
        width:250px;
        height:50px;
        box-shadow: 0 5px 10px 0 rgba(0,0,0,0.5);
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
        <iframe class="_ren_iframe" id="_ren_iframe-${uniqueID}" style=""
            src="https://gateway-js.herokuapp.com/" ></iframe>
    </div>
</div>
`;




// https://gateway-js.herokuapp.com/

/*

fixed; top: 0;

<main>
    <style>
        .banner {
            height: 50px;
            width: calc(100% - 40px);
            display: flex;
            color: $foreground;
            align-items: center;
            border-bottom: 1px solid #ccc;
            padding: 15px 20px;
            background: white;
            // border-radius: 3px;
        }

            .banner h1 {
                margin: 0;
                font-size: 34px;
                font-family: monospace;
                font-weight: 100;
            }

            .banner svg {
                margin-right: 10px;
            }

        .footer {
            position: fixed;
            bottom: 0;
            height: 30px;
            padding: 0 20px;
            width: calc(100% - 40px);
            display: flex;
            color: $foreground;
            align-items: center;
            border-top: 1px solid #ccc;
            background: white;
            // border-radius: 3px;
        }
        .footer h2 {
                margin: 0;
                font-size: 10px;
                font-family: monospace;
                font-weight: 100;
            }

            .footer svg {
                margin-right: 10px;
            }
    </style>
    <div class="banner"><svg id="Layer_1" x="0px" y="0px" viewBox="0 0 135.2 135.2" style="width: 40px;"
            xml:space="preserve">
            <style type="text/css">
                .st0 {
                    fill: #21262C;
                }
            </style>
            <g>
                <polygon class="st0"
                    points="18.6,28.5 28.5,22.8 29.9,25.1 66.6,3.9 63.9,2.3 61.2,0.8 59.9,0 0,34.6 0,36.1 17.2,26.2  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,50.3 47.4,33.7 48.7,36 85.5,14.8 82.8,13.2 80.1,11.7 78.8,10.9 0,56.3 0,57.9 17.2,48  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,61.2 56.8,39.1 58.1,41.4 94.9,20.2 92.2,18.7 89.5,17.1 88.2,16.3 0,67.2 0,68.8 17.2,58.8  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,72 66.5,44.4 67.8,46.7 104.3,25.6 101.6,24.1 98.9,22.5 97.6,21.8 0,78.1 0,79.6 17.2,69.7  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,82.9 75.9,49.8 77.2,52.2 113.7,31.1 111,29.5 108.4,28 107,27.2 0,89 0,90.5 17.2,80.6  ">
                </polygon>
                <polygon class="st0"
                    points="117.8,33.4 116.4,32.6 0,99.9 0,101.4 17.2,91.5 18.6,93.8 75.9,60.7 77.2,63 119.8,38.5 119.8,35.4    119.8,34.6  ">
                </polygon>
                <polygon class="st0"
                    points="7.4,108 17,102.5 18.4,104.8 75.6,71.7 77,74.1 119.8,49.3 119.8,46.2 119.8,43.1 119.8,41.6    6.1,107.2  ">
                </polygon>
                <polyline class="st0"
                    points="75.6,82.6 77,85 119.8,60.2 119.8,57.1 119.8,54 119.8,52.5 15.5,112.7 16.8,113.5 26.6,107.8    28,110.1  ">
                </polyline>
                <polygon class="st0"
                    points="26.2,118.9 36.1,113.2 37.4,115.6 75.6,93.5 77,95.8 119.8,71.1 119.8,68 119.8,64.9 119.8,63.3    24.9,118.1  ">
                </polygon>
                <polygon class="st0"
                    points="35.7,124.3 45.5,118.7 46.8,121 75.6,104.4 77,106.7 119.8,82 119.8,78.9 119.8,75.8 119.8,74.2    34.3,123.6  ">
                </polygon>
                <polygon class="st0"
                    points="43.7,129 45.1,129.8 54.9,124.1 56.2,126.5 75.6,115.3 77,117.6 119.8,92.9 119.8,89.8 119.8,86.6    119.8,85.1  ">
                </polygon>
                <polygon class="st0"
                    points="54.5,135.2 64.3,129.6 65.7,131.9 75.6,126.1 77,128.5 119.8,103.8 119.8,100.6 119.8,97.5 119.8,96    53.2,134.5  ">
                </polygon>
                <polygon class="st0"
                    points="76.1,9.3 73.4,7.8 73.4,7.8 70.7,6.2 69.3,5.4 0,45.5 0,47 17.2,37.1 18.6,39.4 38,28.2 39.3,30.5     ">
                </polygon>
            </g>
        </svg>
        <h1>RenVM</h1>
    </div>
    <div class="footer"><svg id="Layer_1" x="0px" y="0px" viewBox="0 0 135.2 135.2" style="width: 15px;"
            xml:space="preserve">
            <style type="text/css">
                .st0 {
                    fill: #21262C;
                }
            </style>
            <g>
                <polygon class="st0"
                    points="18.6,28.5 28.5,22.8 29.9,25.1 66.6,3.9 63.9,2.3 61.2,0.8 59.9,0 0,34.6 0,36.1 17.2,26.2  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,50.3 47.4,33.7 48.7,36 85.5,14.8 82.8,13.2 80.1,11.7 78.8,10.9 0,56.3 0,57.9 17.2,48  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,61.2 56.8,39.1 58.1,41.4 94.9,20.2 92.2,18.7 89.5,17.1 88.2,16.3 0,67.2 0,68.8 17.2,58.8  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,72 66.5,44.4 67.8,46.7 104.3,25.6 101.6,24.1 98.9,22.5 97.6,21.8 0,78.1 0,79.6 17.2,69.7  ">
                </polygon>
                <polygon class="st0"
                    points="18.6,82.9 75.9,49.8 77.2,52.2 113.7,31.1 111,29.5 108.4,28 107,27.2 0,89 0,90.5 17.2,80.6  ">
                </polygon>
                <polygon class="st0"
                    points="117.8,33.4 116.4,32.6 0,99.9 0,101.4 17.2,91.5 18.6,93.8 75.9,60.7 77.2,63 119.8,38.5 119.8,35.4    119.8,34.6  ">
                </polygon>
                <polygon class="st0"
                    points="7.4,108 17,102.5 18.4,104.8 75.6,71.7 77,74.1 119.8,49.3 119.8,46.2 119.8,43.1 119.8,41.6    6.1,107.2  ">
                </polygon>
                <polyline class="st0"
                    points="75.6,82.6 77,85 119.8,60.2 119.8,57.1 119.8,54 119.8,52.5 15.5,112.7 16.8,113.5 26.6,107.8    28,110.1  ">
                </polyline>
                <polygon class="st0"
                    points="26.2,118.9 36.1,113.2 37.4,115.6 75.6,93.5 77,95.8 119.8,71.1 119.8,68 119.8,64.9 119.8,63.3    24.9,118.1  ">
                </polygon>
                <polygon class="st0"
                    points="35.7,124.3 45.5,118.7 46.8,121 75.6,104.4 77,106.7 119.8,82 119.8,78.9 119.8,75.8 119.8,74.2    34.3,123.6  ">
                </polygon>
                <polygon class="st0"
                    points="43.7,129 45.1,129.8 54.9,124.1 56.2,126.5 75.6,115.3 77,117.6 119.8,92.9 119.8,89.8 119.8,86.6    119.8,85.1  ">
                </polygon>
                <polygon class="st0"
                    points="54.5,135.2 64.3,129.6 65.7,131.9 75.6,126.1 77,128.5 119.8,103.8 119.8,100.6 119.8,97.5 119.8,96    53.2,134.5  ">
                </polygon>
                <polygon class="st0"
                    points="76.1,9.3 73.4,7.8 73.4,7.8 70.7,6.2 69.3,5.4 0,45.5 0,47 17.2,37.1 18.6,39.4 38,28.2 39.3,30.5     ">
                </polygon>
            </g>
        </svg>
        <h2>Gateway JS</h2>
    </div>
</main>
*/

