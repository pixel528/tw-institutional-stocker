let ratioChart = null;
let useLogScale = false;
let marketFilter = "ALL";
let currentWindow = 20;

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return await resp.json();
}

function formatPct(x) {
  const v = Number.isFinite(x) ? x : 0;
  return v.toFixed(2);
}

function formatNumber(x) {
  const v = Number.isFinite(x) ? x : 0;
  return v.toLocaleString();
}

async function loadStock(code) {
  const status = document.getElementById("statusText");
  const title = document.getElementById("chartTitle");
  const btn = document.getElementById("loadBtn");

  code = (code || "").trim();
  if (!code) return;

  btn.disabled = true;
  status.textContent = `載入 ${code}...`;

  const showForeign = document.getElementById("showForeign").checked;
  const showTrust = document.getElementById("showTrust").checked;
  const showDealer = document.getElementById("showDealer").checked;
  const showTotal = document.getElementById("showTotal").checked;

  try {
    const data = await fetchJson(`data/timeseries/${code}.json`);
    if (!data.length) {
      status.textContent = `找不到 ${code} 資料`;
      btn.disabled = false;
      return;
    }

    const name = data[0].name || "";
    const market = data[0].market || "";
    title.textContent = `${code} ${name}（${market || "未知市場"}）三大法人持股比重`;

    const labels = data.map((d) => d.date);
    const foreignRatio = data.map((d) => d.foreign_ratio);
    const trustRatio = data.map((d) => d.trust_ratio);
    const dealerRatio = data.map((d) => d.dealer_ratio);
    const totalRatio = data.map((d) => d.three_inst_ratio);

    const datasets = [];
    if (showForeign) {
      datasets.push({
        label: "外資持股比重%",
        data: foreignRatio,
        borderWidth: 1.5,
        tension: 0.1,
      });
    }
    if (showTrust) {
      datasets.push({
        label: "投信持股估計%",
        data: trustRatio,
        borderWidth: 1.5,
        borderDash: [4, 3],
        tension: 0.1,
      });
    }
    if (showDealer) {
      datasets.push({
        label: "自營商持股估計%",
        data: dealerRatio,
        borderWidth: 1.5,
        borderDash: [2, 2],
        tension: 0.1,
      });
    }
    if (showTotal) {
      datasets.push({
        label: "三大法人合計持股估計%",
        data: totalRatio,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.15,
      });
    }

    const ctx = document.getElementById("ratioChart").getContext("2d");
    if (ratioChart) {
      ratioChart.destroy();
    }

    ratioChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 10,
            },
          },
          y: {
            type: useLogScale ? "logarithmic" : "linear",
            title: {
              display: true,
              text: "持股比重 (%)",
            },
            min: 0,
          },
        },
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });

    const last = data[data.length - 1];
    status.textContent = `最新日期 ${last.date} 三大法人持股約 ${formatPct(
      last.three_inst_ratio
    )}%`;
  } catch (err) {
    console.error(err);
    status.textContent = `載入失敗：${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

async function loadRanking() {
  const tbody = document.querySelector("#rankTable tbody");
  tbody.innerHTML = "";
  try {
    const up = await fetchJson(`data/top_three_inst_change_${currentWindow}_up.json`);
    const filtered = up.filter((row) => {
      if (marketFilter === "ALL") return true;
      return row.market === marketFilter;
    });
    filtered.slice(0, 50).forEach((row, idx) => {
      const tr = document.createElement("tr");

      const tdRank = document.createElement("td");
      tdRank.textContent = idx + 1;

      const tdStock = document.createElement("td");
      tdStock.innerHTML = `<span class="badge">${row.code}</span>${row.name || ""}`;

      const tdMkt = document.createElement("td");
      tdMkt.textContent = row.market || "";

      const tdNow = document.createElement("td");
      tdNow.textContent = formatPct(row.three_inst_ratio);

      const tdDelta = document.createElement("td");
      tdDelta.textContent = formatPct(row.change);

      tr.appendChild(tdRank);
      tr.appendChild(tdStock);
      tr.appendChild(tdMkt);
      tr.appendChild(tdNow);
      tr.appendChild(tdDelta);
      tbody.appendChild(tr);

      // 點擊列時載入該股票圖
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        const input = document.getElementById("stockInput");
        input.value = row.code;
        loadStock(row.code);
      });
    });
  } catch (err) {
    console.error(err);
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = `載入排名失敗：${err.message}`;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

// ========== Broker Functions ==========

async function loadBrokerRanking() {
  console.log("loadBrokerRanking called");
  const tbody = document.querySelector("#brokerRankTable tbody");

  if (!tbody) {
    console.error("brokerRankTable tbody not found!");
    return;
  }

  tbody.innerHTML = "<tr><td colspan='6'>載入中...</td></tr>";

  try {
    console.log("Fetching broker_ranking.json...");
    const data = await fetchJson("data/broker_ranking.json");
    console.log("Received data:", data);
    tbody.innerHTML = "";

    if (!data.data || data.data.length === 0) {
      console.log("No data.data found");
      tbody.innerHTML = "<tr><td colspan='6'>尚無券商數據</td></tr>";
      return;
    }

    console.log(`Rendering ${data.data.length} brokers`);
    data.data.slice(0, 50).forEach((row, idx) => {
      const tr = document.createElement("tr");

      const tdRank = document.createElement("td");
      tdRank.textContent = idx + 1;

      const tdName = document.createElement("td");
      tdName.textContent = row.broker_name || "";

      const tdNet = document.createElement("td");
      const netVol = row.total_net_vol || 0;
      tdNet.textContent = formatNumber(netVol);
      tdNet.className = netVol > 0 ? "net-positive" : "net-negative";

      const tdBuy = document.createElement("td");
      tdBuy.textContent = row.buy_count || 0;

      const tdSell = document.createElement("td");
      tdSell.textContent = row.sell_count || 0;

      const tdStocks = document.createElement("td");
      tdStocks.textContent = row.stocks_traded || 0;

      tr.appendChild(tdRank);
      tr.appendChild(tdName);
      tr.appendChild(tdNet);
      tr.appendChild(tdBuy);
      tr.appendChild(tdSell);
      tr.appendChild(tdStocks);
      tbody.appendChild(tr);
    });
    console.log("Broker ranking rendered successfully");
  } catch (err) {
    console.error("loadBrokerRanking error:", err);
    tbody.innerHTML = `<tr><td colspan='6'>載入失敗：${err.message}</td></tr>`;
  }
}


async function loadBrokerTrades() {
  const tbody = document.querySelector("#brokerTradesTable tbody");
  const status = document.getElementById("brokerTradesStatus");
  tbody.innerHTML = "";
  status.textContent = "載入中...";

  try {
    const data = await fetchJson("data/broker_trades_latest.json");

    if (!data.data || data.data.length === 0) {
      status.textContent = "尚無交易數據";
      return;
    }

    status.textContent = `更新時間：${data.updated || "未知"} | 共 ${data.count || 0} 筆`;

    // 顯示前 100 筆
    data.data.slice(0, 100).forEach((row) => {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = row.date || "";

      const tdStock = document.createElement("td");
      tdStock.innerHTML = `<span class="badge">${row.stock_code}</span>`;

      const tdBroker = document.createElement("td");
      tdBroker.textContent = row.broker_name || "";

      const tdBuy = document.createElement("td");
      tdBuy.textContent = formatNumber(row.buy_vol || 0);

      const tdSell = document.createElement("td");
      tdSell.textContent = formatNumber(row.sell_vol || 0);

      const tdNet = document.createElement("td");
      const netVol = row.net_vol || 0;
      tdNet.textContent = formatNumber(netVol);
      tdNet.className = netVol > 0 ? "net-positive" : "net-negative";

      const tdPct = document.createElement("td");
      tdPct.textContent = formatPct(row.pct || 0) + "%";

      tr.appendChild(tdDate);
      tr.appendChild(tdStock);
      tr.appendChild(tdBroker);
      tr.appendChild(tdBuy);
      tr.appendChild(tdSell);
      tr.appendChild(tdNet);
      tr.appendChild(tdPct);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    status.textContent = `載入失敗：${err.message}`;
  }
}

async function loadTargetBrokers() {
  const container = document.getElementById("targetBrokersContent");
  container.innerHTML = "<p>載入中...</p>";

  try {
    const data = await fetchJson("data/target_broker_trades.json");

    if (!data.brokers || Object.keys(data.brokers).length === 0) {
      container.innerHTML = "<p>尚無目標券商數據</p>";
      return;
    }

    container.innerHTML = "";

    Object.entries(data.brokers).forEach(([brokerName, trades]) => {
      const card = document.createElement("div");
      card.className = "broker-card";

      // 計算總買賣超
      const totalNet = trades.reduce((sum, t) => sum + (t.net_vol || 0), 0);
      const netClass = totalNet > 0 ? "net-positive" : "net-negative";

      card.innerHTML = `
        <h4>${brokerName} <span class="${netClass}">(${formatNumber(totalNet)} 張)</span></h4>
        <div class="trades-list">
          ${trades.slice(0, 10).map(t => {
        const sideClass = t.side === "buy" ? "buy-text" : "sell-text";
        return `<span class="badge">${t.stock_code}</span> 
                    <span class="${sideClass}">${formatNumber(t.net_vol)}</span> `;
      }).join("")}
          ${trades.length > 10 ? `<br><small>... 還有 ${trades.length - 10} 筆</small>` : ""}
        </div>
      `;

      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p>載入失敗：${err.message}</p>`;
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;

      // 更新按鈕狀態
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // 更新內容顯示
      tabContents.forEach(content => {
        content.classList.remove("active");
        if (content.id === targetTab) {
          content.classList.add("active");
        }
      });

      // 載入對應數據
      if (targetTab === "broker-ranking") {
        loadBrokerRanking();
      } else if (targetTab === "broker-trades") {
        loadBrokerTrades();
      } else if (targetTab === "target-brokers") {
        loadTargetBrokers();
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired");

  try {
    const input = document.getElementById("stockInput");
    const btn = document.getElementById("loadBtn");
    const marketSel = document.getElementById("marketFilter");
    const windowSel = document.getElementById("windowFilter");
    const logCb = document.getElementById("logScaleCheckbox");
    const showForeign = document.getElementById("showForeign");
    const showTrust = document.getElementById("showTrust");
    const showDealer = document.getElementById("showDealer");
    const showTotal = document.getElementById("showTotal");

    btn.addEventListener("click", () => {
      loadStock(input.value);
    });

    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        loadStock(input.value);
      }
    });

    marketSel.addEventListener("change", () => {
      marketFilter = marketSel.value;
      loadRanking();
    });

    windowSel.addEventListener("change", () => {
      currentWindow = parseInt(windowSel.value, 10);
      loadRanking();
    });

    logCb.addEventListener("change", () => {
      useLogScale = logCb.checked;
      loadStock(input.value || "2330");
    });

    [showForeign, showTrust, showDealer, showTotal].forEach((cb) => {
      cb.addEventListener("change", () => {
        loadStock(input.value || "2330");
      });
    });

    // 初始化 tabs
    console.log("Initializing tabs...");
    initTabs();

    // default view
    console.log("Loading initial data...");
    input.value = "2330";
    loadStock("2330");
    loadRanking();
    loadBrokerRanking();

    console.log("Initialization complete");
  } catch (err) {
    console.error("Initialization error:", err);
  }
});
