import * as React from "react";

// Modified from https://github.com/ethereum/blockies
// License: https://github.com/ethereum/blockies#license (WTFPL)

function blockies() {
    // The random number is a js implementation of the XOR-shift PRNG
    const randSeed = new Array(4); // XOR-shift: [x, y, z, w] 32 bit values

    function seedRand(seed: any) {
        for (let i = 0; i < randSeed.length; i++) {
            randSeed[i] = 0;
        }
        for (let i = 0; i < seed.length; i++) {
            randSeed[i % 4] = ((randSeed[i % 4] << 5) - randSeed[i % 4]) + seed.charCodeAt(i);
        }
    }

    function rand() {
        // based on Java's String.hashCode(), expanded to 4 32bit values

        const t = randSeed[0] ^ (randSeed[0] << 11);

        randSeed[0] = randSeed[1];
        randSeed[1] = randSeed[2];
        randSeed[2] = randSeed[3];

        randSeed[3] = (randSeed[3] ^ (randSeed[3] >> 19) ^ t ^ (t >> 8));

        return (randSeed[3] >>> 0) / ((1 << 31) >>> 0);
    }

    function createColor() {
        // saturation is the whole color spectrum
        const h = Math.floor(rand() * 360);
        // saturation goes from 40 to 100, it avoids greyish colors
        const s = ((rand() * 60) + 40) + "%";
        // lightness can be anything from 0 to 100, but probabilities are a bell curve around 50%
        const l = ((rand() + rand() + rand() + rand()) * 25) + "%";

        const color = "hsl(" + h + "," + s + "," + l + ")";
        return color;
    }

    function createImageData(size: number) {
        const width = size; // Only support square icons for now
        const height = size;

        const dataWidth = Math.ceil(width / 2);
        const mirrorWidth = width - dataWidth;

        const data = [];
        for (let y = 0; y < height; y++) {
            let row = [];
            for (let x = 0; x < dataWidth; x++) {
                // this makes foreground and background color to have a 43% (1/2.3) probability
                // spot color has 13% chance
                row[x] = Math.floor(rand() * 2.3);
            }
            const r = row.slice(0, mirrorWidth);
            r.reverse();
            row = row.concat(r);

            for (let i = 0; i < row.length; i++) {
                data.push(row[i]);
            }
        }

        return data;
    }

    function buildOpts(opts: any) {
        const newOpts: any = {};

        newOpts.seed = opts.seed || Math.floor((Math.random() * Math.pow(10, 16))).toString(16);

        seedRand(newOpts.seed);

        newOpts.size = opts.size || 8;
        newOpts.scale = opts.scale || 4;
        const color = createColor();
        newOpts.color = opts.color || color;
        const bgColor = createColor();
        newOpts.bgColor = opts.bgColor || bgColor;
        const spotColor = createColor();
        newOpts.spotColor = opts.spotColor || spotColor;

        return newOpts;
    }

    function renderIcon(opts: any, canvas: HTMLCanvasElement) {
        opts = buildOpts(opts || {});

        const imageData = createImageData(opts.size);
        const width = Math.sqrt(imageData.length);

        canvas.width = canvas.height = opts.size * opts.scale;

        const cc = canvas.getContext("2d");
        if (!cc) {
            return canvas;
        }
        cc.fillStyle = opts.bgColor;
        cc.fillRect(0, 0, canvas.width, canvas.height);
        cc.fillStyle = opts.color;

        for (let i = 0; i < imageData.length; i++) {

            // if data is 0, leave the background
            if (imageData[i]) {
                const row = Math.floor(i / width);
                const col = i % width;

                // if data is 2, choose spot color, if 1 choose foreground
                cc.fillStyle = (imageData[i] === 1) ? opts.color : opts.spotColor;

                cc.fillRect(col * opts.scale, row * opts.scale, opts.scale, opts.scale);
            }
        }
        return canvas;
    }

    function createIcon(opts: any): HTMLCanvasElement {
        opts = buildOpts(opts || {});
        const canvas = document.createElement("canvas");

        renderIcon(opts, canvas);

        return canvas;
    }

    return {
        create: createIcon,
        render: renderIcon
    };

}

/**
 * Blocky is a visual component for displaying Ethereum blockies - visual hashes
 * of ethereum addresses
 */
export class Blocky extends React.Component<Props, State> {
    private canvas: HTMLCanvasElement | null | undefined;
    private blocky = blockies();

    constructor(props: Props) {
        super(props);
        this.state = {
            loading: true,
        };
        this.canvas = null;
    }

    public getOpts = (address: string) => {
        const { fgColor, bgColor, spotColor } = this.props;
        return {
            seed: address.toLowerCase(),
            size: 8,
            scale: 10,
            color: fgColor,
            spotColor,
            bgColor,
        };
    }

    public renderIcon = (address: string | null) => {
        if (address) {
            this.setState({ loading: false });
            this.blocky.create(this.getOpts(address));
            if (this.canvas) {
                this.blocky.render(this.getOpts(address), this.canvas);
            } else {
                console.error("No canvas provided to Block component.");
            }
        } else {
            this.setState({ loading: true });
        }
    }

    public componentWillReceiveProps = (nextProps: Props): void => {
        this.renderIcon(nextProps.address);
    }

    public componentDidMount = (): void => {
        this.renderIcon(this.props.address);
    }

    public render = (): JSX.Element => {
        const { address, fgColor, bgColor, spotColor, ...props } = this.props;
        const { loading } = this.state;
        return (
            <div {...props} className={["blocky--outer", this.props.className].join(" ")}>
                <div data-tip={address || "..."}>
                    {loading ? <i className="fa fa-spin fa-spinner blocky__loading" /> : <i />}
                    <canvas className="blocky" ref={canvas => this.canvas = canvas} />
                </div>
            </div>
        );
    }
}

interface Props extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
    address: string | null;
    fgColor?: string,
    bgColor?: string,
    spotColor?: string,
}

interface State {
    loading: boolean;
}
