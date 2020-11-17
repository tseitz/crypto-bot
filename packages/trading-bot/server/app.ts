import express from 'express';
const Kraken = require('kraken-wrapper'); // no d.ts file... gotta figure out heroku deploy
import Order from './models/Order';
import { KrakenService } from './services/krakenService';
// const Binance = require("node-binance-api");
// const config = require("./config");

const PORT = process.env.PORT || 3000;

const app = express();

// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_SECRET_KEY,
// });

const krakenApi = new Kraken(process.env.KRAKEN_API_KEY, process.env.KRAKEN_SECRET_KEY);
const kraken = new KrakenService(krakenApi);

// create application/json parser
const jsonParser = express.json();
app.use(jsonParser);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/webhook/trading-view', jsonParser, async (req, res) => {
  // force body to be JSON
  const requestBody = JSON.parse(JSON.stringify(req.body));
  if (!requestBody || requestBody.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here');
    return res.sendStatus(401);
  }

  // ignore close signal for now. Our current strategy flips the order so we handle it below
  // allow to "close only" though, meaning exit current trade without entering a new one
  const description = requestBody.strategy.description.toLowerCase();
  if (description.includes('close') && !description.includes('close only')) {
    return res.sendStatus(200);
  }

  // Kraken uses XBT instead of BTC. Uniswap uses WETH instead of ETH
  // I use binance/uniswap for most webhooks since there is more volume
  const tradingViewTicker = requestBody.ticker;
  const krakenTicker = tradingViewTicker.replace('BTC', 'XBT').replace('WETH', 'ETH');

  // get pair data
  const { pairError, pairData } = await kraken.getPair(krakenTicker);
  if (pairError.length > 0) {
    console.log(`Pair data for ${krakenTicker} not available on Kraken`);
    return res.sendStatus(404);
  }

  // get pair price info for order
  const { priceError, priceData } = await kraken.getPrice(krakenTicker);
  if (priceError.length > 0) {
    console.log(`Price info for ${krakenTicker} not available on Kraken`);
    return res.sendStatus(404);
  }

  // btc or eth price for calculations (we're currently placing orders in fixed USD amount)
  const assetClass = krakenTicker.includes('XBT') ? 'XBTUSDT' : 'ETHUSDT';
  const { priceError: assetClassError, priceData: assetClassData } = await kraken.getPrice(
    assetClass
  );
  if (assetClassError.length > 0) {
    console.log(`Asset Class Price info for ${krakenTicker} not available on Kraken`);
    return res.sendStatus(404);
  }

  // set up the order
  const order = new Order(requestBody, pairData, priceData, assetClassData);

  // execute the order
  if (order.closeOnly) {
    const closeOrderResult = await kraken.handleLeveragedOrder(order, true, true);
    return res.send(closeOrderResult);
  }

  return res.send(await kraken.openOrder(order));
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});
