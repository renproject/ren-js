# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.3.1](https://github.com/renproject/gateway-js/compare/v0.3.0...v0.3.1) (2020-02-06)

## [0.3.0](https://github.com/renproject/gateway-js/compare/v0.2.2...v0.3.0) (2020-02-05)

When shifting in, an amount is no longer necessary. To maintain the previous behaviour, replace `sendAmount` with `requiredAmount`. However, it's better to not specify an amount, instead letting the user send any value in the BTC/BCH/ZEC deposit. If `requiredAmount` is used, there's currently no way of handling incorrect deposit amounts.

### [0.2.2](https://github.com/renproject/gateway-js/compare/v0.2.1...v0.2.2) (2020-01-31)

### [0.2.1](https://github.com/renproject/gateway-js/compare/v0.2.0...v0.2.1) (2020-01-30)

## [0.2.0](https://github.com/renproject/gateway-js/compare/v0.1.0...v0.2.0) (2020-01-30)

This version fixes the parameters expected by GatewayJS. The main difference from RenJS is that `web3Provider` must not be provided for shifting out.

## [0.1.0](https://github.com/renproject/gateway-js/compare/v0.0.8...v0.1.0) (2020-01-30)

GatewayJS is easier to use with a simpler interface if you just want to send zBTC, zBCH or zZEC directly to an Ethereum address. Omit the contract parameters and details, and set `sendTo` to a normal address instead of a contract. `GatewayJS.utils.value` makes it easier to specify amounts.

### [0.0.8](https://github.com/renproject/gateway-js/compare/v0.0.7...v0.0.8) (2020-01-30)

### [0.0.7](https://github.com/renproject/gateway-js/compare/v0.0.6...v0.0.7) (2020-01-23)

### [0.0.6](https://github.com/renproject/gateway-js/compare/v0.0.5...v0.0.6) (2020-01-22)

### [0.0.5](https://github.com/renproject/gateway-js/compare/v0.0.4...v0.0.5) (2020-01-22)

### [0.0.4](https://github.com/renproject/gateway-js/compare/v0.0.3...v0.0.4) (2020-01-17)

### [0.0.3](https://github.com/renproject/gateway-js/compare/v0.0.2...v0.0.3) (2020-01-17)

### [0.0.2](https://github.com/renproject/gateway-js/compare/v0.0.1...v0.0.2) (2020-01-17)

### 0.0.1 (2020-01-15)
