(() => {
  const BASE_TIME = "17:00"; // <-- CAMBIO 1
  const STORAGE_KEY = "overtime_v1_entries"; // { "YYYY-MM-DD": "HH:MM" }

  const els = {
    daysGrid: document.getElementById("daysGrid"),
    weekLabel: document.getElementById("weekLabel"),
    prevWeek: document.getElementById("prevWeek"),
    nextWeek: document.getElementById("nextWeek"),
    btnToday: document.getElementById("btnToday"),
    btnResetWeek: document.getElementById("btnResetWeek"),

    rangeStart: document.getElementById("rangeStart"),
    rangeEnd: document.getElementById("rangeEnd"),
    btnCalcRange: document.getElementById("btnCalcRange"),
    rangeTotal: document.getElementById("rangeTotal"),
    rangeDetail: document.getElementById("rangeDetail"),

    btnExport: document.getElementById("btnExport"),
    importFile: document.getElementById("importFile"),
    btnWipeAll: document.getElementById("btnWipeAll"),
  };

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let rangeMode = "date"; // "date" o "week-select"
  let dateRangeInputs = null;

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseTimeToMinutes(hhmm) {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm || "");
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function minutesToHM(mins) {
    const sign = mins < 0 ? "-" : "";
    const a = Math.abs(mins);
    const h = Math.floor(a / 60);
    const m = a % 60;
    return `${sign}${h}h ${pad2(m)}m`;
  }

  function startOfWeekMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const jsDay = d.getDay(); // 0 Sun..6 Sat
    const diff = (jsDay === 0) ? -6 : (1 - jsDay);
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function formatShortDate(d) {
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  }

  function weekRangeLabel(monday) {
    const sunday = addDays(monday, 6);
    return `${formatShortDate(monday)} → ${formatShortDate(sunday)}`;
  }

  function computeOvertimeMinutes(exitTimeHHMM) {
    const base = parseTimeToMinutes(BASE_TIME);
    const out = parseTimeToMinutes(exitTimeHHMM);
    if (out == null) return null;

    const diff = out - base;
    return Math.max(0, diff); // no negativo
  }

  // --- NUEVO: Rango por fecha libre (inputs tipo date) ---
  function ensureDateRangeInputs() {
    if (dateRangeInputs) return dateRangeInputs;

    // Creamos inputs "date" y los insertamos junto a los selects existentes
    const row = els.btnCalcRange.closest(".rangeRow");
    if (!row) return null;

    // Ocultamos selects (manteniendo compatibilidad con tu HTML actual)
    els.rangeStart.style.display = "none";
    els.rangeEnd.style.display = "none";

    const wrapStart = els.rangeStart.closest(".field");
    const wrapEnd = els.rangeEnd.closest(".field");

    const startDate = document.createElement("input");
    startDate.type = "date";
    startDate.className = "timeInput"; // reutiliza estilo
    startDate.style.padding = "10px 10px";
    startDate.style.borderRadius = "12px";

    const endDate = document.createElement("input");
    endDate.type = "date";
    endDate.className = "timeInput";
    endDate.style.padding = "10px 10px";
    endDate.style.borderRadius = "12px";

    // Etiquetas
    const startLabel = wrapStart?.querySelector("span");
    const endLabel = wrapEnd?.querySelector("span");
    if (startLabel) startLabel.textContent = "Desde (fecha)";
    if (endLabel) endLabel.textContent = "Hasta (fecha)";

    // Insertar debajo del span
    wrapStart?.appendChild(startDate);
    wrapEnd?.appendChild(endDate);

    // Defaults: lunes de semana actual → hoy
    const monday = startOfWeekMonday(new Date());
    startDate.value = toISODate(monday);
    endDate.value = toISODate(new Date());

    dateRangeInputs = { startDate, endDate };
    return dateRangeInputs;
  }

  function buildWeek(monday, entries) {
    els.weekLabel.textContent = weekRangeLabel(monday);

    // Mantengo los selects rellenados por si quieres volver a usarlos, pero quedarán ocultos
    els.rangeStart.innerHTML = "";
    els.rangeEnd.innerHTML = "";

    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      const iso = toISODate(d);

      const opt1 = document.createElement("option");
      opt1.value = iso;
      opt1.textContent = `${dayNames[i]} ${formatShortDate(d)}`;
      els.rangeStart.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = iso;
      opt2.textContent = `${dayNames[i]} ${formatShortDate(d)}`;
      els.rangeEnd.appendChild(opt2);
    }

    // Construcción tarjetas días
    els.daysGrid.innerHTML = "";
    const todayISO = toISODate(new Date());

    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
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
      input.value = stored;
      input.setAttribute("aria-label", `Hora de salida ${dayNames[i]} ${formatShortDate(d)}`);

      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerHTML = `<span>Horas extra</span><strong>—</strong>`;

      function refreshPill() {
        const mins = computeOvertimeMinutes(input.value);
        pill.querySelector("strong").textContent = (mins == null) ? "—" : minutesToHM(mins);
      }

      refreshPill();

      input.addEventListener("input", () => {
        const v = input.value;
        if (v && parseTimeToMinutes(v) == null) return;

        if (v) entries[iso] = v;
        else delete entries[iso];

        saveEntries(entries);
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

    // Asegurar inputs de rango por fecha
    ensureDateRangeInputs();

    els.rangeTotal.textContent = "—";
    els.rangeDetail.textContent = "—";
  }

  function computeRangeTotal(entries, startISO, endISO) {
    if (!startISO || !endISO) return { total: null, detail: "Selecciona un rango." };

    const a = (startISO <= endISO) ? [startISO, endISO] : [endISO, startISO];

    let total = 0;
    let counted = 0;
    let missing = 0;

    const start = new Date(a[0] + "T00:00:00");
    const end = new Date(a[1] + "T00:00:00");

    // Safety: si el usuario pone un rango enorme accidentalmente, igual funciona,
    // pero aquí podrías poner un límite. Lo dejo sin límite.
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      const v = entries[iso];
      if (!v) { missing++; continue; }
      const mins = computeOvertimeMinutes(v);
      if (mins == null) { missing++; continue; }
      total += mins;
      counted++;
    }

    const detail = `Días con hora: ${counted} • Sin dato: ${missing} • Base ${BASE_TIME}`;
    return { total, detail };
  }

  // --- Init ---
  let entries = loadEntries();
  let currentMonday = startOfWeekMonday(new Date());

  function render() {
    buildWeek(currentMonday, entries);
  }

  // Week nav
  els.prevWeek.addEventListener("click", () => {
    currentMonday = addDays(currentMonday, -7);
    render();
  });
  els.nextWeek.addEventListener("click", () => {
    currentMonday = addDays(currentMonday, +7);
    render();
  });
  els.btnToday.addEventListener("click", () => {
    currentMonday = startOfWeekMonday(new Date());
    render();
  });

  // Clear week only
  els.btnResetWeek.addEventListener("click", () => {
    const ok = confirm("¿Seguro? Esto borra SOLO los datos de la semana visible.");
    if (!ok) return;

    for (let i = 0; i < 7; i++) {
      const iso = toISODate(addDays(currentMonday, i));
      delete entries[iso];
    }
    saveEntries(entries);
    render();
  });

  // Range calc (AHORA con fechas libres)
  els.btnCalcRange.addEventListener("click", () => {
    const dr = ensureDateRangeInputs();
    const startISO = dr?.startDate?.value;
    const endISO = dr?.endDate?.value;

    const { total, detail } = computeRangeTotal(entries, startISO, endISO);

    if (total == null) {
      els.rangeTotal.textContent = "—";
      els.rangeDetail.textContent = detail;
      return;
    }
    els.rangeTotal.textContent = minutesToHM(total);
    els.rangeDetail.textContent = detail;
  });

  // Export / Import
  els.btnExport.addEventListener("click", async () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      baseTime: BASE_TIME,
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
    } catch { /* ignore */ }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  els.importFile.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== "object" || !data.entries || typeof data.entries !== "object") {
        alert("JSON inválido: no encuentro 'entries'.");
        ev.target.value = "";
        return;
      }

      entries = { ...entries, ...data.entries };
      saveEntries(entries);
      render();
      alert("Importación OK ✅");
    } catch {
      alert("No pude importar el JSON. Revisa que sea un archivo válido.");
    } finally {
      ev.target.value = "";
    }
  });

  els.btnWipeAll.addEventListener("click", () => {
    const ok = confirm("¿Seguro? Esto borra TODO tu historial guardado en este dispositivo.");
    if (!ok) return;
    entries = {};
    saveEntries(entries);
    render();
  });

  render();
})();
