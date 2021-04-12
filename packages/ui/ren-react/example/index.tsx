import * as React from 'react'
import * as ReactDOM from 'react-dom'

import { useDeposit, useMint, useBurn } from '@renproject/ren-react'
import RenJS from '@renproject/ren'
import { Ethereum } from '@renproject/chains-ethereum'
import { Zcash } from '@renproject/chains-bitcoin'
import Web3 from 'web3'
import { useEffect, useMemo, useState } from 'react'
import { RenNetwork } from '@renproject/interfaces'

const BurnApp = ({ account, provider, destinationAddress, balance }) => {
  const parameters = useMemo(
    () => ({
      sdk: new RenJS('testnet'),
      burnParams: {
        sourceAsset: 'ZEC',
        network: RenNetwork.Testnet,
        destinationAddress
      },
      from: Ethereum(provider, 'testnet').Account({
        address: account,
        value: balance
      }),
      to: Zcash().Address(destinationAddress)
    }),
    [provider, account, balance]
  )

  const { state, session, burn, tx } = useBurn(parameters)
  switch (true) {
    case state.matches('created'):
      return (
        <button onClick={burn}>
          Burn and release {Number(balance) / 10 ** 8} {session.sourceAsset} to
          {destinationAddress}
        </button>
      )
    case state.matches('srcSettling'):
      return `Waiting for burn confirmation ${tx.sourceTxConfs} / ${tx.sourceTxConfTarget}`
    case state.matches('srcConfirmed'):
      return 'Submitting to RenVM'
    case state.matches('accepted'):
      return 'Releasing'
    case state.matches('destInitiated'):
      return 'Released'
    case state.matches('errorBurning'):
      return "Couldn't burn: " + session.error?.message?.toString()
    case state.matches('errorReleasing'):
      return 'Rejected'
    default:
      return 'Loading...'
  }
}

const MintApp = ({ account, provider }) => {
  const parameters = useMemo(
    () => ({
      sdk: new RenJS('testnet'),
      mintParams: {
        sourceAsset: 'ZEC',
        network: RenNetwork.Testnet,
        destinationAddress: account,
        nonce: Buffer.from(new Array(32).fill(0))
      },
      to: Ethereum(provider).Account({ address: account }),
      from: Zcash()
    }),
    [provider, account]
  )
  const mint = useMint(parameters)
  return (
    <div>
      Deposit {mint.session.sourceAsset} at {mint.session.gatewayAddress}
      {mint.deposits.map((x) => (
        <Deposit
          key={x}
          sessionMachine={mint.sessionMachine}
          depositId={x}
          currency={mint.session.sourceAsset}
        />
      ))}
    </div>
  )
}

const Deposit: React.FC<{
  sessionMachine: any
  depositId: string
  currency: string
}> = ({ sessionMachine, depositId, currency }) => {
  const machine = useDeposit(sessionMachine, depositId)
  if (!machine) return <div>Missing deposit...</div>
  const { deposit, state, mint } = machine
  switch (true) {
    case state.matches('srcSettling'):
      return `Waiting for deposit confirmation ${deposit.sourceTxConfs}/
    ${deposit.sourceTxConfTarget}`
    case state.matches('srcConfirmed'):
      return `Submitting to RenVM`
    case state.matches('accepted'):
      return (
        <button onClick={mint}>
          Mint {deposit.sourceTxAmount} {currency}?
        </button>
      )
    case state.matches('claiming'):
      return <div>Minting...</div>
    case state.matches('destInitiated'):
    case state.matches('completed'):
      return `Successfully minted: ${deposit.rawDestTx}`
    case state.matches('rejected'):
      return `Deposit rejected ${deposit.error?.toString()}`
    default:
      return `State: {state} id: ${deposit.sourceTxHash}`
  }
}

const WithProvider = () => {
  const [provider, setProvider] = useState<any>()
  const [account, setAccount] = useState<string>()
  useEffect(() => {
    ;(window as any).ethereum.enable().then(async () => {
      const web3 = new Web3((window as any).ethereum)
      setAccount((await web3.eth.personal.getAccounts())[0])
      setProvider((window as any).ethereum)
    })
  }, [])

  const [balance, setBalance] = useState<string>()
  useEffect(() => {
    Ethereum(provider, 'testnet')
      .getBalance('ZEC', account)
      .then((v) => setBalance(v.minus(1000).toString()))
  }, [provider, setBalance])

  if (!provider || !account || !balance) {
    return <div>Connect Wallet</div>
  }

  return (
    <div>
      <div>
        <h2>Mint</h2>
        <MintApp provider={provider} account={account} />
      </div>
      <div>
        <h2>Burn</h2>
        <BurnApp
          provider={provider}
          account={account}
          destinationAddress={'tmCZ74c41byQKyVsA6xc8jMwXbQxKU16nJT'}
          balance={balance}
        />
      </div>
    </div>
  )
}

ReactDOM.render(<WithProvider />, document.getElementById('root'))
