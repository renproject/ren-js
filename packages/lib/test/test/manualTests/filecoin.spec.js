"use strict";
/* eslint-disable no-console */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var chains_filecoin_1 = require("@renproject/chains-filecoin");
var chains_ethereum_1 = require("@renproject/chains-ethereum");
var interfaces_1 = require("@renproject/interfaces");
var ren_1 = require("@renproject/ren");
var utils_1 = require("@renproject/utils");
var chalk_1 = require("chalk");
var truffle_hdwallet_provider_1 = require("truffle-hdwallet-provider");
var dotenv_1 = require("dotenv");
// Load environment variables.
dotenv_1.config();
var MNEMONIC = process.env.MNEMONIC;
var logLevel = interfaces_1.LogLevel.Log;
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var renJS, infuraURL, provider, lockAndMint, colors, i;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                renJS = new ren_1["default"](interfaces_1.RenNetwork.MainnetVDot3, { logLevel: logLevel });
                infuraURL = chains_ethereum_1.renMainnetVDot3.infura + "/v3/" + process.env.INFURA_KEY;
                provider = new truffle_hdwallet_provider_1["default"](MNEMONIC, infuraURL, 0, 10);
                return [4 /*yield*/, renJS.lockAndMint({
                        asset: "FIL",
                        from: chains_filecoin_1.Filecoin(),
                        to: chains_ethereum_1.Ethereum(provider, chains_ethereum_1.renMainnetVDot3).Account({
                            address: "0xFB87bCF203b78d9B67719b7EEa3b6B65A208961B"
                        })
                    })];
            case 1:
                lockAndMint = _a.sent();
                console.info("Deposit " + chalk_1.blue("FIL") + " to " + chalk_1.blue(JSON.stringify(lockAndMint.gatewayAddress, null, "    ")));
                colors = [chalk_1.green, chalk_1.magenta, chalk_1.yellow, chalk_1.cyan, chalk_1.blue, chalk_1.red];
                i = 0;
                /*
                 * The following callback can be replaced with the following, which will
                 * attempt each step of the minting indefinitely.
                 * ```
                 * lockAndMint.on("deposit", RenJS.defaultDepositHandler)
                 * ```
                 */
                lockAndMint.on("deposit", function (deposit) {
                    (function () { return __awaiter(void 0, void 0, void 0, function () {
                        var hash, color, info, retries;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    hash = deposit.txHash();
                                    color = colors[i % colors.length];
                                    i += 1;
                                    deposit._state.logger = new interfaces_1.SimpleLogger(logLevel, color("[" + hash.slice(0, 6) + "] "));
                                    info = deposit._state.logger.log;
                                    info("Received " + 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    deposit.depositDetails.amount / 1e8 + " " + deposit.params.asset, deposit.depositDetails);
                                    info("status:", deposit.status); // DepositStatus.Detected
                                    retries = 10;
                                    return [4 /*yield*/, utils_1.retryNTimes(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        deposit._state.logger.log("Calling .confirmed");
                                                        return [4 /*yield*/, deposit
                                                                .confirmed()
                                                                .on("confirmation", function (confs, target) {
                                                                deposit._state.logger.log(confs + "/" + target + " confirmations");
                                                            })];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); }, retries, 
                                        // Time between retries.
                                        10 * utils_1.SECONDS)];
                                case 1:
                                    _a.sent();
                                    info("status:", deposit.status); // DepositStatus.Confirmed
                                    return [4 /*yield*/, utils_1.retryNTimes(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        deposit._state.logger.log("Calling .signed");
                                                        return [4 /*yield*/, deposit.signed().on("status", function (status) {
                                                                deposit._state.logger.log("status: " + status);
                                                            })];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); }, retries, 10 * utils_1.SECONDS)];
                                case 2:
                                    _a.sent();
                                    info("status:", deposit.status); // DepositStatus.Signed
                                    return [4 /*yield*/, utils_1.retryNTimes(function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        deposit._state.logger.log("Calling .mint");
                                                        return [4 /*yield*/, deposit
                                                                .mint({
                                                                _extraMsg: "test"
                                                            })
                                                                .on("transactionHash", function (txHash) {
                                                                deposit._state.logger.log("txHash: " + String(txHash));
                                                            })];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); }, retries, 10 * utils_1.SECONDS)];
                                case 3:
                                    _a.sent();
                                    info("status:", deposit.status); // DepositStatus.Submitted
                                    return [2 /*return*/];
                            }
                        });
                    }); })()["catch"](console.error);
                });
                return [2 /*return*/];
        }
    });
}); };
main()["catch"](console.error);
