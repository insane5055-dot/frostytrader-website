// 🔥 MUST BE OUTSIDE OBJECT
let searchTimeout = null;
let lastSearchId = 0;

const Datafeed = {

  onReady: (cb) => {
    cb({
      supported_resolutions: ["1", "5", "15"]
    });
  },

  // 🔥 SMOOTH + DEBOUNCED SEARCH
  searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {

      const searchId = ++lastSearchId;

      try {
        const res = await fetch(
          `http://127.0.0.1:5000/search?q=${encodeURIComponent(userInput)}`
        );

        const data = await res.json();

        // 🔥 Prevent old responses overwriting new ones
        if (searchId !== lastSearchId) return;

        onResultReadyCallback(data);

      } catch (err) {
        onResultReadyCallback([]);
      }

    }, 300); // 300ms debounce
  },

  resolveSymbol: async (symbolName, onResolve, onError) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:5000/resolve?symbol=${encodeURIComponent(symbolName)}`
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
      onError("Resolve error");
    }
  },

  getBars: async (symbolInfo, resolution, periodParams, onHistory, onError) => {
    try {
      const { from, to } = periodParams;

      const url =
        `http://127.0.0.1:5000/history` +
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
      onError("History error");
    }
  },

  subscribeBars: () => {},
  unsubscribeBars: () => {}
};

export default Datafeed;
