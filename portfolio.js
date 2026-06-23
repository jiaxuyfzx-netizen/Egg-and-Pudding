const portfolioData = window.__PERFORMANCE_DATA__;
let calendarMonthIndex = 0;

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
}

initPortfolioPage();
