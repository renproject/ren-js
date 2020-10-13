import React from 'react';
import { Meta, Story } from '@storybook/react';
import { EventEmitter } from 'events';
import {
  MultiwalletProvider,
  WalletPickerModal,
  WalletPickerModalProps,
} from '../src';

const meta: Meta<typeof WalletPickerModal> = {
  title: 'WalletPickerModal',
  component: WalletPickerModal,
  argTypes: {
    chain: {
      control: {
        type: 'text',
      },
      defaultValue: 'ethereum',
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
  close: () => {},
  options: {
    chain: 'ethereum',
    close: () => {},
    config: {
      chains: {
        ethereum: [
          {
            name: 'metamask',
            connector: {} as any,
            logo: 'https://avatars1.githubusercontent.com/u/11744586?s=60&v=4',
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
  close: () => {
    console.log('close');
  },
  open: true,
  options: {
    close: () => {
      console.log('close');
    },
    chain: 'ethereum',
    config: {
      chains: {
        ethereum: [
          {
            info: ({ acknowledge, close }) => (
              <div>
                Are you sure you want to connect this wallet?{' '}
                <button onClick={acknowledge}>Yes</button>
                <button onClick={close}>No</button>
              </div>
            ),
            name: 'metamask',
            logo: 'https://avatars1.githubusercontent.com/u/11744586?s=60&v=4',
            connector: {
              emitter: new EventEmitter(),
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
