(() => {
  const DEFAULT_BASE_TIME = "17:00";
  const STORAGE_KEY = "overtime_v2_data"; // { entries: {}, weekBaseTimes: {} }

  function $(id) { return document.getElementById(id); }

  const els = {
    daysGrid: $("daysGrid"),
    weekLabel: $("weekLabel"),
    prevWeek: $("prevWeek"),
    nextWeek: $("nextWeek"),
    btnToday: $("btnToday"),
    btnResetWeek: $("btnResetWeek"),

    weekBaseTime: $("weekBaseTime"),
    weekBaseHint: $("weekBaseHint"),
    currentBaseLabel: $("currentBaseLabel"),

    rangeStartDate: $("rangeStartDate"),
    rangeEndDate: $("rangeEndDate"),
    rangeStart: $("rangeStart"),
    rangeEnd: $("rangeEnd"),

    btnCalcRange: $("btnCalcRange"),
    rangeTotal: $("rangeTotal"),
    rangeDetail: $("rangeDetail"),

    btnExport: $("btnExport"),
    importFile: $("importFile"),
    btnWipeAll: $("btnWipeAll"),
  };

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  function loadData() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

      // Compatibilidad con versión antigua: localStorage guardaba solo entries
      if (raw && !raw.entries && !raw.weekBaseTimes) {
        return {
          entries: raw || {},
          weekBaseTimes: {}
        };
      }

      return {
        entries: (raw && typeof raw.entries === "object" && raw.entries) ? raw.entries : {},
        weekBaseTimes: (raw && typeof raw.weekBaseTimes === "object" && raw.weekBaseTimes) ? raw.weekBaseTimes : {},
      };
    } catch {
      return { entries: {}, weekBaseTimes: {} };
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      entries,
      weekBaseTimes
    }));
  }

  function pad2(n){ return String(n).padStart(2,"0"); }

  function toISODate(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function parseISODate(iso){
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y,m,d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function parseTimeToMinutes(hhmm){
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm || "");
    if(!m) return null;
    const hh = Number(m[1]), mm = Number(m[2]);
    if(hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function minutesToHM(mins){
    const a = Math.abs(mins);
    const h = Math.floor(a / 60);
    const m = a % 60;
    return `${h}h ${pad2(m)}m`;
  }

  function startOfWeekMonday(date){
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const jsDay = d.getDay(); // 0 Sun..6 Sat
    const diff = (jsDay === 0) ? -6 : (1 - jsDay);
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addDays(d,n){
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function formatShortDate(d){
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`;
  }

  function weekRangeLabel(monday){
    const sunday = addDays(monday,6);
    return `${formatShortDate(monday)} → ${formatShortDate(sunday)}`;
  }

  function getWeekMondayISOFromDate(date){
    return toISODate(startOfWeekMonday(date));
  }

  function getWeekMondayISOFromEntryISO(iso){
    const d = parseISODate(iso);
    if (!d) return null;
    return getWeekMondayISOFromDate(d);
  }

  function getInheritedWeekBaseTime(mondayISO){
    const target = parseISODate(mondayISO);
    if (!target) return DEFAULT_BASE_TIME;

    let bestISO = null;

    for (const iso of Object.keys(weekBaseTimes)) {
      const d = parseISODate(iso);
      if (!d) continue;
      if (d <= target) {
        if (!bestISO || iso > bestISO) bestISO = iso;
      }
    }

    return bestISO ? weekBaseTimes[bestISO] : DEFAULT_BASE_TIME;
  }

  function ensureWeekBaseTime(mondayISO){
    if (parseTimeToMinutes(weekBaseTimes[mondayISO]) != null) {
      return weekBaseTimes[mondayISO];
    }
    const inherited = getInheritedWeekBaseTime(mondayISO);
    weekBaseTimes[mondayISO] = inherited;
    saveData();
    return inherited;
  }

  function getWeekBaseTimeByDateISO(dateISO){
    const mondayISO = getWeekMondayISOFromEntryISO(dateISO);
    if (!mondayISO) return DEFAULT_BASE_TIME;
    return ensureWeekBaseTime(mondayISO);
  }

  function computeOvertimeMinutes(exitTimeHHMM, baseTimeHHMM){
    const base = parseTimeToMinutes(baseTimeHHMM);
    const out = parseTimeToMinutes(exitTimeHHMM);
    if (base == null || out == null) return null;
    return Math.max(0, out - base);
  }

  function getRangeValues() {
    if (els.rangeStartDate && els.rangeEndDate) {
      return { startISO: els.rangeStartDate.value, endISO: els.rangeEndDate.value, mode: "date" };
    }
    if (els.rangeStart && els.rangeEnd) {
      return { startISO: els.rangeStart.value, endISO: els.rangeEnd.value, mode: "select" };
    }
    return { startISO: "", endISO: "", mode: "none" };
  }

  function setDefaultRange(currentMonday) {
    const todayISO = toISODate(new Date());

    if (els.rangeStartDate && els.rangeEndDate) {
      els.rangeStartDate.value = toISODate(currentMonday);
      els.rangeEndDate.value = todayISO;
      return;
    }

    if (els.rangeStart && els.rangeEnd) {
      els.rangeStart.value = toISODate(currentMonday);
      const weekEndISO = toISODate(addDays(currentMonday, 6));
      els.rangeEnd.value = (todayISO >= toISODate(currentMonday) && todayISO <= weekEndISO) ? todayISO : weekEndISO;
    }
  }

  function computeRangeTotal(startISO, endISO){
    if(!startISO || !endISO) {
      return { total:null, detail:"Selecciona ambas fechas." };
    }

    const [sISO, eISO] = (startISO <= endISO) ? [startISO, endISO] : [endISO, startISO];

    let total = 0;
    let counted = 0;
    let missing = 0;
    const basesUsed = new Set();

    const start = new Date(sISO + "T00:00:00");
    const end = new Date(eISO + "T00:00:00");

    for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      const iso = toISODate(d);
      const v = entries[iso];
      if(!v){ missing++; continue; }

      const weekBase = getWeekBaseTimeByDateISO(iso);
      basesUsed.add(weekBase);

      const mins = computeOvertimeMinutes(v, weekBase);
      if(mins == null){ missing++; continue; }

      total += mins;
      counted++;
    }

    const baseText =
      basesUsed.size === 0 ? "sin base semanal aplicada" :
      basesUsed.size === 1 ? `base semanal: ${[...basesUsed][0]}` :
      `bases semanales mixtas: ${[...basesUsed].join(", ")}`;

    return {
      total,
      detail: `Días con hora: ${counted} • Sin dato: ${missing} • ${baseText}`
    };
  }

  function refreshTopBaseLabel(mondayISO){
    const base = ensureWeekBaseTime(mondayISO);
    if (els.currentBaseLabel) {
      els.currentBaseLabel.textContent = base;
    }
    if (els.weekBaseHint) {
      els.weekBaseHint.textContent = `Esta semana calcula en base a ${base}. Las semanas nuevas heredan el último valor ingresado.`;
    }
  }

  function buildWeek(monday){
    if (!els.daysGrid || !els.weekLabel) return;

    const mondayISO = toISODate(monday);
    const weekBase = ensureWeekBaseTime(mondayISO);

    els.weekLabel.textContent = weekRangeLabel(monday);
    els.daysGrid.innerHTML = "";

    if (els.weekBaseTime) {
      els.weekBaseTime.value = weekBase;
    }
    refreshTopBaseLabel(mondayISO);

    const todayISO = toISODate(new Date());
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);

    for(let i=0;i<7;i++){
      const d = addDays(monday,i);
      const iso = toISODate(d);
      const stored = entries[iso] || "";

      const card = document.createElement("div");
      card.className = "dayCard";

      const top = document.createElement("div");
      top.className = "dayTop";

      const name = document.createElement("div");
      name.className = "dayName";
      name.textContent = dayNames[i];

      const date = document.createElement("div");
      date.className = "dayDate";
      date.textContent = formatShortDate(d);

      top.appendChild(name);
      top.appendChild(date);

      const row = document.createElement("div");
      row.className = "inputRow";

      const input = document.createElement("input");
      input.className = "timeInput";
      input.type = "time";
      input.inputMode = "none";
      input.value = stored;
      input.setAttribute("step", "60");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("aria-label", `Hora de salida ${dayNames[i]} ${formatShortDate(d)}`);

      const openPicker = () => {
        if (typeof input.showPicker === "function") {
          input.showPicker();
        } else {
          input.focus({ preventScroll: true });
        }
      };

      input.addEventListener("click", () => {
        openPicker();
      });

      if (isiOS) {
        input.addEventListener("touchend", () => {
          openPicker();
        }, { passive: true });
      }

      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerHTML = `<span>Horas extra</span><strong>—</strong>`;

      function refreshPill(){
        const currentWeekBase = getWeekBaseTimeByDateISO(iso);
        const mins = computeOvertimeMinutes(input.value, currentWeekBase);
        pill.querySelector("strong").textContent = (mins == null) ? "—" : minutesToHM(mins);
      }
      refreshPill();

      input.addEventListener("input", () => {
        const v = input.value;
        if (v && parseTimeToMinutes(v) == null) return;

        if (v) entries[iso] = v;
        else delete entries[iso];

        saveData();
        refreshPill();
      });

      row.appendChild(input);
      card.appendChild(top);
      card.appendChild(row);
      card.appendChild(pill);

      if (iso === todayISO) {
        card.style.borderColor = "rgba(231,127,154,0.55)";
        card.style.boxShadow = "0 14px 32px rgba(231,127,154,0.18)";
      }

      els.daysGrid.appendChild(card);
    }

    if (els.rangeTotal) els.rangeTotal.textContent = "—";
    if (els.rangeDetail) els.rangeDetail.textContent = "—";
  }

  let data = loadData();
  let entries = data.entries;
  let weekBaseTimes = data.weekBaseTimes;
  let currentMonday = startOfWeekMonday(new Date());

  function render(){
    buildWeek(currentMonday);
  }

  els.prevWeek?.addEventListener("click", () => {
    currentMonday = addDays(currentMonday, -7);
    render();
  });

  els.nextWeek?.addEventListener("click", () => {
    currentMonday = addDays(currentMonday, +7);
    render();
  });

  els.btnToday?.addEventListener("click", () => {
    currentMonday = startOfWeekMonday(new Date());
    render();
  });

  els.btnResetWeek?.addEventListener("click", () => {
    const ok = confirm("¿Seguro? Esto borra SOLO los datos de la semana visible.");
    if (!ok) return;

    for (let i = 0; i < 7; i++){
      const iso = toISODate(addDays(currentMonday, i));
      delete entries[iso];
    }

    saveData();
    render();
  });

  els.weekBaseTime?.addEventListener("input", () => {
    const v = els.weekBaseTime.value;
    if (parseTimeToMinutes(v) == null) return;

    const mondayISO = toISODate(currentMonday);
    weekBaseTimes[mondayISO] = v;
    saveData();
    refreshTopBaseLabel(mondayISO);

    // refresca pills visibles
    render();
  });

  setDefaultRange(currentMonday);

  els.btnCalcRange?.addEventListener("click", () => {
    const { startISO, endISO } = getRangeValues();
    const { total, detail } = computeRangeTotal(startISO, endISO);

    if (!els.rangeTotal || !els.rangeDetail) return;

    if (total == null) {
      els.rangeTotal.textContent = "—";
      els.rangeDetail.textContent = detail;
      return;
    }

    els.rangeTotal.textContent = minutesToHM(total);
    els.rangeDetail.textContent = detail;
  });

  els.btnExport?.addEventListener("click", async () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      defaultBaseTime: DEFAULT_BASE_TIME,
      weekBaseTimes,
      entries
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const filename = `horas-extra-backup_${toISODate(new Date())}.json`;
    const file = new File([blob], filename, { type: "application/json" });

    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Respaldo horas extra" });
        return;
      }
    } catch {}

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  els.importFile?.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== "object") {
        alert("JSON inválido.");
        ev.target.value = "";
        return;
      }

      const importedEntries =
        (data.entries && typeof data.entries === "object") ? data.entries : null;

      const importedWeekBaseTimes =
        (data.weekBaseTimes && typeof data.weekBaseTimes === "object") ? data.weekBaseTimes : {};

      // Compatibilidad con backups antiguos
      if (!importedEntries && typeof data === "object") {
        alert("JSON inválido: no encuentro 'entries'.");
        ev.target.value = "";
        return;
      }

      entries = { ...entries, ...importedEntries };
      weekBaseTimes = { ...weekBaseTimes, ...importedWeekBaseTimes };

      saveData();
      render();
      alert("Importación OK ✅");
    } catch {
      alert("No pude importar el JSON.");
    } finally {
      ev.target.value = "";
    }
  });

  els.btnWipeAll?.addEventListener("click", () => {
    const ok = confirm("¿Seguro? Esto borra TODO tu historial guardado en este dispositivo.");
    if (!ok) return;

    entries = {};
    weekBaseTimes = {};
    saveData();
    render();
  });

  render();
})();
