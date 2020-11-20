import {
  ChainId,
  Token,
  Fetcher,
  WETH,
  Pair,
  Percent,
  Route,
  Trade,
  TokenAmount,
  TradeType,
} from '@uniswap/sdk';
import { ethers, utils, BigNumber } from 'ethers';
import axios from 'axios';
import { toWei } from 'web3-utils';
import abis from '../abis/abis';

const chainId = ChainId.ROPSTEN;
// const tokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // dai
// const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18);
const DAI = new Token(
  ChainId.ROPSTEN,
  utils.getAddress('0xad6d458402f60fd3bd25163575031acdce07538d'),
  18
);

// Use the mainnet
const network = 'ropsten';
const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

// Specify your own API keys
// Each is optional, and if you omit it the default
// API key for that service will be used.
const provider = ethers.getDefaultProvider(network, {
  etherscan: process.env.ETHERSCAN_API_KEY,
  infura: {
    projectId: process.env.INFURA_PROJECT_ID,
    projectSecret: process.env.INFURA_PROJECT_SECRET,
  },
});

console.log(abis);
const wallet = new ethers.Wallet(process.env.ETH_WALLET_PRIVATE_KEY || '', provider);
const uniswap = new ethers.Contract(uniswapRouterAddress, abis.router02, wallet);
console.log(uniswap);

export async function getToken(tokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F') {
  const TOKEN: Token = await Fetcher.fetchTokenData(
    chainId,
    tokenAddress,
    provider
    // 'DAI',
    // 'Dai Stablecoin'
  ); // get token details
  console.log(TOKEN);
  return TOKEN;
}

export async function getPair(): Promise<Pair> {
  const WETHID = WETH[DAI.chainId];
  const pair = await Fetcher.fetchPairData(DAI, WETHID);

  const route = new Route([pair], WETHID);
  const tradeValue = 50 / parseInt(route.midPrice.toSignificant(6)); // risk $50
  console.log(route.midPrice.toSignificant(6));
  // console.log(route.midPrice.invert().toSignificant(6)); // amount in dai
  console.log(tradeValue);

  const trade = new Trade(
    route,
    new TokenAmount(WETHID, '1000000000000000000'),
    TradeType.EXACT_INPUT
  );

  // console.log(trade.executionPrice.toSignificant(6));
  // console.log(trade.nextMidPrice.toSignificant(6)); // we can see what price we'll get after the trade

  const slippageTolerance = new Percent('50', '10000'); // 50 bips, or 0.50%

  const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // worst case scenario
  const path = [WETHID.address, DAI.address];
  const to = utils.getAddress('0x266d6Bc2262Cc2690Ef5C0313e7330995C15eEDb'); // my address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  // const value = trade.inputAmount.raw; // needs to be converted to e.g. hex
  const value = BigNumber.from(toWei('1', 'ether'));
  // const value = utils.hexlify(50000000000000000); // 0.05ETH
  const gasPrice = await getGasPrice();
  console.log(gasPrice);
  console.log(value);

  // call a contract with order details
  // "inputs": [
  //   { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
  //   { "internalType": "address[]", "name": "path", "type": "address[]" },
  //   { "internalType": "address", "name": "to", "type": "address" },
  //   { "internalType": "uint256", "name": "deadline", "type": "uint256" }
  // ],
  const tx = await uniswap.swapExactETHForTokens(value, path, to, deadline, {
    value,
    gasPrice,
  });
  console.log(`Transaction Hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction was minded in block ${receipt.blockNumber}`);

  return pair;
}

// async function getDecimals(chainId: ChainId, tokenAddress: string): Promise<number> {
//   // implementation details
// }

export async function getGasPrice(speed = 'average') {
  // , maxWait?: number = 100) {
  try {
    const response = await axios.get('https://ethgasstation.info/json/ethgasAPI.json');
    const price = response.data[speed];
    // const price = Object.keys(data).find((price) => parseFloat(data[price]) <= maxWait);
    return toWei(`${(price || response.data.fast) / 10}`, 'gwei');
  } catch (error) {
    throw new Error(`Failed to fetch gas price data: ${error}`);
  }
}
