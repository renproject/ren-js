import React from 'react';
import * as ReactDOM from 'react-dom';
import {
  Default as Multiwallet,
  DefaultInfo,
  Connecting,
} from '../stories/WalletPicker.stories';
import { Default as MultiwalletModal } from '../stories/WalletPickerModal.stories';

describe('Multiwallet', () => {
  it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<Multiwallet {...Multiwallet.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });

  it('renders connecting', () => {
    const div = document.createElement('div');
    ReactDOM.render(<Connecting {...Connecting.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });

  it('renders default info', () => {
    const div = document.createElement('div');
    ReactDOM.render(<DefaultInfo {...DefaultInfo.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });
});

describe('MultiwalletModal', () => {
  it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<MultiwalletModal {...MultiwalletModal.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });
});
