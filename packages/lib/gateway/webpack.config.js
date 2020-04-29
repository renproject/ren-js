var path = require('path');
var nodeExternals = require('webpack-node-externals');
// var TypedocWebpackPlugin = require('typedoc-webpack-plugin');

let common = {
    entry: './src/index.ts',
    devtool: 'source-map',
    module: {
        rules: [{
            test: /\.tsx?$/,
            use: ['babel-loader', 'ts-loader'],
            exclude: /node_modules/
        },]
    },
    plugins: [],
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias: {
            scrypt: 'scrypt-js'
        },
    }
};

module.exports = [
    Object.assign({}, common, {
        target: 'web',
        entry: ['babel-polyfill', './src/index.ts'],
        output: {
            path: path.resolve(__dirname, 'build/browser'),
            filename: 'browser.js',
            libraryTarget: 'var',
            library: 'RenVM', // This is the var name in browser
            libraryExport: 'default'
        },
        node: {
            fs: 'empty',
            child_process: 'empty'
        }
    }),
    Object.assign({}, common, {
        target: 'node',
        output: {
            path: path.resolve(__dirname, 'build/browser'),
            filename: 'index.js',
            libraryTarget: 'commonjs2',
            // libraryExport: 'default'
        },
        externals: [nodeExternals()]
    })
]
