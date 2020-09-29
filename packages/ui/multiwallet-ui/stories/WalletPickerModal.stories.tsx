import React from 'react';
import { Meta, Story } from '@storybook/react';
import { WalletPickerModal, WalletPickerModalProps } from '../src';

const meta: Meta<typeof WalletPickerModal> = {
  title: 'WalletPickerModal',
  component: WalletPickerModal,
  argTypes: {
    open: { defaultValue: true },
    options: {
      defaultValue: {
        chain: 'ethereum',
        config: {
          chains: {
            ethereum: [
              {
                name: 'metamask',
                logo:
                  'https://avatars1.githubusercontent.com/u/11744586?s=60&v=4',
              },
            ],
          },
        },
      },
    },
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

const Template: Story<WalletPickerModalProps<any, any>> = (args) => (
  <WalletPickerModal {...args} />
);

// By passing using the Args format for exported stories, you can control the props for a component for reuse in a test
// https://storybook.js.org/docs/react/workflows/unit-testing
export const Default = Template.bind({});

Default.args = {};
