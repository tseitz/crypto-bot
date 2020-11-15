import express from 'express';
const Kraken = require('kraken-wrapper'); // no d.ts file... gotta figure out heroku deploy
import Order from './models/Order';
import { KrakenOpenPosition } from './models/KrakenOpenPosition';
// const Binance = require("node-binance-api");
// const config = require("./config");

const PORT = process.env.PORT || 3000;

const app = express();

// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_SECRET_KEY,
// });

const kraken = new Kraken(process.env.KRAKEN_API_KEY, process.env.KRAKEN_SECRET_KEY);

// create application/json parser
const jsonParser = express.json();
app.use(jsonParser);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/webhook/trading-view', jsonParser, async (req, res) => {
  // force body to be JSON
  const body = JSON.parse(JSON.stringify(req.body));
  if (!body || body.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here');
    return res.sendStatus(401);
  }

  // ignore close signal for now. We will handle this ourselves in one order
  if (body.strategy.description.toLowerCase().includes('close')) {
    return res.sendStatus(200);
  }

  // Kraken uses XBT instead of BTC. I use binance for most webhooks since there is more volume
  const tradingViewTicker = body.ticker;
  const switchPair = /BTC/.test(tradingViewTicker);
  const krakenTicker = switchPair ? tradingViewTicker.replace('BTC', 'XBT') : tradingViewTicker;

  // get pair data (used for orderMin, decimal info)
  const { error: krakenPairError, result: krakenPairResult } = await kraken.getTradableAssetPairs({
    pair: krakenTicker,
  });

  if (krakenPairError.length > 0) {
    console.log(`Pair data for ${krakenTicker} not available on Kraken`);
    return res.sendStatus(404);
  }

  // get pair price info for order
  const { result: priceInfo } = await kraken.getTickerInformation({
    pair: krakenTicker,
  });

  // btc price for calculations
  const { result: btcPriceInfo } = await kraken.getTickerInformation({ pair: 'XBTUSDT' });

  // set up the order
  const order = new Order(kraken, body, krakenPairResult, priceInfo, btcPriceInfo);

  console.log(
    `${order.krakenTicker} ${order.action.toUpperCase()} ${order.volume} ${order.baseOfPair} at ${
      order.currentBid
    } : $${order.usdOrderValue} at $${order.bidPriceInDollar.toFixed(2)}`
  );

  // close or open new order
  // if (order.close) {
  //   const closeOrderResult = await closeOrder(order);
  //   return res.send(closeOrderResult);
  // }

  const addOrderResult = await openOrder(order);
  return res.send(addOrderResult);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});

async function openOrder(order: Order) {
  let result;
  if (typeof order.leverageAmount === 'undefined') {
    result = await handleNonLeveragedOrder(order);
  } else {
    result = await handleLeveragedOrder(order);
  }

  console.log('Set Order Request: ', result);
  return result;
}

// async function closeOrder(order: Order) {
//   let result;
//   if (typeof order.leverageAmount === 'undefined') {
//     result = await handleNonLeveragedOrder(order);
//   } else {
//     result = await settleLeveragedOrder(order);
//   }

//   console.log('Closing Request: ', result);
//   return result;
// }

async function settleLeveragedOrder(order: Order, position: KrakenOpenPosition) {
  const closeAction = position.type === 'sell' ? 'buy' : 'sell';
  return await kraken.setAddOrder({
    pair: order.krakenTicker,
    type: closeAction,
    ordertype: 'limit',
    price: order.currentAsk,
    volume: position.vol, // only close current volume. 0 for close all
    leverage: order.leverageAmount,
    // validate: true,
  });
}

async function handleLeveragedOrder(order: Order, closeOpenPositions = true) {
  // TODO: pass this along in the request body. Sometimes we don't want to close positions first
  if (closeOpenPositions) {
    const { error, result: openPositions } = await kraken.getOpenPositions();

    // close out positons first
    for (const key in openPositions) {
      const position = openPositions[key];
      if (position.pair === order.krakenTicker) {
        const { result } = await settleLeveragedOrder(order, position);
        console.log(result);
      }
    }
  }

  return await kraken.setAddOrder({
    pair: order.krakenTicker,
    type: order.action,
    ordertype: 'stop-loss',
    price: order.stopLoss,
    // price2: currentBid,
    volume: order.volume,
    leverage: order.leverageAmount,
    // validate: true,
  });
}

async function handleNonLeveragedOrder(order: Order) {
  const { error: balanceError, result: balanceResult } = await kraken.getBalance();
  const pairBalance = balanceResult[order.baseOfPair];

  if (order.action === 'sell') {
    // sell off current balance, we cannot short so stop there
    return await kraken.setAddOrder({
      pair: order.krakenTicker,
      type: order.action,
      ordertype: 'limit',
      volume: pairBalance,
      price: order.currentAsk,
      // validate: true,
    });
  } else {
    return await kraken.setAddOrder({
      pair: order.krakenTicker,
      type: order.action,
      ordertype: 'stop-loss',
      price: order.stopLoss,
      // price2: currentBid,
      volume: order.volume,
      // validate: true,
    });
  }
}
