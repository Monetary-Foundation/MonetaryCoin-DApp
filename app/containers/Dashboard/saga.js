import { channel } from 'redux-saga';
import { take, call, put, select, takeLatest, fork } from 'redux-saga/effects';

import Web3 from 'web3';

import { distributionContracts } from 'utils/constants';

import { MCoinAbi } from 'utils/contracts/abi';

import {
  INIT_DASHBOARD,
  // ADD_NEW_SET_EVENT,
  GET_DISTRIBUTION_INFO,
  GET_ADDRESS_INFO,
  COMMIT_ETH_SEND,

  WITHDRAW_SEND,

  // used for eventChannel
  COMMIT_ETH_SEND_SUCCESS,
  COMMIT_ETH_MINED_SUCCESS,
  COMMIT_ETH_ERROR,

  WITHDRAW_SEND_SUCCESS,
  WITHDRAW_MINED_SUCCESS,
  WITHDRAW_ERROR,
} from './constants';

import {
  initDashboardSuccess,
  initDashboardError,

  getDistributionInfo,
  getDistributionInfoSuccess,
  getDistributionInfoError,

  getAddressInfo,
  getAddressInfoSuccess,
  getAddressInfoError,

  commitEthSendSuccess,
  commitEthMinedSuccess,
  commitEthError,

  withdrawSendSuccess,
  withdrawMinedSuccess,
  withdrawError,

  // addNewEvent,

} from './actions';

import {
  makeSelectWeb3,
  makeSelectTokenAddress,

  makeSelectCommitEthSendAmount,
  // makeSelectWithdrawWindow,
} from './selectors';


export const timer = (ms) =>
  new Promise((resolve) => setTimeout(() => resolve('timer end'), ms));

const withdrawChannel = channel();
const STOP_CHANNEL_FORK = 'app/Dashboard/STOP_CHANNEL_FORK';

// let distributionContract;
let tokenContract;

/**
 * Init Dashboard
 */
function* initDashboardAsync(action) {
  try {
    let web3js;

    // Will be set to true if no web3 is injected from external source.
    let isWeb3Browser = false;

    // Checking if Web3 has been injected by the browser (Mist/MetaMask...)
    if (typeof web3 !== 'undefined') {
      // Use Mist/MetaMask's provider
      web3js = new Web3(web3.currentProvider); // eslint-disable-line no-undef

      web3js.eth.defaultAccount = web3.eth.defaultAccount; // eslint-disable-line no-undef
      isWeb3Browser = true;
    } else {
      // throw new Error('No web3 injected (Mist/Metamask...), Aborting');
      console.log('No web3 injected (Mist/Metamask...), Using local fallback');
      // web3js = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws'));
      // web3js = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws'));
      web3js = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/'));
      // new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws'));

      // web3js = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
      isWeb3Browser = false;
      // web3js = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws'));
      // const web2 = new Web3(new Web3.providers.WebsocketProvider('wss://mainnet.infura.io/ws'));
      // const web2 = new Web3(new Web3.providers.WebsocketProvider('wss://rinkeby.infura.io/ws'));
      // console.log(web2);
      // const subscription = web2.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
      //   if (error) return console.error(error);
      //   console.log('Successfully subscribed!', blockHeader);
      // }).on('data', (blockHeader) => {
      //   console.log('data: ', blockHeader);
      // });

      // // unsubscribes the subscription
      // subscription.unsubscribe((error, success) => {
      //   if (error) return console.error(error);

      //   console.log('Successfully unsubscribed!');
      // });
    }

    let networkId;
    try {
      networkId = yield call(web3js.eth.net.getId);
    } catch (err) {
      throw new Error(`web3.eth.net.getId error, check connection to RPC endpoint and refresh page. ${err}`);
    }

    const networkContracts = distributionContracts[networkId] || distributionContracts.default;

    const { networkName } = networkContracts;

    const tokenSelect = action.tokenSymbol || networkContracts.defaultToken;

    const token = networkContracts.tokenList.find((token_) =>
      token_.symbol === tokenSelect);

    // kill previous fork in nesecary
    withdrawChannel.put({ type: STOP_CHANNEL_FORK });
    // fork to handle channel
    yield fork(handleChannelEvents);

    // send every Set() event into eventChannel
    // simpleStorageInstance.contract.Set(
    //   null, // use no filter
    //   (_, event) => {
    //     console.log('call')
    //     eventChannel.put({
    //       type: ADD_NEW_SET_EVENT,
    //       event,
    //     });
    //   }
    // );

    yield put(initDashboardSuccess(
      web3js,
      isWeb3Browser,
      networkId,
      networkName,
      token.name,
      token.symbol,
      token.address,
      token.distributionAddress,
      networkContracts.tokenList
    ));
    yield put(getDistributionInfo());
  } catch (err) {
    yield put(initDashboardError(err.toString()));
  }
}

// /*
//  * catch all events from channel and create an action
//  */
// function* handleEvents() {
//   while (true) {
//     const eventAction = yield take(eventChannel);
//     yield put(addNewEvent(eventAction));
//   }
// }

/**
 * getDistributionInfo
 */
function* getDistributionInfoAsync() {
  try {
    const web3 = yield select(makeSelectWeb3());
    const tokenAddress = yield select(makeSelectTokenAddress());
    tokenContract = new web3.eth.Contract(MCoinAbi, tokenAddress);

    // TODO:Remove
    yield call(timer, 500);

    const allCalls = [];

    allCalls.push(web3.eth.getBlock('latest'));

    allCalls.push(tokenContract.methods.blockReward().call());
    allCalls.push(tokenContract.methods.totalStake().call());
    allCalls.push(tokenContract.methods.totalSupply().call());

    const getAllPromises = () => Promise.all(allCalls);


    const [latestBlock, blockReward, totalStake, totalSupply] =
      yield call(getAllPromises);


    const distributionInfo = {
      timestamp: latestBlock.timestamp,
      totalSupply,
      latestBlock,
      blockReward,
      totalStake,
    };


    yield put(getDistributionInfoSuccess(distributionInfo));
    yield put(getAddressInfo());
  } catch (err) {
    yield put(getDistributionInfoError(err.toString()));
  }
}
/**
 * getAddressInfoAsync
 */
function* getAddressInfoAsync() {
  try {
    const web3 = yield select(makeSelectWeb3());

    const address = (yield call(() => web3.eth.getAccounts()))[0];

    const getBalanceOf = tokenContract.methods.balanceOf(address).call();
    const getCommitmentOf = tokenContract.methods.commitmentOf(address).call();
    const getReward = tokenContract.methods.getReward(address).call();

    const getAllPromises = () =>
      Promise.all([getBalanceOf, getCommitmentOf, getReward]);

    const [balance, commitment, reward] = yield call(getAllPromises);

    const addressInfo = {
      address,
      balance,
      commitment,
      reward,
    };

    // const getRewards = () => distributionContract.methods.getAllRewards().call();
    // const rewards = yield call(getRewards);


    yield put(getAddressInfoSuccess(addressInfo));
  } catch (err) {
    yield put(getAddressInfoError(err.toString()));
  }
}

/**
 * commitEthSendAsync
 */
function* commitEthSendAsync() {
  try {
    const web3 = yield select(makeSelectWeb3());
    const amount = (yield select(makeSelectCommitEthSendAmount()));

    const defaultAccount = (yield call(() => web3.eth.getAccounts()))[0];

    const commitValue = web3.utils.toWei(amount.toString(), 'ether');
    console.log(commitValue);
    console.log(`typeof amount: ${typeof (commitValue)}`);

    tokenContract.methods.commit(commitValue).send({
      from: defaultAccount,
      gas: (200000).toString(),
      gasPrice: web3.utils.toWei((10).toString(), 'gwei'),
      value: 0,
    }).once('transactionHash', (tx) => {
      withdrawChannel.put({
        type: COMMIT_ETH_SEND_SUCCESS,
        tx,
      });
    })
      .once('receipt', (receipt) => {
        withdrawChannel.put({
          type: COMMIT_ETH_MINED_SUCCESS,
          receipt,
        });
      })
      .on('error', (error) => {
        withdrawChannel.put({
          type: COMMIT_ETH_ERROR,
          error,
        });
      });

    console.log(`amount: ${amount}`);
    console.log(`typeof amount: ${typeof (amount)}`);


    // const receipt = yield call(sendPromise);
    // console.log(receipt);

    // yield put(commitEthSendSuccess('receipt'));
  } catch (err) {
    const errMsg = err.toString();
    const shortErr = errMsg.substring(0, errMsg.indexOf('.') + 1);
    yield put(commitEthError(shortErr));
  }
}

/**
 * withdrawSendAsync
 */
function* withdrawSendAsync() {
  try {
    const web3 = yield select(makeSelectWeb3());

    // console.log('withdrawSendAsync');
    // console.log(`window: ${window}`);

    const defaultAccount = (yield call(() => web3.eth.getAccounts()))[0];
    // console.log(defaultAccount);

    tokenContract.methods.withdraw().send({
      from: defaultAccount,
      gas: (100000).toString(),
      gasPrice: web3.utils.toWei((10).toString(), 'gwei'),
      value: 0,
    })
      .once('transactionHash', (tx) => {
        withdrawChannel.put({
          type: WITHDRAW_SEND_SUCCESS,
          tx,
        });
      })
      .once('receipt', (receipt) => {
        withdrawChannel.put({
          type: WITHDRAW_MINED_SUCCESS,
          receipt,
        });
      })
      .on('error', (error) => {
        withdrawChannel.put({
          type: WITHDRAW_ERROR,
          error,
        });
      });

    console.log('withdrawSendAsync');


    // yield put(withdrawMinedSuccess({ recipt: 'withdraw receipt' }));
  } catch (err) {
    const errMsg = err.toString();
    const shortErr = errMsg.substring(0, errMsg.indexOf('.') + 1);
    yield put(withdrawError(shortErr));
  }
}

/*
 * catch all events from channel and create an action
 */
function* handleChannelEvents() {
  console.log('handleChannelEvents forked');
  // prevent return on first stop
  let secondStop = false;
  while (true) {
    const eventAction = yield take(withdrawChannel);
    console.log(eventAction);
    switch (eventAction.type) {
      case WITHDRAW_SEND_SUCCESS:
        yield put(withdrawSendSuccess(eventAction.tx));
        break;
      case WITHDRAW_MINED_SUCCESS:
        yield put(getDistributionInfo());
        // yield put(getAddressInfo());
        yield put(withdrawMinedSuccess(eventAction.receipt));
        break;
      case WITHDRAW_ERROR:
        yield put(withdrawError(eventAction.error));
        break;

      case COMMIT_ETH_SEND_SUCCESS:
        yield put(commitEthSendSuccess(eventAction.tx));
        break;
      case COMMIT_ETH_MINED_SUCCESS:
        yield put(getDistributionInfo());
        // yield put(getAddressInfo());
        yield put(commitEthMinedSuccess(eventAction.receipt));
        break;
      case COMMIT_ETH_ERROR:
        yield put(commitEthError(eventAction.error));
        break;

      case STOP_CHANNEL_FORK:
        if (secondStop) {
          console.log('going to return');
          return;
        }
        secondStop = true;
        break;
      default:
    }
  }
}


// Individual exports for testing
export default function* defaultSaga() {
  yield takeLatest(INIT_DASHBOARD, initDashboardAsync);

  yield takeLatest(GET_DISTRIBUTION_INFO, getDistributionInfoAsync);
  yield takeLatest(GET_ADDRESS_INFO, getAddressInfoAsync);

  yield takeLatest(COMMIT_ETH_SEND, commitEthSendAsync);
  yield takeLatest(WITHDRAW_SEND, withdrawSendAsync);
}
