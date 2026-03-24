import Datafeed from "./datafeed.js";

window.addEventListener("DOMContentLoaded", () => {

  const widget = new TradingView.widget({
    container_id: "tv_chart_container",

    // 🔥 DEFAULT OPENING SYMBOL
    symbol: "NIFTY",

    interval: "1",
    timezone: "Asia/Kolkata",

    datafeed: Datafeed,
    library_path: "/charting_library/",

    locale: "en",
    autosize: true,

    disabled_features: [
        "use_localstorage_for_settings"
    ],

    enabled_features: [
        "study_templates"
    ]
});

  widget.onChartReady(() => {
    const chart = widget.chart();

    // 🔥 Timeframe change smooth fix
    chart.onIntervalChanged().subscribe(null, () => {
      setTimeout(() => {
        chart.executeActionById("chartAutoScale");
        chart.executeActionById("chartReset");
      }, 50);
    });
  });

});
