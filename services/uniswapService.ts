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

const chainId = ChainId.MAINNET;

interface TokenList {
  [index: string]: string;
}

interface TokensByNetwork {
  [index: string]: TokenList;
}

const tokensByNetwork: TokensByNetwork = {
  ROPSTEN: {
    DAI: '0xad6d458402f60fd3bd25163575031acdce07538d',
    XOR: '0x087457fae2d66fd1d466f3fd880a99b6c28566e5',
  },
  MAINNET: {
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    XOR: '0x40fd72257597aa14c7231a7b1aaa29fce868f677',
  },
};

// Use the mainnet
const network = 'mainnet';
const tokens = tokensByNetwork[network.toUpperCase()];
const uniswapRouterAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'; // mainnet
// const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // ropsten

const DAI = new Token(ChainId.MAINNET, utils.getAddress(tokens['DAI']), 18);

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

const wallet = new ethers.Wallet(process.env.ETH_WALLET_PRIVATE_KEY || '', provider);
const uniswap = new ethers.Contract(uniswapRouterAddress, abis.router02, wallet);

export async function getToken(tokenAddress: string): Promise<Token> {
  const TOKEN: Token = await Fetcher.fetchTokenData(
    chainId,
    utils.getAddress(tokenAddress), // checksum it
    provider
    // 'DAI',
    // 'Dai Stablecoin'
  ); // get token details
  return TOKEN;
}

export async function tradeToken(token: string): Promise<Pair> {
  const WETHID = WETH[DAI.chainId];
  const ethPricePair = await Fetcher.fetchPairData(DAI, WETHID);
  const tradeableToken = await getToken(tokens[token]);
  const tradeablePair = await Fetcher.fetchPairData(tradeableToken, WETHID);

  const ethPriceRoute = new Route([ethPricePair], WETHID);
  const route = new Route([tradeablePair], WETHID);
  // const tradeValue2 = 50 / parseInt(route.midPrice.toSignificant(6)); // risk $50
  console.log(`Price in ${token}: `, route.midPrice.toSignificant(6));
  console.log(`Price in ETH: `, route.midPrice.invert().toSignificant(6));
  const tradeValue = 50 / parseInt(ethPriceRoute.midPrice.toSignificant(6)); // risk $50
  console.log('Trade Value: ', tradeValue);

  const trade = new Trade(
    route,
    new TokenAmount(WETHID, toWei(`${tradeValue}`, 'ether')),
    TradeType.EXACT_INPUT
  );

  console.log('Execute Price: ', trade.executionPrice.toSignificant(6));
  console.log('Price After: ', trade.nextMidPrice.toSignificant(6)); // we can see what price we'll get after the trade

  const slippageTolerance = new Percent('50', '10000'); // 50 bips, or 0.50%

  const amountOutMin = BigNumber.from(trade.minimumAmountOut(slippageTolerance).raw.toString()); // worst case scenario
  const path = [WETHID.address, tradeableToken.address];
  const to = utils.getAddress('0x266d6Bc2262Cc2690Ef5C0313e7330995C15eEDb'); // my address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const value = BigNumber.from(trade.inputAmount.raw.toString()); // needs to be converted to e.g. hex
  // const value = BigNumber.from(toWei('1', 'ether'));
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
  // const tx = await uniswap.swapExactETHForTokens(amountOutMin, path, to, deadline, {
  //   value,
  //   gasPrice,
  // });
  // console.log(`Transaction Hash: ${tx.hash}`);

  // const receipt = await tx.wait();
  // console.log(`Transaction was minded in block ${receipt.blockNumber}`);

  return tradeablePair;
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
