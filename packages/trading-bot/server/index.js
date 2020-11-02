const express = require("express");
var bodyParser = require("body-parser");
const PORT = process.env.PORT || 3000;

const app = express();

// create application/json parser
var jsonParser = bodyParser.json()

app.use(jsonParser)

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/webhook/trading-view", jsonParser, (req, res) => {
  if (req.body.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log("Hey buddy, get out of here");
    res.sendStatus(401);
    return;
  }
  res.send(req.body);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});
