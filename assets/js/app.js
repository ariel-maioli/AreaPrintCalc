(function () {
  const form = document.getElementById('layoutForm');
  const statusEl = document.getElementById('formStatus');
  const metricPieces = document.getElementById('metricPieces');
  const metricGrid = document.getElementById('metricGrid');
  const metricUsage = document.getElementById('metricUsage');
  const metricWaste = document.getElementById('metricWaste');
  const previewContainer = document.getElementById('previewContainer');
  const sheetDimensionsRow = document.querySelector('.sheet-dimensions');
  const unitButtons = Array.from(document.querySelectorAll('.segmented button'));
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

  const state = {
    unit: 'mm',
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
  unitButtons.forEach((btn) => {
    btn.addEventListener('click', () => setUnit(btn.dataset.unit));
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

  function setUnit(unit) {
    if (unit === state.unit) return;
    state.unit = unit;
    state.sheet.width = roundForUnit(fromMillimeters(state.canonical.sheet.width, unit), unit);
    state.sheet.height = roundForUnit(fromMillimeters(state.canonical.sheet.height, unit), unit);
    state.image.width = roundForUnit(fromMillimeters(state.canonical.image.width, unit), unit);
    state.image.height = roundForUnit(fromMillimeters(state.canonical.image.height, unit), unit);
    syncForm();
  }

  function syncUnitButtons() {
    unitButtons.forEach((btn) => {
      const checked = btn.dataset.unit === state.unit;
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
        state.sheet.width = roundForUnit(fromMillimeters(preset.width, state.unit), state.unit);
        state.sheet.height = roundForUnit(fromMillimeters(preset.height, state.unit), state.unit);
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
    } else {
      inputs.sheetWidth.removeAttribute('disabled');
      inputs.sheetHeight.removeAttribute('disabled');
      if (sheetDimensionsRow) sheetDimensionsRow.removeAttribute('data-hidden');
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
    allowRotation: document.getElementById('allowRotation')
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
    const val = parseFloat(input.value);
    let normalized = val;
    if (['sheetWidth', 'sheetHeight', 'imageWidth', 'imageHeight'].includes(key)) {
      if (state.unit === 'mm') {
        normalized = Math.round(val);
      } else if (state.unit === 'cm' || state.unit === 'in') {
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
          const nextHeightDisplay = roundForUnit(fromMillimeters(nextHeight, state.unit), state.unit);
          setStateValue('imageHeight', nextHeightDisplay);
        } else {
          const updatedHeightMm = state.canonical.image.height;
          const nextWidth = updatedHeightMm * ratio;
          const nextWidthDisplay = roundForUnit(fromMillimeters(nextWidth, state.unit), state.unit);
          setStateValue('imageWidth', nextWidthDisplay);
        }
        syncForm();
        calculateAndRender();
        return;
      }
    }
    setStateValue(key, normalized);
    calculateAndRender();
  }

  function setStateValue(key, value) {
    switch (key) {
      case 'sheetWidth':
        state.sheet.width = value;
        state.canonical.sheet.width = toMillimeters(value, state.unit);
        break;
      case 'sheetHeight':
        state.sheet.height = value;
        state.canonical.sheet.height = toMillimeters(value, state.unit);
        break;
      case 'imageWidth':
        state.image.width = value;
        state.canonical.image.width = Number.isFinite(value) ? toMillimeters(value, state.unit) : NaN;
        if (!state.lockRatio) {
          state.aspectRatio = null;
        } else if (!Number.isFinite(state.canonical.image.width) || !Number.isFinite(state.canonical.image.height)) {
          state.aspectRatio = null;
        }
        break;
      case 'imageHeight':
        state.image.height = value;
        state.canonical.image.height = Number.isFinite(value) ? toMillimeters(value, state.unit) : NaN;
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

  function validateField(key, input) {
    const textEl = helperTexts.find((el) => el.dataset.field === key);
    if (!textEl) return;
    const limits = LIMITS[state.unit];
    let message = '';
    const val = parseFloat(input.value);
    if (Number.isNaN(val)) {
      message = 'Requerido.';
    } else if (['sheetWidth', 'sheetHeight', 'imageWidth', 'imageHeight'].includes(key)) {
      if (val < limits.min || val > limits.max) {
        message = `Debe estar entre ${limits.min} y ${limits.max} ${state.unit}.`;
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
      optimized = rotated.total > strict.total ? rotated : strict;
    }
    return { strict, optimized };
  }

  function layoutCalculation(sheetW, sheetH, imgW, imgH, margin, gapX, gapY, rotated = false) {
    const usableW = sheetW - margin * 2 + gapX;
    const usableH = sheetH - margin * 2 + gapY;
    const cellW = imgW + gapX;
    const cellH = imgH + gapY;
    const base = {
      sheet: { width: sheetW, height: sheetH, margin },
      cell: { width: imgW, height: imgH },
      gap: { x: gapX, y: gapY },
      rotated
    };
    if (usableW <= 0 || usableH <= 0 || cellW <= 0 || cellH <= 0) {
      return {
        total: 0,
        rows: 0,
        columns: 0,
        usage: 0,
        ...base
      };
    }
    const columns = Math.max(0, Math.floor(usableW / cellW));
    const rows = Math.max(0, Math.floor(usableH / cellH));
    const total = rows * columns;
    const sheetArea = sheetW * sheetH;
    const usedArea = total * (imgW * imgH);
    const usage = sheetArea ? (usedArea / sheetArea) * 100 : 0;
    return {
      total,
      rows,
      columns,
      usage,
      ...base
    };
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
    metricGrid.innerHTML = renderMetricBlock(primary, secondary, (data) => `${data.rows} × ${data.columns}`);
    metricUsage.innerHTML = renderMetricBlock(primary, secondary, (data) => `${data.usage.toFixed(1)}%`);
    metricWaste.innerHTML = renderMetricBlock(primary, secondary, (data) => `${(100 - data.usage).toFixed(1)}%`);
  }

  function toMetricSnapshot(label, data) {
    if (!data || !Number.isFinite(data.total) || data.total <= 0) {
      return { label, total: 0, rows: 0, columns: 0, usage: 0 };
    }
    return { label, total: data.total, rows: data.rows, columns: data.columns, usage: Math.max(0, Math.min(100, data.usage)) };
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
    if (!results.strict.total && !results.optimized.total) {
      const empty = document.createElement('p');
      empty.textContent = 'Completa los datos para ver el diseño.';
      previewContainer.appendChild(empty);
      return;
    }
    const showOptimized = results.optimized.total > results.strict.total;
    previewContainer.appendChild(createCard('strict', results.strict));
    if (showOptimized) {
      previewContainer.appendChild(createCard('optimized', results.optimized, results.optimized.total - results.strict.total, results));
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
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', isStrict ? 'var(--color-strict)' : 'var(--color-optimized)');
    rect.setAttribute('stroke-width', '1.5');
    stage.appendChild(rect);

    const printableWidth = Math.max(0, (data.sheet.width - 2 * data.sheet.margin) * viewport.scale);
    const printableHeight = Math.max(0, (data.sheet.height - 2 * data.sheet.margin) * viewport.scale);
    if (printableWidth > 0 && printableHeight > 0) {
      const printable = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      printable.setAttribute('x', viewport.offsetX + data.sheet.margin * viewport.scale);
      printable.setAttribute('y', viewport.offsetY + data.sheet.margin * viewport.scale);
      printable.setAttribute('width', printableWidth);
      printable.setAttribute('height', printableHeight);
      printable.setAttribute('rx', '4');
      printable.setAttribute('fill', 'rgba(255,255,255,0.3)');
      stage.appendChild(printable);
    }

    const marginOffsetX = viewport.offsetX + data.sheet.margin * viewport.scale;
    const marginOffsetY = viewport.offsetY + data.sheet.margin * viewport.scale;
    const tileWidth = Math.max(0, data.cell.width * viewport.scale);
    const tileHeight = Math.max(0, data.cell.height * viewport.scale);
    const stepX = (data.cell.width + data.gap.x) * viewport.scale;
    const stepY = (data.cell.height + data.gap.y) * viewport.scale;

    let placed = 0;
    outer: for (let row = 0; row < data.rows; row += 1) {
      for (let col = 0; col < data.columns; col += 1) {
        if (placed >= data.total) break outer;
        const cell = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const x = marginOffsetX + col * stepX;
        const y = marginOffsetY + row * stepY;
        cell.setAttribute('x', x);
        cell.setAttribute('y', y);
        cell.setAttribute('width', Math.max(0, tileWidth));
        cell.setAttribute('height', Math.max(0, tileHeight));
        cell.setAttribute('fill', isStrict ? 'var(--color-strict-pattern)' : 'var(--color-optimized-pattern)');
        cell.setAttribute('stroke', isStrict ? 'var(--color-strict)' : 'var(--color-optimized)');
        cell.setAttribute('stroke-width', '0.4');
        stage.appendChild(cell);
        placed += 1;
      }
    }
    card.appendChild(stage);
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
    syncUnitButtons();
    updateSheetInputsLock();
    updateDimensionSteps();
  }

  function updateDimensionSteps() {
    const stepValue = dimensionStepForUnit(state.unit);
    const minValue = LIMITS[state.unit]?.min ?? 0.01;
    ['sheetWidth', 'sheetHeight', 'imageWidth', 'imageHeight'].forEach((key) => {
      if (!inputs[key]) return;
      inputs[key].setAttribute('step', stepValue);
      inputs[key].setAttribute('min', minValue);
    });
  }

  function init() {
    updateSheetInputsLock();
    syncForm();
    calculateAndRender();
  }

  init();
})();
