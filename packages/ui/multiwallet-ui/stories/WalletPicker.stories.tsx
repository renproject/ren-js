import React from 'react';
import { Meta, Story } from '@storybook/react';
import { WalletPicker, WalletPickerProps } from '../src';

const meta: Meta<typeof WalletPicker> = {
  title: 'Welcome',
  component: WalletPicker,
  argTypes: {
    config: {
      defaultValue: {
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

const Template: Story<WalletPickerProps<any, any>> = (args) => (
  <WalletPicker {...args} />
);

// By passing using the Args format for exported stories, you can control the props for a component for reuse in a test
// https://storybook.js.org/docs/react/workflows/unit-testing
export const Default = Template.bind({});

Default.args = {};
