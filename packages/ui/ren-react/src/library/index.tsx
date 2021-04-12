// import React from 'react'
import DefaultComponent from './Sample/DefaultComponent'
import {
  mintMachine,
  GatewaySession,
  burnMachine,
  GatewayMachineContext,
  GatewayMachineEvent,
  BurnMachineContext
} from '@renproject/ren-tx'
import RenJS from '@renproject/ren'
import { useActor, useMachine, useSelector } from '@xstate/react'
import { LockChain, MintChain, RenNetwork } from '@renproject/interfaces'
import { Interpreter } from 'xstate'
import { useCallback, useMemo } from 'react'
// import { Actor, Interpreter, State } from 'xstate'

interface MintParams {
  /**
   * Asset to be minted/burned (on native chain) eg. "BTC"
   */
  sourceAsset: string
  /**
   * Ren network version to be used, which determines network versions for the selected chains
   */
  network: RenNetwork | 'testnet' | 'mainnet'
  /**
   * Address that will recieve the asset, eg. "0xA1..."
   */
  destinationAddress: string
  /**
   * How much the user expects to recieve in destAsset (eg. BTC)
   *
   */
  targetAmount?: string | number

  /**
   * Amount of sourceAsset user is suggested to send in the base denomination (eg. SATs for Bitcoin)
   * Usually the targetAmount + fees
   */
  suggestedAmount?: string | number

  /**
   * Optional random 32 bytes to make the gateway address unique. Must be persisted in order to restore the transaction
   */
  nonce?: string | Buffer
}

export const getSessionDay = () => Math.floor(Date.now() / 1000 / 60 / 60 / 24)

// user has 72 hours from the start of a session day to complete the tx
// a gateway is only valid for 48 hours however.
//
// FIXME: once ren-tx takes the two-stage expiry into account, update this
export const getSessionExpiry = () =>
  (getSessionDay() + 3) * 60 * 60 * 24 * 1000

function idFromParams(session: GatewaySession): string {
  return `tx-${session.userAddress}-${getSessionDay()}-${
    session.sourceAsset
  }-to-${session.destChain}`
}

function sessionFromMintConfigMultiple<CustomParams = {}>(config: {
  mintParams: MintParams
  userAddress: string
  destinationChain: string
  sourceChain: string
  customParams: CustomParams
}): GatewaySession {
  const session: GatewaySession = {
    ...config.mintParams,
    id: '',
    type: 'mint',
    userAddress: config.userAddress,
    destAddress: config.mintParams.destinationAddress,
    destChain: config.destinationChain,
    sourceChain: config.sourceChain,
    expiryTime: getSessionExpiry(),
    transactions: {},
    targetAmount: config.mintParams.targetAmount ?? 0,
    customParams: config.customParams,
    createdAt: Date.now()
  }
  session.id = idFromParams(session)
  return session
}

export interface MintConfig {
  sdk: RenJS
  mintParams: MintParams
  debug?: boolean
}

// Use this if you want to send to a single destination
export interface MintConfigSingle extends MintConfig {
  to: MintChain
  from: LockChain
}

// Use this if you want to set up & restore multiple assets / destinations
export interface MintConfigMultiple<CustomParams = {}> extends MintConfig {
  toMap: GatewayMachineContext['toChainMap']
  fromMap: GatewayMachineContext['fromChainMap']
  /**
   * Chain that the source asset is located on, eg. "Bitcoin"
   */
  sourceChain: string
  /**
   * Chain that the asset will be recieved on eg. "Ethereum"
   */
  destinationChain: string
  /**
   * Address that can cryptographically be proven to belong to a user. Used as a "from" address for some chains
   */
  userAddress: string
  /**
   * Extra parameters to be used for constructing to/from contract parameters
   */
  customParams: CustomParams
  providers: any
}

function isSingle(
  c: MintConfigSingle | MintConfigMultiple
): c is MintConfigSingle {
  return (c as MintConfigSingle).to !== undefined
}

const buildMintContext = (config: MintConfigSingle | MintConfigMultiple) => {
  const { sdk } = config
  let tx: GatewaySession

  let fromChainMap = {}
  let toChainMap = {}
  let providers = {}
  if (isSingle(config)) {
    fromChainMap = { [config.from.name]: (_: any) => config.from }
    toChainMap = { [config.to.name]: (_: any) => config.to }
    tx = sessionFromMintConfigMultiple({
      ...config,
      sourceChain: config.from.name,
      userAddress: '',
      destinationChain: config.to.name,
      customParams: {}
    })
  } else {
    tx = sessionFromMintConfigMultiple(config)
    fromChainMap = config.fromMap
    toChainMap = config.toMap
    providers = config.providers
  }
  return {
    tx,
    providers,
    sdk,
    fromChainMap,
    toChainMap
  }
}

export const useMint = (config: MintConfigSingle | MintConfigMultiple) => {
  const context = useMemo(() => buildMintContext(config), [config])

  const [state, , machine] = useMachine(mintMachine, {
    context,
    devTools: config.debug
  })

  const session = useSelector(machine, (machine) => {
    return machine.context.tx
  })

  /* const deposits = useSelector(machineHook[2], (machine) => {
   *   return Object.keys(machine.context.depositMachines || {})
   * }) */

  return {
    sessionMachine: machine,
    session, //state.context.tx,
    deposits: Object.keys(state.context.depositMachines || {})
  }
}

export const useDeposit = (
  sessionMachine: Interpreter<GatewayMachineContext, any, GatewayMachineEvent>,
  depositId: string
) => {
  const depositMachine = useSelector(sessionMachine, (context) => {
    if (!context.context.depositMachines) return
    return context.context.depositMachines[depositId]
  })
  if (!depositMachine) return
  const [state, send] = useActor(depositMachine)
  const deposit = useSelector(depositMachine, (context) => {
    return context.context.deposit
  })

  const mint = useCallback(() => {
    send({ type: 'CLAIM', data: deposit, params: {} })
  }, [deposit, send])

  return {
    state,
    deposit,
    mint
  }
}

interface BurnParams {
  /**
   * Asset to be minted/burned (on native chain) eg. "BTC"
   */
  sourceAsset: string
  /**
   * Ren network version to be used, which determines network versions for the selected chains
   */
  network: RenNetwork | 'testnet' | 'mainnet'
  /**
   * Address that will recieve the asset, eg. "0xA1..."
   */
  destinationAddress: string
  /**
   * How much the user expects to recieve in destAsset (eg. BTC)
   *
   */
  targetAmount?: string | number

  /**
   * Amount of sourceAsset user is suggested to send in the base denomination (eg. SATs for Bitcoin)
   * Usually the targetAmount + fees
   */
  suggestedAmount?: string | number

  /**
   * Optional random 32 bytes to make the gateway address unique. Must be persisted in order to restore the transaction
   */
  nonce?: string | Buffer
}

function sessionFromBurnConfigMultiple<CustomParams = {}>(config: {
  burnParams: BurnParams
  userAddress: string
  destinationChain: string
  sourceChain: string
  customParams: CustomParams
}): GatewaySession {
  const session: GatewaySession = {
    ...config.burnParams,
    id: '',
    type: 'mint',
    userAddress: config.userAddress,
    destAddress: config.burnParams.destinationAddress,
    destChain: config.destinationChain,
    sourceChain: config.sourceChain,
    expiryTime: getSessionExpiry(),
    transactions: {},
    targetAmount: config.burnParams.targetAmount ?? 0,
    customParams: config.customParams,
    createdAt: Date.now()
  }
  session.id = idFromParams(session)
  return session
}

export interface BurnConfig {
  sdk: RenJS
  burnParams: BurnParams
  debug?: boolean
}

// Use this if you want to send to a single destination
export interface BurnConfigSingle extends BurnConfig {
  to: LockChain
  from: MintChain
}

// Use this if you want to set up & restore multiple assets / destinations
export interface BurnConfigMultiple<CustomParams = {}> extends BurnConfig {
  toMap: BurnMachineContext['toChainMap']
  fromMap: BurnMachineContext['fromChainMap']
  /**
   * Chain that the source asset is located on, eg. "Bitcoin"
   */
  sourceChain: string
  /**
   * Chain that the asset will be recieved on eg. "Ethereum"
   */
  destinationChain: string
  /**
   * Address that can cryptographically be proven to belong to a user. Used as a "from" address for some chains
   */
  userAddress: string
  /**
   * Extra parameters to be used for constructing to/from contract parameters
   */
  customParams: CustomParams
  providers: any
}

function isSingleBurn(
  c: BurnConfigSingle | BurnConfigMultiple
): c is BurnConfigSingle {
  return (c as BurnConfigSingle).to !== undefined
}

const buildBurnContext = (config: BurnConfigSingle | BurnConfigMultiple) => {
  console.log('building', config)
  const { sdk } = config
  let tx: GatewaySession

  let fromChainMap: BurnMachineContext['fromChainMap'] = {}
  let toChainMap: BurnMachineContext['toChainMap'] = {}
  let providers = {}
  if (isSingleBurn(config)) {
    fromChainMap = { [config.from.name]: (_: any) => config.from }
    toChainMap = { [config.to.name]: (_: any) => config.to }
    tx = sessionFromBurnConfigMultiple({
      ...config,
      sourceChain: config.from.name,
      userAddress: '',
      destinationChain: config.to.name,
      customParams: {}
    })
  } else {
    tx = sessionFromBurnConfigMultiple(config)
    fromChainMap = config.fromMap
    toChainMap = config.toMap
    providers = config.providers
  }
  return {
    tx,
    providers,
    sdk,
    fromChainMap,
    toChainMap
  }
}

export const useBurn = (config: BurnConfigSingle | BurnConfigMultiple) => {
  const context = buildBurnContext(config)

  const [state, , machine] = useMachine(burnMachine, {
    context,
    devTools: config.debug
  })
  const burn = useCallback(() => {
    machine.send({ type: 'SUBMIT' })
  }, [machine.send])

  return {
    machine,
    state,
    session: state.context.tx,
    tx: Object.values(state.context.tx.transactions)[0],
    burn
  }
}

export default DefaultComponent
