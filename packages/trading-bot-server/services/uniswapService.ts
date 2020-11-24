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
import { toWei } from 'web3-utils';
import abis from '../abis/abis';
import { TradingViewBody } from '../models/TradingViewBody';

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
    AUDIO: '0x18aaa7115705e8be94bffebde57af9bfc265b998',
    RPL: '0xb4efd85c19999d84251304bda99e90b92300bd93',
  },
};

// Use the mainnet
const network = 'mainnet';
const chainId = ChainId.MAINNET;
// const network = 'ropsten';
const tokens = tokensByNetwork[network.toUpperCase()];
const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // mainnet and ropsten

const DAI = new Token(ChainId.MAINNET, utils.getAddress(tokens['DAI']), 18);
// const DAI = new Token(ChainId.ROPSTEN, utils.getAddress(tokens['DAI']), 18);
const weth = WETH[DAI.chainId];

// Specify your own API keys
// Each is optional, and if you omit it the default
// API key for that service will be used.
// const provider = ethers.getDefaultProvider();
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

export async function handleUniswapOrder(body: TradingViewBody) {
  // get eth info
  const ethPricePair = await Fetcher.fetchPairData(DAI, weth, provider);
  const ethPriceRoute = new Route([ethPricePair], weth);
  console.log(`ETH Price: ${ethPriceRoute.midPrice.toSignificant(6)}`);

  const token = body.ticker.slice(0, body.ticker.indexOf('WETH'));
  if (body.strategy.action === 'buy' || !body.strategy.description.includes('Close')) {
    const tradeValue = 300 / parseInt(ethPriceRoute.midPrice.toSignificant(6));
    return await swapExactETHForTokens(token, tradeValue);
  } else {
    return await swapExactTokensForETH(token);
  }
}

// TODO handle not in token list
async function swapExactETHForTokens(token: string, tradeValue: number) {
  const tradeableToken = await getToken(tokens[token]);
  const tradeablePair = await Fetcher.fetchPairData(tradeableToken, weth, provider);
  const route = new Route([tradeablePair], weth);

  console.log(`${token} Price in ETH: `, route.midPrice.invert().toSignificant(6));
  console.log('Trade Value: ', tradeValue);

  // set up trade
  const trade = new Trade(
    route,
    new TokenAmount(weth, toWei(`${tradeValue}`, 'ether')),
    TradeType.EXACT_INPUT
  );
  const slippageTolerance = new Percent('75', '10000'); // 75 bips, or 0.75%
  console.log('Execute Price: ', trade.executionPrice.toSignificant(6));
  console.log('Price After: ', trade.nextMidPrice.toSignificant(6)); // we can see what price we'll get after the trade

  // set up order details
  const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
  const amountOutMinHex = BigNumber.from(amountOutMin.toString()).toHexString(); // worst case scenario
  const path = [weth.address, tradeableToken.address];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const inputAmount = trade.inputAmount.raw;
  const inputAmountHex = BigNumber.from(inputAmount.toString()).toHexString(); // needs to be converted to e.g. hex
  const gasPrice = await provider.getGasPrice();

  console.log(`Gas Price: ${gasPrice.toString()}`);
  // if (gasPrice > 250000000000) {
  //   console.log(`Nah it's too expensive`);
  // }

  // call a contract with order details
  const tx = await uniswap.swapExactETHForTokens(amountOutMinHex, path, wallet.address, deadline, {
    value: inputAmountHex,
    gasPrice: gasPrice.toHexString(),
    gasLimit: BigNumber.from(160000).toHexString(),
  });
  console.log(`Transaction Hash: ${tx.hash}`);

  // wait and profit
  const receipt = await tx.wait();
  console.log(`Transaction was minded in block ${receipt.blockNumber}`);

  return receipt.blockNumber;
}

async function swapExactTokensForETH(token: string) {
  const balanceOf = new ethers.Contract(tokens[token], abis.erc20.abi, provider);
  const balance = await balanceOf.balanceOf(wallet.address);

  const tradeableToken = await getToken(tokens[token]);
  const tradeablePair = await Fetcher.fetchPairData(tradeableToken, weth, provider);
  const route = new Route([tradeablePair], tradeableToken, weth);

  console.log(`${token} Price in ETH: `, route.midPrice.toSignificant(6));
  console.log('Trade Value: ', balance.toString());

  // set up trade
  const hey = new TokenAmount(tradeableToken, balance.toString());
  console.log(balance.toString().length);
  const trade = new Trade(route, new TokenAmount(tradeableToken, balance), TradeType.EXACT_INPUT);
  const slippageTolerance = new Percent('75', '10000'); // 75 bips, or 0.75%
  console.log('Execute Price: ', trade.executionPrice.toSignificant(6));
  console.log('Price After: ', trade.nextMidPrice.toSignificant(6)); // we can see what price we'll get after the trade

  // set up order details
  const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
  const amountOutMinHex = BigNumber.from(amountOutMin.toString()).toHexString(); // worst case scenario
  const path = [tradeableToken.address, weth.address];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const inputAmount = trade.inputAmount.raw;
  const inputAmountHex = BigNumber.from(inputAmount.toString()).toHexString(); // needs to be converted to e.g. hex
  console.log(inputAmount.toString());
  console.log(amountOutMin.toString());
  const gasPrice = await provider.getGasPrice();

  console.log(`Gas Price: ${gasPrice.toString()}`);
  // if (gasPrice > 250000000000) {
  //   console.log(`Nah it's too expensive`);
  // }

  // call a contract with order details
  const tx = await uniswap.swapExactTokensForETH(
    inputAmountHex,
    amountOutMinHex,
    path,
    wallet.address,
    deadline,
    {
      // value: inputAmountHex,
      gasPrice: gasPrice.toHexString(),
      gasLimit: BigNumber.from(160000).toHexString(),
    }
  );
  console.log(`Transaction Hash: ${tx.hash}`);

  // wait and profit
  const receipt = await tx.wait();
  console.log(`Transaction was minded in block ${receipt.blockNumber}`);

  return receipt.blockNumber;
}
