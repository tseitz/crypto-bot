import websocket, json, pprint

SOCKET = "wss://stream.binance.com:9443/ws/ethusdt@kline_1m"


def on_open(ws):
    print("opened connection")


def on_close(ws):
    print("closed connection")


def on_message(ws, message):
    json_message = json.loads(message)
    pprint.pprint(json_message)

    candle = json_message["k"]

    is_candle_closed = candle["x"]  # if x is true, it's closed

    close = candle["c"]

    if is_candle_closed:
        print(f"candle closed at {close}")


ws = websocket.WebSocketApp(SOCKET, on_open=on_open, on_close=on_close, on_message=on_message)
ws.run_forever()