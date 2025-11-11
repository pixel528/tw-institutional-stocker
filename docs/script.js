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

document.addEventListener("DOMContentLoaded", () => {
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

  // default view
  input.value = "2330";
  loadStock("2330");
  loadRanking();
});
