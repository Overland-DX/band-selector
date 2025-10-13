// Enhanced Tuning V2.06.1 – A plugin to switch bands and modify AM bandwidth options
// -------------------------------------------------------------------------------------
// Settings have been moved to /public/config.js
// -------------------------------------------------------------------------------------

/* global document, socket, WebSocket, LAYOUT_STYLE, HIDE_ALL_BUTTONS, SHOW_LOOP_BUTTON, SHOW_BAND_RANGE, ENABLE_TUNE_STEP_FEATURE, TUNE_STEP_TIMEOUT_SECONDS, TUNING_STANDARD, ENABLE_AM_BW, FIRMWARE_TYPE, ENABLE_DEFAULT_AM_BW, DEFAULT_AM_BW_VALUE, ENABLED_BANDS, ENABLE_FREQUENCY_MEMORY, ENABLE_MW_STEP_TOGGLE */
(() => {

  const loadScript = (src) => {
    const script = document.createElement('script');
    script.src = src;
    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Script load error for ${src}`));
    });
  };

  const loadPluginStylesheet = () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = '/public/Enhanced_Tuning.css';
    document.head.appendChild(link);
    
    return new Promise((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('Stylesheet load error for Enhanced_Tuning.css'));
    });
  };

  const initializePlugin = () => {
    if (!ENABLE_AM_BW && (typeof console !== 'undefined')) {
      if (ENABLE_DEFAULT_AM_BW) {
        console.warn('[BandSelector] ENABLE_DEFAULT_AM_BW is set but ENABLE_AM_BW is false; default BW selection will be ignored.');
      }
    }

    const FM_DX_TUNER_BW_OPTIONS = {
      '3 kHz': 'W3000',
      '4 kHz': 'W4000',
      '6 kHz': 'W6000',
      '8 kHz': 'W8000'
    };

    const AM_BW_MAPPING = {
      '56000': 3,  // 56 kHz → 3 kHz
      '64000': 4,  // 64 kHz → 4 kHz
      '72000': 6,  // 72 kHz → 6 kHz
      '84000': 8   // 84 kHz → 8 kHz
    };

    if (typeof socket === 'undefined' || socket === null) return;

    const ALL_BANDS = {
      'AM_SUPER': { name: 'AM Super', start: 0.144, end: 27.0, displayUnit: 'MHz' },
      'FM':   { name: 'FM',   tune: 87.500,  start: 87.5,    end: 108.0,   displayUnit: 'MHz' },
      'OIRT': { name: 'OIRT', tune: 65.900,  start: 65.9,    end: 74.0,    displayUnit: 'MHz' },
      'SW':   { name: 'SW',   tune: 9.400,   start: 1.710,   end: 27.0,    displayUnit: 'MHz' },
      'MW':   { name: 'MW',   tune: 0.504,   start: 0.504,   end: 1.701,   displayUnit: 'kHz' },
      'LW':   { name: 'LW',   tune: 0.144,   start: 0.144,   end: 0.351,   displayUnit: 'kHz' },
    };
    
    switch (typeof TUNING_STANDARD !== 'undefined' ? TUNING_STANDARD.toLowerCase() : 'international') {
      case 'americas':
        ALL_BANDS['MW'] = { name: 'MW', tune: 0.530, start: 0.530, end: 1.700, displayUnit: 'kHz' };
        ALL_BANDS['FM'] = { name: 'FM', tune: 87.500, start: 87.5, end: 107.9, displayUnit: 'MHz' };
        break;
      case 'japan':
        ALL_BANDS['FM'] = { name: 'FM', tune: 76.000, start: 76.0, end: 95.0, displayUnit: 'MHz' };
        break;
    }

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
    const dataFrequencyElement = document.getElementById('data-frequency');
    
    const getCurrentFrequencyInMHz = () => { const freqText = dataFrequencyElement.textContent; let freqValue = parseFloat(freqText); if (freqText.toLowerCase().includes('khz')) { freqValue /= 1000; } return freqValue; };
    const initializeBwFilter = () => {
      const desktopBwList = document.querySelector('#data-bw .options');
      const mobileBwList = document.querySelector('#data-bw-phone .options');

      if (desktopBwList) {
          masterBwListTemplates = Array.from(desktopBwList.querySelectorAll('li')).map(li => li.cloneNode(true));
      }
      
      Object.entries(FM_DX_TUNER_BW_OPTIONS).forEach(([text, command]) => {
        if (desktopBwList) {
          const newLi = document.createElement('li');
          newLi.textContent = text;
          newLi.classList.add('fmdx-tuner-bw-option'); 
          newLi.style.display = 'none'; 
          addFmDxTunerClickListener(newLi, command);
          desktopBwList.appendChild(newLi);
        }

        if (mobileBwList) {
          const newLi = document.createElement('li');
          newLi.textContent = text;
          newLi.classList.add('fmdx-tuner-bw-option');
          newLi.style.display = 'none';
          newLi.addEventListener('click', () => socket.send(command));
          mobileBwList.appendChild(newLi);
        }
      });
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

    let _prevIsAmMode = null;
    const updateBwOptionsForMode = (freqInMHz) => {
    if (!ENABLE_AM_BW) return;

    const isAmMode = freqInMHz < 27.0;

    const justLeftAmMode = _prevIsAmMode === true && !isAmMode;
    if (justLeftAmMode) {
        socket.send('W0');
        const desktopSelectedText = document.querySelector('#data-bw .selected');
        const mobileSelectedText = document.querySelector('#data-bw-phone .selected');
        if (desktopSelectedText) desktopSelectedText.textContent = 'Auto';
        if (mobileSelectedText) mobileSelectedText.textContent = 'Auto';
    }

    const allBwItems = document.querySelectorAll('#data-bw .options li, #data-bw-phone .options li');
    if (allBwItems.length === 0) return;

    const amValuesToShow = new Set(['0', ...Object.keys(AM_BW_MAPPING)]);

    const getOriginalText = (value) => {
        const template = masterBwListTemplates.find(t => t.dataset.value === value);
        return template ? template.textContent : null;
    };

    allBwItems.forEach(li => {
        const isTunerOption = li.classList.contains('fmdx-tuner-bw-option');
        const value = li.dataset.value;

        if (isAmMode) {
        if (FIRMWARE_TYPE === 'FM-DX-Tuner') {
            li.style.display = isTunerOption ? '' : 'none';
        } else { 
            const isRelevant = !isTunerOption && amValuesToShow.has(value);
            li.style.display = isRelevant ? '' : 'none';
            if (isRelevant && AM_BW_MAPPING.hasOwnProperty(value)) {
            li.textContent = `${AM_BW_MAPPING[value]} kHz`;
            }
        }
        } else { 
        li.style.display = isTunerOption ? 'none' : '';
        
        if (!isTunerOption && value) {
            const originalText = getOriginalText(value);
            if (originalText) {
            li.textContent = originalText;
            }
        }
        }
    });

    if (isAmMode && FIRMWARE_TYPE === 'TEF6686_ESP32') {
        const desktopBwList = document.querySelector('#data-bw .options');
        const justEnteredAm = _prevIsAmMode !== true;
        if (desktopBwList && ENABLE_DEFAULT_AM_BW && justEnteredAm && DEFAULT_AM_BW_VALUE) {
        const targetLi = desktopBwList.querySelector(`li[data-value="${DEFAULT_AM_BW_VALUE}"]`);
        if (targetLi) targetLi.click();
        }
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
    
    const addFmDxTunerClickListener = (element, command) => {
    element.addEventListener('click', (ev) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        const bwDropdown = document.getElementById('data-bw');
        if (!bwDropdown) return;
        const root = getDropdownRoot(bwDropdown);
        const toggler = findDropdownToggler(root);
        socket.send(command);
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
    if (!SHOW_LOOP_BUTTON) {
        loopEnabled = false;
        localStorage.setItem(LOOP_STORAGE_KEY, 'false');
    }

    let activeBandForLooping = null;
    let fullSwTuningActive = sessionStorage.getItem(FULL_SW_MODE_KEY) === 'true';

    const freqContainer = document.getElementById("freq-container");
    const rtContainer = document.getElementById('rt-container');
    const h2Freq = freqContainer.querySelector('h2');
    const tuneUpButton = document.getElementById('freq-up');
    const tuneDownButton = document.getElementById('freq-down');
    if (!freqContainer || !dataFrequencyElement || !rtContainer || !h2Freq || !tuneUpButton || !tuneDownButton) return;
    
    let observer;
    let updateFrequencyDisplayWithMarker = () => {};
    let tuneEventHandler = () => {};
    let handleCustomStepTune = () => false;

    const tuneToFrequency = (frequencyInMHz) => { if (socket.readyState === WebSocket.OPEN) socket.send("T" + Math.round(frequencyInMHz * 1000)); };

    if (ENABLE_TUNE_STEP_FEATURE || (typeof TUNING_STANDARD !== 'undefined' && TUNING_STANDARD === 'americas')) {
        if (ENABLE_TUNE_STEP_FEATURE) {
            const TUNE_STEP_CONFIG = [
                { step: 0.001, markerIndex: -1 }, { step: 0.010, markerIndex: -2 },
                { step: 0.100, markerIndex: -3 }, { step: 1.000, markerIndex: -5 },
            ];
            let currentTuneStepIndex = -1;
            let tuneStepResetTimer = null;
            let startResetTimer = () => {};

            if (TUNE_STEP_TIMEOUT_SECONDS > 0) {
                const resetTuneStep = () => { currentTuneStepIndex = -1; updateFrequencyDisplayWithMarker(); };
                startResetTimer = () => {
                    clearTimeout(tuneStepResetTimer);
                    if (currentTuneStepIndex !== -1) tuneStepResetTimer = setTimeout(resetTuneStep, TUNE_STEP_TIMEOUT_SECONDS * 1000);
                };
                const clearResetTimer = () => clearTimeout(tuneStepResetTimer);
                freqContainer.addEventListener('mouseenter', clearResetTimer);
                freqContainer.addEventListener('mouseleave', startResetTimer);
            }

            updateFrequencyDisplayWithMarker = () => {
                const originalText = dataFrequencyElement.textContent;
                if (observer) observer.disconnect();
                if (currentTuneStepIndex === -1) {
                    dataFrequencyElement.innerHTML = originalText;
                } else {
                    const config = TUNE_STEP_CONFIG[currentTuneStepIndex];
                    const textOnly = originalText.replace(/[^\d.]/g, '');
                    const chars = textOnly.split('');
                    const markerPos = chars.length + config.markerIndex;
                    let html = '';
                    for (let i = 0; i < chars.length; i++) {
                        if (i === markerPos && chars[i] !== '.') html += `<span class="freq-digit-marker">${chars[i]}</span>`;
                        else html += `<span>${chars[i]}</span>`;
                    }
                    dataFrequencyElement.innerHTML = html;
                }
                if (observer) observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });
            };

            handleCustomStepTune = (direction) => {
                if (currentTuneStepIndex === -1) return false;
                const currentFreq = getCurrentFrequencyInMHz();
                if (isNaN(currentFreq)) return true;
                const stepSize = TUNE_STEP_CONFIG[currentTuneStepIndex].step;
                const newFreq = (direction === 'up') ? currentFreq + stepSize : currentFreq - stepSize;
                tuneToFrequency(newFreq);
                startResetTimer();
                return true;
            };

            freqContainer.addEventListener('click', (e) => {
                if (e.target.closest('#mw-step-toggle-button, .loop-toggle-button, #band-range-container, .band-selector-button')) return;
				e.preventDefault();
				e.stopImmediatePropagation();
                currentTuneStepIndex++;
                const freqInMHz = getCurrentFrequencyInMHz();
                if (currentTuneStepIndex === 0 && freqInMHz >= 64.0) currentTuneStepIndex = 1;
                if (currentTuneStepIndex >= TUNE_STEP_CONFIG.length) currentTuneStepIndex = -1;
                updateFrequencyDisplayWithMarker();
                startResetTimer();
            });
        }
        
        const handleAmericasDefaultStepTune = (direction) => {
            const currentFreq = getCurrentFrequencyInMHz();
            if (isNaN(currentFreq)) return;
            let newFreq;
            if (currentFreq >= ALL_BANDS['FM'].start && currentFreq <= ALL_BANDS['FM'].end) {
                const step = 0.2;
                newFreq = parseFloat(currentFreq.toFixed(1)); 
                if (direction === 'up') {
                    newFreq += step;
                } else {
                    newFreq -= step;
                }
                if (Math.round(newFreq * 10) % 2 === 0) {
                   newFreq -= 0.1;
                }
            } else {
                const step = 0.010;
                const directionMultiplier = (direction === 'up' ? 1 : -1);
                newFreq = Math.round((currentFreq + (step * directionMultiplier)) / step) * step;
            }
            tuneToFrequency(newFreq.toFixed(3));
        };
        
        tuneEventHandler = (event, direction) => {
            if (SHOW_LOOP_BUTTON && loopEnabled && activeBandForLooping) {
                const currentFreq = getCurrentFrequencyInMHz();
                const tolerance = 0.0001;
                let looped = false;
                if (direction === 'up' && currentFreq >= activeBandForLooping.end - tolerance) {
                    tuneToFrequency(activeBandForLooping.start);
                    looped = true;
                } else if (direction === 'down' && currentFreq <= activeBandForLooping.start + tolerance) {
                    tuneToFrequency(activeBandForLooping.end);
                    looped = true;
                }
                if (looped) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }
            }

            if (handleCustomStepTune(direction)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            
            if (TUNING_STANDARD === 'americas') {
                const currentFreq = getCurrentFrequencyInMHz();
                const isFmBand = currentFreq >= ALL_BANDS['FM'].start && currentFreq <= ALL_BANDS['FM'].end;
                const isMwBand = currentFreq >= ALL_BANDS['MW'].start && currentFreq <= ALL_BANDS['MW'].end;
                if (isFmBand || isMwBand) {
                    handleAmericasDefaultStepTune(direction);
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }
        };

        freqContainer.addEventListener('wheel', (e) => tuneEventHandler(e, e.deltaY < 0 ? 'up' : 'down'), true);
        tuneUpButton.addEventListener('click', (e) => tuneEventHandler(e, 'up'), true);
        tuneDownButton.addEventListener('click', (e) => tuneEventHandler(e, 'down'), true);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') tuneEventHandler(e, 'up');
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') tuneEventHandler(e, 'down');
        }, true);
    }
    
    let updateVisualsByFrequency;

    const updateBandButtonStates = () => {
        const limitSpan = Array.from(document.querySelectorAll('.text-small, span')).find(el => el.textContent.includes('Limit:'));
        if (!limitSpan) return;

        const limitText = limitSpan.textContent;
        const matches = limitText.match(/(\d+\.?\d*)\s*MHz\s*-\s*(\d+\.?\d*)\s*MHz/);

        if (!matches || matches.length < 3) {
            document.querySelectorAll('[data-band-key]').forEach(button => button.classList.add('disabled-band'));
            return;
        }

        const lowerLimit = parseFloat(matches[1]);
        const upperLimit = parseFloat(matches[2]);

        if (isNaN(lowerLimit) || isNaN(upperLimit)) return;

        const allBandData = { ...ALL_BANDS, ...SW_BANDS };

        document.querySelectorAll('[data-band-key], [data-band-name]').forEach(button => {
            const key = button.dataset.bandKey || button.dataset.bandName;
            const bandData = allBandData[key];

            if (bandData) {
                const bandStartMHz = (bandData.displayUnit === 'kHz') ? bandData.start / 1000 : bandData.start;
                const bandEndMHz = (bandData.displayUnit === 'kHz') ? bandData.end / 1000 : bandData.end;
                const isOutside = bandEndMHz < lowerLimit || bandStartMHz > upperLimit;
                button.classList.toggle('disabled-band', isOutside);

                const parent = button.parentElement;
                const isAlreadyWrapped = parent.classList.contains('bs-tooltip'); 

                if (LAYOUT_STYLE === 'modern' && isOutside && !isAlreadyWrapped) {
                    const tooltipWrapper = document.createElement('div');
                    tooltipWrapper.className = 'bs-tooltip'; 
                    const tooltipText = document.createElement('span');
                    tooltipText.className = 'bs-tooltiptext';
                    tooltipText.id = `tooltip-band-${key}`;
                    tooltipText.textContent = 'This band is outside the server tuning limit.';
                    button.parentNode.insertBefore(tooltipWrapper, button);
                    tooltipWrapper.appendChild(button);
                    tooltipWrapper.appendChild(tooltipText);
                } else if (LAYOUT_STYLE === 'modern' && !isOutside && isAlreadyWrapped) {
                    const grandParent = parent.parentNode;
                    grandParent.insertBefore(button, parent);
                    grandParent.removeChild(parent);
                }
            }
        });
    };

    if (LAYOUT_STYLE === 'modern') {
        const layoutWrapper = document.createElement('div');
        const sideButtonContainer = document.createElement('div');
        const amBandsViewContainer = document.createElement('div');
        const mobileBandSelectorWrapper = document.createElement('div');
        const mobileBandSelector = document.createElement('select');
        const bandRangeContainer = document.createElement("div");
        const loopButton = document.createElement("button");

        const updateBandRangeDisplay = (band) => {
            if (!SHOW_BAND_RANGE || !band) { bandRangeContainer.style.display = 'none'; return; } 
            bandRangeContainer.style.display = 'flex'; 
            const unit = band.displayUnit || 'MHz'; 
            const start = unit === 'kHz' ? Math.round(band.start * 1000) : band.start.toFixed(3); 
            const end = unit === 'kHz' ? Math.round(band.end * 1000) : band.end.toFixed(3); 
            bandRangeContainer.querySelector('.band-range-start').textContent = `${start} ${unit}`; 
            bandRangeContainer.querySelector('.band-range-end').textContent = `${end} ${unit}`; 
        };
        
        const updateView = (activeBandKey) => { 
            if (HIDE_ALL_BUTTONS) return;
            const freqForAmCheck = getCurrentFrequencyInMHz();
            const isAmView = (freqForAmCheck >= ALL_BANDS.AM_SUPER.start && freqForAmCheck <= ALL_BANDS.AM_SUPER.end);
            rtContainer.style.display = isAmView ? 'none' : 'block'; 
            amBandsViewContainer.style.display = isAmView ? 'grid' : 'none'; 
        };

        const createBandButton = (key, data, cssClass) => {
            const button = document.createElement("button");
            button.className = cssClass;
            button.textContent = data.displayName || key.replace('m', '');
            button.dataset.bandKey = key;
            return button;
        };

        updateVisualsByFrequency = (freqInMHz) => {
            let currentMainKey = null, currentSwKey = null;
            for (const key in ALL_BANDS) { if (key !== 'AM_SUPER' && ENABLED_BANDS.includes(key) && freqInMHz >= ALL_BANDS[key].start && freqInMHz <= ALL_BANDS[key].end) { currentMainKey = key; break; } }
            if (currentMainKey === 'SW') {
                for (const key in SW_BANDS) { if (freqInMHz >= SW_BANDS[key].start && freqInMHz <= SW_BANDS[key].end) { currentSwKey = key; break; } }
            }
            if (ENABLE_FREQUENCY_MEMORY) {
                try {
                    const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
                    if (currentSwKey) lastFreqs[currentSwKey] = freqInMHz;
                    if (currentMainKey) lastFreqs[currentMainKey] = freqInMHz;
                    localStorage.setItem(LAST_FREQS_STORAGE_KEY, JSON.stringify(lastFreqs));
                } catch (e) { console.error("Could not save last frequencies:", e); }
            }
            const bandForDisplay = (currentMainKey === 'SW' && fullSwTuningActive) ? ALL_BANDS['SW'] : (SW_BANDS[currentSwKey] || ALL_BANDS[currentMainKey]);
            updateView(currentMainKey);
            updateBandRangeDisplay(bandForDisplay);
            activeBandForLooping = bandForDisplay;
            if (amBandKeys.includes(currentMainKey)) localStorage.setItem('bandSelectorLastAmBand', currentMainKey);
            const activeKeys = new Set();
            if (currentMainKey) activeKeys.add(currentMainKey);
            if (currentSwKey) activeKeys.add(currentSwKey);
            if (amBandKeys.includes(currentMainKey)) activeKeys.add('AM');
            document.querySelectorAll('.band-selector-button, .am-view-button, .sw-grid-button').forEach(btn => { btn.classList.toggle('active-band', activeKeys.has(btn.dataset.bandKey)); });
            if (mobileBandSelector && currentMainKey) { if (document.activeElement !== mobileBandSelector) mobileBandSelector.value = currentMainKey; }
            const loopOption = document.getElementById('mobile-loop-toggle-option');
            if (loopOption) loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';
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
            if (mobileSwBandSelector) mobileSwBandSelector.value = currentSwKey || '';
            updateFrequencyDisplayWithMarker();
        };
        
        if (SHOW_LOOP_BUTTON) {
            loopButton.className = 'loop-toggle-button'; loopButton.innerHTML = 'Band<br>Loop';
            loopButton.title = 'Enable/disable frequency loop'; loopButton.classList.toggle('active', loopEnabled);
            freqContainer.appendChild(loopButton);
            loopButton.addEventListener('click', (e) => { e.stopPropagation(); loopEnabled = !loopEnabled; loopButton.classList.toggle('active', loopEnabled); localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled); });
        }
        if (SHOW_BAND_RANGE) {
            bandRangeContainer.id = "band-range-container"; bandRangeContainer.innerHTML = `<span class="band-range-part band-range-start"></span><span class="range-separator">↔</span><span class="band-range-part band-range-end"></span>`;
            freqContainer.appendChild(bandRangeContainer);
            bandRangeContainer.querySelector('.band-range-start').addEventListener('click', () => { if (activeBandForLooping) tuneToFrequency(activeBandForLooping.start); });
            bandRangeContainer.querySelector('.band-range-end').addEventListener('click', () => { if (activeBandForLooping) tuneToFrequency(activeBandForLooping.end); });
        }
        if (!HIDE_ALL_BUTTONS) {
            layoutWrapper.className = `band-selector-layout-wrapper ${rtContainer.className}`; rtContainer.className = '';
            rtContainer.parentNode.replaceChild(layoutWrapper, rtContainer);
            sideButtonContainer.className = 'side-band-button-container'; layoutWrapper.appendChild(sideButtonContainer);
            layoutWrapper.appendChild(rtContainer);
            amBandsViewContainer.className = 'am-bands-view-container'; layoutWrapper.appendChild(amBandsViewContainer);
            const sideButtonKeys = ['FM', 'OIRT', 'AM'];
            sideButtonKeys.forEach(key => {
                const isAmButton = (key === 'AM');
                const shouldCreate = isAmButton ? amBandKeys.some(b => ENABLED_BANDS.includes(b)) : ENABLED_BANDS.includes(key);
                if (shouldCreate) {
                    const btn = createBandButton(key, { displayName: key }, 'band-selector-button');
                    btn.addEventListener('click', () => {
                        const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                        let targetFreq;
                        if (isAmButton) {
                            const lastAmBand = localStorage.getItem('bandSelectorLastAmBand');
                            if (lastAmBand && ENABLED_BANDS.includes(lastAmBand) && lastFreqs[lastAmBand]) targetFreq = lastFreqs[lastAmBand];
                            else {
                                const firstEnabledAmBand = amBandKeys.find(b => ENABLED_BANDS.includes(b));
                                if (firstEnabledAmBand) targetFreq = lastFreqs[firstEnabledAmBand] || ALL_BANDS[firstEnabledAmBand].tune;
                            }
                        } else {
                            fullSwTuningActive = false; sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                            targetFreq = lastFreqs[key] || ALL_BANDS[key].tune;
                        }
                        if (targetFreq !== undefined) tuneToFrequency(targetFreq);
                        updateVisualsByFrequency(getCurrentFrequencyInMHz());
                    });
                    sideButtonContainer.appendChild(btn);
                }
            });
            if (ENABLED_BANDS.includes('SW')) {
                const swFieldset = document.createElement('fieldset'); swFieldset.className = 'sw-bands-fieldset';
                const swLegend = document.createElement('legend'); swLegend.textContent = 'SW Broadcast Band'; swFieldset.appendChild(swLegend);
                const swGridContainer = document.createElement('div'); swGridContainer.className = 'sw-grid-container'; swFieldset.appendChild(swGridContainer);
                Object.keys(SW_BANDS).forEach(key => {
                    const btn = createBandButton(key, SW_BANDS[key], 'sw-grid-button');
                    btn.addEventListener('click', () => {
                        fullSwTuningActive = false; sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                        const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                        const targetFreq = lastFreqs[key] || SW_BANDS[key].tune;
                        tuneToFrequency(targetFreq);
                        updateVisualsByFrequency(getCurrentFrequencyInMHz());
                    });
                    swGridContainer.appendChild(btn);
                });
                amBandsViewContainer.appendChild(swFieldset);
            }
            const bandFieldset = document.createElement('fieldset'); bandFieldset.className = 'band-fieldset';
            const bandLegend = document.createElement('legend'); bandLegend.textContent = 'AM Band'; bandFieldset.appendChild(bandLegend);
            const bandButtonContainer = document.createElement('div'); bandButtonContainer.className = 'band-button-container'; bandFieldset.appendChild(bandButtonContainer);
            if (ENABLED_BANDS.includes('SW')) {
                const fullSwButton = createBandButton('SW', { ...ALL_BANDS['SW'], displayName: 'SW' }, 'am-view-button');
                fullSwButton.addEventListener('click', () => {
                    fullSwTuningActive = true; sessionStorage.setItem(FULL_SW_MODE_KEY, 'true');
                    const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                    const targetFreq = lastFreqs['SW'] || ALL_BANDS['SW'].tune;
                    tuneToFrequency(targetFreq);
                    updateVisualsByFrequency(getCurrentFrequencyInMHz());
                });
                bandButtonContainer.appendChild(fullSwButton);
            }
            ['MW', 'LW'].forEach(key => {
                if (ENABLED_BANDS.includes(key)) {
                    const btn = createBandButton(key, ALL_BANDS[key], 'am-view-button');
                    btn.addEventListener('click', () => {
                        fullSwTuningActive = false; sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                        const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                        const targetFreq = lastFreqs[key] || ALL_BANDS[key].tune;
                        tuneToFrequency(targetFreq);
                        updateVisualsByFrequency(getCurrentFrequencyInMHz());
                    });
                    bandButtonContainer.appendChild(btn);
                }
            });
            if (bandButtonContainer.hasChildNodes()) amBandsViewContainer.prepend(bandFieldset);
            const rtContainerForAnchor = document.getElementById('rt-container');
            if (rtContainerForAnchor && rtContainerForAnchor.parentNode) {
                let antContainer = document.getElementById('data-ant-container');
                if (!antContainer) {
                    antContainer = document.createElement('div'); antContainer.id = 'data-ant-container'; antContainer.className = 'hide-desktop';
                    rtContainerForAnchor.parentNode.insertBefore(antContainer, rtContainerForAnchor);
                }
                mobileBandSelectorWrapper.id = 'mobile-band-selector-wrapper'; mobileBandSelector.id = 'mobile-band-selector';
                const mobileBandOrder = ['FM', 'OIRT', 'SW', 'MW', 'LW'];
                mobileBandOrder.forEach(key => {
                    if (ENABLED_BANDS.includes(key)) {
                        const option = document.createElement('option'); option.value = key; option.textContent = ALL_BANDS[key].name; mobileBandSelector.appendChild(option);
                    }
                });
                if (SHOW_LOOP_BUTTON) {
                    const separator = document.createElement('option'); separator.disabled = true; separator.textContent = '──────────'; mobileBandSelector.appendChild(separator);
                    const loopOption = document.createElement('option'); loopOption.id = 'mobile-loop-toggle-option'; loopOption.value = 'toggle-loop';
                    loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop'; mobileBandSelector.appendChild(loopOption);
                }
                mobileBandSelectorWrapper.appendChild(mobileBandSelector); antContainer.appendChild(mobileBandSelectorWrapper);
                const mobileSwBandSelectorWrapper = document.createElement('div'); mobileSwBandSelectorWrapper.id = 'mobile-sw-band-selector-wrapper'; mobileSwBandSelectorWrapper.style.display = 'none'; 
                const mobileSwBandSelector = document.createElement('select'); mobileSwBandSelector.id = 'mobile-sw-band-selector';
                const defaultSwOption = document.createElement('option'); defaultSwOption.value = ""; defaultSwOption.textContent = "Band"; mobileSwBandSelector.appendChild(defaultSwOption);
                Object.keys(SW_BANDS).forEach(key => {
                    const option = document.createElement('option'); option.value = key; option.textContent = key; mobileSwBandSelector.appendChild(option);
                });
                mobileSwBandSelectorWrapper.appendChild(mobileSwBandSelector); antContainer.appendChild(mobileSwBandSelectorWrapper);
                mobileSwBandSelector.addEventListener('change', (event) => {
                const key = event.target.value; 
                if (!key) return; 
                const data = SW_BANDS[key]; 
                if (!data) return;

                fullSwTuningActive = false; 
                sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');

                const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                const targetFreq = lastFreqs[key] || data.tune;
                tuneToFrequency(targetFreq);
            });
                mobileBandSelector.addEventListener('change', (event) => {
                    const key = event.target.value;
                    if (key === 'toggle-loop') {
                        loopEnabled = !loopEnabled; localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
                        if (loopButton) loopButton.classList.toggle('active', loopEnabled);
                        const freqMhz = getCurrentFrequencyInMHz();
                        let currentMainKey = null;
                        for (const bandKey in ALL_BANDS) { if (freqMhz >= ALL_BANDS[bandKey].start && freqMhz <= ALL_BANDS[bandKey].end) { currentMainKey = bandKey; break; } }
                        if (currentMainKey) mobileBandSelector.value = currentMainKey;
                        updateVisualsByFrequency(freqMhz); return;
                    }
                    const data = ALL_BANDS[key]; if (!data) return;
                    if (key === 'SW') fullSwTuningActive = true; else fullSwTuningActive = false;
                    sessionStorage.setItem(FULL_SW_MODE_KEY, String(fullSwTuningActive));
                    const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
                    const targetFreq = lastFreqs[key] || data.tune;
                    tuneToFrequency(targetFreq);
                    updateVisualsByFrequency(getCurrentFrequencyInMHz());
                });
            }
        }
    } else if (LAYOUT_STYLE === 'classic') {
        const pluginTopContainer = document.createElement("div");
        pluginTopContainer.className = "plugin-top-container";
        const mainBandsWrapper = document.createElement("div");
        mainBandsWrapper.className = "main-bands-wrapper";
        const swBandsContainer = document.createElement("div");
        swBandsContainer.className = "sw-bands-container";
        const swBandsTopWrapper = document.createElement("div");
        swBandsTopWrapper.className = "sw-bands-grid sw-bands-top-wrapper";
        const swBandsBottomWrapper = document.createElement("div");
        swBandsBottomWrapper.className = "sw-bands-grid sw-bands-bottom-wrapper";
        const bandRangeContainer = document.createElement("div");
        bandRangeContainer.id = "band-range-container";
        const startFreqSpan = document.createElement("span");
        startFreqSpan.className = "band-range-part";
        startFreqSpan.title = "Go to band start";
        const rangeSeparator = document.createElement("span");
        rangeSeparator.className = "range-separator";
        rangeSeparator.innerHTML = "↔"; 
        const endFreqSpan = document.createElement("span");
        endFreqSpan.className = "band-range-part";
        endFreqSpan.title = "Go to band end";

        const updateBandRangeDisplay = (start, end, unit) => {
            if (!SHOW_BAND_RANGE || start === undefined || end === undefined) {
                bandRangeContainer.style.display = 'none';
                return;
            }
            bandRangeContainer.style.display = 'flex';
            const displayStart = unit === 'kHz' ? Math.round(start * 1000) : start.toFixed(3);
            const displayEnd = unit === 'kHz' ? Math.round(end * 1000) : end.toFixed(3);
            startFreqSpan.textContent = `${displayStart} ${unit}`;
            startFreqSpan.dataset.freqMhz = start;
            endFreqSpan.textContent = `${displayEnd} ${unit}`;
            endFreqSpan.dataset.freqMhz = end;
        };

        updateVisualsByFrequency = (freqInMHz) => {
            let activeMainBandName = null;
            for (const bandName of ENABLED_BANDS) {
                const band = ALL_BANDS[bandName];
                if (band && freqInMHz >= band.start && freqInMHz <= band.end) {
                    activeMainBandName = band.name;
                    break;
                }
            }
            mainBandsWrapper.querySelectorAll('.main-band-button').forEach(btn => btn.classList.toggle('active-band', btn.dataset.bandName === activeMainBandName));
            
            if (activeMainBandName) {
                activeBandForLooping = ALL_BANDS[activeMainBandName];
            } else {
                activeBandForLooping = null;
            }

            let activeSwBandName = null;
            if (activeMainBandName === 'SW') {
                swBandsContainer.style.display = 'flex';
                for (const swBandName in SW_BANDS) {
                    const swBand = SW_BANDS[swBandName];
                    if (freqInMHz >= swBand.start && freqInMHz <= swBand.end) {
                        activeSwBandName = swBandName;
                        break;
                    }
                }
                swBandsContainer.querySelectorAll('.sw-band-button').forEach(btn => btn.classList.toggle('active-band', btn.dataset.bandName === activeSwBandName));
                
                const activeSwBand = SW_BANDS[activeSwBandName];
                if (activeSwBand) { 
                    updateBandRangeDisplay(activeSwBand.start, activeSwBand.end, 'MHz');
                    activeBandForLooping = activeSwBand;
                } else { 
                    updateBandRangeDisplay(ALL_BANDS.SW.start, ALL_BANDS.SW.end, 'MHz');
                    activeBandForLooping = ALL_BANDS.SW;
                }
            } else {
                swBandsContainer.style.display = 'none';
                const activeMainBand = ALL_BANDS[activeMainBandName];
                if (activeMainBand) {
                    updateBandRangeDisplay(activeMainBand.start, activeMainBand.end, activeMainBand.displayUnit);
                } else {
                    updateBandRangeDisplay();
                }
            }
            
            if (ENABLE_FREQUENCY_MEMORY) {
                try {
                    const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
                    if (activeSwBandName) lastFreqs[activeSwBandName] = freqInMHz;
                    if (activeMainBandName) lastFreqs[activeMainBandName] = freqInMHz;
                    localStorage.setItem(LAST_FREQS_STORAGE_KEY, JSON.stringify(lastFreqs));
                } catch (e) { console.error("Could not save last frequencies:", e); }
            }

            const mobileBandSelectorEl = document.getElementById('mobile-band-selector');
            if (mobileBandSelectorEl && activeMainBandName) {
                if (document.activeElement !== mobileBandSelectorEl) {
                    mobileBandSelectorEl.value = activeMainBandName;
                }
            }

            const loopOption = document.getElementById('mobile-loop-toggle-option');
            if (loopOption) {
                loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';
            }

            const antContainer = document.getElementById('data-ant-container');
            const swSelectorWrapper = document.getElementById('mobile-sw-band-selector-wrapper');
            const mobileSwBandSelectorEl = document.getElementById('mobile-sw-band-selector');

            if (antContainer && swSelectorWrapper) {
                if (activeMainBandName === 'SW') {
                    swSelectorWrapper.style.display = 'flex';
                    antContainer.classList.add('sw-mode-active');
                } else {
                    swSelectorWrapper.style.display = 'none';
                    antContainer.classList.remove('sw-mode-active');
                }
            }
            
            if (mobileSwBandSelectorEl) {
                mobileSwBandSelectorEl.value = activeSwBandName || '';
            }

            updateFrequencyDisplayWithMarker();
        };
        
        const createBandButton = (bandName, bandData, isSubBand = false) => {
            const button = document.createElement("button");
            button.className = isSubBand ? 'sw-band-button band-selector-button' : 'main-band-button band-selector-button';
            button.textContent = isSubBand ? bandName.replace('m', '') : bandName;
            button.dataset.bandName = bandName;
            button.title = `Go to ${bandData.tune.toFixed(3)} ${bandData.displayUnit || 'MHz'}`;
            button.addEventListener('click', () => { 
                activeBandForLooping = bandData;
                const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                const targetFreq = lastFreqs[bandName] || bandData.tune;
                tuneToFrequency(targetFreq);
            });
            return button;
        };
        
        ENABLED_BANDS.forEach((bandName) => mainBandsWrapper.appendChild(createBandButton(bandName, ALL_BANDS[bandName])));
        
        let swButtonIndex = 0;
        Object.keys(SW_BANDS).forEach((swBandName) => {
            const button = createBandButton(swBandName, SW_BANDS[swBandName], true);
            if (swButtonIndex < 9) {
                swBandsTopWrapper.appendChild(button);
            } else {
                swBandsBottomWrapper.appendChild(button);
            }
            swButtonIndex++;
        });

        if (SHOW_LOOP_BUTTON) {
            const loopButton = document.createElement("button");
            loopButton.id = 'loop-toggle-button';
            loopButton.className = 'band-selector-button';
            loopButton.textContent = 'Loop';
            loopButton.title = 'Enable/disable frequency loop';
            if (loopEnabled) loopButton.classList.add('active');
            loopButton.addEventListener('click', () => {
                loopEnabled = !loopEnabled;
                loopButton.classList.toggle('active', loopEnabled);
                localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
            });
            pluginTopContainer.appendChild(mainBandsWrapper);
            pluginTopContainer.appendChild(loopButton);
        } else {
            pluginTopContainer.appendChild(mainBandsWrapper);
        }

        swBandsContainer.appendChild(swBandsTopWrapper);
        swBandsContainer.appendChild(swBandsBottomWrapper);
        startFreqSpan.addEventListener('click', (e) => { const freqMhz = parseFloat(e.target.dataset.freqMhz); if (!isNaN(freqMhz)) tuneToFrequency(freqMhz); });
        endFreqSpan.addEventListener('click', (e) => { const freqMhz = parseFloat(e.target.dataset.freqMhz); if (!isNaN(freqMhz)) tuneToFrequency(freqMhz); });
        
        const rtContainerForAnchor = document.getElementById('rt-container');
        if (rtContainerForAnchor && rtContainerForAnchor.parentNode) {
            let antContainer = document.getElementById('data-ant-container');
            if (!antContainer) {
                antContainer = document.createElement('div');
                antContainer.id = 'data-ant-container';
                rtContainerForAnchor.parentNode.insertBefore(antContainer, rtContainerForAnchor);
            }
            antContainer.classList.add('classic-mobile-controls');
            
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

            if (SHOW_LOOP_BUTTON) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '──────────';
                mobileBandSelector.appendChild(separator);
                const loopOption = document.createElement('option');
                loopOption.id = 'mobile-loop-toggle-option';
                loopOption.value = 'toggle-loop';
                loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';
                mobileBandSelector.appendChild(loopOption);
            }
            mobileBandSelectorWrapper.appendChild(mobileBandSelector);
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
                const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                const targetFreq = lastFreqs[key] || data.tune;
                tuneToFrequency(targetFreq);
            });

            mobileBandSelector.addEventListener('change', (event) => {
                const key = event.target.value;
                if (key === 'toggle-loop') {
                    loopEnabled = !loopEnabled; 
                    localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
                    const classicLoopButton = document.getElementById('loop-toggle-button');
                    if (classicLoopButton) classicLoopButton.classList.toggle('active', loopEnabled);
                    
                    const freqMhz = getCurrentFrequencyInMHz();
                    let currentMainKey = null;
                    for (const bandKey of ENABLED_BANDS) {
                        if (ALL_BANDS[bandKey] && freqMhz >= ALL_BANDS[bandKey].start && freqMhz <= ALL_BANDS[bandKey].end) {
                            currentMainKey = bandKey; 
                            break; 
                        }
                    }
                    if (currentMainKey) mobileBandSelector.value = currentMainKey;
                    updateVisualsByFrequency(freqMhz); 
                    return;
                }
                const data = ALL_BANDS[key]; 
                if (!data) return;

                fullSwTuningActive = (key === 'SW');
                sessionStorage.setItem(FULL_SW_MODE_KEY, String(fullSwTuningActive));
                
                const lastFreqs = ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
                const targetFreq = lastFreqs[key] || data.tune;
                tuneToFrequency(targetFreq);
            });
        }

        freqContainer.appendChild(pluginTopContainer);
        freqContainer.appendChild(swBandsContainer);
        
        if (SHOW_BAND_RANGE) {
            bandRangeContainer.appendChild(startFreqSpan);
            bandRangeContainer.appendChild(rangeSeparator);
            bandRangeContainer.appendChild(endFreqSpan);
            freqContainer.appendChild(bandRangeContainer);
        }
    }

    const setBodyClasses = () => {
      const body = document.body;
      
      if (LAYOUT_STYLE === 'modern') {
        body.classList.add('layout-modern');
      } else {
        body.classList.add('layout-classic');
      }
      
      if (ENABLE_TUNE_STEP_FEATURE) {
        body.classList.add('tune-step-enabled');
      }
      if (SHOW_LOOP_BUTTON) {
        body.classList.add('loop-button-visible');
      }
      if (SHOW_BAND_RANGE) {
        body.classList.add('band-range-visible');
      }
      
      if (LAYOUT_STYLE === 'modern' && !HIDE_ALL_BUTTONS) {
        body.classList.add('modern-buttons-visible');
      }
    };
    
    setBodyClasses();

    observer = new MutationObserver(() => {
      setTimeout(() => {
        const freqMhz = getCurrentFrequencyInMHz();
        if (!isNaN(freqMhz)) {
          updateVisualsByFrequency(freqMhz);
          if (ENABLE_AM_BW) setTimeout(() => updateBwOptionsForMode(freqMhz), 150);
        }
      }, 0);
    });
    observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });

    const limitSpanForObserver = Array.from(document.querySelectorAll('.text-small, span')).find(el => el.textContent.includes('Limit:'));
    if (limitSpanForObserver) {
        const limitObserver = new MutationObserver(updateBandButtonStates);
        limitObserver.observe(limitSpanForObserver, { childList: true, characterData: true, subtree: true });
    }

    setTimeout(() => {
      const initialFreqMhz = getCurrentFrequencyInMHz();
      if (ENABLE_AM_BW) initializeBwFilter();
      if (!isNaN(initialFreqMhz)) {
        updateVisualsByFrequency(initialFreqMhz);
        if (ENABLE_AM_BW) updateBwOptionsForMode(initialFreqMhz);
      }
      if(typeof updateBandButtonStates === 'function') updateBandButtonStates();
    }, 500);

    if (typeof ENABLE_MW_STEP_TOGGLE !== 'undefined' && ENABLE_MW_STEP_TOGGLE) {
      
      const MW_STEP_STORAGE_KEY = 'mwStepPreference';
      
      const MW_BAND_AMERICAS = { name: 'MW', tune: 1.000, start: 0.530, end: 1.700, displayUnit: 'kHz' };
      const MW_BAND_INTERNATIONAL = { name: 'MW', tune: 0.999, start: 0.504, end: 1.701, displayUnit: 'kHz' };

      let is10kHzStep = localStorage.getItem(MW_STEP_STORAGE_KEY)
        ? localStorage.getItem(MW_STEP_STORAGE_KEY) === 'true'
        : (typeof TUNING_STANDARD !== 'undefined' && TUNING_STANDARD === 'americas');

      const mwStepButton = document.createElement("button");
      mwStepButton.id = 'mw-step-toggle-button';
      mwStepButton.textContent = is10kHzStep ? '10 kHz' : '9 kHz';
      mwStepButton.title = 'Toggle MW tuning step';
      
      const updateButtonStyle = () => {
        mwStepButton.classList.toggle('active', is10kHzStep);
      };

      mwStepButton.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        const originalFreq = getCurrentFrequencyInMHz();

        is10kHzStep = !is10kHzStep;
        mwStepButton.textContent = is10kHzStep ? '10 kHz' : '9 kHz';
        localStorage.setItem(MW_STEP_STORAGE_KEY, is10kHzStep);
        updateButtonStyle();

        ALL_BANDS.MW = is10kHzStep ? MW_BAND_AMERICAS : MW_BAND_INTERNATIONAL;
        const newBand = ALL_BANDS.MW;

        const newStep = is10kHzStep ? 0.010 : 0.009;
        let targetFreq = Math.round(originalFreq / newStep) * newStep;
        targetFreq = Math.max(newBand.start, Math.min(newBand.end, targetFreq));
        
        if (Math.abs(targetFreq - originalFreq) > 0.0001) {
            tuneToFrequency(targetFreq.toFixed(3));
        }
        
        updateVisualsByFrequency(targetFreq);
      });
      
      freqContainer.appendChild(mwStepButton);
      updateButtonStyle();

      const originalUpdateVisuals = updateVisualsByFrequency;
      updateVisualsByFrequency = (freqInMHz) => {
        originalUpdateVisuals(freqInMHz);
        const isMwBandActive = (ALL_BANDS.MW && freqInMHz >= ALL_BANDS.MW.start && freqInMHz <= ALL_BANDS.MW.end);
        mwStepButton.style.display = isMwBandActive ? 'block' : 'none';
      };

      const originalTuneHandler = tuneEventHandler;
      tuneEventHandler = (event, direction) => {
        const currentFreq = getCurrentFrequencyInMHz();
        const isMwBand = (ALL_BANDS.MW && currentFreq >= ALL_BANDS.MW.start && currentFreq <= ALL_BANDS.MW.end);

        if (isMwBand) {
          if (SHOW_LOOP_BUTTON && loopEnabled) {
              const tolerance = 0.0001;
              let looped = false;
              if (direction === 'up' && currentFreq >= ALL_BANDS.MW.end - tolerance) {
                  tuneToFrequency(ALL_BANDS.MW.start);
                  looped = true;
              } else if (direction === 'down' && currentFreq <= ALL_BANDS.MW.start + tolerance) {
                  tuneToFrequency(ALL_BANDS.MW.end);
                  looped = true;
              }
              if (looped) {
                  event.preventDefault();
                  event.stopImmediatePropagation();
                  return;
              }
          }

          if (!handleCustomStepTune(direction)) {
            const step = is10kHzStep ? 0.010 : 0.009;
            const directionMultiplier = (direction === 'up' ? 1 : -1);
            
            let newFreq = Math.round((currentFreq + (step * directionMultiplier)) / step) * step;
            
            if (SHOW_LOOP_BUTTON && loopEnabled) {
                newFreq = Math.max(ALL_BANDS.MW.start, Math.min(ALL_BANDS.MW.end, newFreq));
            }

            tuneToFrequency(newFreq.toFixed(3));
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
          }
        }
        
        originalTuneHandler(event, direction);
      };
    }

    console.log(`Enhanced Tuning v2.06.1 loaded.`);
  };

  document.addEventListener("DOMContentLoaded", () => {
    loadScript('/public/config.ini')
      .then(() => {
        return loadPluginStylesheet();
      })
      .then(() => {
        initializePlugin();
      })
      .catch(error => {
        console.error("BandSelector Error: Could not load dependencies. Plugin will not run.", error);
      });
  });
})();