// =========================================================
// GLOBALS
// =========================================================

let searchTimeout = null;

let lastSearchId = 0;

// =========================================================
// BACKEND URL
// =========================================================

const BASE_URL =
    "https://frosty-backend-4mox.onrender.com";

// =========================================================
// SOCKET
// =========================================================

let socket = null;

let currentCallback = null;

// =========================================================
// LAST BAR CACHE
// =========================================================

let lastBar = null;

// =========================================================
// DATAFEED
// =========================================================

const Datafeed = {

    // =====================================================
    // ON READY
    // =====================================================

    onReady: (cb) => {

        console.log("✅ Datafeed Ready");

        setTimeout(() => {

            cb({

                supported_resolutions: [

                    "1",

                    "5",

                    "15"
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

                console.log(
                    "🔍 Searching:",
                    userInput
                );

                const res = await fetch(

                    `${BASE_URL}/search?q=${encodeURIComponent(userInput)}`
                );

                const data = await res.json();

                if (searchId !== lastSearchId) {

                    return;
                }

                console.log(
                    "✅ Search Results:",
                    data
                );

                onResultReadyCallback(data);

            } catch (err) {

                console.error(
                    "❌ Search error:",
                    err
                );

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

            console.log(
                "📌 Resolving:",
                symbolName
            );

            const res = await fetch(

                `${BASE_URL}/resolve?symbol=${encodeURIComponent(symbolName)}`
            );

            const data = await res.json();

            console.log(
                "✅ Resolve Data:",
                data
            );

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

                supported_resolutions:
                    data.supported_resolutions,

                volume_precision: 2,

                data_status: "streaming",

                security_id: data.security_id,

                instrument: data.instrument,

                exchange_segment:
                    data.exchange_segment
            });

        } catch (err) {

            console.error(
                "❌ Resolve error:",
                err
            );

            onError("Resolve error");
        }
    },

    // =====================================================
    // GET HISTORY
    // =====================================================

    getBars: async (

        symbolInfo,

        resolution,

        periodParams,

        onHistoryCallback,

        onErrorCallback

    ) => {

        try {

            console.log(
                "📚 Loading history..."
            );

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

            console.log(
                "📦 History Response:",
                data
            );

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

            // =================================================
            // SAVE LAST BAR
            // =================================================

            if (bars.length > 0) {

                lastBar =
                    bars[bars.length - 1];
            }

            console.log(
                "✅ Bars Loaded:",
                bars.length
            );

            onHistoryCallback(bars, {

                noData: false
            });

        } catch (err) {

            console.error(
                "❌ History error:",
                err
            );

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

        console.log(
            "📡 subscribeBars:",
            symbolInfo.name
        );

        currentCallback =
            onRealtimeCallback;

        // =================================================
        // CLEAN OLD SOCKET
        // =================================================

        if (socket) {

            console.log(
                "♻️ Closing old socket"
            );

            socket.disconnect();

            socket = null;
        }

        // =================================================
        // CONNECT SOCKET
        // =================================================

        socket = io(BASE_URL, {

            transports: [

                "polling",

                "websocket"
            ],

            upgrade: true,

            reconnection: true,

            reconnectionAttempts: Infinity,

            reconnectionDelay: 2000,

            reconnectionDelayMax: 5000,

            timeout: 20000,

            forceNew: true
        });

        // =================================================
        // CONNECT
        // =================================================

        socket.on("connect", () => {

            console.log(
                "✅ WebSocket Connected"
            );
        });

        // =================================================
        // DISCONNECT
        // =================================================

        socket.on("disconnect", (reason) => {

            console.log(
                "❌ Socket Disconnected:",
                reason
            );
        });

        // =================================================
        // CONNECT ERROR
        // =================================================

        socket.on("connect_error", (err) => {

            console.log(
                "⚠️ WS Error:",
                err.message
            );
        });

        // =================================================
        // RECONNECT
        // =================================================

        socket.on("reconnect", (attempt) => {

            console.log(
                "🔄 Reconnected:",
                attempt
            );
        });

        // =================================================
        // MARKET DATA
        // =================================================

        socket.on("market_data", (data) => {

            try {

                if (!currentCallback) {

                    return;
                }

                // =============================================
                // UPDATE EMA VALUES
                // =============================================

                if (

                    window.updateEMAValues

                ) {

                    window.updateEMAValues(

                        data.ema20,

                        data.ema50
                    );
                }

                // =============================================
                // REALTIME BAR
                // =============================================

                const bar = {

                    time:
                        data.minute * 60 * 1000,

                    open: data.open,

                    high: data.high,

                    low: data.low,

                    close: data.close,

                    volume: data.volume
                };

                // =============================================
                // SAVE LAST BAR
                // =============================================

                lastBar = bar;

                // =============================================
                // SEND TO TRADINGVIEW
                // =============================================

                currentCallback(bar);

            } catch (e) {

                console.log(
                    "❌ MARKET DATA ERROR:",
                    e
                );
            }
        });
    },

    // =====================================================
    // UNSUBSCRIBE
    // =====================================================

    unsubscribeBars: (

        subscriberUID

    ) => {

        console.log(
            "🛑 unsubscribeBars"
        );

        currentCallback = null;

        if (socket) {

            socket.disconnect();

            socket = null;
        }
    }
};

// =========================================================
// EXPORT
// =========================================================

export default Datafeed;
