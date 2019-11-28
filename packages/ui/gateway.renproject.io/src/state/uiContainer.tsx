import { Currency, sleep } from "@renproject/react-components";
import RenSDK, { NetworkDetails, Tokens as ShiftActions } from "@renproject/ren";
import BigNumber from "bignumber.js";
import { Map as ImmutableMap } from "immutable";
import { Container } from "unstated";
import Web3 from "web3";

import { syncGetTokenAddress } from "../lib/contractAddresses";
import { ETHEREUM_NODE } from "../lib/environmentVariables";
import { _catchInteractionErr_ } from "../lib/errors";
import { getTokenPricesInCurrencies } from "../lib/market";
import { getERC20, Token } from "./generalTypes";
import { network } from "./sdkContainer";

export const fetchEthereumTokenBalance = async (web3: Web3, networkID: number, networkDetails: NetworkDetails, token: Token, address: string): Promise<BigNumber> => {
    if (!web3) {
        return new BigNumber(0);
    }
    let balance: string;
    if (token === Token.ETH) {
        balance = await web3.eth.getBalance(address);
    } else {
        // if (isERC20(token)) {
        const tokenAddress = syncGetTokenAddress(networkID, token);
        const tokenInstance = getERC20(web3, networkDetails, tokenAddress);
        balance = (await tokenInstance.methods.balanceOf(address).call()).toString();
        // } else {
        //     throw new Error(`Invalid Ethereum token: ${token}`);
    }
    return new BigNumber(balance);
};

export type ReserveBalances = Map<Token, BigNumber>;

const initialState = {
    web3: new Web3(ETHEREUM_NODE),
    networkID: network.contracts.networkID,

    loggedOut: null as string | null,

    preferredCurrency: Currency.USD,

    address: null as string | null,
    tokenPrices: ImmutableMap<Token, ImmutableMap<Currency, number>>(),
    accountBalances: ImmutableMap<Token, BigNumber>(),
    // balanceReserves: ImmutableMap<MarketPair, ReserveBalances>(),

    confirmedTrade: false,
    submitting: false,

    currentOrderID: null as string | null,

    network,
};

export class UIContainer extends Container<typeof initialState> {
    public state = initialState;

    public connect = async (web3: Web3, address: string | null, networkID: number): Promise<void> => {
        await this.setState({ web3, networkID, address, loggedOut: null });
    }

    public clearAddress = async (): Promise<void> => {
        await this.setState({ address: null });
    }

    public onConfirmedTrade = async () => {
        await this.setState({ confirmedTrade: true });
    }

    public handleOrder = async (orderID: string | null) => {
        await this.setState({ submitting: false, currentOrderID: orderID });
    }

    // Token prices ////////////////////////////////////////////////////////////

    public setCurrency = async (preferredCurrency: Currency) => {
        await this.setState({ preferredCurrency });
    }

    public updateTokenPrices = async (): Promise<void> => {
        const tokenPrices = await getTokenPricesInCurrencies();
        await this.setState({ tokenPrices });
    }

    public fetchEthereumTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
        const { web3, networkID, network: networkDetails } = this.state;
        if (!web3) {
            return new BigNumber(0);
        }
        return fetchEthereumTokenBalance(web3, networkID, networkDetails, token, address);
    }

    // Inputs for swap /////////////////////////////////////////////////////////

    public resetTrade = async () => {
        await this.setState({
            confirmedTrade: false,
            currentOrderID: null,
            submitting: false,
        });
    }

    public setSubmitting = async (submitting: boolean) => {
        await this.setState({
            submitting,
        });
    }

    public setLoggedOut = async (loggedOut?: string) => {
        return this.setState({ loggedOut: loggedOut || null });
    }

    // lookForLogout detects if 1) the user has changed or logged out of their Web3
    // wallet
    public lookForLogout = async () => {
        const { address, web3 } = this.state;

        if (!address || !web3) {
            return;
        }

        const accounts = (await web3.eth.getAccounts())
            .map((web3Address: string) => web3Address.toLowerCase());

        if (!accounts.includes(address.toLowerCase())) {
            await this.clearAddress();
            await this.setLoggedOut(address);
        }
    }
}
