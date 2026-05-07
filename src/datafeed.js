// =========================================================
// GLOBALS
// =========================================================

let searchTimeout = null;
let lastSearchId = 0;

// =========================================================
// BACKEND URL
// =========================================================

const BASE_URL = "https://frosty-backend-4mox.onrender.com";

// =========================================================
// SOCKET
// =========================================================

let socket = null;
let currentCallback = null;

// =========================================================
// DATAFEED
// =========================================================

const Datafeed = {

    // =====================================================
    // ON READY
    // =====================================================

    onReady: (cb) => {

        console.log("✅ Datafeed Ready");

        cb({
            supported_resolutions: ["1", "5", "15"]
        });
    },

    // =====================================================
    // SEARCH SYMBOLS
    // =====================================================

    searchSymbols: (
        userInput,
        exchange,
        symbolType,
        onResultReadyCallback
    ) => {

        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(async () => {

            const searchId = ++lastSearchId;

            try {

                console.log("🔍 Searching:", userInput);

                const res = await fetch(
                    `${BASE_URL}/search?q=${encodeURIComponent(userInput)}`
                );

                const data = await res.json();

                if (searchId !== lastSearchId) {
                    return;
                }

                console.log("✅ Search Results:", data);

                onResultReadyCallback(data);

            } catch (err) {

                console.error("❌ Search error:", err);

                onResultReadyCallback([]);
            }

        }, 300);
    },

    // =====================================================
    // RESOLVE SYMBOL
    // =====================================================

    resolveSymbol: async (
        symbolName,
        onResolve,
        onError
    ) => {

        try {

            console.log("📌 Resolving:", symbolName);

            const res = await fetch(
                `${BASE_URL}/resolve?symbol=${encodeURIComponent(symbolName)}`
            );

            const data = await res.json();

            console.log("✅ Resolve Data:", data);

            if (data.error) {

                onError(data.error);

                return;
            }

            onResolve({

                name: data.name,

                ticker: data.ticker,

                description: data.description,

                type: data.type.toLowerCase(),

                session: data.session,

                timezone: data.timezone,

                exchange: data.exchange,

                minmov: data.minmov,

                pricescale: data.pricescale,

                has_intraday: true,

                has_daily: true,

                has_weekly_and_monthly: true,

                supported_resolutions: data.supported_resolutions,

                volume_precision: 2,

                data_status: "streaming",

                security_id: data.security_id,

                instrument: data.instrument,

                exchange_segment: data.exchange_segment
            });

        } catch (err) {

            console.error("❌ Resolve error:", err);

            onError("Resolve error");
        }
    },

    // =====================================================
    // HISTORY
    // =====================================================

    getBars: async (
        symbolInfo,
        resolution,
        periodParams,
        onHistoryCallback,
        onErrorCallback
    ) => {

        try {

            console.log("📚 Loading history...");

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

            console.log("📦 History Response:", data);

            if (data.s !== "ok") {

                onHistoryCallback([], {
                    noData: true
                });

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

            console.log("✅ Bars Loaded:", bars.length);

            onHistoryCallback(bars, {
                noData: false
            });

        } catch (err) {

            console.error("❌ History error:", err);

            onErrorCallback(err);
        }
    },

    // =====================================================
    // SUBSCRIBE BARS
    // =====================================================

    subscribeBars: (
        symbolInfo,
        resolution,
        onRealtimeCallback,
        subscriberUID
    ) => {

        console.log("📡 subscribeBars:", symbolInfo.name);

        // update callback
        currentCallback = onRealtimeCallback;

        // reuse existing socket
        if (socket && socket.connected) {

            console.log("♻️ Reusing existing socket");

            return;
        }

        // cleanup old socket
        if (socket) {

            socket.disconnect();

            socket = null;
        }

        // =================================================
        // CONNECT SOCKET
        // =================================================

        socket = io(BASE_URL, {

            transports: ["websocket"],

            reconnection: true,

            reconnectionAttempts: 5,

            reconnectionDelay: 3000,

            timeout: 20000,

            forceNew: false
        });

        // =================================================
        // CONNECT
        // =================================================

        socket.on("connect", () => {

            console.log("✅ WebSocket Connected");
        });

        // =================================================
        // DISCONNECT
        // =================================================

        socket.on("disconnect", (reason) => {

            console.log("❌ Socket Disconnected:", reason);
        });

        // =================================================
        // ERROR
        // =================================================

        socket.on("connect_error", (err) => {

            console.log("⚠️ WS Error:", err.message);
        });

        // =================================================
        // LIVE CANDLE
        // =================================================

        socket.on("candle", (candle) => {

            // console.log("📊 Live Candle:", candle);

            if (!currentCallback) {
                return;
            }

            currentCallback({

                time: candle.minute * 60 * 1000,

                open: candle.open,

                high: candle.high,

                low: candle.low,

                close: candle.close,

                volume: candle.volume
            });
        });
    },

    // =====================================================
    // UNSUBSCRIBE
    // =====================================================

    unsubscribeBars: () => {

        console.log("🛑 unsubscribeBars");

        currentCallback = null;
    }
};

// =========================================================
// EXPORT
// =========================================================

export default Datafeed;
