const express = require('express');
var bodyParser = require('body-parser');
const Kraken = require('kraken-wrapper');
// const Binance = require("node-binance-api");
// const config = require("./config");

const PORT = process.env.PORT || 3000;

const app = express();

// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_SECRET_KEY,
// });

const kraken = new Kraken(process.env.KRAKEN_API_KEY, process.env.KRAKEN_SECRET_KEY);

const stopPerc = 12; // for now

// create application/json parser
const jsonParser = bodyParser.json();
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

  // grab data from the body
  let { action, description } = body.strategy;
  const tradingViewTicker = body.ticker;

  // Kraken uses XBT instead of BTC. I use binance for most webhooks since there is more volume
  const switchPair = /BTC/.test(tradingViewTicker);
  const krakenTicker = switchPair ? tradingViewTicker.replace('BTC', 'XBT') : tradingViewTicker;

  // stopped out. this is handled by config currently
  if (description && description.includes('stop')) {
    console.log('Stopped out handled by Kraken now');
    return res.sendStatus(200);
  }

  // get pair data (used for orderMin, decimal info)
  const { error: krakenPairError, result: krakenPairResult } = await kraken.getTradableAssetPairs({
    pair: krakenTicker,
  });

  if (krakenPairError.length > 0) {
    console.log(`Pair data for ${krakenTicker} not available on Kraken`);
    res.sendStatus(401);
    return;
  }

  // const order = new Order(body, krakenPairResult)

  // Sometimes the kraken name is not what I receive from TradingView
  const krakenPair = Object.keys(krakenPairResult)[0];
  const orderMin = parseInt(krakenPairResult[krakenPair]['ordermin']);
  const baseOfPair = krakenPairResult[krakenPair]['base'];
  const leverageBuy = krakenPairResult[krakenPair]['leverage_buy'];
  const leverageSell = krakenPairResult[krakenPair]['leverage_sell'];
  const leverageBuyAmount = leverageBuy[0]; // leverageBuy.length - 1
  const leverageSellAmount = leverageSell[0]; // leverageSell.length - 1
  const leverageAmount = action === 'sell' ? leverageSellAmount : leverageBuyAmount;
  const decimals = krakenPairResult[krakenPair]['pair_decimals'];

  const { result: priceInfo } = await kraken.getTickerInformation({
    pair: krakenPair,
  });
  const currentBid = priceInfo[krakenPair]['b'][0];
  // const currentPrice = priceInfo[krakenPair]["c"][0];

  // if btc pair, convert to dollar (to pay $10 for now)
  // if usdt pair, keep dollar price
  const btcPair = /XBT$/.test(krakenPair); // bitcoin pair, not XBTUSDT
  let myBidPriceInDollar;
  if (btcPair) {
    const { result } = await kraken.getTickerInformation({ pair: 'XBTUSDT' });
    const btcPrice = result['XBTUSDT']['c'][0];
    console.log(`Current BTC Price: ${btcPrice}`);
    myBidPriceInDollar = btcPrice * currentBid;
  } else {
    myBidPriceInDollar = currentBid;
  }

  // let's risk $40 for now
  let volume = Number.parseFloat((40 / myBidPriceInDollar).toFixed(parseInt(decimals)));
  volume = volume > orderMin ? volume : orderMin;

  const usdOrderValue = (myBidPriceInDollar * volume).toFixed(2); // total value bought
  console.log(
    `${krakenPair} ${action.toUpperCase()} ${volume} ${baseOfPair} at ${currentBid} : $${usdOrderValue} at $${Number.parseFloat(
      myBidPriceInDollar
    ).toFixed(2)}`
  );

  if (description.includes('Close')) {
    res.send(await closeOrder(krakenPair, baseOfPair, action, leverageAmount));
  }

  return res.send(
    await openOrder(krakenPair, baseOfPair, action, volume, currentBid, decimals, leverageAmount)
  );
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});

async function handleLeveragedOrder(pair, action, settle, volume, currentBid, decimals, leverage) {
  if (settle) {
    return await kraken.setAddOrder({
      pair,
      type: action,
      ordertype: 'market',
      volume: 0,
      leverage,
      // validate: true,
    });
  } else {
    const stopLoss =
      action === 'sell' ? currentBid * (1 + stopPerc / 100) : currentBid * (1 - stopPerc / 100); // config[krakenPair].longStop
    const btcPair = /XBT$/.test(pair);
    const { error, result: openPositions } = await kraken.getOpenPositions();

    // close out positons first
    for (const key in openPositions) {
      if (openPositions[key].pair === pair) {
        const { result } = await handleLeveragedOrder(
          pair,
          'buy',
          true,
          currentBid,
          decimals,
          leverage
        );
        console.log(result);
        break; // settles all so get out
      }
    }

    return await kraken.setAddOrder({
      pair,
      type: action,
      ordertype: 'stop-loss',
      price: btcPair ? stopLoss.toFixed(decimals) : stopLoss.toFixed(1),
      // price2: currentBid,
      volume,
      leverage,
      // validate: true,
    });
  }
}

async function handleNonLeveragedOrder(pair, baseOfPair, action, volume, currentBid, decimals) {
  const { error: balanceError, result: balanceResult } = await kraken.getBalance();

  if (action === 'sell') {
    // something something check if balance is enough to sell
    return await kraken.setAddOrder({
      pair,
      type: action,
      ordertype: 'market',
      volume: balanceResult[baseOfPair],
      // validate: true,
    });
  } else {
    const stopLoss = currentBid * (1 - stopPerc / 100); // config[krakenPair].longStop
    const btcPair = /XBT$/.test(pair);

    return await kraken.setAddOrder({
      pair,
      type: action,
      ordertype: 'stop-loss',
      price: btcPair ? stopLoss.toFixed(decimals) : stopLoss.toFixed(1),
      // price2: currentBid,
      volume,
      // validate: true,
    });
  }
}

async function closeOrder(krakenPair, baseOfPair, action, leverageAmount) {
  let result;
  if (!leverageAmount) {
    result = await handleNonLeveragedOrder(krakenPair, baseOfPair, action);
  } else {
    result = await handleLeveragedOrder(krakenPair, action, true, leverageAmount);
  }

  console.log('Closing Request: ', result);
  return result;
}

async function openOrder(pair, baseOfPair, action, volume, currentBid, decimals, leverageAmount) {
  let result;
  if (!leverageAmount) {
    result = await handleNonLeveragedOrder(pair, baseOfPair, action, volume, currentBid, decimals);
  } else {
    result = await handleLeveragedOrder(
      pair,
      action,
      false,
      volume,
      currentBid,
      decimals,
      leverageAmount
    );
  }

  console.log('Set Order Request: ', result);
  return result;
}
