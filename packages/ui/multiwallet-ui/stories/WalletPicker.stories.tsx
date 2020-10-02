import React from 'react';
import { Meta, Story } from '@storybook/react';
import { WalletPicker, WalletPickerProps } from '../src';

const meta: Meta<typeof WalletPicker> = {
  title: 'Welcome',
  component: WalletPicker,
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: Story<any> = (args) => <WalletPicker {...args} />;

// By passing using the Args format for exported stories, you can control the props for a component for reuse in a test
// https://storybook.js.org/docs/react/workflows/unit-testing
export const Default = Template.bind({});

const defaultProps: WalletPickerProps<any, any> = {
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
          connector: {} as any,
        },
      ],
    },
  },
};
Default.args = defaultProps;

export const Connecting = Template.bind({});

const connectingProps: WalletPickerProps<any, any> = {
  ...defaultProps,
  connecting: true,
  config: {
    chains: {
      ethereum: [],
    },
  },
};

Connecting.args = connectingProps;

export const DefaultInfo = Template.bind({});

const defaultInfoProps: WalletPickerProps<any, any> = {
  ...defaultProps,
  DefaultInfo: ({ acknowledge }) => (
    <div>
      Welcome to the selector{' '}
      <button onClick={() => acknowledge()}>Continue</button>
    </div>
  ),
  config: {
    chains: {
      ethereum: [],
    },
  },
};

DefaultInfo.args = defaultInfoProps;
