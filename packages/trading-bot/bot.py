import websocket, json, pprint, numpy
from talib import RSI

# from binance.client import Client
# from binanace.enums import *

SOCKET = "wss://stream.binance.com:9443/ws/ethusdt@kline_1m"

RSI_PERIOD = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30
TRADE_SYMBOL = 'ETHUSD'
TRADE_QUANTITY = .05

closes = []

# client = Client(process.env.API_KEY, process.env.API_SECRET, tld='us')

def on_open(ws):
    print("opened connection")


def on_close(ws):
    print("closed connection")


def on_message(ws, message):
    json_message = json.loads(message)
    # pprint.pprint(json_message)

    candle = json_message["k"]

    is_candle_closed = candle["x"]  # if x is true, it's closed

    close = candle["c"]

    if is_candle_closed:
        print(f"candle closed at {close}")
        closes.append(float(close))
        print(closes)

        if len(closes) > RSI_PERIOD:
            np_closes = numpy.array(closes)
            rsi = RSI(np_closes, RSI_PERIOD)
            print(rsi)


ws = websocket.WebSocketApp(SOCKET, on_open=on_open, on_close=on_close, on_message=on_message)
ws.run_forever()