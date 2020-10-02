import React from 'react';
import * as ReactDOM from 'react-dom';
import { Default as Multiwallet } from '../stories/WalletPicker.stories';

describe('Multiwallet', () => {
  it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<Multiwallet {...Multiwallet.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });
});
