interface Strategy {
  type: string;
  tradeVolume: XEthLong | XEthShort;
}

interface XEthLong {
  volume: 50;
}

interface XEthShort {
  volume: 100;
}
