// BandSelector V2.00.01 – A plugin to switch bands on the FM-DX Webserver (v2.00.01 - Band Edge Tuning Re-enabled)
// -------------------------------------------------------------------------------------

/* global document, socket, WebSocket */
(() => {
// ==========================================================================
// ⚙️ SERVER OWNER CONFIGURATION ⚙️
// ==========================================================================
const ENABLED_BANDS = ['FM', 'OIRT', 'SW', 'MW', 'LW'];
// ==========================================================================
// END OF CONFIGURATION
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  if (typeof socket === 'undefined' || socket === null) return;

  const ALL_BANDS = {
    'FM':   { name: 'FM',   tune: 87.500,  start: 87.5,    end: 108.0,   displayUnit: 'MHz' },
    'OIRT': { name: 'OIRT', tune: 65.900,  start: 65.9,    end: 74.0,    displayUnit: 'MHz' },
    'SW':   { name: 'SW',   tune: 9.400,   start: 1.8,     end: 26.1,    displayUnit: 'MHz' },
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
  const LOOP_STORAGE_KEY = 'bandSelectorLoopState';
  const LAST_FREQS_STORAGE_KEY = 'bandSelectorLastFreqs'; 
  let loopEnabled = localStorage.getItem(LOOP_STORAGE_KEY) === 'true';
  let activeBandForLooping = null;

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
  
  const getCurrentFrequencyInMHz = () => { const freqText = dataFrequencyElement.textContent; let freqValue = parseFloat(freqText); if (freqText.toLowerCase().includes('khz')) { freqValue /= 1000; } return freqValue; };
  const handleTuneAttempt = (direction, event) => { if (!loopEnabled || !activeBandForLooping) return; const currentFreq = getCurrentFrequencyInMHz(); if (isNaN(currentFreq)) return; const tolerance = 0.0001; let shouldWrap = false; if (direction === 'up' && currentFreq >= activeBandForLooping.end - tolerance) { tuneToFrequency(activeBandForLooping.start); shouldWrap = true; } else if (direction === 'down' && currentFreq <= activeBandForLooping.start + tolerance) { tuneToFrequency(activeBandForLooping.end); shouldWrap = true; } if (shouldWrap && event) { event.preventDefault(); event.stopPropagation(); } };
  
  const updateVisualsByFrequency = (freqInMHz) => {
    let currentMainKey = null, currentSwKey = null;
    for (const key in ALL_BANDS) { if (freqInMHz >= ALL_BANDS[key].start && freqInMHz <= ALL_BANDS[key].end) { currentMainKey = key; break; } }
    if (currentMainKey === 'SW') { for (const key in SW_BANDS) { if (freqInMHz >= SW_BANDS[key].start && freqInMHz <= SW_BANDS[key].end) { currentSwKey = key; break; } } }
    
    try {
        const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
        let hasSaved = false;
        if (currentSwKey) {
            lastFreqs[currentSwKey] = freqInMHz;
            hasSaved = true;
        }
        if (currentMainKey) {
            lastFreqs[currentMainKey] = freqInMHz;
            hasSaved = true;
        }
        if (hasSaved) {
            localStorage.setItem(LAST_FREQS_STORAGE_KEY, JSON.stringify(lastFreqs));
        }
    } catch (e) { console.error("Could not save last frequencies:", e); }

    const bandForDisplay = SW_BANDS[currentSwKey] || ALL_BANDS[currentMainKey];
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
        mobileBandSelector.value = currentMainKey;
    }
  };

  freqContainer.appendChild(loopButton); freqContainer.appendChild(bandRangeContainer);
  layoutWrapper.className = `band-selector-layout-wrapper ${rtContainer.className}`; rtContainer.className = ''; rtContainer.parentNode.replaceChild(layoutWrapper, rtContainer);
  sideButtonContainer.className = 'side-band-button-container'; layoutWrapper.appendChild(sideButtonContainer); layoutWrapper.appendChild(rtContainer);
  amBandsViewContainer.className = 'am-bands-view-container'; layoutWrapper.appendChild(amBandsViewContainer);
  
  const sideButtonKeys = ['FM', 'OIRT', 'AM'];
  sideButtonKeys.forEach(key => {
    const isAmButton = (key === 'AM');
    const defaultBandKey = isAmButton ? 'MW' : key;
    const defaultBandData = ALL_BANDS[defaultBandKey];
    if (ENABLED_BANDS.includes(defaultBandKey)) {
        const btnData = { ...defaultBandData, displayName: key };
        const btn = createBandButton(key, btnData, 'band-selector-button');
        btn.addEventListener('click', () => {
            const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
            let targetFreq;
            if (isAmButton) {
                const lastAmBand = localStorage.getItem('bandSelectorLastAmBand');
                if (lastAmBand && lastFreqs[lastAmBand]) {
                    targetFreq = lastFreqs[lastAmBand];
                } else {
                    targetFreq = lastFreqs.MW || lastFreqs.LW || lastFreqs.SW || defaultBandData.tune;
                }
            } else {
                targetFreq = lastFreqs[key] || defaultBandData.tune;
            }
            tuneToFrequency(targetFreq);
        });
        sideButtonContainer.appendChild(btn);
    }
  });

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
          const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
          const targetFreq = lastFreqs[key] || data.tune;
          tuneToFrequency(targetFreq);
      });
      swGridContainer.appendChild(btn);
  });

  const bandFieldset = document.createElement('fieldset');
  bandFieldset.className = 'band-fieldset';
  const bandLegend = document.createElement('legend');
  bandLegend.textContent = 'MW/LW Band';
  bandFieldset.appendChild(bandLegend);
  const bandButtonContainer = document.createElement('div');
  bandButtonContainer.className = 'band-button-container';
  bandFieldset.appendChild(bandButtonContainer);

  ['MW', 'LW'].forEach(key => {
      if (ENABLED_BANDS.includes(key)) {
          const data = ALL_BANDS[key];
          const btn = createBandButton(key, data, 'am-view-button');
          btn.addEventListener('click', () => {
              const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
              const targetFreq = lastFreqs[key] || data.tune;
              tuneToFrequency(targetFreq);
          });
          bandButtonContainer.appendChild(btn);
      }
  });

  amBandsViewContainer.appendChild(bandFieldset);
  amBandsViewContainer.appendChild(swFieldset);

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

      mobileBandSelector.addEventListener('change', (event) => {
          const key = event.target.value;
          const data = ALL_BANDS[key];
          if (!data) return;

          const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
          const targetFreq = lastFreqs[key] || data.tune;
          tuneToFrequency(targetFreq);
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
    .am-view-button.active-band, .sw-grid-button.active-band { background-color: var(--color-4) !important; color: var(--color-main) !important; }
    .am-view-button { font-size: 14px; height: 25px; width: 60px; } 
    .loop-toggle-button { position: absolute; left: 6px; bottom: 6px; z-index: 5; width: 34px; height: auto; min-height: 22px; line-height: 1.2; font-size: 11px; font-weight: bold; border: none; border-radius: 8px; background-color: var(--color-3); color: var(--color-main); cursor: pointer; padding: 2px; }
    .loop-toggle-button:hover { background-color: var(--color-main-bright); }
    .loop-toggle-button.active { background-color: var(--color-4) !important; color: var(--color-main) !important; }
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
        padding-top: 15px;
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
        }

		#data-ant-container::before,
		#data-ant-container::after {
			content: '';
			flex: 1; 
		}


		#data-ant-container > .dropdown,
		#mobile-band-selector-wrapper {
			width: 45% !important; 
			flex: none !important;
		}

		#data-ant-container:has(#mobile-band-selector-wrapper:only-child)::before,
		#data-ant-container:has(#mobile-band-selector-wrapper:only-child)::after {
			display: none;
		}

		#mobile-band-selector-wrapper:only-child {
			width: 50% !important;
			margin: 0 auto;
		}

        #mobile-band-selector {
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
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 1em;
        }
  `;
  document.head.appendChild(style);
  
  const observer = new MutationObserver(() => {
    let freqMhz = getCurrentFrequencyInMHz();
    if (!isNaN(freqMhz)) updateVisualsByFrequency(freqMhz);
  });
  observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });
  let initialFreqMhz = getCurrentFrequencyInMHz();
  if (!isNaN(initialFreqMhz)) updateVisualsByFrequency(initialFreqMhz);

  console.log(`Band Selector Plugin (v2.00.01 - Band Edge Tuning Re-enabled) loaded.`);
});
})();
