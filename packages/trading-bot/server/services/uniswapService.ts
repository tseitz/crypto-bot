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

const chainId = ChainId.MAINNET;
// const tokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // dai
const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18);

// Use the mainnet
const network = 'homestead';

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

console.log(process.env);
console.log(provider);

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
  const to = ''; // my address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  const value = trade.inputAmount.raw; // needs to be converted to e.g. hex

  // call a contract with order details

  return pair;
}

// async function getDecimals(chainId: ChainId, tokenAddress: string): Promise<number> {
//   // implementation details
// }
