// BandSelector V2.02.2 – A plugin to switch bands and modify AM bandwidth options
// -------------------------------------------------------------------------------------

/* global document, socket, WebSocket */
(() => {
// ─────────────────────────────────────────────────────────────────────────────
// Band Selector – Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enable custom AM bandwidth handling.
 * REQUIRES the ESP32-FM firmware by Sjef Verhoeven (PE5PVB).
 * If your firmware does not accept AM BW, set this to false.
 */
const ENABLE_AM_BW = false;

/**
 * Automatically select a default AM bandwidth when entering AM mode (< 27 MHz).
 * EFFECTIVE ONLY if:
 *   - ENABLE_AM_BW === true, and
 *   - You are running the ESP32-FM firmware.
 * Set to false to keep the firmware/server’s default selection.
 */
const ENABLE_DEFAULT_AM_BW = false;

/**
 * The default AM bandwidth to select when ENABLE_DEFAULT_AM_BW is true.
 * EFFECTIVE ONLY with ESP32-FM AND when ENABLE_AM_BW === true.
 *
 * IMPORTANT:
 * - Must be one of the keys in AM_BW_MAPPING.
 * - Keys are in Hz (strings), matching <li data-value="..."> values.
 *   Example mapping:
 *     '56000' → 3 kHz
 *     '64000' → 4 kHz
 *     '72000' → 6 kHz
 *     '84000' → 8 kHz
 *
 * Example: '56000' selects 3 kHz by default.
 */
const DEFAULT_AM_BW_VALUE = '56000';

/**
 * Which bands are shown in the UI.
 * Order matters for the mobile selector; items must match keys in ALL_BANDS.
 * Default: ['FM', 'OIRT', 'SW', 'MW', 'LW'];
 */
const ENABLED_BANDS = ['FM', 'OIRT', 'SW', 'MW', 'LW'];

/**
 * Enable/disable saving the last tuned frequency for each band to localStorage.
 * Set to false to always tune to the default frequency for a band.
 */
const ENABLE_FREQUENCY_MEMORY = true;

// (Optional) Developer-friendly warning if someone toggles defaults without the feature:
if (!ENABLE_AM_BW && (typeof console !== 'undefined')) {
  if (ENABLE_DEFAULT_AM_BW) {
    console.warn('[BandSelector] ENABLE_DEFAULT_AM_BW is set but ENABLE_AM_BW is false; default BW selection will be ignored.');
  }
}
// ==========================================================================
// END OF CONFIGURATION
// ==========================================================================
const AM_BW_MAPPING = {
  '56000': 3,  // 56 kHz → 3 kHz
  '64000': 4,  // 64 kHz → 4 kHz
  '72000': 6,  // 72 kHz → 6 kHz
  '84000': 8   // 84 kHz → 8 kHz
};

document.addEventListener("DOMContentLoaded", () => {
  if (typeof socket === 'undefined' || socket === null) return;

  const ALL_BANDS = {
    'FM':   { name: 'FM',   tune: 87.500,  start: 87.5,    end: 108.0,   displayUnit: 'MHz' },
    'OIRT': { name: 'OIRT', tune: 65.900,  start: 65.9,    end: 74.0,    displayUnit: 'MHz' },
    'SW':   { name: 'SW',   tune: 9.400,   start: 1.710,     end: 27.0,    displayUnit: 'MHz' },
    'MW':   { name: 'MW',   tune: 0.504,   start: 0.504,   end: 1.701,   displayUnit: 'kHz' },
    'LW':   { name: 'LW',   tune: 0.144,   start: 0.144,   end: 0.351,   displayUnit: 'kHz' },
  };
  const SW_BANDS = {
    '160m': { tune: 1.8, start: 1.8, end: 2.0, displayUnit: 'MHz' }, '120m': { tune: 2.3, start: 2.3, end: 2.5, displayUnit: 'MHz' },
    '90m':  { tune: 3.2, start: 3.2, end: 3.4, displayUnit: 'MHz' }, '75m':  { tune: 3.9, start: 3.9, end: 4.0, displayUnit: 'MHz' },
    '60m':  { tune: 4.75,start: 4.75,end: 5.06,displayUnit: 'MHz' }, '49m':  { tune: 5.9, start: 5.9, end: 6.2, displayUnit: 'MHz' },
    '41m':  { tune: 7.2, start: 7.2, end: 7.6, displayUnit: 'MHz' }, '31m':  { tune: 9.4, start: 9.4, end: 9.9, displayUnit: 'MHz' },
    '25m':  { tune: 11.6,start: 11.6,end: 12.1,displayUnit: 'MHz'},  '22m':  { tune: 13.57,start:13.57,end:13.87,displayUnit: 'MHz'},
    '19m':  { tune: 15.1,start: 15.1,end: 15.83,displayUnit: 'MHz'}, '16m':  { tune: 17.48,start:17.48,end:17.9,displayUnit: 'MHz'},
    '15m':  { tune: 18.9,start: 18.9,end: 19.02,displayUnit: 'MHz'}, '13m':  { tune: 21.45,start:21.45,end:21.85,displayUnit: 'MHz'},
    '11m':  { tune: 25.67,start:25.67,end:26.1,displayUnit: 'MHz'}
  };
  const amBandKeys = ['SW', 'MW', 'LW'];

  let masterBwListTemplates = [];

  const getCurrentFrequencyInMHz = () => { const freqText = dataFrequencyElement.textContent; let freqValue = parseFloat(freqText); if (freqText.toLowerCase().includes('khz')) { freqValue /= 1000; } return freqValue; };

  const initializeBwFilter = () => {
    const bwList = document.querySelector('#data-bw .options');
    if (bwList) {
        masterBwListTemplates = Array.from(bwList.querySelectorAll('li')).map(li => li.cloneNode(true));
    }
  };
  
const getDropdownRoot = (dropdownEl) =>
  dropdownEl?.closest?.('.dropdown') || dropdownEl;

const findDropdownToggler = (root) => {
  return (
    root.querySelector('.selected') ||
    root.querySelector('[data-toggle]') ||
    root.querySelector('.dropdown-toggle') ||
    root.querySelector('summary') || 
    root
  );
};
  
const bwRoot = document.getElementById('data-bw');
if (bwRoot) {
  bwRoot.addEventListener('mousedown', (e) => {
    if ((e.target && e.target.closest('.options li'))) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, { capture: true });
}

const updateBwOptionsForMode = (freqInMHz) => {
  if (!ENABLE_AM_BW) return;

  const bwDropdown = document.getElementById('data-bw');
  const bwList = bwDropdown?.querySelector('.options');
  if (!bwList || masterBwListTemplates.length === 0) return;

  const isAmMode = freqInMHz < 27.0;

  bwList.innerHTML = '';

  if (isAmMode) {
    const amValuesToShow = new Set(['0', ...Object.keys(AM_BW_MAPPING)]);
    masterBwListTemplates.forEach(templateLi => {
      const value = templateLi.dataset.value;
      if (amValuesToShow.has(value)) {
        const newLi = templateLi.cloneNode(true);
        if (AM_BW_MAPPING.hasOwnProperty(value)) {
          newLi.textContent = `${AM_BW_MAPPING[value]} kHz`;
        }
        addClickListener(newLi);
        bwList.appendChild(newLi);
      }
    });

    const justEnteredAm = _prevIsAmMode !== true;
    if (ENABLE_DEFAULT_AM_BW && justEnteredAm && DEFAULT_AM_BW_VALUE) {
      const targetLi = bwList.querySelector(`li[data-value="${DEFAULT_AM_BW_VALUE}"]`);
      if (targetLi) targetLi.click();
    }
  } else {
    masterBwListTemplates.forEach(templateLi => {
      const newLi = templateLi.cloneNode(true);
      addClickListener(newLi);
      bwList.appendChild(newLi);
    });
  }

  _prevIsAmMode = isAmMode;
};

const closeDropdown = (dropdownEl) => {
  const root = dropdownEl.closest('.dropdown') || dropdownEl;
  const options = root.querySelector('.options');
  const selected = root.querySelector('.selected');

  root.classList.remove('open','active','show');
  dropdownEl.classList.remove('open','active','show');
  options?.classList.remove('open','active','show');

  const details = root.tagName === 'DETAILS' ? root : root.querySelector('details');
  if (details) details.open = false;

  root.querySelectorAll('[aria-expanded="true"]').forEach(el => el.setAttribute('aria-expanded','false'));
  selected?.setAttribute('aria-expanded','false');

  root.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(inp => {
    if (inp.checked) {
      inp.checked = false;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  if (document.activeElement && root.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  selected?.blur?.();

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  if (options) {
    const prev = options.getAttribute('style') || '';
    const addSemi = prev && !prev.trim().endsWith(';') ? ';' : '';
    options.setAttribute('style', prev + addSemi + 'display:none;');
    setTimeout(() => {
      const current = options.getAttribute('style') || '';
      const cleaned = current.replace(/(^|;)\s*display\s*:\s*none\s*;?/i, ';').replace(/^;|;;/g, ';').trim();
      if (cleaned) options.setAttribute('style', cleaned);
      else options.removeAttribute('style');
    }, 50);
  }
};

const addClickListener = (element) => {
  element.addEventListener('click', (ev) => {
    ev.stopImmediatePropagation();
    ev.preventDefault();

    const bwDropdown = document.getElementById('data-bw');
    if (!bwDropdown) return;

    const root = getDropdownRoot(bwDropdown);
    const toggler = findDropdownToggler(root);
    const value = element.dataset.value;

    socket.send(`W${value}`);

    const selectedText = root.querySelector('.selected');
    if (selectedText) selectedText.textContent = element.textContent;

    root.style.pointerEvents = 'none';

    closeDropdown?.(bwDropdown);

    setTimeout(() => {
      try {
        if (root.tagName === 'DETAILS') {
          root.open = false;
        } else if (toggler) {
          toggler.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          toggler.setAttribute?.('aria-expanded', 'false');
        }

        if (document.activeElement && root.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      } finally {
        setTimeout(() => { root.style.pointerEvents = ''; }, 120);
      }
    }, 0);
  }, { capture: true });
};

  const LOOP_STORAGE_KEY = 'bandSelectorLoopState';
  const LAST_FREQS_STORAGE_KEY = 'bandSelectorLastFreqs';
  const FULL_SW_MODE_KEY = 'bandSelectorFullSwMode';

  let loopEnabled = localStorage.getItem(LOOP_STORAGE_KEY) === 'true';
  let activeBandForLooping = null;
  let fullSwTuningActive = sessionStorage.getItem(FULL_SW_MODE_KEY) === 'true';
  let _prevIsAmMode = null;

  const freqContainer = document.getElementById("freq-container");
  const dataFrequencyElement = document.getElementById('data-frequency');
  const rtContainer = document.getElementById('rt-container');
  const h2Freq = freqContainer.querySelector('h2');
  const tuneUpButton = document.getElementById('freq-up');
  const tuneDownButton = document.getElementById('freq-down');
  if (!freqContainer || !dataFrequencyElement || !rtContainer || !h2Freq || !tuneUpButton || !tuneDownButton) return;

  const bandRangeContainer = document.createElement("div"); bandRangeContainer.id = "band-range-container"; bandRangeContainer.innerHTML = `<span class="band-range-part band-range-start"></span><span class="range-separator">↔</span><span class="band-range-part band-range-end"></span>`;
  const loopButton = document.createElement("button"); loopButton.className = 'loop-toggle-button'; loopButton.innerHTML = 'Band<br>Loop'; loopButton.title = 'Enable/disable frequency loop'; loopButton.classList.toggle('active', loopEnabled);

  const layoutWrapper = document.createElement('div');
  const sideButtonContainer = document.createElement('div');
  const amBandsViewContainer = document.createElement('div');

  const mobileBandSelectorWrapper = document.createElement('div');
  mobileBandSelectorWrapper.id = 'mobile-band-selector-wrapper';

  const mobileBandSelector = document.createElement('select');
  mobileBandSelector.id = 'mobile-band-selector';

  const mobileBandOrder = ['FM', 'OIRT', 'SW', 'MW', 'LW'];
  mobileBandOrder.forEach(key => {
      if (ENABLED_BANDS.includes(key)) {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = ALL_BANDS[key].name;
          mobileBandSelector.appendChild(option);
      }
  });

  const separator = document.createElement('option');
  separator.disabled = true;
  separator.textContent = '──────────';
  mobileBandSelector.appendChild(separator);

  const loopOption = document.createElement('option');
  loopOption.id = 'mobile-loop-toggle-option';
  loopOption.value = 'toggle-loop';
  loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';
  mobileBandSelector.appendChild(loopOption);

  mobileBandSelectorWrapper.appendChild(mobileBandSelector);

  const tuneToFrequency = (frequencyInMHz) => { if (socket.readyState === WebSocket.OPEN) socket.send("T" + Math.round(frequencyInMHz * 1000)); };
  const updateBandRangeDisplay = (band) => { if (!band) { bandRangeContainer.style.display = 'none'; return; } bandRangeContainer.style.display = 'flex'; const unit = band.displayUnit || 'MHz'; const start = unit === 'kHz' ? Math.round(band.start * 1000) : band.start.toFixed(3); const end = unit === 'kHz' ? Math.round(band.end * 1000) : band.end.toFixed(3); bandRangeContainer.querySelector('.band-range-start').textContent = `${start} ${unit}`; bandRangeContainer.querySelector('.band-range-end').textContent = `${end} ${unit}`; };
  const updateView = (activeBandKey) => { const isAmView = amBandKeys.includes(activeBandKey); rtContainer.style.display = isAmView ? 'none' : 'block'; amBandsViewContainer.style.display = isAmView ? 'grid' : 'none'; };

  const createBandButton = (key, data, cssClass) => {
    const button = document.createElement("button");
    button.className = cssClass;
    button.textContent = data.displayName || key.replace('m', '');
    button.dataset.bandKey = key;
    return button;
  };

  const handleTuneAttempt = (direction, event) => { if (!loopEnabled || !activeBandForLooping) return; const currentFreq = getCurrentFrequencyInMHz(); if (isNaN(currentFreq)) return; const tolerance = 0.0001; let shouldWrap = false; if (direction === 'up' && currentFreq >= activeBandForLooping.end - tolerance) { tuneToFrequency(activeBandForLooping.start); shouldWrap = true; } else if (direction === 'down' && currentFreq <= activeBandForLooping.start + tolerance) { tuneToFrequency(activeBandForLooping.end); shouldWrap = true; } if (shouldWrap && event) { event.preventDefault(); event.stopPropagation(); } };

  const updateVisualsByFrequency = (freqInMHz) => {
    let currentMainKey = null, currentSwKey = null;
    for (const key in ALL_BANDS) { if (ENABLED_BANDS.includes(key) && freqInMHz >= ALL_BANDS[key].start && freqInMHz <= ALL_BANDS[key].end) { currentMainKey = key; break; } }

    if (currentMainKey === 'SW') {
        for (const key in SW_BANDS) {
            if (freqInMHz >= SW_BANDS[key].start && freqInMHz <= SW_BANDS[key].end) {
                currentSwKey = key;
                break;
            }
        }
    }

    if (ENABLE_FREQUENCY_MEMORY) {
        try {
            const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
            if (currentSwKey) { lastFreqs[currentSwKey] = freqInMHz; }
            if (currentMainKey) { lastFreqs[currentMainKey] = freqInMHz; }
            localStorage.setItem(LAST_FREQS_STORAGE_KEY, JSON.stringify(lastFreqs));
        } catch (e) { console.error("Could not save last frequencies:", e); }
    }

    const bandForDisplay = (currentMainKey === 'SW' && fullSwTuningActive)
        ? ALL_BANDS['SW']
        : (SW_BANDS[currentSwKey] || ALL_BANDS[currentMainKey]);

    updateView(currentMainKey);
    updateBandRangeDisplay(bandForDisplay);
    activeBandForLooping = bandForDisplay;
	if (amBandKeys.includes(currentMainKey)) {
        localStorage.setItem('bandSelectorLastAmBand', currentMainKey);
    }

    const activeKeys = new Set();
    if (currentMainKey) activeKeys.add(currentMainKey);
    if (currentSwKey) activeKeys.add(currentSwKey);
    if (amBandKeys.includes(currentMainKey)) activeKeys.add('AM');

    document.querySelectorAll('.band-selector-button, .am-view-button, .sw-grid-button').forEach(btn => { btn.classList.toggle('active-band', activeKeys.has(btn.dataset.bandKey)); });
    
    if (mobileBandSelector && currentMainKey) {
        if (document.activeElement !== mobileBandSelector) {
            mobileBandSelector.value = currentMainKey;
        }
    }
    
    const loopOption = document.getElementById('mobile-loop-toggle-option');
    if (loopOption) {
        loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';
    }

    const antContainer = document.getElementById('data-ant-container');
    const swSelectorWrapper = document.getElementById('mobile-sw-band-selector-wrapper');
    const mobileSwBandSelector = document.getElementById('mobile-sw-band-selector');

    if (antContainer && swSelectorWrapper) {
        if (currentMainKey === 'SW') {
            swSelectorWrapper.style.display = 'flex';
            antContainer.classList.add('sw-mode-active');
        } else {
            swSelectorWrapper.style.display = 'none';
            antContainer.classList.remove('sw-mode-active');
        }
    }
    
    if (mobileSwBandSelector) {
        mobileSwBandSelector.value = currentSwKey || '';
    }
  };

const updateBandButtonStates = () => {
    const limitSpan = Array.from(document.querySelectorAll('.text-small, span')).find(el => el.textContent.includes('Limit:'));
    if (!limitSpan) {
        console.warn("[BandSelector] Fant ikke tekst-elementet for frekvensgrensen.");
        return;
    }

    const limitText = limitSpan.textContent;
    const matches = limitText.match(/(\d+\.?\d*)\s*MHz\s*-\s*(\d+\.?\d*)\s*MHz/);

    if (!matches || matches.length < 3) {
        console.warn("[BandSelector] Kunne ikke tolke frekvensgrensene fra teksten:", limitText);
        return;
    }

    const lowerLimit = parseFloat(matches[1]);
    const upperLimit = parseFloat(matches[2]);

    if (isNaN(lowerLimit) || isNaN(upperLimit)) return;

    const allBandData = { ...ALL_BANDS, ...SW_BANDS };

    document.querySelectorAll('[data-band-key]').forEach(button => {
        const key = button.dataset.bandKey;
        const bandData = allBandData[key];

        if (bandData) {
            const bandStartMHz = (bandData.displayUnit === 'kHz') ? bandData.start / 1000 : bandData.start;
            const bandEndMHz = (bandData.displayUnit === 'kHz') ? bandData.end / 1000 : bandData.end;
            
            const isOutside = bandEndMHz < lowerLimit || bandStartMHz > upperLimit;
            
            button.classList.toggle('disabled-band', isOutside);

            const parent = button.parentElement;
            const isAlreadyWrapped = parent.classList.contains('bs-tooltip'); 

            if (isOutside && !isAlreadyWrapped) {
                const tooltipWrapper = document.createElement('div');
                tooltipWrapper.className = 'bs-tooltip'; 

                const tooltipText = document.createElement('span');
                tooltipText.className = 'bs-tooltiptext';
                tooltipText.id = `tooltip-band-${key}`;
                tooltipText.textContent = 'This band is outside the server tuning limit.';

                button.parentNode.insertBefore(tooltipWrapper, button);
                tooltipWrapper.appendChild(button);
                tooltipWrapper.appendChild(tooltipText);

            } else if (!isOutside && isAlreadyWrapped) {
                const grandParent = parent.parentNode;
                grandParent.insertBefore(button, parent);
                grandParent.removeChild(parent);
            }
        }
    });
};

  freqContainer.appendChild(loopButton); freqContainer.appendChild(bandRangeContainer);
  layoutWrapper.className = `band-selector-layout-wrapper ${rtContainer.className}`; rtContainer.className = ''; rtContainer.parentNode.replaceChild(layoutWrapper, rtContainer);
  sideButtonContainer.className = 'side-band-button-container'; layoutWrapper.appendChild(sideButtonContainer); layoutWrapper.appendChild(rtContainer);
  amBandsViewContainer.className = 'am-bands-view-container'; layoutWrapper.appendChild(amBandsViewContainer);

  const sideButtonKeys = ['FM', 'OIRT', 'AM'];
  sideButtonKeys.forEach(key => {
    const isAmButton = (key === 'AM');
    const shouldCreate = isAmButton ? amBandKeys.some(b => ENABLED_BANDS.includes(b)) : ENABLED_BANDS.includes(key);

    if (shouldCreate) {
        const btnData = { displayName: key };
        const btn = createBandButton(key, btnData, 'band-selector-button');
        btn.addEventListener('click', () => {
            const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
            let targetFreq;

            if (isAmButton) {
                const lastAmBand = localStorage.getItem('bandSelectorLastAmBand');
                if (lastAmBand && ENABLED_BANDS.includes(lastAmBand) && lastFreqs[lastAmBand]) {
                    targetFreq = lastFreqs[lastAmBand];
                } else {
                    const firstEnabledAmBand = amBandKeys.find(b => ENABLED_BANDS.includes(b));
                    if (firstEnabledAmBand) {
                        targetFreq = lastFreqs[firstEnabledAmBand] || ALL_BANDS[firstEnabledAmBand].tune;
                    }
                }
            } else {
                fullSwTuningActive = false;
                sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                targetFreq = lastFreqs[key] || ALL_BANDS[key].tune;
            }

            if (targetFreq !== undefined) {
                tuneToFrequency(targetFreq);
            }
            updateVisualsByFrequency(getCurrentFrequencyInMHz());
        });
        sideButtonContainer.appendChild(btn);
    }
  });

  if (ENABLED_BANDS.includes('SW')) {
    const swFieldset = document.createElement('fieldset');
    swFieldset.className = 'sw-bands-fieldset';
    const swLegend = document.createElement('legend');
    swLegend.textContent = 'SW Broadcast Band';
    swFieldset.appendChild(swLegend);
    const swGridContainer = document.createElement('div');
    swGridContainer.className = 'sw-grid-container';
    swFieldset.appendChild(swGridContainer);

    Object.keys(SW_BANDS).forEach(key => {
        const data = SW_BANDS[key];
        const btn = createBandButton(key, data, 'sw-grid-button');
        btn.addEventListener('click', () => {
            fullSwTuningActive = false;
            sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
            const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
            const targetFreq = lastFreqs[key] || data.tune;
            tuneToFrequency(targetFreq);
            updateVisualsByFrequency(getCurrentFrequencyInMHz());
        });
        swGridContainer.appendChild(btn);
    });
    amBandsViewContainer.appendChild(swFieldset);
  }

  const bandFieldset = document.createElement('fieldset');
  bandFieldset.className = 'band-fieldset';
  const bandLegend = document.createElement('legend');
  bandLegend.textContent = 'Band';
  bandFieldset.appendChild(bandLegend);
  const bandButtonContainer = document.createElement('div');
  bandButtonContainer.className = 'band-button-container';
  bandFieldset.appendChild(bandButtonContainer);

  if (ENABLED_BANDS.includes('SW')) {
    const fullSwButton = createBandButton('SW', { ...ALL_BANDS['SW'], displayName: 'SW' }, 'am-view-button');
    fullSwButton.addEventListener('click', () => {
        fullSwTuningActive = true;
        sessionStorage.setItem(FULL_SW_MODE_KEY, 'true');
        const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
        const targetFreq = lastFreqs['SW'] || ALL_BANDS['SW'].tune;
        tuneToFrequency(targetFreq);
        updateVisualsByFrequency(getCurrentFrequencyInMHz());
    });
    bandButtonContainer.appendChild(fullSwButton);
  }

  ['MW', 'LW'].forEach(key => {
      if (ENABLED_BANDS.includes(key)) {
          const data = ALL_BANDS[key];
          const btn = createBandButton(key, data, 'am-view-button');
          btn.addEventListener('click', () => {
              fullSwTuningActive = false;
              sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
              const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
              const targetFreq = lastFreqs[key] || data.tune;
              tuneToFrequency(targetFreq);
              updateVisualsByFrequency(getCurrentFrequencyInMHz());
          });
          bandButtonContainer.appendChild(btn);
      }
  });

  if (bandButtonContainer.hasChildNodes()) {
    amBandsViewContainer.prepend(bandFieldset);
  }

  loopButton.addEventListener('click', (e) => { e.stopPropagation(); loopEnabled = !loopEnabled; loopButton.classList.toggle('active', loopEnabled); localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled); });
  freqContainer.addEventListener('wheel', (event) => handleTuneAttempt(event.deltaY < 0 ? 'up' : 'down', event), true);

  const rtContainerForAnchor = document.getElementById('rt-container');
  if (rtContainerForAnchor && rtContainerForAnchor.parentNode) {
      let antContainer = document.getElementById('data-ant-container');

      if (!antContainer) {
          antContainer = document.createElement('div');
          antContainer.id = 'data-ant-container';
          antContainer.className = 'hide-desktop';
          rtContainerForAnchor.parentNode.insertBefore(antContainer, rtContainerForAnchor);
      }

      antContainer.appendChild(mobileBandSelectorWrapper);

      const mobileSwBandSelectorWrapper = document.createElement('div');
      mobileSwBandSelectorWrapper.id = 'mobile-sw-band-selector-wrapper';
      mobileSwBandSelectorWrapper.style.display = 'none'; 

      const mobileSwBandSelector = document.createElement('select');
      mobileSwBandSelector.id = 'mobile-sw-band-selector';

      const defaultSwOption = document.createElement('option');
      defaultSwOption.value = "";
      defaultSwOption.textContent = "Band";
      mobileSwBandSelector.appendChild(defaultSwOption);

      Object.keys(SW_BANDS).forEach(key => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = key;
          mobileSwBandSelector.appendChild(option);
      });
      mobileSwBandSelectorWrapper.appendChild(mobileSwBandSelector);
      antContainer.appendChild(mobileSwBandSelectorWrapper);

      mobileSwBandSelector.addEventListener('change', (event) => {
          const key = event.target.value;
          if (!key) return;
          const data = SW_BANDS[key];
          if (!data) return;

          fullSwTuningActive = false;
          sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
          
          const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
          const targetFreq = lastFreqs[key] || data.tune;
          tuneToFrequency(targetFreq);
      });

      mobileBandSelector.addEventListener('change', (event) => {
          const key = event.target.value;

          if (key === 'toggle-loop') {
              loopEnabled = !loopEnabled;
              localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
              loopButton.classList.toggle('active', loopEnabled);

              const freqMhz = getCurrentFrequencyInMHz();
              let currentMainKey = null;
              for (const bandKey in ALL_BANDS) {
                  if (freqMhz >= ALL_BANDS[bandKey].start && freqMhz <= ALL_BANDS[bandKey].end) {
                      currentMainKey = bandKey;
                      break;
                  }
              }
              if (currentMainKey) {
                  mobileBandSelector.value = currentMainKey;
              }
              
              updateVisualsByFrequency(freqMhz);
              return;
          }

          const data = ALL_BANDS[key];
          if (!data) return;

          if (key === 'SW') {
              fullSwTuningActive = true;
              sessionStorage.setItem(FULL_SW_MODE_KEY, 'true');
          } else {
              fullSwTuningActive = false;
              sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
          }

          const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
          const targetFreq = lastFreqs[key] || data.tune;
          tuneToFrequency(targetFreq);
          updateVisualsByFrequency(getCurrentFrequencyInMHz());
      });
  }

  document.addEventListener('keydown', (event) => { let direction = null; if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = 'up'; else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = 'down'; if (direction) handleTuneAttempt(direction, event); }, true);
  tuneUpButton.addEventListener('click', (event) => handleTuneAttempt('up', event), true);
  tuneDownButton.addEventListener('click', (event) => handleTuneAttempt('down', event), true);

  bandRangeContainer.querySelector('.band-range-start').addEventListener('click', () => {
      if (activeBandForLooping) {
          tuneToFrequency(activeBandForLooping.start);
      }
  });

  bandRangeContainer.querySelector('.band-range-end').addEventListener('click', () => {
      if (activeBandForLooping) {
          tuneToFrequency(activeBandForLooping.end);
      }
  });

  const style = document.createElement('style');
  style.textContent = `
	#freq-container {
		position: relative !important;
		display: flex !important;
		flex-direction: column !important;
		align-items: center !important;
		justify-content: center !important;
	}

    .band-selector-layout-wrapper { display: flex; gap: 15px; margin: 20px 10px 0 10px; background: transparent !important; padding: 0 !important; backdrop-filter: none !important; }
    .side-band-button-container { display: flex; flex-direction: column; gap: 8px; width: 60px; flex-shrink: 0; }
    .band-selector-button { height: 28px; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; background-color: var(--color-3); color: var(--color-main); cursor: pointer; transition: all 0.2s ease-in-out; }
    .band-selector-button:hover { background-color: var(--color-4); color: var(--color-main); }
    .band-selector-button.active-band { background-color: var(--color-main-bright) !important; color: var(--color-main) !important; }
    #rt-container, .am-bands-view-container { flex-grow: 1; min-width: 0; background-color: var(--color-1-transparent); backdrop-filter: blur(5px); border-radius: 15px; margin: 0 !important; height: auto !important; align-self: stretch; }
    .am-bands-view-container { display: grid; grid-template-columns: 85px 1fr; gap: 5px; padding: 0 5px; }
    .sw-grid-container { display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(3, 1fr); gap: 5px; height: 100%; }
    .am-view-button, .sw-grid-button { border: none; border-radius: 8px; background-color: var(--color-3); color: var(--color-main); font-weight: bold; cursor: pointer; font-size: 12px; transition: all 0.2s ease-in-out; }
    .am-view-button:hover, .sw-grid-button:hover { background-color: var(--color-4); }
    .am-view-button.active-band, .sw-grid-button.active-band { background-color: var(--color-5) !important; color: var(--color-main) !important; }
    .am-view-button { font-size: 14px; height: 22px; width: 60px; }
    .loop-toggle-button { position: absolute; left: 6px; bottom: 6px; z-index: 5; width: 34px; height: auto; min-height: 22px; line-height: 1.2; font-size: 11px; font-weight: bold; border: none; border-radius: 8px; background-color: var(--color-3); color: var(--color-main); cursor: pointer; padding: 2px; }
    .loop-toggle-button:hover { background-color: var(--color-4); }
    .loop-toggle-button.active { background-color: var(--color-5) !important; color: var(--color-main) !important; }
    #band-range-container { position: absolute; bottom: 0px; left: 50%; transform: translateX(-50%); z-index: 5; display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--color-text); opacity: 0.7; }
    .band-range-part { cursor: pointer; } .band-range-part:hover { opacity: 1; text-decoration: underline; }
	.sw-bands-fieldset, .band-fieldset {
        border: 1px solid var(--color-3);
        border-bottom: none;
        border-radius: 8px;
        padding: 0px 5px 5px 5px;
        margin: 0;
        position: relative;
    }
    .sw-bands-fieldset legend, .band-fieldset legend {
        color: var(--color-4);
        font-weight: bold;
        font-size: 11px;

        width: auto;
        margin: 0 auto;
        padding: 0;
    }
    .band-button-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding-top: 3px;
        height: 100%;
        box-sizing: border-box;
    }

	.disabled-band {
		background-color: var(--color-1) !important;
		color: var(--color-3) !important;
		cursor: not-allowed !important;
		pointer-events: none;
	}

	.band-selector-layout-wrapper .tooltip {
		display: inline-block;
		position: relative; 
		cursor: pointer;
	}

	.band-selector-layout-wrapper .bs-tooltip { 
		display: inline-block;
		position: relative; 
		cursor: pointer;
		line-height: 0;
	}

	.band-selector-layout-wrapper .bs-tooltiptext {
		visibility: hidden; 
		width: 180px; 
		position: absolute;
		background-color: var(--color-2);
		border: 2px solid var(--color-3);
		color: var(--color-text);
		text-align: center;
		font-size: 14px;
		border-radius: 15px;
		padding: 8px;
		z-index: 1000;
    
		bottom: 110%;
		left: 50%;
		margin-left: -90px; 

		opacity: 0;
		transition: opacity 0.3s ease;
		line-height: normal;
	}

	.band-selector-layout-wrapper .bs-tooltip:hover .bs-tooltiptext {
		visibility: visible;
		opacity: 1;
	}

	@media (max-width: 768px) {
        .band-selector-layout-wrapper { display: block !important; }
        .side-band-button-container, .am-bands-view-container, #band-range-container, .loop-toggle-button { display: none !important; }
        #data-ant-container {
            display: flex;
            gap: 5px;
            padding: 0 18px 10px 18px;
            width: 100%;
            box-sizing: border-box;
            justify-content: center;
			align-items: baseline;
        }

		#data-ant-container::before,
		#data-ant-container::after {
			content: '';
			flex: 1;
		}

		#data-ant-container > .dropdown,
		#mobile-band-selector-wrapper,
        #mobile-sw-band-selector-wrapper {
			width: 45% !important;
			flex: 0 1 auto !important;
            transition: width 0.3s ease;
		}
        
        #data-ant-container.sw-mode-active > .dropdown,
        #data-ant-container.sw-mode-active > #mobile-band-selector-wrapper,
        #data-ant-container.sw-mode-active > #mobile-sw-band-selector-wrapper {
            width: 30% !important;
        }
        
        #mobile-sw-band-selector-wrapper {
            display: none;
            justify-content: center;
            align-items: center;
        }

		#data-ant-container:has(#mobile-band-selector-wrapper:only-child)::before,
		#data-ant-container:has(#mobile-band-selector-wrapper:only-child)::after {
			display: none;
		}

		#mobile-band-selector-wrapper:only-child {
			width: 50% !important;
			margin: 0 auto;
		}

        #mobile-band-selector,
        #mobile-sw-band-selector { 
            width: 100%;
            height: 48px;
            background-color: var(--color-4);
            color: var(--color-main);
            border: none;
            border-radius: 0 0 15px 15px;
            font-weight: normal;
            font-size: 14px;
            padding: 0 10px;
            -webkit-appearance: none;
            appearance: none;
            background-image: url("data-image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 1em;
        }
  `;
  document.head.appendChild(style);

const observer = new MutationObserver(() => {
  const freqMhz = getCurrentFrequencyInMHz();
  if (!isNaN(freqMhz)) {
    updateVisualsByFrequency(freqMhz);
    if (ENABLE_AM_BW) {
      setTimeout(() => updateBwOptionsForMode(freqMhz), 150);
    }
  }
});
observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });
const limitSpanForObserver = Array.from(document.querySelectorAll('.text-small, span')).find(el => el.textContent.includes('Limit:'));
if (limitSpanForObserver) {
    const limitObserver = new MutationObserver(updateBandButtonStates);
    limitObserver.observe(limitSpanForObserver, { childList: true, characterData: true, subtree: true });
}
setTimeout(() => {
  const initialFreqMhz = getCurrentFrequencyInMHz();

  if (ENABLE_AM_BW) {
    initializeBwFilter();
  }

  if (!isNaN(initialFreqMhz)) {
    updateVisualsByFrequency(initialFreqMhz);
    if (ENABLE_AM_BW) {
      updateBwOptionsForMode(initialFreqMhz);
    }
  }
  updateBandButtonStates();
}, 500);

  console.log(`Band Selector v2.02.2 loaded.`);
});
})();

