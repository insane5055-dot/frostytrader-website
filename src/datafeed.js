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

    onReady: (callback) => {

        console.log("✅ Datafeed Ready");

        setTimeout(() => {

            callback({

                supported_resolutions: [

                    "1",
                    "5",
                    "15",
                    "30",
                    "60"
                ],

                exchanges: [

                    {
                        value: "NSE",
                        name: "NSE",
                        desc: "National Stock Exchange"
                    },

                    {
                        value: "BSE",
                        name: "BSE",
                        desc: "Bombay Stock Exchange"
                    }
                ],

                symbols_types: [

                    {
                        name: "stock",
                        value: "stock"
                    },

                    {
                        name: "index",
                        value: "index"
                    },

                    {
                        name: "futures",
                        value: "futures"
                    },

                    {
                        name: "option",
                        value: "option"
                    }
                ]
            });

        }, 0);
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

                const response = await fetch(

                    `${BASE_URL}/search?q=${encodeURIComponent(userInput)}`
                );

                const data = await response.json();

                if (searchId !== lastSearchId) {
                    return;
                }

                console.log("✅ Search Results:", data);

                onResultReadyCallback(data);

            } catch (err) {

                console.error("❌ Search Error:", err);

                onResultReadyCallback([]);
            }

        }, 300);
    },

    // =====================================================
    // RESOLVE SYMBOL
    // =====================================================

    resolveSymbol: async (

        symbolName,
        onSymbolResolvedCallback,
        onResolveErrorCallback

    ) => {

        try {

            console.log("📌 Resolving Symbol:", symbolName);

            const response = await fetch(

                `${BASE_URL}/resolve?symbol=${encodeURIComponent(symbolName)}`
            );

            const data = await response.json();

            console.log("✅ Resolve Response:", data);

            if (data.error) {

                onResolveErrorCallback(data.error);

                return;
            }

            const symbolInfo = {

                ticker: data.ticker,

                name: data.name,

                description: data.description,

                type: data.type,

                session: data.session,

                timezone: data.timezone,

                exchange: data.exchange,

                minmov: data.minmov,

                pricescale: data.pricescale,

                has_intraday: true,

                has_daily: true,

                has_weekly_and_monthly: true,

                supported_resolutions:
                data.supported_resolutions,

                volume_precision:
                data.volume_precision,

                data_status:
                "streaming",

                // =============================================
                // CUSTOM
                // =============================================

                security_id:
                data.security_id,

                instrument:
                data.instrument,

                exchange_segment:
                data.exchange_segment
            };

            onSymbolResolvedCallback(symbolInfo);

        } catch (err) {

            console.error("❌ Resolve Error:", err);

            onResolveErrorCallback("Cannot resolve symbol");
        }
    },

    // =====================================================
    // GET BARS
    // =====================================================

    getBars: async (

        symbolInfo,
        resolution,
        periodParams,
        onHistoryCallback,
        onErrorCallback

    ) => {

        try {

            console.log("📚 Loading History...");

            const from = periodParams.from;
            const to = periodParams.to;

            const url =

                `${BASE_URL}/history` +

                `?security_id=${symbolInfo.security_id}` +

                `&exchange=${symbolInfo.exchange_segment}` +

                `&instrument=${symbolInfo.instrument}` +

                `&resolution=${resolution}` +

                `&from=${from}` +

                `&to=${to}`;

            console.log("🌐 HISTORY URL:", url);

            const response = await fetch(url);

            const data = await response.json();

            console.log("📦 History Response:", data);

            // =================================================
            // NO DATA
            // =================================================

            if (

                !data ||
                data.s !== "ok" ||
                !data.t ||
                data.t.length === 0

            ) {

                console.log("⚠️ NO DATA FOUND");

                onHistoryCallback([], {
                    noData: true
                });

                return;
            }

            // =================================================
            // FORMAT BARS
            // =================================================

            const bars = [];

            for (let i = 0; i < data.t.length; i++) {

                bars.push({

                    time:
                    data.t[i] * 1000,

                    open:
                    Number(data.o[i]),

                    high:
                    Number(data.h[i]),

                    low:
                    Number(data.l[i]),

                    close:
                    Number(data.c[i]),

                    volume:
                    Number(data.v[i] || 0)
                });
            }

            console.log("✅ Bars Loaded:", bars.length);

            onHistoryCallback(

                bars,

                {
                    noData: false
                }
            );

        } catch (err) {

            console.error("❌ getBars Error:", err);

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
        subscriberUID,
        onResetCacheNeededCallback

    ) => {

        console.log("📡 subscribeBars:", symbolInfo.name);

        currentCallback = onRealtimeCallback;

        // =================================================
        // REUSE SOCKET
        // =================================================

        if (socket && socket.connected) {

            console.log("♻️ Reusing Existing Socket");

            return;
        }

        // =================================================
        // CLEANUP OLD SOCKET
        // =================================================

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

            reconnectionAttempts: 10,

            reconnectionDelay: 2000,

            timeout: 20000,

            forceNew: true
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

            console.log("⚠️ Socket Error:", err.message);
        });

        // =================================================
        // LIVE CANDLE
        // =================================================

        socket.on("candle", (candle) => {

            if (!currentCallback) {
                return;
            }

            // console.log("📊 LIVE:", candle);

            currentCallback({

                time:
                candle.minute * 60 * 1000,

                open:
                candle.open,

                high:
                candle.high,

                low:
                candle.low,

                close:
                candle.close,

                volume:
                candle.volume || 0
            });
        });
    },

    // =====================================================
    // UNSUBSCRIBE
    // =====================================================

    unsubscribeBars: (subscriberUID) => {

        console.log("🛑 unsubscribeBars:", subscriberUID);

        currentCallback = null;
    }
};

// =========================================================
// EXPORT
// =========================================================

export default Datafeed;
