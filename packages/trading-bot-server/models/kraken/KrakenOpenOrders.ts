export interface OpenOrderResponse {
  open: {
    [index: string]: {
      cost: string;
      descr: OpenOrderDescription;
      expiretm: number;
      fee: string;
      limitprice: string;
      misc: string;
      oflags: string;
      opentm: number;
      price: string;
      refid: any; // came in as null, not sure
      starttm: number;
      status: string;
      stopprice: string;
      userref: number;
      vol: string;
      vol_exec: string;
    };
  };
}

interface OpenOrderDescription {
  close: string;
  leverage: string;
  order: string;
  ordertype: string;
  pair: string;
  price: string;
  price2: string;
  type: string;
}
