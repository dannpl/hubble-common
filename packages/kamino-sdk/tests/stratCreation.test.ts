import {
  Account,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import { Kamino, numberToRebalanceType, RaydiumService, sendTransactionWithLogs } from '../src';
import Decimal from 'decimal.js';
import {
  assignBlockInfoToTransaction,
  createTransactionWithExtraBudget,
  getAssociatedTokenAddressAndData,
} from '../src';
import { updateStrategyConfig, updateTreasuryFeeVault, solAirdrop } from './utils';
import { UpdateRebalanceType } from '../src/kamino-client/types/StrategyConfigOption';
import { expect } from 'chai';
import { WHIRLPOOL_PROGRAM_ID } from '../src/whirpools-client/programId';
import { PROGRAM_ID as RAYDIUM_PROGRAM_ID } from '../src/raydium_client/programId';
import { Manual, PricePercentage } from '../src/kamino-client/types/RebalanceType';

const GlobalConfigMainnet = new PublicKey('GKnHiWh3RRrE1zsNzWxRkomymHc374TvJPSTv2wPeYdB');
const KaminoProgramIdMainnet = new PublicKey('6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc');
const SOLMintMainnet = new PublicKey('So11111111111111111111111111111111111111112');
const USDCMintMainnet = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

describe('Kamino strategy creation SDK Tests', () => {
  let connection: Connection;
  const cluster = 'mainnet-beta';
  const clusterUrl: string = 'https://api.mainnet-beta.solana.com';
  connection = new Connection(clusterUrl, 'processed');

  // use your private key here
  const signerPrivateKey = [];
  const signer = Keypair.fromSecretKey(Uint8Array.from(signerPrivateKey));

  it.skip('create custom USDC-USDH new manual strategy on existing whirlpool', async () => {
    let kamino = new Kamino(
      cluster,
      connection,
      GlobalConfigMainnet,
      KaminoProgramIdMainnet,
      WHIRLPOOL_PROGRAM_ID,
      RAYDIUM_PROGRAM_ID
    );

    const newStrategy = Keypair.generate();
    const newPosition = Keypair.generate();
    const createRaydiumStrategyAccountIx = await kamino.createStrategyAccount(signer.publicKey, newStrategy.publicKey);
    console.log('newStrategy.publicKey', newStrategy.publicKey.toString());

    let buildNewStrategyIxs = await kamino.getBuildStrategyIxns(
      'ORCA',
      new Decimal(0.0001),
      newStrategy.publicKey,
      newPosition.publicKey,
      signer.publicKey,
      new Decimal(Manual.discriminator),
      [], // not needed used for manual
      new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
      new PublicKey('USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX')
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(createRaydiumStrategyAccountIx);
    ixs.push(buildNewStrategyIxs[0]);
    const createStratTx = await kamino.getTransactionV2Message(signer.publicKey, ixs);
    const createStratTransactionV0 = new VersionedTransaction(createStratTx);
    createStratTransactionV0.sign([newStrategy, signer]);

    //@ts-ignore
    let txHash = await sendAndConfirmTransaction(kamino._connection, createStratTransactionV0);
    console.log('create strategy tx hash', txHash);

    let strategySetupIxs: TransactionInstruction[] = [];

    buildNewStrategyIxs[1].slice(0, 4).map((ix) => strategySetupIxs.push(ix));
    const setupStratTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupIxs);
    const setupStratTransactionV0 = new VersionedTransaction(setupStratTx);
    setupStratTransactionV0.sign([signer]);

    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratTransactionV0);
    console.log('setup strategy tx hash', txHash);

    let strategySetupFeesIxs: TransactionInstruction[] = [];
    console.log(' buildNewStrategyIxs[1].length()', buildNewStrategyIxs[1].length);
    buildNewStrategyIxs[1].slice(4).map((ix) => strategySetupFeesIxs.push(ix));
    strategySetupFeesIxs.push(buildNewStrategyIxs[2]);
    const setupStratFeesTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupFeesIxs);
    const setupStratFeesTransactionV0 = new VersionedTransaction(setupStratFeesTx);
    setupStratFeesTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratFeesTransactionV0);
    console.log('setup strategy fees tx hash', txHash);

    // after strategy creation we have to set the reward mappings so it autocompounds
    let updateRewardMappingIxs = await kamino.getUpdateRewardsIxs(signer.publicKey, newStrategy.publicKey);
    const updateRewardMappingTx = await kamino.getTransactionV2Message(signer.publicKey, updateRewardMappingIxs);
    const updateRewardMappingsTransactionV0 = new VersionedTransaction(updateRewardMappingTx);
    updateRewardMappingsTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, updateRewardMappingsTransactionV0);
    console.log('update reward mappings tx hash', txHash);
  });

  it.skip('create new manual strategy on existing whirlpool', async () => {
    let kamino = new Kamino(
      cluster,
      connection,
      GlobalConfigMainnet,
      KaminoProgramIdMainnet,
      WHIRLPOOL_PROGRAM_ID,
      RAYDIUM_PROGRAM_ID
    );

    const newStrategy = Keypair.generate();
    const newPosition = Keypair.generate();
    const createRaydiumStrategyAccountIx = await kamino.createStrategyAccount(signer.publicKey, newStrategy.publicKey);
    console.log('newStrategy.publicKey', newStrategy.publicKey.toString());

    let buildNewStrategyIxs = await kamino.getBuildStrategyIxns(
      'ORCA',
      new Decimal(0.0005),
      newStrategy.publicKey,
      newPosition.publicKey,
      signer.publicKey,
      new Decimal(Manual.discriminator),
      [], // not needed used for manual
      SOLMintMainnet,
      USDCMintMainnet
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(createRaydiumStrategyAccountIx);
    ixs.push(buildNewStrategyIxs[0]);
    const createStratTx = await kamino.getTransactionV2Message(signer.publicKey, ixs);
    const createStratTransactionV0 = new VersionedTransaction(createStratTx);
    createStratTransactionV0.sign([newStrategy, signer]);
    //@ts-ignore
    let txHash = await sendAndConfirmTransaction(kamino._connection, createStratTransactionV0);
    console.log('create strategy tx hash', txHash);

    let strategySetupIxs: TransactionInstruction[] = [];

    buildNewStrategyIxs[1].slice(0, 4).map((ix) => strategySetupIxs.push(ix));
    const setupStratTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupIxs);
    const setupStratTransactionV0 = new VersionedTransaction(setupStratTx);
    setupStratTransactionV0.sign([signer]);

    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratTransactionV0);
    console.log('setup strategy tx hash', txHash);

    let strategySetupFeesIxs: TransactionInstruction[] = [];
    console.log(' buildNewStrategyIxs[1].length()', buildNewStrategyIxs[1].length);
    buildNewStrategyIxs[1].slice(4).map((ix) => strategySetupFeesIxs.push(ix));
    strategySetupFeesIxs.push(buildNewStrategyIxs[2]);
    const setupStratFeesTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupFeesIxs);
    const setupStratFeesTransactionV0 = new VersionedTransaction(setupStratFeesTx);
    setupStratFeesTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratFeesTransactionV0);
    console.log('setup strategy fees tx hash', txHash);

    // after strategy creation we have to set the reward mappings so it autocompounds
    let updateRewardMappingIxs = await kamino.getUpdateRewardsIxs(signer.publicKey, newStrategy.publicKey);
    const updateRewardMappingTx = await kamino.getTransactionV2Message(signer.publicKey, updateRewardMappingIxs);
    const updateRewardMappingsTransactionV0 = new VersionedTransaction(updateRewardMappingTx);
    updateRewardMappingsTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, updateRewardMappingsTransactionV0);
    console.log('update reward mappings tx hash', txHash);
  });

  it.skip('create new percentage strategy on existing whirlpool', async () => {
    let kamino = new Kamino(
      cluster,
      connection,
      GlobalConfigMainnet,
      KaminoProgramIdMainnet,
      WHIRLPOOL_PROGRAM_ID,
      RAYDIUM_PROGRAM_ID
    );

    const newStrategy = Keypair.generate();
    const newPosition = Keypair.generate();
    const createRaydiumStrategyAccountIx = await kamino.createStrategyAccount(signer.publicKey, newStrategy.publicKey);
    console.log('newStrategy.publicKey', newStrategy.publicKey.toString());

    let buildNewStrategyIxs = await kamino.getBuildStrategyIxns(
      'ORCA',
      new Decimal(0.0005),
      newStrategy.publicKey,
      newPosition.publicKey,
      signer.publicKey,
      new Decimal(PricePercentage.discriminator),
      [new Decimal(100.0), new Decimal(100.0)],
      SOLMintMainnet,
      USDCMintMainnet
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(createRaydiumStrategyAccountIx);
    ixs.push(buildNewStrategyIxs[0]);
    const createStratTx = await kamino.getTransactionV2Message(signer.publicKey, ixs);
    const createStratTransactionV0 = new VersionedTransaction(createStratTx);
    createStratTransactionV0.sign([newStrategy, signer]);
    //@ts-ignore
    let txHash = await sendAndConfirmTransaction(kamino._connection, createStratTransactionV0);
    console.log('create strategy tx hash', txHash);

    let strategySetupIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(0, 4).map((ix) => strategySetupIxs.push(ix));
    const setupStratTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupIxs);
    const setupStratTransactionV0 = new VersionedTransaction(setupStratTx);
    setupStratTransactionV0.sign([signer]);

    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratTransactionV0);
    console.log('setup strategy tx hash', txHash);

    let strategySetupFeesIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(4).map((ix) => strategySetupFeesIxs.push(ix));
    strategySetupFeesIxs.push(buildNewStrategyIxs[2]);
    const setupStratFeesTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupFeesIxs);
    const setupStratFeesTransactionV0 = new VersionedTransaction(setupStratFeesTx);
    setupStratFeesTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratFeesTransactionV0);
    console.log('setup strategy fees tx hash', txHash);

    // after strategy creation we have to set the reward mappings so it autocompounds
    let updateRewardMappingIxs = await kamino.getUpdateRewardsIxs(signer.publicKey, newStrategy.publicKey);
    const updateRewardMappingTx = await kamino.getTransactionV2Message(signer.publicKey, updateRewardMappingIxs);
    const updateRewardMappingsTransactionV0 = new VersionedTransaction(updateRewardMappingTx);
    updateRewardMappingsTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, updateRewardMappingsTransactionV0);
    console.log('update reward mappings tx hash', txHash);
  });

  it.skip('create custom USDC-USDH new percentage strategy on existing whirlpool', async () => {
    let kamino = new Kamino(
      cluster,
      connection,
      GlobalConfigMainnet,
      KaminoProgramIdMainnet,
      WHIRLPOOL_PROGRAM_ID,
      RAYDIUM_PROGRAM_ID
    );

    const newStrategy = Keypair.generate();
    const newPosition = Keypair.generate();
    const createRaydiumStrategyAccountIx = await kamino.createStrategyAccount(signer.publicKey, newStrategy.publicKey);
    console.log('newStrategy.publicKey', newStrategy.publicKey.toString());

    let buildNewStrategyIxs = await kamino.getBuildStrategyIxns(
      'ORCA',
      new Decimal(0.0001),
      newStrategy.publicKey,
      newPosition.publicKey,
      signer.publicKey,
      new Decimal(Manual.discriminator),
      [], // not needed used for manual
      new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
      new PublicKey('USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX')
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(createRaydiumStrategyAccountIx);
    ixs.push(buildNewStrategyIxs[0]);
    const createStratTx = await kamino.getTransactionV2Message(signer.publicKey, ixs);
    const createStratTransactionV0 = new VersionedTransaction(createStratTx);
    createStratTransactionV0.sign([newStrategy, signer]);
    //@ts-ignore
    let txHash = await sendAndConfirmTransaction(kamino._connection, createStratTransactionV0);
    console.log('create strategy tx hash', txHash);

    let strategySetupIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(0, 4).map((ix) => strategySetupIxs.push(ix));
    const setupStratTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupIxs);
    const setupStratTransactionV0 = new VersionedTransaction(setupStratTx);
    setupStratTransactionV0.sign([signer]);

    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratTransactionV0);
    console.log('setup strategy tx hash', txHash);

    let strategySetupFeesIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(4).map((ix) => strategySetupFeesIxs.push(ix));
    strategySetupFeesIxs.push(buildNewStrategyIxs[2]);
    const setupStratFeesTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupFeesIxs);
    const setupStratFeesTransactionV0 = new VersionedTransaction(setupStratFeesTx);
    setupStratFeesTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratFeesTransactionV0);
    console.log('setup strategy fees tx hash', txHash);

    // after strategy creation we have to set the reward mappings so it autocompounds
    let updateRewardMappingIxs = await kamino.getUpdateRewardsIxs(signer.publicKey, newStrategy.publicKey);
    const updateRewardMappingTx = await kamino.getTransactionV2Message(signer.publicKey, updateRewardMappingIxs);
    const updateRewardMappingsTransactionV0 = new VersionedTransaction(updateRewardMappingTx);
    updateRewardMappingsTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, updateRewardMappingsTransactionV0);
    console.log('update reward mappings tx hash', txHash);
  });

  it.skip('create new percentage strategy on existing whirlpool', async () => {
    let kamino = new Kamino(
      cluster,
      connection,
      GlobalConfigMainnet,
      KaminoProgramIdMainnet,
      WHIRLPOOL_PROGRAM_ID,
      RAYDIUM_PROGRAM_ID
    );

    const newStrategy = Keypair.generate();
    const newPosition = Keypair.generate();
    const createRaydiumStrategyAccountIx = await kamino.createStrategyAccount(signer.publicKey, newStrategy.publicKey);
    console.log('newStrategy.publicKey', newStrategy.publicKey.toString());

    let buildNewStrategyIxs = await kamino.getBuildStrategyIxns(
      'ORCA',
      new Decimal(0.0005),
      newStrategy.publicKey,
      newPosition.publicKey,
      signer.publicKey,
      new Decimal(PricePercentage.discriminator),
      [new Decimal(100.0), new Decimal(100.0)],
      SOLMintMainnet,
      USDCMintMainnet
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(createRaydiumStrategyAccountIx);
    ixs.push(buildNewStrategyIxs[0]);
    const createStratTx = await kamino.getTransactionV2Message(signer.publicKey, ixs);
    const createStratTransactionV0 = new VersionedTransaction(createStratTx);
    createStratTransactionV0.sign([newStrategy, signer]);
    //@ts-ignore
    let txHash = await sendAndConfirmTransaction(kamino._connection, createStratTransactionV0);
    console.log('create strategy tx hash', txHash);

    let strategySetupIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(0, 4).map((ix) => strategySetupIxs.push(ix));
    const setupStratTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupIxs);
    const setupStratTransactionV0 = new VersionedTransaction(setupStratTx);
    setupStratTransactionV0.sign([signer]);

    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratTransactionV0);
    console.log('setup strategy tx hash', txHash);

    let strategySetupFeesIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(4).map((ix) => strategySetupFeesIxs.push(ix));
    strategySetupFeesIxs.push(buildNewStrategyIxs[2]);
    const setupStratFeesTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupFeesIxs);
    const setupStratFeesTransactionV0 = new VersionedTransaction(setupStratFeesTx);
    setupStratFeesTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratFeesTransactionV0);
    console.log('setup strategy fees tx hash', txHash);

    // after strategy creation we have to set the reward mappings so it autocompounds
    let updateRewardMappingIxs = await kamino.getUpdateRewardsIxs(signer.publicKey, newStrategy.publicKey);
    const updateRewardMappingTx = await kamino.getTransactionV2Message(signer.publicKey, updateRewardMappingIxs);
    const updateRewardMappingsTransactionV0 = new VersionedTransaction(updateRewardMappingTx);
    updateRewardMappingsTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, updateRewardMappingsTransactionV0);
    console.log('update reward mappings tx hash', txHash);

    // update rebalance params
    let updateRebalanceParamsIx = await kamino.getUpdateRebalancingParmsIxns(signer.publicKey, newStrategy.publicKey, [
      new Decimal(10.0),
      new Decimal(24.0),
    ]);
    let tx = createTransactionWithExtraBudget(signer.publicKey);
    tx.add(updateRebalanceParamsIx);
    let updateRebalanceParamsTxHash = await sendTransactionWithLogs(connection, tx, signer.publicKey, [signer]);
    console.log('update Rebalance Params Tx Hash ', updateRebalanceParamsTxHash);

    let strategyData = await kamino.getStrategies([newStrategy.publicKey]);
    expect(strategyData[0]?.rebalanceRaw[0] == 10.0);
    expect(strategyData[0]?.rebalanceRaw[2] == 24.0);

    // update rebalance method to manual
    await updateStrategyConfig(
      connection,
      signer,
      newStrategy.publicKey,
      new UpdateRebalanceType(),
      new Decimal(Manual.discriminator)
    );

    strategyData = await kamino.getStrategies([newStrategy.publicKey]);
    expect(strategyData[0]?.rebalanceType == Manual.discriminator);
  });

  it.skip('get raydium pool liquidity distribution', async () => {
    let raydiumService = new RaydiumService(connection, cluster);
    let liquidityDistribution = await raydiumService.getRaydiumPoolLiquidityDistribution(
      new PublicKey('2QdhepnKRTLjjSqPL1PtKNwqrUkoLee5Gqs8bvZhRdMv')
    );

    console.log('liquidityDistribution', liquidityDistribution);
  });

  it.skip('create new custom USDC-USDH percentage strategy on existing whirlpool', async () => {
    let kamino = new Kamino(
      cluster,
      connection,
      GlobalConfigMainnet,
      KaminoProgramIdMainnet,
      WHIRLPOOL_PROGRAM_ID,
      RAYDIUM_PROGRAM_ID
    );

    const newStrategy = Keypair.generate();
    const newPosition = Keypair.generate();
    const createRaydiumStrategyAccountIx = await kamino.createStrategyAccount(signer.publicKey, newStrategy.publicKey);
    console.log('newStrategy.publicKey', newStrategy.publicKey.toString());

    let buildNewStrategyIxs = await kamino.getBuildStrategyIxns(
      'ORCA',
      new Decimal(0.0001),
      newStrategy.publicKey,
      newPosition.publicKey,
      signer.publicKey,
      new Decimal(Manual.discriminator),
      [], // not needed used for manual
      new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
      new PublicKey('USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX')
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(createRaydiumStrategyAccountIx);
    ixs.push(buildNewStrategyIxs[0]);
    const createStratTx = await kamino.getTransactionV2Message(signer.publicKey, ixs);
    const createStratTransactionV0 = new VersionedTransaction(createStratTx);
    createStratTransactionV0.sign([newStrategy, signer]);
    //@ts-ignore
    let txHash = await sendAndConfirmTransaction(kamino._connection, createStratTransactionV0);
    console.log('create strategy tx hash', txHash);

    let strategySetupIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(0, 4).map((ix) => strategySetupIxs.push(ix));
    const setupStratTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupIxs);
    const setupStratTransactionV0 = new VersionedTransaction(setupStratTx);
    setupStratTransactionV0.sign([signer]);

    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratTransactionV0);
    console.log('setup strategy tx hash', txHash);

    let strategySetupFeesIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(4).map((ix) => strategySetupFeesIxs.push(ix));
    strategySetupFeesIxs.push(buildNewStrategyIxs[2]);
    const setupStratFeesTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupFeesIxs);
    const setupStratFeesTransactionV0 = new VersionedTransaction(setupStratFeesTx);
    setupStratFeesTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratFeesTransactionV0);
    console.log('setup strategy fees tx hash', txHash);

    // update rebalance params
    let updateRebalanceParamsIx = await kamino.getUpdateRebalancingParmsIxns(signer.publicKey, newStrategy.publicKey, [
      new Decimal(10.0),
      new Decimal(24.0),
    ]);
    let tx = createTransactionWithExtraBudget(signer.publicKey);
    tx.add(updateRebalanceParamsIx);
    let updateRebalanceParamsTxHash = await sendTransactionWithLogs(connection, tx, signer.publicKey, [signer]);
    console.log('update Rebalance Params Tx Hash ', updateRebalanceParamsTxHash);

    let strategyData = await kamino.getStrategies([newStrategy.publicKey]);
    expect(strategyData[0]?.rebalanceRaw[0] == 10.0);
    expect(strategyData[0]?.rebalanceRaw[2] == 24.0);

    // update rebalance method to manual
    await updateStrategyConfig(
      connection,
      signer,
      newStrategy.publicKey,
      new UpdateRebalanceType(),
      new Decimal(Manual.discriminator)
    );

    strategyData = await kamino.getStrategies([newStrategy.publicKey]);
    expect(strategyData[0]?.rebalanceType == Manual.discriminator);
  });

  it.skip('create new custom USDC-USDH percentage strategy on existing whirlpool and open position', async () => {
    let kamino = new Kamino(
      cluster,
      connection,
      GlobalConfigMainnet,
      KaminoProgramIdMainnet,
      WHIRLPOOL_PROGRAM_ID,
      RAYDIUM_PROGRAM_ID
    );

    const newStrategy = Keypair.generate();
    const newPosition = Keypair.generate();
    const createRaydiumStrategyAccountIx = await kamino.createStrategyAccount(signer.publicKey, newStrategy.publicKey);
    console.log('newStrategy.publicKey', newStrategy.publicKey.toString());

    let lowerPriceBpsDifference = new Decimal(10.0);
    let upperPriceBpsDifference = new Decimal(11.0);

    let buildNewStrategyIxs = await kamino.getBuildStrategyIxns(
      'ORCA',
      new Decimal(0.0001),
      newStrategy.publicKey,
      newPosition.publicKey,
      signer.publicKey,
      new Decimal(PricePercentage.discriminator),
      [lowerPriceBpsDifference, upperPriceBpsDifference],
      new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
      new PublicKey('USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX')
    );

    let ixs: TransactionInstruction[] = [];
    ixs.push(createRaydiumStrategyAccountIx);
    ixs.push(buildNewStrategyIxs[0]);
    const createStratTx = await kamino.getTransactionV2Message(signer.publicKey, ixs);
    const createStratTransactionV0 = new VersionedTransaction(createStratTx);
    createStratTransactionV0.sign([newStrategy, signer]);
    //@ts-ignore
    let txHash = await sendAndConfirmTransaction(kamino._connection, createStratTransactionV0);
    console.log('create strategy tx hash', txHash);

    let strategySetupIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(0, 4).map((ix) => strategySetupIxs.push(ix));
    const setupStratTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupIxs);
    const setupStratTransactionV0 = new VersionedTransaction(setupStratTx);
    setupStratTransactionV0.sign([signer]);

    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratTransactionV0);
    console.log('setup strategy tx hash', txHash);

    let strategySetupFeesIxs: TransactionInstruction[] = [];
    buildNewStrategyIxs[1].slice(4).map((ix) => strategySetupFeesIxs.push(ix));
    strategySetupFeesIxs.push(buildNewStrategyIxs[2]);
    const setupStratFeesTx = await kamino.getTransactionV2Message(signer.publicKey, strategySetupFeesIxs);
    const setupStratFeesTransactionV0 = new VersionedTransaction(setupStratFeesTx);
    setupStratFeesTransactionV0.sign([signer]);
    //@ts-ignore
    txHash = await sendAndConfirmTransaction(kamino._connection, setupStratFeesTransactionV0);
    console.log('setup strategy fees tx hash', txHash);

    // verify strategy rebalance params
    let strategyData = await kamino.getStrategies([newStrategy.publicKey]);
    expect(strategyData[0]?.rebalanceRaw[0] == lowerPriceBpsDifference);
    expect(strategyData[0]?.rebalanceRaw[2] == upperPriceBpsDifference);

    // open position
    const openPositionIxn = buildNewStrategyIxs[3];
    const openPositionMessage = await kamino.getTransactionV2Message(signer.publicKey, [openPositionIxn]);
    const openPositionTx = new VersionedTransaction(openPositionMessage);
    openPositionTx.sign([signer, newPosition]);

    //@ts-ignore
    const openPositionTxId = await sendAndConfirmTransaction(kamino._connection, openPositionTx);
    console.log('openPositionTxId', openPositionTxId);
  });
});