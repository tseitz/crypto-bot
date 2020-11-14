import express from 'express';
// import Kraken from 'kraken-wrapper';
const Kraken = require('kraken-wrapper');
import Order from './models/Order';
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
    res.sendStatus(401);
    return;
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
  if (order.close) {
    const closeOrderResult = await closeOrder(order);
    return res.send(closeOrderResult);
  }

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

async function closeOrder(order: Order) {
  let result;
  if (typeof order.leverageAmount === 'undefined') {
    result = await handleNonLeveragedOrder(order);
  } else {
    result = await handleLeveragedOrder(order, true, true);
  }

  console.log('Closing Request: ', result);
  return result;
}

async function handleLeveragedOrder(order: Order, closeOpenPositions = true, settle?: boolean) {
  if (settle) {
    return await kraken.setAddOrder({
      pair: order.krakenTicker,
      type: order.action,
      ordertype: 'limit',
      price: order.currentAsk,
      volume: 0,
      leverage: order.leverageAmount,
      // validate: true,
    });
  } else {
    // TODO: pass this along in the request body. Sometimes we don't want to close positions first
    if (closeOpenPositions) {
      const { error, result: openPositions } = await kraken.getOpenPositions();

      // close out positons first
      for (const key in openPositions) {
        if (openPositions[key].pair === order.krakenTicker) {
          const { result } = await handleLeveragedOrder(order, true, true);
          console.log(result);
          break; // settles all so ignore the rest
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
}

async function handleNonLeveragedOrder(order: Order) {
  const { error: balanceError, result: balanceResult } = await kraken.getBalance();

  if (order.action === 'sell') {
    return await kraken.setAddOrder({
      pair: order.krakenTicker,
      type: order.action,
      ordertype: 'limit',
      volume: balanceResult[order.baseOfPair],
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
