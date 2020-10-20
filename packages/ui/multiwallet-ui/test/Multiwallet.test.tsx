import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import {
  Default as Multiwallet,
  DefaultInfo,
  Connecting,
  ClassExtension,
  CustomConnecting,
} from '../stories/WalletPicker.stories';
import {
  Default as MultiwalletModal,
  Connecting as ConnectingModal,
  Resolving,
  WrongNetwork,
} from '../stories/WalletPickerModal.stories';

describe('Multiwallet', () => {
  it('renders without crashing', async () => {
    const div = document.createElement('div');
    ReactDOM.render(<Multiwallet {...Multiwallet.args} />, div);

    expect(div.innerHTML).toContain('Connect a wallet');
    await act(async () => {
      const button = div.querySelectorAll('button').item(1);
      if (!button) return;
      Simulate.click(button);
    });

    expect(div.innerHTML).toContain('Are you sure');

    ReactDOM.unmountComponentAtNode(div);
  });

  it('renders connecting', () => {
    const div = document.createElement('div');
    ReactDOM.render(<Connecting {...Connecting.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });

  it('renders default info', async () => {
    const div = document.createElement('div');
    ReactDOM.render(<DefaultInfo {...DefaultInfo.args} />, div);

    await act(async () => {
      const button = div.querySelector('#acknowledge');
      if (!button) return;
      Simulate.click(button);
    });

    expect(div.innerHTML).toContain('Connect a wallet');

    ReactDOM.unmountComponentAtNode(div);
  });

  it('renders custom connecting component', () => {
    const div = document.createElement('div');
    ReactDOM.render(<CustomConnecting {...CustomConnecting.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });

  it('renders extended classes', () => {
    const div = document.createElement('div');
    ReactDOM.render(<ClassExtension {...ClassExtension.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });
});

describe('MultiwalletModal', () => {
  it('renders without crashing', async () => {
    const div = document.createElement('div');
    ReactDOM.render(<MultiwalletModal {...MultiwalletModal.args} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });

  it('renders without crashing when closed', async () => {
    const div = document.createElement('div');
    const newArgs = { ...MultiwalletModal.args, open: false };
    ReactDOM.render(<MultiwalletModal {...newArgs} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });

  it('throws if used without a provider', async () => {
    const div = document.createElement('div');
    ReactDOM.render(<MultiwalletModal {...MultiwalletModal.args} />, div);
    try {
      // wait for render
      await new Promise((resolve) => setTimeout(resolve, 200));
      await act(async () => {
        // Modal does not render in div
        const button = window.document.body.querySelectorAll('button').item(1);
        if (!button) throw new Error('Not rendered');
        Simulate.click(button);
      });
    } catch (e) {
      // success
      expect(e.message).toContain('Multiwallet not ready');
    } finally {
      ReactDOM.unmountComponentAtNode(div);
    }
  });

  it('renders the connecting state', async () => {
    const div = document.createElement('div');
    ReactDOM.render(<ConnectingModal {...ConnectingModal.args} />, div);

    // wait for render
    await new Promise((resolve) => setTimeout(resolve, 200));
    await act(async () => {
      // Modal does not render in div
      const button = window.document.body.querySelectorAll('button').item(1);
      if (!button) throw new Error('Not rendered');
      Simulate.click(button);
    });
    await act(async () => {
      // Modal does not render in div
      const button = window.document.body.querySelectorAll('button').item(0);
      if (!button) throw new Error('Not rendered');
      Simulate.click(button);
    });

    ReactDOM.unmountComponentAtNode(div);
  });

  it('should close if connected', async () => {
    const div = document.createElement('div');
    const activatingSpy = jest.spyOn(
      Resolving.args?.options?.config?.chains.ethereum[0].connector as any,
      'activate'
    );
    const closeSpy = jest.spyOn(Resolving.args?.options as any, 'close');

    ReactDOM.render(<Resolving {...Resolving.args} />, div);
    await act(
      () =>
        new Promise(async (resolve) => {
          setTimeout(() => {
            // Modal does not render in div
            const button = window.document.body
              .querySelectorAll('button')
              .item(1);
            if (!button) throw new Error('Not rendered');
            Simulate.click(button);
            resolve();
          }, 100);
        })
    );

    await new Promise((resolve) => {
      setTimeout(() => {
        expect(activatingSpy).toBeCalled();
        expect(closeSpy).toBeCalled();
        resolve();
      }, 100);
    });

    ReactDOM.unmountComponentAtNode(div);
  });

  it('should warn of wrong network', async () => {
    const div = document.createElement('div');
    const activatingSpy = jest.spyOn(
      WrongNetwork.args?.options?.config?.chains.ethereum[0].connector as any,
      'activate'
    );
    const closeSpy = jest.spyOn(WrongNetwork.args?.options as any, 'close');

    ReactDOM.render(<WrongNetwork {...WrongNetwork.args} />, div);
    await act(
      () =>
        new Promise(async (resolve) => {
          setTimeout(() => {
            // Modal does not render in div
            const button = window.document.body
              .querySelectorAll('button')
              .item(1);
            if (!button) throw new Error('Not rendered');
            Simulate.click(button);
            resolve();
          }, 100);
        })
    );

    await new Promise((resolve) => {
      setTimeout(() => {
        expect(activatingSpy).toBeCalled();
        expect(closeSpy).not.toBeCalled();
        expect(window.document.body.querySelector('p')?.innerHTML).toContain(
          'wrong network'
        );
        resolve();
      }, 100);
    });

    ReactDOM.unmountComponentAtNode(div);
  });
});
