const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/webhooks", (req, res) => {
  res.send(req);
});

app.listen(process.env.PORT || 5000);
