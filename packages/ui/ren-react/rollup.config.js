// import path from 'path'
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import external from "rollup-plugin-peer-deps-external";
import typescript from "@rollup/plugin-typescript";

const input = "src/library/index.ts";
const output = "dist/index";
// const projectRootDir = path.resolve(__dirname)

export default [
    {
        input: input,
        output: {
            dir: "./dist/main",
            format: "cjs",
            exports: "named",
            sourcemap: true,
        },
        plugins: [
            resolve({
                browser: true,
            }),
            commonjs({
                include: ["node_modules/**"],
                namedExports: {
                    "react-dom": ["createPortal"],
                    // '@renproject/ren-tx': ['mintMachine']
                },
            }),
            external(),
            typescript({
                tsconfig: "tsconfig.build.json",
                declarationDir: "./dist/main",
            }),
            babel({
                exclude: "node_modules/**",
            }),
        ],
    },
    {
        input: input,
        output: {
            dir: "./dist/modern",
            format: "es",
            sourcemap: true,
            exports: "named",
        },
        plugins: [
            typescript({
                tsconfig: "tsconfig.build.json",
                declarationDir: "./dist/modern",
            }),
            external(),
            resolve(),
            commonjs({
                //include: ['node_modules/**']
            }),
            babel({
                exclude: "node_modules/**",
            }),
        ],
    },
    {
        input: input,
        output: {
            name: "ReactUi",
            dir: "./dist/umd",
            globals: {
                react: "React",
                "react-dom": "ReactDOM",
            },
            format: "umd",
            sourcemap: true,
            exports: "named",
        },
        plugins: [
            external(),
            typescript({
                tsconfig: "tsconfig.build.json",
                declarationDir: "./dist/umd",
            }),
            resolve(),
            commonjs({
                include: ["node_modules/**"],
                namedExports: {
                    "react-dom": ["createPortal"],
                },
            }),
            babel({
                exclude: "node_modules/**",
            }),
        ],
    },
];
