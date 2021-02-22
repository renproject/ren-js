import React from "react";
import { Meta, Story } from "@storybook/react";
import { EventEmitter } from "events";
import {
  MultiwalletProvider,
  WalletPickerModal,
  WalletPickerModalProps,
} from "../src";
import { RenNetwork } from "@renproject/interfaces";

const meta: Meta<typeof WalletPickerModal> = {
  title: "WalletPickerModal",
  component: WalletPickerModal,
  argTypes: {
    chain: {
      control: {
        type: "text",
      },
      defaultValue: "ethereum",
    },
  },
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: Story<any> = (args) => <WalletPickerModal {...args} />;
export const Default = Template.bind({});

const props: WalletPickerModalProps<any, any> = {
  open: true,
  options: {
    chain: "ethereum",
    targetNetwork: RenNetwork.Testnet,
    onClose: () => {},
    config: {
      chains: {
        ethereum: [
          {
            name: "metamask",
            connector: {} as any,
            logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
          },
        ],
      },
    },
  },
};
Default.args = props;

const ConnectingTemplate: Story<any> = (args) => (
  <MultiwalletProvider>
    <WalletPickerModal {...args} />
  </MultiwalletProvider>
);

export const Connecting = ConnectingTemplate.bind({});

const connectingProps: WalletPickerModalProps<any, any> = {
  open: true,
  options: {
    targetNetwork: RenNetwork.Testnet,
    onClose: () => {
      console.debug("close");
    },
    chain: "ethereum",
    config: {
      chains: {
        ethereum: [
          {
            info: ({ acknowledge, onClose, onPrev }) => (
              <div>
                <button onClick={onPrev}>back</button>
                Are you sure you want to connect this wallet?{" "}
                <div>
                  <button onClick={acknowledge}>Yes</button>
                  <button onClick={onClose}>No</button>
                </div>
              </div>
            ),
            name: "metamask",
            logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
            connector: {
              emitter: new EventEmitter() as any,
              activate: () =>
                new Promise((_resolve) => {
                  /*connecting forever*/
                }),
            } as any,
          },
        ],
      },
    },
  },
};

Connecting.args = connectingProps;

export const Resolving = ConnectingTemplate.bind({});

const resolvingProps: WalletPickerModalProps<any, any> = {
  open: true,
  options: {
    targetNetwork: RenNetwork.Testnet,
    onClose: () => {
      console.debug("close");
    },
    chain: "ethereum",
    config: {
      chains: {
        ethereum: [
          {
            name: "metamask",
            logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
            connector: {
              emitter: new EventEmitter() as any,
              getAccount: async () => "123",
              getProvider: async () => ({}),
              getRenNetwork: async () => "" as any,
              supportsTestnet: true,
              deactivate: async () => {},
              activate: () =>
                new Promise((resolve) => {
                  console.debug("activating");
                  resolve({
                    account: "123",
                    provider: {},
                    renNetwork: RenNetwork.Testnet,
                  });
                }),
            },
          },
        ],
      },
    },
  },
};

Resolving.args = resolvingProps;

export const WrongNetwork = ConnectingTemplate.bind({});

const emitter = new EventEmitter();

const wrongNetworkProps: WalletPickerModalProps<any, any> = {
  open: true,
  options: {
    targetNetwork: RenNetwork.Mainnet,
    onClose: () => {
      console.debug("close");
    },
    chain: "ethereum",
    config: {
      chains: {
        ethereum: [
          {
            name: "metamask",
            logo: "https://avatars1.githubusercontent.com/u/11744586?s=60&v=4",
            connector: {
              emitter: emitter as any,
              getAccount: async () => "123",
              getProvider: async () => ({}),
              getRenNetwork: async () => "" as any,
              supportsTestnet: true,
              deactivate: async () => {
                emitter.emit("CONNECTOR_DEACTIVATE", "mock deactivate");
              },
              activate: () =>
                new Promise((resolve) => {
                  console.debug("activating");
                  resolve({
                    account: "123",
                    provider: {},
                    renNetwork: RenNetwork.Testnet,
                  });
                }),
            },
          },
        ],
      },
    },
  },
};

WrongNetwork.args = wrongNetworkProps;
