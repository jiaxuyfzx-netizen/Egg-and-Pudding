const data = window.__PERFORMANCE_DATA__;
let currentCurveSeries = null;

function formatPct(value) {
  return `${value >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = el(id);
  if (node) {
    node.textContent = value;
  }
}

function createMetricCards(meta) {
  const grid = el("metrics-grid");
  if (!grid) return;

  const cards = [
    ["年化波动", `${formatNumber(meta.annualVolPct)}%`, "使用全区间日收益率估算年化波动"],
    ["年内收益", formatPct(meta.ytdReturnPct), `${meta.latestDate.slice(0, 4)} 年以来的表现`],
    ["近 30 天", formatPct(meta.last30ReturnPct), "跟踪最近一个月的变化速度"],
    ["样本区间", `${meta.periodStart} - ${meta.periodEnd}`, "首日为回测起点，后续自然衔接到实盘"],
    ["拼接日期", meta.spliceDate, "此前为回测，此后为实盘单位净值"],
    ["回测样本", `${meta.sourceBreakdown.backtestDays} 天`, "用于构成历史净值底稿"],
    ["实盘样本", `${meta.sourceBreakdown.liveDays} 天`, "后续更新 Excel 后自动刷新"],
    ["起始净值", formatNumber(meta.startNav, 2), "以组合回测起点作为归一化基准"],
  ];

  grid.innerHTML = "";
  cards.forEach(([title, value, hint]) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.innerHTML = `<p>${title}</p><strong>${value}</strong><span>${hint}</span>`;
    grid.appendChild(card);
  });
}

function buildLinePath(points, width, height, padding, key) {
  const values = points.map((point) => point[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - ((point[key] - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(points, width, height, padding, key) {
  const values = points.map((point) => point[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const bottom = height - padding;

  const line = points.map((point, index) => {
    const x = padding + (index / (points.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((point[key] - min) / span) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return `${line.join(" ")} L${width - padding},${bottom} L${padding},${bottom} Z`;
}

function renderNavChart(series, meta, targetId = "nav-chart") {
  const svg = el(targetId);
  if (!svg) return;

  const width = 1100;
  const height = 420;
  const leftPad = 62;
  const rightPad = 28;
  const topPad = 26;
  const bottomPad = 52;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const lastIndex = series.length - 1;
  const yValues = series.map((item) => item.nav);
  const maxNav = Math.max(...yValues);
  const minNav = Math.min(...yValues);
  const span = maxNav - minNav || 1;
  const points = series.map((item, index) => {
    const x = leftPad + (index / (series.length - 1 || 1)) * chartWidth;
    const y = topPad + (1 - (item.nav - minNav) / span) * chartHeight;
    return { x, y, ...item };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const xTickIndices = [0, Math.floor(lastIndex / 3), Math.floor((lastIndex * 2) / 3), lastIndex];
  const yTicks = Array.from({ length: 5 }, (_, idx) => minNav + ((4 - idx) / 4) * span);
  const xGrid = xTickIndices
    .map((idx) => {
      const x = leftPad + (idx / (series.length - 1 || 1)) * chartWidth;
      return `<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + chartHeight}" stroke="rgba(16,16,16,0.06)" stroke-dasharray="4 8"></line>
      <text x="${x}" y="${height - 14}" text-anchor="middle" fill="rgba(16,16,16,0.5)" font-size="13">${series[idx].date}</text>`;
    })
    .join("");
  const yGrid = yTicks
    .map((value) => {
      const y = topPad + (1 - (value - minNav) / span) * chartHeight;
      return `<line x1="${leftPad}" y1="${y}" x2="${leftPad + chartWidth}" y2="${y}" stroke="rgba(16,16,16,0.08)"></line>
      <text x="${leftPad - 10}" y="${y + 4}" text-anchor="end" fill="rgba(16,16,16,0.5)" font-size="13">${value.toFixed(2)}</text>`;
    })
    .join("");
  const parent = svg.parentElement;
  if (parent) {
    parent.classList.add("chart-host");
  }

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="rgba(255,255,255,0.18)"></rect>
    ${yGrid}
    ${xGrid}
    <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + chartHeight}" stroke="rgba(16,16,16,0.16)"></line>
    <line x1="${leftPad}" y1="${topPad + chartHeight}" x2="${leftPad + chartWidth}" y2="${topPad + chartHeight}" stroke="rgba(16,16,16,0.16)"></line>
    <path d="${path}" fill="none" stroke="rgba(180,67,44,0.16)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="${path}" fill="none" stroke="#b4432c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
    <text x="${leftPad}" y="16" fill="rgba(16,16,16,0.56)" font-size="13">净值</text>
    <text x="${leftPad + chartWidth}" y="${height - 14}" text-anchor="end" fill="rgba(16,16,16,0.56)" font-size="13">日期</text>
    <line id="${targetId}-hover-x" x1="0" y1="0" x2="0" y2="0" stroke="rgba(16,16,16,0.18)" stroke-dasharray="4 6" opacity="0"></line>
    <line id="${targetId}-hover-y" x1="0" y1="0" x2="0" y2="0" stroke="rgba(16,16,16,0.18)" stroke-dasharray="4 6" opacity="0"></line>
    <circle id="${targetId}-hover-dot" cx="0" cy="0" r="5" fill="#b4432c" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" opacity="0"></circle>
  `;

  if (!parent) return;
  let tooltip = parent.querySelector(".nav-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "nav-tooltip";
    parent.appendChild(tooltip);
  }

  const hoverX = el(`${targetId}-hover-x`);
  const hoverY = el(`${targetId}-hover-y`);
  const hoverDot = el(`${targetId}-hover-dot`);

  const showTooltip = (event) => {
    const rect = svg.getBoundingClientRect();
    const ratioX = width / rect.width;
    const localX = (event.clientX - rect.left) * ratioX;
    const clampedX = Math.max(leftPad, Math.min(leftPad + chartWidth, localX));
    const idx = Math.round(((clampedX - leftPad) / chartWidth) * (series.length - 1));
    const point = points[Math.max(0, Math.min(points.length - 1, idx))];
    const baseNav = series[0]?.nav || point.nav;
    const totalReturn = ((point.nav / baseNav) - 1) * 100;

    hoverX.setAttribute("x1", point.x);
    hoverX.setAttribute("y1", topPad);
    hoverX.setAttribute("x2", point.x);
    hoverX.setAttribute("y2", topPad + chartHeight);
    hoverX.setAttribute("opacity", "1");

    hoverY.setAttribute("x1", leftPad);
    hoverY.setAttribute("y1", point.y);
    hoverY.setAttribute("x2", leftPad + chartWidth);
    hoverY.setAttribute("y2", point.y);
    hoverY.setAttribute("opacity", "1");

    hoverDot.setAttribute("cx", point.x);
    hoverDot.setAttribute("cy", point.y);
    hoverDot.setAttribute("opacity", "1");

    tooltip.innerHTML = `
      <strong>${point.date}</strong>
      <span>净值 ${point.nav.toFixed(2)}</span>
      <span>累计收益 ${formatPct(totalReturn)}</span>
      <span>${point.source === "live" ? "实盘段" : "回测段"}</span>
    `;
    tooltip.style.opacity = "1";

    const tooltipX = (point.x / width) * rect.width + 14;
    const tooltipY = (point.y / height) * rect.height - 18;
    tooltip.style.left = `${Math.min(rect.width - 180, Math.max(8, tooltipX))}px`;
    tooltip.style.top = `${Math.max(8, tooltipY)}px`;
  };

  const hideTooltip = () => {
    hoverX.setAttribute("opacity", "0");
    hoverY.setAttribute("opacity", "0");
    hoverDot.setAttribute("opacity", "0");
    tooltip.style.opacity = "0";
  };

  svg.onmousemove = showTooltip;
  svg.onmouseleave = hideTooltip;
  svg.ontouchmove = (event) => {
    if (event.touches && event.touches[0]) {
      showTooltip(event.touches[0]);
    }
  };
  svg.ontouchend = hideTooltip;
}

function getRangeFilteredSeries(series, rangeKey) {
  if (!series?.length || rangeKey === "all") return series;
  const lastDate = new Date(series[series.length - 1].date);
  const cutoff = new Date(lastDate);

  if (rangeKey === "1m") cutoff.setMonth(cutoff.getMonth() - 1);
  if (rangeKey === "3m") cutoff.setMonth(cutoff.getMonth() - 3);
  if (rangeKey === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);

  const filtered = series.filter((item) => new Date(item.date) >= cutoff);
  return filtered.length > 1 ? filtered : series;
}

function renderCurveSummary(series, meta) {
  if (!series?.length) return;
  const startNav = series[0].nav;
  const endNav = series[series.length - 1].nav;
  const totalReturn = (endNav / startNav - 1) * 100;
  const currentDrawdown = series[series.length - 1].drawdownPct;

  setText("curve-end-nav", formatNumber(endNav, 2));
  setText("curve-total-return", formatPct(totalReturn));
  setText("curve-current-drawdown", formatPct(currentDrawdown));
  setText("curve-annual-return", formatPct(meta.annualReturnPct));
}

function initRangeSwitch(series, meta, chartId = "portfolio-nav-chart") {
  const root = el("curve-range-switch");
  if (!root) return;
  const buttons = [...root.querySelectorAll("[data-range]")];

  const applyRange = (rangeKey) => {
    currentCurveSeries = getRangeFilteredSeries(series, rangeKey);
    renderNavChart(currentCurveSeries, meta, chartId);
    renderCurveSummary(currentCurveSeries, meta);
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.range === rangeKey);
    });
  };

  buttons.forEach((button) => {
    button.onclick = () => applyRange(button.dataset.range);
  });

  applyRange("1m");
}

function renderDrawdownChart(series, targetId = "drawdown-chart") {
  const svg = el(targetId);
  if (!svg) return;

  const width = 520;
  const height = 260;
  const leftPad = 52;
  const rightPad = 24;
  const topPad = 24;
  const bottomPad = 56;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const values = series.map((item) => item.drawdownPct);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue || 1;
  const points = series.map((item, index) => {
    const x = leftPad + (index / (series.length - 1 || 1)) * chartWidth;
    const y = topPad + (1 - (item.drawdownPct - minValue) / span) * chartHeight;
    return { x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `${line} L${leftPad + chartWidth},${topPad + chartHeight} L${leftPad},${topPad + chartHeight} Z`;
  const minDrawdown = Math.min(...series.map((item) => item.drawdownPct));
  const firstLabel = series[0].date;
  const midLabel = series[Math.floor(series.length / 2)].date;
  const lastLabel = series[series.length - 1].date;
  const topAxis = topPad;
  const bottomAxis = topPad + chartHeight;

  svg.innerHTML = `
    <defs>
      <linearGradient id="${targetId}-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(217,95,2,0.38)"></stop>
        <stop offset="100%" stop-color="rgba(217,95,2,0.06)"></stop>
      </linearGradient>
    </defs>
    <line x1="${leftPad}" y1="${topAxis}" x2="${leftPad}" y2="${bottomAxis}" stroke="rgba(16,16,16,0.16)"></line>
    <line x1="${leftPad}" y1="${bottomAxis}" x2="${leftPad + chartWidth}" y2="${bottomAxis}" stroke="rgba(16,16,16,0.16)"></line>
    <line x1="${leftPad}" y1="${topAxis}" x2="${leftPad + chartWidth}" y2="${topAxis}" stroke="rgba(16,16,16,0.08)" stroke-dasharray="5 5"></line>
    <path d="${area}" fill="url(#${targetId}-fill)"></path>
    <path d="${line}" fill="none" stroke="#d95f02" stroke-width="2.5" stroke-linecap="round"></path>
    <text x="${leftPad - 8}" y="${topAxis + 4}" text-anchor="end" fill="rgba(16,16,16,0.54)" font-size="12">0%</text>
    <text x="${leftPad - 8}" y="${bottomAxis + 4}" text-anchor="end" fill="rgba(16,16,16,0.54)" font-size="12">${formatPct(minDrawdown)}</text>
    <text x="${leftPad}" y="${height - 16}" fill="rgba(16,16,16,0.54)" font-size="12">${firstLabel}</text>
    <text x="${leftPad + chartWidth / 2 - 40}" y="${height - 16}" fill="rgba(16,16,16,0.54)" font-size="12">${midLabel}</text>
    <text x="${leftPad + chartWidth - 70}" y="${height - 16}" fill="rgba(16,16,16,0.54)" font-size="12">${lastLabel}</text>
    <text x="${leftPad}" y="18" fill="rgba(16,16,16,0.56)" font-size="13">最深回撤 ${formatPct(minDrawdown)}</text>
  `;
}

function renderYearGrid(meta) {
  const root = el("year-grid");
  if (!root) return;

  root.innerHTML = "";
  meta.yearlyReturns.forEach((item) => {
    const node = document.createElement("div");
    const cls = item.returnPct >= 0 ? "is-negative" : "is-positive";
    node.className = "year-card";
    node.innerHTML = `<small>${item.year}</small><strong class="${cls}">${formatPct(item.returnPct)}</strong>`;
    root.appendChild(node);
  });
}

function renderMonthBars(meta) {
  const root = el("month-bars");
  if (!root) return;

  const recent = meta.monthlyReturns.slice(-6);
  const maxAbs = Math.max(...recent.map((item) => Math.abs(item.returnPct)), 1);
  root.innerHTML = "";

  recent.forEach((item) => {
    const row = document.createElement("div");
    const width = (Math.abs(item.returnPct) / maxAbs) * 100;
    const positive = item.returnPct >= 0;
    row.className = "month-row";
    row.innerHTML = `
      <div class="month-label">${item.month}</div>
      <div class="month-track">
        <div class="month-fill" style="width:${width}%; background:${positive ? "#b4432c" : "#136f3a"}"></div>
      </div>
      <div class="${positive ? "is-negative" : "is-positive"}">${formatPct(item.returnPct)}</div>
    `;
    root.appendChild(row);
  });
}

function hydrateText(meta) {
  setText("latest-date", `最新更新 ${meta.latestDate}`);
  setText("splice-date-inline", meta.spliceDate);
  setText("end-nav", formatNumber(meta.endNav, 2));
  setText("total-return", formatPct(meta.totalReturnPct));
  setText("max-drawdown", formatPct(meta.maxDrawdownPct));
  setText("annual-return", formatPct(meta.annualReturnPct));
  setText("sharpe", formatNumber(meta.sharpe));
  setText("period-start", meta.periodStart);
  setText("period-end", meta.periodEnd);
  setText("splice-date", meta.spliceDate);
  setText("backtest-days", meta.sourceBreakdown.backtestDays);
  setText("live-days", meta.sourceBreakdown.liveDays);
}

function initIndexPage() {
  if (!data || !data.meta || !data.series || !el("metrics-grid")) {
    return;
  }

  hydrateText(data.meta);
  createMetricCards(data.meta);
  renderNavChart(data.series, data.meta, "nav-chart");
  renderDrawdownChart(data.series, "drawdown-chart");
  renderYearGrid(data.meta);
  renderMonthBars(data.meta);
}

initIndexPage();
