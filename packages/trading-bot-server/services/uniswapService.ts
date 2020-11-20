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
import { ethers } from 'ethers';
import abis from '../abis/abis';

const chainId = ChainId.ROPSTEN;
// const tokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // dai
// const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18);
const DAI = new Token(ChainId.ROPSTEN, '0xad6d458402f60fd3bd25163575031acdce07538d', 18);

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
  console.log(route.midPrice.toSignificant(6));
  console.log(route.midPrice.invert().toSignificant(6));

  const trade = new Trade(
    route,
    new TokenAmount(WETHID, '1000000000000000000'),
    TradeType.EXACT_INPUT
  );

  console.log(trade.executionPrice.toSignificant(6));
  console.log(trade.nextMidPrice.toSignificant(6)); // we can see what price we'll get after the trade

  const slippageTolerance = new Percent('50', '10000'); // 50 bips, or 0.50%

  const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // worst case scenario
  const path = [WETHID.address, DAI.address];
  const to = '0x266d6Bc2262Cc2690Ef5C0313e7330995C15eEDb'; // my address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const value = trade.inputAmount.raw; // needs to be converted to e.g. hex
  console.log(value);

  // call a contract with order details
  // "inputs": [
  //   { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
  //   { "internalType": "address[]", "name": "path", "type": "address[]" },
  //   { "internalType": "address", "name": "to", "type": "address" },
  //   { "internalType": "uint256", "name": "deadline", "type": "uint256" }
  // ],
  const tx = await uniswap.swapExactETHForTokens(amountOutMin, path, to, deadline, {
    value,
    gasPrice: 20e9,
  });
  console.log(`Transaction Hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction was minded in block ${receipt.blockNumber}`);

  return pair;
}

// async function getDecimals(chainId: ChainId, tokenAddress: string): Promise<number> {
//   // implementation details
// }
