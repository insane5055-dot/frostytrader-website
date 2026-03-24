// 🔥 MUST BE OUTSIDE OBJECT
let searchTimeout = null;
let lastSearchId = 0;

// 👉 BACKEND URL
const BASE_URL = "https://frosty-backend-4mox.onrender.com";

let socket = null;

const Datafeed = {

  onReady: (cb) => {
    cb({
      supported_resolutions: ["1", "5", "15"]
    });
  },

  // 🔥 SEARCH
  searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {

      const searchId = ++lastSearchId;

      try {
        const res = await fetch(
          `${BASE_URL}/search?q=${encodeURIComponent(userInput)}`
        );

        const data = await res.json();

        if (searchId !== lastSearchId) return;

        onResultReadyCallback(data);

      } catch (err) {
        console.error("Search error:", err);
        onResultReadyCallback([]);
      }

    }, 300);
  },

  // 🔥 RESOLVE
  resolveSymbol: async (symbolName, onResolve, onError) => {
    try {
      const res = await fetch(
        `${BASE_URL}/resolve?symbol=${encodeURIComponent(symbolName)}`
      );

      const data = await res.json();

      if (data.error) {
        onError(data.error);
        return;
      }

      onResolve({
        name: data.name,
        ticker: data.ticker,
        description: data.description,
        type: data.type.toLowerCase(),
        exchange: data.exchange,
        session: data.session,
        timezone: data.timezone,
        minmov: data.minmov,
        pricescale: data.pricescale,
        has_intraday: true,
        supported_resolutions: data.supported_resolutions,
        data_status: "streaming",
        security_id: data.security_id,
        instrument: data.instrument,
        exchange_segment: data.exchange_segment
      });

    } catch (err) {
      console.error("Resolve error:", err);
      onError("Resolve error");
    }
  },

  // 🔥 HISTORY
  getBars: async (symbolInfo, resolution, periodParams, onHistory, onError) => {
    try {
      const { from, to } = periodParams;

      const url =
        `${BASE_URL}/history` +
        `?security_id=${symbolInfo.security_id}` +
        `&exchange=${symbolInfo.exchange_segment}` +
        `&instrument=${symbolInfo.instrument}` +
        `&resolution=${resolution}` +
        `&from=${from}` +
        `&to=${to}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.s !== "ok") {
        onHistory([], { noData: true });
        return;
      }

      const bars = data.t.map((t, i) => ({
        time: t * 1000,
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i]
      }));

      onHistory(bars, { noData: false });

    } catch (err) {
      console.error("History error:", err);
      onError("History error");
    }
  },

  // 🔥 REAL-TIME (MAIN MAGIC)
  subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID) => {

    socket = io(BASE_URL);

    socket.on("connect", () => {
      console.log("✅ WebSocket Connected");
    });

    socket.on("candle", (candle) => {
      console.log("📊 Live Candle:", candle);

      onRealtimeCallback({
        time: candle.minute * 60 * 1000,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      });
    });

  },

  unsubscribeBars: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      console.log("❌ WebSocket Disconnected");
    }
  }
};

export default Datafeed;
