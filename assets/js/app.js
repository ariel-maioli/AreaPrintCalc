(function () {
  const form = document.getElementById('layoutForm');
  const statusEl = document.getElementById('formStatus');
  const metricPieces = document.getElementById('metricPieces');
  const metricUsage = document.getElementById('metricUsage');
  const metricWaste = document.getElementById('metricWaste');
  const previewContainer = document.getElementById('previewContainer');
  const sheetDimensionsRow = document.querySelector('.sheet-dimensions');
  const unitFieldset = document.getElementById('unitSelector');
  const unitGroups = {
    sheet: Array.from(document.querySelectorAll('[data-unit-group="sheet"] button')),
    image: Array.from(document.querySelectorAll('[data-unit-group="image"] button'))
  };
  const themeToggle = document.getElementById('themeToggle');
  const helperTexts = Array.from(document.querySelectorAll('.helper-text[data-field]'));

  const PRESETS = {
    letter: { width: 215.9, height: 279.4, unit: 'mm' },
    legal: { width: 215.9, height: 355.6, unit: 'mm' },
    tabloid: { width: 279.4, height: 431.8, unit: 'mm' },
    a4: { width: 210, height: 297, unit: 'mm' },
    a3: { width: 297, height: 420, unit: 'mm' },
    a3plus: { width: 329, height: 483, unit: 'mm' }
  };

  const UNIT_FACTORS_MM = {
    mm: 1,
    cm: 10,
    in: 25.4
  };

  const LIMITS = {
    mm: { min: 1, max: 1000 },
    cm: { min: 0.1, max: 100 },
    in: { min: 0.05, max: 40 }
  };

  function span(count, size, gap) {
    if (!Number.isFinite(count) || count <= 0) return 0;
    return count * size + Math.max(0, count - 1) * gap;
  }

  function gridStats(areaWidth, areaHeight, cellWidth, cellHeight, gapX, gapY) {
    const width = Math.max(0, areaWidth);
    const height = Math.max(0, areaHeight);
    if (width <= 0 || height <= 0 || cellWidth <= 0 || cellHeight <= 0) {
      return { rows: 0, columns: 0, total: 0, usedWidth: 0, usedHeight: 0 };
    }
    const columns = Math.max(0, Math.floor((width + gapX) / (cellWidth + gapX)));
    const rows = Math.max(0, Math.floor((height + gapY) / (cellHeight + gapY)));
    return {
      rows,
      columns,
      total: rows * columns,
      usedWidth: span(columns, cellWidth, gapX),
      usedHeight: span(rows, cellHeight, gapY)
    };
  }

  function pickBetterLayout(current, candidate) {
    if (!candidate || candidate.total <= 0) return current;
    if (!current || candidate.total > current.total) return candidate;
    if (candidate.total === current.total && candidate.usage > current.usage) return candidate;
    return current;
  }

  const state = {
    sheetUnit: 'mm',
    imageUnit: 'mm',
    sheet: { width: 210, height: 297 },
    image: { width: NaN, height: NaN },
    canonical: {
      sheet: { width: 210, height: 297 },
      image: { width: NaN, height: NaN }
    },
    margin: 5,
    gapX: 3,
    gapY: 3,
    preset: 'a4',
    lockRatio: false,
    allowRotation: true,
    linkGaps: true,
    aspectRatio: null
  };

  /* Theme handling */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.setAttribute('aria-checked', theme === 'dark');
    themeToggle.querySelector('.theme-switch__label').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
    try {
      localStorage.setItem('theme', theme);
    } catch (err) {
      /* ignore storage issues */
    }
  }

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  /* Unit handling */
  unitGroups.sheet.forEach((btn) => {
    btn.addEventListener('click', () => setSheetUnit(btn.dataset.unit));
  });

  unitGroups.image.forEach((btn) => {
    btn.addEventListener('click', () => setImageUnit(btn.dataset.unit));
  });

  function roundForUnit(value, unit) {
    if (!Number.isFinite(value)) return value;
    if (unit === 'mm') return Math.round(value);
    if (unit === 'cm' || unit === 'in') return Math.round(value * 10) / 10;
    return +value.toFixed(2);
  }

  function dimensionStepForUnit(unit) {
    if (unit === 'mm') return 1;
    if (unit === 'cm') return 0.1;
    if (unit === 'in') return 0.05;
    return 0.01;
  }

  function toMillimeters(value, unit) {
    if (!Number.isFinite(value)) return NaN;
    return value * UNIT_FACTORS_MM[unit];
  }

  function fromMillimeters(value, unit) {
    if (!Number.isFinite(value)) return NaN;
    return value / UNIT_FACTORS_MM[unit];
  }

  function unitForKey(key) {
    if (key === 'sheetWidth' || key === 'sheetHeight') return state.sheetUnit;
    if (key === 'imageWidth' || key === 'imageHeight') return state.imageUnit;
    return null;
  }

  function ensureAspectRatio() {
    if (!state.lockRatio) return null;
    if (state.aspectRatio && Number.isFinite(state.aspectRatio) && state.aspectRatio > 0) {
      return state.aspectRatio;
    }
    const w = state.canonical.image.width;
    const h = state.canonical.image.height;
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      state.aspectRatio = w / h;
      return state.aspectRatio;
    }
    return null;
  }

  function setSheetUnit(unit) {
    if (unit === state.sheetUnit) return;
    state.sheetUnit = unit;
    state.sheet.width = roundForUnit(fromMillimeters(state.canonical.sheet.width, unit), unit);
    state.sheet.height = roundForUnit(fromMillimeters(state.canonical.sheet.height, unit), unit);
    syncForm();
  }

  function setImageUnit(unit) {
    if (unit === state.imageUnit) return;
    state.imageUnit = unit;
    state.image.width = roundForUnit(fromMillimeters(state.canonical.image.width, unit), unit);
    state.image.height = roundForUnit(fromMillimeters(state.canonical.image.height, unit), unit);
    syncForm();
  }

  function syncUnitButtons() {
    unitGroups.sheet.forEach((btn) => {
      const checked = btn.dataset.unit === state.sheetUnit;
      btn.setAttribute('aria-checked', checked);
    });
    unitGroups.image.forEach((btn) => {
      const checked = btn.dataset.unit === state.imageUnit;
      btn.setAttribute('aria-checked', checked);
    });
  }

  /* Preset handling */
  const presetSelect = document.getElementById('sheetPreset');
  presetSelect.addEventListener('change', () => {
    const value = presetSelect.value;
    state.preset = value;
    if (value !== 'custom') {
      const preset = PRESETS[value];
      if (preset) {
        state.canonical.sheet.width = preset.width;
        state.canonical.sheet.height = preset.height;
        state.sheet.width = roundForUnit(fromMillimeters(preset.width, state.sheetUnit), state.sheetUnit);
        state.sheet.height = roundForUnit(fromMillimeters(preset.height, state.sheetUnit), state.sheetUnit);
      }
    }
    updateSheetInputsLock();
    syncForm();
  });

  function updateSheetInputsLock() {
    const locked = state.preset !== 'custom';
    if (locked) {
      inputs.sheetWidth.setAttribute('disabled', 'true');
      inputs.sheetHeight.setAttribute('disabled', 'true');
      if (sheetDimensionsRow) sheetDimensionsRow.setAttribute('data-hidden', 'true');
      if (unitFieldset) unitFieldset.setAttribute('data-hidden', 'true');
    } else {
      inputs.sheetWidth.removeAttribute('disabled');
      inputs.sheetHeight.removeAttribute('disabled');
      if (sheetDimensionsRow) sheetDimensionsRow.removeAttribute('data-hidden');
      if (unitFieldset) unitFieldset.removeAttribute('data-hidden');
    }
  }

  /* Form inputs binding */
  const inputs = {
    sheetWidth: document.getElementById('sheetWidth'),
    sheetHeight: document.getElementById('sheetHeight'),
    imageWidth: document.getElementById('imageWidth'),
    imageHeight: document.getElementById('imageHeight'),
    lockRatio: document.getElementById('lockRatio'),
    margin: document.getElementById('margin'),
    gapX: document.getElementById('gapX'),
    gapY: document.getElementById('gapY'),
    allowRotation: document.getElementById('allowRotation'),
    linkGaps: document.getElementById('linkGaps')
  };

  Object.entries(inputs).forEach(([key, input]) => {
    input.addEventListener('input', () => handleInput(key, input));
    input.addEventListener('blur', () => validateField(key, input));
  });

  function handleInput(key, input) {
    if (key === 'lockRatio') {
      state.lockRatio = input.checked;
      if (!state.lockRatio) {
        state.aspectRatio = null;
      } else {
        ensureAspectRatio();
      }
      return;
    }
    if (key === 'allowRotation') {
      state.allowRotation = input.checked;
      calculateAndRender();
      return;
    }
    if (key === 'linkGaps') {
      state.linkGaps = input.checked;
      if (state.linkGaps) {
        const reference = Number.isFinite(state.gapX) ? state.gapX : state.gapY;
        if (Number.isFinite(reference)) {
          unifyGapValues(reference);
        }
      }
      calculateAndRender();
      return;
    }
    const val = parseFloat(input.value);
    let normalized = val;
    const fieldUnit = unitForKey(key);
    if (fieldUnit) {
      if (fieldUnit === 'mm') {
        normalized = Math.round(val);
      } else if (fieldUnit === 'cm' || fieldUnit === 'in') {
        normalized = Math.round(val * 10) / 10;
      }
      if (!Number.isNaN(normalized)) input.value = normalized;
    }
    if (Number.isNaN(normalized)) {
      setStateValue(key, NaN);
      return;
    }
    if (state.lockRatio && (key === 'imageWidth' || key === 'imageHeight')) {
      const ratio = ensureAspectRatio();
      if (ratio) {
        setStateValue(key, normalized);
        if (key === 'imageWidth') {
          const updatedWidthMm = state.canonical.image.width;
          const nextHeight = updatedWidthMm / ratio;
          const nextHeightDisplay = roundForUnit(fromMillimeters(nextHeight, state.imageUnit), state.imageUnit);
          setStateValue('imageHeight', nextHeightDisplay);
        } else {
          const updatedHeightMm = state.canonical.image.height;
          const nextWidth = updatedHeightMm * ratio;
          const nextWidthDisplay = roundForUnit(fromMillimeters(nextWidth, state.imageUnit), state.imageUnit);
          setStateValue('imageWidth', nextWidthDisplay);
        }
        syncForm();
        calculateAndRender();
        return;
      }
    }
    setStateValue(key, normalized);
    if (state.linkGaps && Number.isFinite(normalized) && (key === 'gapX' || key === 'gapY')) {
      mirrorGapValue(key, normalized);
    }
    calculateAndRender();
  }

  function setStateValue(key, value) {
    switch (key) {
      case 'sheetWidth':
        state.sheet.width = value;
        state.canonical.sheet.width = Number.isFinite(value) ? toMillimeters(value, state.sheetUnit) : NaN;
        break;
      case 'sheetHeight':
        state.sheet.height = value;
        state.canonical.sheet.height = Number.isFinite(value) ? toMillimeters(value, state.sheetUnit) : NaN;
        break;
      case 'imageWidth':
        state.image.width = value;
        state.canonical.image.width = Number.isFinite(value) ? toMillimeters(value, state.imageUnit) : NaN;
        if (!state.lockRatio) {
          state.aspectRatio = null;
        } else if (!Number.isFinite(state.canonical.image.width) || !Number.isFinite(state.canonical.image.height)) {
          state.aspectRatio = null;
        }
        break;
      case 'imageHeight':
        state.image.height = value;
        state.canonical.image.height = Number.isFinite(value) ? toMillimeters(value, state.imageUnit) : NaN;
        if (!state.lockRatio) {
          state.aspectRatio = null;
        } else if (!Number.isFinite(state.canonical.image.width) || !Number.isFinite(state.canonical.image.height)) {
          state.aspectRatio = null;
        }
        break;
      case 'margin':
        state.margin = Math.max(0, Math.round(value));
        inputs.margin.value = state.margin;
        break;
      case 'gapX':
        state.gapX = value;
        break;
      case 'gapY':
        state.gapY = value;
        break;
      default:
        break;
    }
  }

  function mirrorGapValue(sourceKey, value) {
    if (!Number.isFinite(value)) return;
    const targetKey = sourceKey === 'gapX' ? 'gapY' : 'gapX';
    setStateValue(targetKey, value);
    if (inputs[targetKey]) {
      inputs[targetKey].value = value;
    }
  }

  function unifyGapValues(value) {
    if (!Number.isFinite(value)) return;
    setStateValue('gapX', value);
    setStateValue('gapY', value);
    if (inputs.gapX) inputs.gapX.value = value;
    if (inputs.gapY) inputs.gapY.value = value;
  }

  function validateField(key, input) {
    const textEl = helperTexts.find((el) => el.dataset.field === key);
    if (!textEl) return;
    let message = '';
    const val = parseFloat(input.value);
    if (Number.isNaN(val)) {
      message = 'Requerido.';
    } else if (['sheetWidth', 'sheetHeight', 'imageWidth', 'imageHeight'].includes(key)) {
      const unit = unitForKey(key) || state.sheetUnit;
      const limits = LIMITS[unit];
      if (limits && (val < limits.min || val > limits.max)) {
        message = `Debe estar entre ${limits.min} y ${limits.max} ${unit}.`;
      }
    } else if (val < 0) {
      message = 'Debe ser positivo.';
    }
    textEl.textContent = message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    return !message;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculateAndRender();
  });

  function calculateAndRender() {
    const results = computeLayouts();
    updateMetrics(results);
    renderPreviews(results);
    renderStatus(results);
  }

  function computeLayouts() {
    const sheetW = state.canonical.sheet.width;
    const sheetH = state.canonical.sheet.height;
    const imageW = state.canonical.image.width;
    const imageH = state.canonical.image.height;
    const margin = Math.max(0, state.margin);
    const gapX = Math.max(0, state.gapX);
    const gapY = Math.max(0, state.gapY);

    const strict = layoutCalculation(sheetW, sheetH, imageW, imageH, margin, gapX, gapY);
    let optimized = strict;
    if (state.allowRotation) {
      const rotated = layoutCalculation(sheetW, sheetH, imageH, imageW, margin, gapX, gapY, true);
      optimized = pickBetterLayout(optimized, rotated);

      const hybridNormal = layoutHybrid(
        sheetW,
        sheetH,
        { width: imageW, height: imageH },
        { width: imageH, height: imageW },
        margin,
        gapX,
        gapY,
        { primary: 'Original', secondary: 'Rotado', primaryRotated: false }
      );
      optimized = pickBetterLayout(optimized, hybridNormal);

      const hybridRotatedFirst = layoutHybrid(
        sheetW,
        sheetH,
        { width: imageH, height: imageW },
        { width: imageW, height: imageH },
        margin,
        gapX,
        gapY,
        { primary: 'Rotado', secondary: 'Original', primaryRotated: true }
      );
      optimized = pickBetterLayout(optimized, hybridRotatedFirst);
    }
    return { strict, optimized };
  }

  function layoutCalculation(sheetW, sheetH, imgW, imgH, margin, gapX, gapY, rotated = false) {
    const printableW = sheetW - margin * 2;
    const printableH = sheetH - margin * 2;
    const stats = gridStats(printableW, printableH, imgW, imgH, gapX, gapY);
    const sheetArea = sheetW * sheetH;
    const label = rotated ? 'Rotado' : 'Original';
    const summaryText = rotated ? `${stats.rows} × ${stats.columns} (${label})` : `${stats.rows} × ${stats.columns}`;
    const base = {
      sheet: { width: sheetW, height: sheetH, margin },
      cell: { width: imgW, height: imgH },
      gap: { x: gapX, y: gapY },
      rotated
    };
    if (!stats.total) {
      return {
        total: 0,
        rows: 0,
        columns: 0,
        usage: 0,
        summary: '--',
        segments: [],
        ...base
      };
    }
    const usedArea = stats.total * (imgW * imgH);
    const usage = sheetArea ? (usedArea / sheetArea) * 100 : 0;
    const segment = {
      rows: stats.rows,
      columns: stats.columns,
      cell: { width: imgW, height: imgH },
      offset: { x: 0, y: 0 },
      gap: { x: gapX, y: gapY },
      total: stats.total,
      label
    };
    return {
      total: stats.total,
      rows: stats.rows,
      columns: stats.columns,
      usage,
      summary: summaryText,
      segments: [segment],
      ...base
    };
  }

  function layoutHybrid(sheetW, sheetH, primaryDims, secondaryDims, margin, gapX, gapY, labels = {}) {
    const printableW = sheetW - margin * 2;
    const printableH = sheetH - margin * 2;
    if (printableW <= 0 || printableH <= 0) return null;
    const baseStats = gridStats(printableW, printableH, primaryDims.width, primaryDims.height, gapX, gapY);
    if (!baseStats.total) return null;
    const sheetArea = sheetW * sheetH;
    const primaryLabel = labels.primary || 'Original';
    const secondaryLabel = labels.secondary || 'Rotado';

    const baseSegmentTemplate = {
      rows: baseStats.rows,
      columns: baseStats.columns,
      cell: { width: primaryDims.width, height: primaryDims.height },
      offset: { x: 0, y: 0 },
      gap: { x: gapX, y: gapY },
      total: baseStats.total,
      label: primaryLabel
    };

    const layouts = [];

    function buildLayout(extraStats, offsetX, offsetY) {
      if (!extraStats || !extraStats.total) return null;
      const segments = [
        {
          rows: baseSegmentTemplate.rows,
          columns: baseSegmentTemplate.columns,
          cell: { ...baseSegmentTemplate.cell },
          offset: { ...baseSegmentTemplate.offset },
          gap: { ...baseSegmentTemplate.gap },
          total: baseSegmentTemplate.total,
          label: primaryLabel
        },
        {
          rows: extraStats.rows,
          columns: extraStats.columns,
          cell: { width: secondaryDims.width, height: secondaryDims.height },
          offset: { x: offsetX, y: offsetY },
          gap: { x: gapX, y: gapY },
          total: extraStats.total,
          label: secondaryLabel
        }
      ];
      const total = baseStats.total + extraStats.total;
      const usedArea = baseStats.total * primaryDims.width * primaryDims.height + extraStats.total * secondaryDims.width * secondaryDims.height;
      const summary = `${baseStats.rows} × ${baseStats.columns} (${primaryLabel}) + ${extraStats.rows} × ${extraStats.columns} (${secondaryLabel})`;
      return {
        total,
        rows: baseStats.rows,
        columns: baseStats.columns,
        usage: sheetArea ? (usedArea / sheetArea) * 100 : 0,
        summary,
        sheet: { width: sheetW, height: sheetH, margin },
        cell: { width: primaryDims.width, height: primaryDims.height },
        gap: { x: gapX, y: gapY },
        rotated: labels.primaryRotated || false,
        mode: 'hybrid',
        segments
      };
    }

    const baseUsedHeight = baseStats.usedHeight;
    const offsetY = baseUsedHeight > 0 ? baseUsedHeight + (baseStats.rows > 0 ? gapY : 0) : 0;
    const availableHeight = printableH - offsetY;
    if (availableHeight > 0) {
      const extraHeightStats = gridStats(printableW, availableHeight, secondaryDims.width, secondaryDims.height, gapX, gapY);
      const layout = buildLayout(extraHeightStats, 0, offsetY);
      if (layout) layouts.push(layout);
    }

    const baseUsedWidth = baseStats.usedWidth;
    const offsetX = baseUsedWidth > 0 ? baseUsedWidth + (baseStats.columns > 0 ? gapX : 0) : 0;
    const availableWidth = printableW - offsetX;
    if (availableWidth > 0) {
      const extraWidthStats = gridStats(availableWidth, printableH, secondaryDims.width, secondaryDims.height, gapX, gapY);
      const layout = buildLayout(extraWidthStats, offsetX, 0);
      if (layout) layouts.push(layout);
    }

    if (!layouts.length) return null;
    return layouts.reduce((best, candidate) => pickBetterLayout(best, candidate), null);
  }

  function noLayout(rotated) {
    return { total: 0, rows: 0, columns: 0, usage: 0, rotated, sheet: { width: 0, height: 0, margin: 0 }, cell: { width: 0, height: 0 }, gap: { x: 0, y: 0 } };
  }

  function updateMetrics(results) {
    const strict = toMetricSnapshot('Estricto', results.strict);
    const optimized = toMetricSnapshot('Modo optimizado', results.optimized);
    const showOptimized = optimized.total > strict.total;
    const primary = showOptimized ? optimized : strict;
    const secondary = showOptimized ? strict : null;

    metricPieces.innerHTML = renderMetricBlock(primary, secondary, (data) => data.total);
    metricUsage.innerHTML = renderMetricBlock(primary, secondary, (data) => `${data.usage.toFixed(1)}%`);
    metricWaste.innerHTML = renderMetricBlock(primary, secondary, (data) => `${(100 - data.usage).toFixed(1)}%`);
  }

  function toMetricSnapshot(label, data) {
    if (!data || !Number.isFinite(data.total) || data.total <= 0) {
      return { label, total: 0, rows: 0, columns: 0, usage: 0, summary: '--' };
    }
    return {
      label,
      total: data.total,
      rows: data.rows,
      columns: data.columns,
      usage: Math.max(0, Math.min(100, data.usage)),
      summary: data.summary || `${data.rows} × ${data.columns}`
    };
  }

  function renderMetricBlock(primary, secondary, formatter) {
    const format = formatter || ((data) => data.total);
    const primaryValue = primary.total > 0 ? format(primary) : '--';
    if (!secondary) {
      return `<strong>${primaryValue}</strong>`;
    }
    const secondaryValue = secondary.total > 0 ? format(secondary) : '--';
    return `<div class="metric-chip"><strong>${primaryValue}</strong><span>${secondary.label}: ${secondaryValue}</span></div>`;
  }

  function renderPreviews(results) {
    previewContainer.innerHTML = '';
    const hasStrict = results.strict.total > 0;
    const hasOptimized = results.optimized.total > 0;

    if (!hasStrict && !hasOptimized) {
      const empty = document.createElement('p');
      empty.textContent = 'Completa los datos para ver el diseño.';
      previewContainer.appendChild(empty);
      return;
    }

    const pair = document.createElement('div');
    pair.className = 'preview-pair';
    if (hasStrict && hasOptimized) {
      pair.classList.add('preview-pair--split');
    }
    previewContainer.appendChild(pair);

    if (hasOptimized) {
      const gain = Math.max(0, results.optimized.total - (results.strict.total || 0));
      pair.appendChild(createCard('optimized', results.optimized, gain, results));
    }

    if (hasStrict) {
      pair.appendChild(createCard('strict', results.strict));
    }
  }

  function createCard(type, data, gain = 0, allResults) {
    const card = document.createElement('article');
    const isStrict = type === 'strict';
    card.className = `preview-card preview-card--${type}`;

    const header = document.createElement('header');
    header.className = 'preview-card__header';
    const title = document.createElement('h3');
    title.textContent = isStrict ? 'Modo estricto' : 'Modo optimizado';
    header.appendChild(title);

    if (!isStrict && gain > 0) {
      const percentGain = allResults ? Math.round(Math.max(0, allResults.optimized.usage - allResults.strict.usage)) : 0;
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `+${gain} piezas (+${percentGain}%)`;
      header.appendChild(badge);
    }
    card.appendChild(header);

    const stage = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    stage.setAttribute('viewBox', '0 0 140 100');
    stage.setAttribute('class', 'preview-stage');

    const viewport = computeViewport(data.sheet.width, data.sheet.height);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', viewport.offsetX);
    rect.setAttribute('y', viewport.offsetY);
    rect.setAttribute('width', viewport.width);
    rect.setAttribute('height', viewport.height);
    rect.setAttribute('rx', '0');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'var(--color-border-strong)');
    rect.setAttribute('stroke-width', '0.8');
    stage.appendChild(rect);

    const printableWidth = Math.max(0, (data.sheet.width - 2 * data.sheet.margin) * viewport.scale);
    const printableHeight = Math.max(0, (data.sheet.height - 2 * data.sheet.margin) * viewport.scale);
    if (printableWidth > 0 && printableHeight > 0) {
      const printable = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      printable.setAttribute('x', viewport.offsetX + data.sheet.margin * viewport.scale);
      printable.setAttribute('y', viewport.offsetY + data.sheet.margin * viewport.scale);
      printable.setAttribute('width', printableWidth);
      printable.setAttribute('height', printableHeight);
      printable.setAttribute('rx', '0');
      printable.setAttribute('fill', 'rgba(255,255,255,0.3)');
      stage.appendChild(printable);
    }

    const marginOffsetX = viewport.offsetX + data.sheet.margin * viewport.scale;
    const marginOffsetY = viewport.offsetY + data.sheet.margin * viewport.scale;
    const segments = Array.isArray(data.segments) && data.segments.length
      ? data.segments
      : [
          {
            rows: data.rows,
            columns: data.columns,
            cell: data.cell ? { ...data.cell } : { width: 0, height: 0 },
            offset: { x: 0, y: 0 },
            gap: data.gap ? { ...data.gap } : { x: 0, y: 0 },
            total: data.total,
            label: data.rotated ? 'Rotado' : 'Original'
          }
        ];

    segments.forEach((segment) => {
      const tileWidth = Math.max(0, (segment.cell?.width || 0) * viewport.scale);
      const tileHeight = Math.max(0, (segment.cell?.height || 0) * viewport.scale);
      const gapX = segment.gap?.x ?? data.gap.x ?? 0;
      const gapY = segment.gap?.y ?? data.gap.y ?? 0;
      const stepX = ((segment.cell?.width || 0) + gapX) * viewport.scale;
      const stepY = ((segment.cell?.height || 0) + gapY) * viewport.scale;
      const baseX = marginOffsetX + (segment.offset?.x || 0) * viewport.scale;
      const baseY = marginOffsetY + (segment.offset?.y || 0) * viewport.scale;
      const rowLimit = Math.max(0, segment.rows || 0);
      const colLimit = Math.max(0, segment.columns || 0);
      for (let row = 0; row < rowLimit; row += 1) {
        for (let col = 0; col < colLimit; col += 1) {
          const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          const x = baseX + col * stepX;
          const y = baseY + row * stepY;
          cell.setAttribute('x', x);
          cell.setAttribute('y', y);
          cell.setAttribute('width', Math.max(0, tileWidth));
          cell.setAttribute('height', Math.max(0, tileHeight));
          cell.setAttribute('fill', isStrict ? 'var(--color-strict-pattern)' : 'var(--color-optimized-pattern)');
          cell.setAttribute('stroke', isStrict ? 'var(--color-strict)' : 'var(--color-optimized)');
          const isRotatedSegment = (segment.label || '').toLowerCase().includes('rotado');
          cell.setAttribute('fill-opacity', isRotatedSegment ? '0.7' : '1');
          cell.removeAttribute('stroke-dasharray');
          cell.setAttribute('stroke-width', '0.4');
          stage.appendChild(cell);
        }
      }
    });

    const summary = document.createElement('p');
    summary.className = 'preview-card__summary';
    summary.textContent = `${data.total} piezas - ${data.summary || ''}`;
    card.appendChild(stage);
    card.appendChild(summary);
    return card;
  }

  function computeViewport(sheetWidth, sheetHeight) {
    const VIEW_W = 140;
    const VIEW_H = 100;
    const PADDING = 12;
    const baseW = Math.max(sheetWidth || 1, 1);
    const baseH = Math.max(sheetHeight || 1, 1);
    const maxW = VIEW_W - PADDING * 2;
    const maxH = VIEW_H - PADDING * 2;
    const scale = Math.min(maxW / baseW, maxH / baseH);
    const width = baseW * scale;
    const height = baseH * scale;
    return {
      scale,
      width,
      height,
      offsetX: (VIEW_W - width) / 2,
      offsetY: (VIEW_H - height) / 2
    };
  }

  function renderStatus(results) {
    if (!results.strict.total && !results.optimized.total) {
      statusEl.textContent = 'Sin disposición válida: revisa dimensiones, márgenes y gaps.';
      return;
    }
    if (results.optimized.total > results.strict.total) {
      statusEl.textContent = 'Se encontró una mejora automática.';
    } else {
      statusEl.textContent = '';
    }
  }

  function syncForm() {
    inputs.sheetWidth.value = Number.isFinite(state.sheet.width) ? state.sheet.width : '';
    inputs.sheetHeight.value = Number.isFinite(state.sheet.height) ? state.sheet.height : '';
    inputs.imageWidth.value = Number.isFinite(state.image.width) ? state.image.width : '';
    inputs.imageHeight.value = Number.isFinite(state.image.height) ? state.image.height : '';
    inputs.margin.value = state.margin;
    inputs.gapX.value = state.gapX;
    inputs.gapY.value = state.gapY;
    inputs.lockRatio.checked = state.lockRatio;
    inputs.allowRotation.checked = state.allowRotation;
    inputs.linkGaps.checked = state.linkGaps;
    syncUnitButtons();
    updateSheetInputsLock();
    updateDimensionSteps();
  }

  function updateDimensionSteps() {
    const sheetStep = dimensionStepForUnit(state.sheetUnit);
    const sheetMin = LIMITS[state.sheetUnit]?.min ?? 0.01;
    ['sheetWidth', 'sheetHeight'].forEach((key) => {
      if (!inputs[key]) return;
      inputs[key].setAttribute('step', sheetStep);
      inputs[key].setAttribute('min', sheetMin);
    });
    const imageStep = dimensionStepForUnit(state.imageUnit);
    const imageMin = LIMITS[state.imageUnit]?.min ?? 0.01;
    ['imageWidth', 'imageHeight'].forEach((key) => {
      if (!inputs[key]) return;
      inputs[key].setAttribute('step', imageStep);
      inputs[key].setAttribute('min', imageMin);
    });
  }

  function init() {
    updateSheetInputsLock();
    syncForm();
    calculateAndRender();
  }

  init();
})();
