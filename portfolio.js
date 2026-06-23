const portfolioData = window.__PERFORMANCE_DATA__;
let calendarMonthIndex = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function portfolioSetText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function buildSnapshotGrid(meta) {
  const root = document.getElementById("snapshot-grid");
  if (!root) return;

  const cards = [
    ["最新净值", formatNumber(meta.endNav, 2), `更新：${meta.latestDate}`],
    ["近一年收益", formatPct(meta.intervalRows.find((x) => x.label === "近1年")?.returnPct ?? 0), "滚动 12 个月收益"],
    ["成立以来收益", formatPct(meta.totalReturnPct), `${meta.periodStart} 至今`],
    ["年化收益", formatPct(meta.annualReturnPct), "回测以来年化复合收益"],
    ["最大回撤", formatPct(meta.maxDrawdownPct), "完整区间的最大回撤"],
    ["年化波动", formatPct(meta.annualVolPct), "使用全样本日收益估算"],
  ];

  root.innerHTML = "";
  cards.forEach(([label, value, note]) => {
    const item = document.createElement("article");
    item.className = "snapshot-card";
    item.innerHTML = `<small>${label}</small><strong>${value}</strong><span>${note}</span>`;
    root.appendChild(item);
  });
}

function renderTable(rootId, headers, rows, mapper) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const head = `<div class="table-row table-head">${headers.map((h) => `<span>${h}</span>`).join("")}</div>`;
  const body = rows
    .map((row) => `<div class="table-row">${mapper(row).map((cell) => `<span>${cell}</span>`).join("")}</div>`)
    .join("");
  root.innerHTML = head + body;
}

function getCalendarMonths(series) {
  const months = [...new Set(series.map((item) => monthKey(item.date)))];
  return months.sort();
}

function buildCalendar(series) {
  const head = document.getElementById("calendar-head");
  const grid = document.getElementById("calendar-grid");
  if (!head || !grid) return;

  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  const months = getCalendarMonths(series);
  calendarMonthIndex = Math.max(0, Math.min(calendarMonthIndex, months.length - 1));
  const currentMonth = months[calendarMonthIndex];
  const [yearText, monthText] = currentMonth.split("-");
  head.textContent = `${yearText} 年 ${Number(monthText)} 月`;
  grid.innerHTML = labels.map((label) => `<div class="calendar-label">${label}</div>`).join("");

  const monthSeries = series.filter((item) => monthKey(item.date) === currentMonth);
  const firstDay = new Date(`${currentMonth}-01`).getDay();
  const daysInMonth = new Date(Number(yearText), Number(monthText), 0).getDate();
  const dayMap = new Map(
    monthSeries.map((item) => [Number(item.date.slice(8, 10)), { day: Number(item.date.slice(8, 10)), returnPct: item.dailyReturnPct }])
  );

  for (let i = 0; i < firstDay; i += 1) {
    grid.innerHTML += `<div class="calendar-cell calendar-empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const item = dayMap.get(day);
    const cls = !item ? "" : item.returnPct >= 0 ? "calendar-up" : "calendar-down";
    const value = !item ? "休市/缺失" : formatPct(item.returnPct);
    grid.innerHTML += `
      <div class="calendar-cell ${cls}">
        <strong>${day}</strong>
        <span>${value}</span>
      </div>
    `;
  }

  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");
  if (prev) prev.disabled = calendarMonthIndex === 0;
  if (next) next.disabled = calendarMonthIndex === months.length - 1;
}

function renderSelectionRows(date) {
  const selection = portfolioData.selection;
  const summary = document.getElementById("selection-summary");
  const table = document.getElementById("selection-table");
  if (!selection || !summary || !table) return;

  const rows = selection.selectionByDate?.[date] ?? [];
  const strategyCount = new Set(rows.map((row) => row.strategy)).size;
  const totalWeight = rows.reduce((sum, row) => sum + Number(row.targetWeightPct || 0), 0);
  summary.innerHTML = `
    <div>
      <small>选股日期</small>
      <strong>${escapeHtml(date)}</strong>
    </div>
    <div>
      <small>选股数量</small>
      <strong>${rows.length}</strong>
    </div>
    <div>
      <small>策略数量</small>
      <strong>${strategyCount}</strong>
    </div>
    <div>
      <small>目标仓位合计</small>
      <strong>${formatPct(totalWeight)}</strong>
    </div>
  `;

  if (!rows.length) {
    table.innerHTML = `<div class="selection-empty">该日期没有选股记录</div>`;
    return;
  }

  const head = `
    <div class="selection-row selection-head">
      <span>策略</span>
      <span>代码</span>
      <span>名称</span>
      <span>目标仓位</span>
      <span>分批仓位</span>
      <span>择时</span>
      <span>排名</span>
      <span>调仓类型</span>
    </div>
  `;
  const body = rows
    .map(
      (row) => `
        <div class="selection-row">
          <span>${escapeHtml(row.strategy)}</span>
          <span>${escapeHtml(row.code)}</span>
          <span>${escapeHtml(row.name)}</span>
          <span>${formatPct(row.targetWeightPct)}</span>
          <span>${formatPct(row.entryWeightPct)}</span>
          <span>${escapeHtml(row.timingSignal)}</span>
          <span>${row.factorRank == null ? "-" : escapeHtml(row.factorRank)}</span>
          <span>${escapeHtml(row.rebalanceType)}</span>
        </div>
      `
    )
    .join("");
  table.innerHTML = head + body;
}

function initSelectionViewer() {
  const selection = portfolioData.selection;
  const select = document.getElementById("selection-date");
  const section = document.getElementById("selection-section");
  if (!selection || !select || !section) return;

  const dates = selection.selectionDates ?? [];
  if (!dates.length) {
    section.hidden = true;
    return;
  }

  select.innerHTML = dates
    .map((date) => `<option value="${escapeHtml(date)}">${escapeHtml(date)}</option>`)
    .join("");
  select.value = selection.selectionLatestDate ?? dates[dates.length - 1];
  renderSelectionRows(select.value);
  select.addEventListener("change", () => renderSelectionRows(select.value));
}

function initPortfolioPage() {
  if (!portfolioData || !document.getElementById("snapshot-grid")) {
    return;
  }

  const meta = portfolioData.meta;
  portfolioSetText("portfolio-latest-date", `最新更新 ${meta.latestDate}`);
  buildSnapshotGrid(meta);
  initRangeSwitch(portfolioData.series, meta, "portfolio-nav-chart");
  renderDrawdownChart(portfolioData.series, "portfolio-drawdown-chart");

  renderTable(
    "drawdown-table",
    ["开始", "结束", "最大回撤", "恢复期"],
    meta.drawdownEvents,
    (row) => [row.start, row.end, `${row.maxDrawdownPct}%`, row.recovery]
  );

  renderTable(
    "interval-table",
    ["周期", "组合收益", "最大回撤"],
    meta.intervalRows,
    (row) => [
      row.label,
      `<em class="${row.returnPct >= 0 ? "is-negative" : "is-positive"}">${formatPct(row.returnPct)}</em>`,
      `${row.maxDrawdownPct}%`,
    ]
  );

  const months = getCalendarMonths(portfolioData.series);
  calendarMonthIndex = months.length - 1;
  buildCalendar(portfolioData.series);

  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");
  if (prev) {
    prev.addEventListener("click", () => {
      calendarMonthIndex -= 1;
      buildCalendar(portfolioData.series);
    });
  }
  if (next) {
    next.addEventListener("click", () => {
      calendarMonthIndex += 1;
      buildCalendar(portfolioData.series);
    });
  }

  initSelectionViewer();
}

initPortfolioPage();
