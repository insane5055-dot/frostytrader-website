const demoDatafeed = {

  onReady: (cb) => {
    cb({
      supported_resolutions: ["1", "5", "15"]
    });
  },

  resolveSymbol: (symbolName, onResolve) => {
    onResolve({
      name: symbolName,
      type: "index",
      session: "0915-1530",
      timezone: "Asia/Kolkata",
      minmov: 1,
      pricescale: 1,
      has_intraday: true,
      supported_resolutions: ["1", "5", "15"],
      volume_precision: 2
    });
  },

  getBars: (symbolInfo, resolution, from, to, onHistoryCallback) => {

    let bars = [];
    let time = from * 1000;

    for (let i = 0; i < 300; i++) {
      let open = 22000 + Math.random() * 50;
      let close = open + (Math.random() - 0.5) * 30;

      bars.push({
        time: time,
        open: open,
        high: Math.max(open, close) + 10,
        low: Math.min(open, close) - 10,
        close: close,
        volume: Math.floor(Math.random() * 1000)
      });

      time += 60 * 1000; // 1 minute
    }

    onHistoryCallback(bars, { noData: false });
  },

  subscribeBars: () => {},
  unsubscribeBars: () => {}
};

