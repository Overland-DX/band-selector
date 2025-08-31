// BandSelector – A plugin to switch bands on the FM-DX Webserver (v1.5)
// --------------------------------------------------------------------------

/* global document, socket, WebSocket */
(() => {
// ==========================================================================
// ⚙️ SERVER OWNER CONFIGURATION ⚙️
// ==========================================================================
const ENABLED_BANDS = [
  'FM',
  'OIRT',
  'SW',
  'MW',
  'LW'
];
// ==========================================================================
// END OF CONFIGURATION
// ==========================================================================


document.addEventListener("DOMContentLoaded", () => {
  if (typeof socket === 'undefined' || socket === null) return;

  const LOOP_STORAGE_KEY = 'bandSelectorLoopState';
  let loopEnabled = localStorage.getItem(LOOP_STORAGE_KEY) === 'true';
  let activeBandForLooping = null;

  const ALL_BANDS = {
    'FM':   { name: 'FM',   tune: 87.500,  start: 87.5,    end: 108.0,   displayUnit: 'MHz' },
    'OIRT': { name: 'OIRT', tune: 65.900,  start: 65.9,    end: 74.0,    displayUnit: 'MHz' },
    'SW':   { name: 'SW',   tune: 9.400,   start: 1.8,     end: 26.1,    displayUnit: 'MHz' },
    'MW':   { name: 'MW',   tune: 0.504,   start: 0.504,   end: 1.701,   displayUnit: 'kHz' },
    'LW':   { name: 'LW',   tune: 0.144,   start: 0.144,   end: 0.351,   displayUnit: 'kHz' },
  };

  const SW_BANDS = {
    '160m': { name: '160m', tune: 1.800,  start: 1.800,  end: 2.000 }, '120m': { name: '120m', tune: 2.300,  start: 2.300,  end: 2.500 },
    '90m':  { name: '90m',  tune: 3.200,  start: 3.200,  end: 3.400 }, '75m':  { name: '75m',  tune: 3.900,  start: 3.900,  end: 4.000 },
    '60m':  { name: '60m',  tune: 4.750,  start: 4.750,  end: 5.060 }, '49m':  { name: '49m',  tune: 5.900,  start: 5.900,  end: 6.200 },
    '41m':  { name: '41m',  tune: 7.200,  start: 7.200,  end: 7.600 }, '31m':  { name: '31m',  tune: 9.400,  start: 9.400,  end: 9.900 },
    '25m':  { name: '25m',  tune: 11.600, start: 11.600, end: 12.100 }, '22m':  { name: '22m',  tune: 13.570, start: 13.570, end: 13.870 },
    '19m':  { name: '19m',  tune: 15.100, start: 15.100, end: 15.830 }, '16m':  { name: '16m',  tune: 17.480, start: 17.480, end: 17.900 },
    '15m':  { name: '15m',  tune: 18.900, start: 18.900, end: 19.020 }, '13m':  { name: '13m',  tune: 21.450, start: 21.450, end: 21.850 },
    '11m':  { name: '11m',  tune: 25.670, start: 25.670, end: 26.100 }
  };

  const ACTIVE_BANDS = {};
  ENABLED_BANDS.forEach(bandName => { if (ALL_BANDS[bandName]) ACTIVE_BANDS[bandName] = ALL_BANDS[bandName]; });
  if (Object.keys(ACTIVE_BANDS).length === 0) return;

  const freqContainer = document.getElementById("freq-container");
  const dataFrequencyElement = document.getElementById('data-frequency');
  const tuneUpButton = document.getElementById('freq-up');
  const tuneDownButton = document.getElementById('freq-down');
  if (!freqContainer || !dataFrequencyElement || !tuneUpButton || !tuneDownButton) return;
  
  const pluginTopContainer = document.createElement("div"); pluginTopContainer.className = "plugin-top-container";
  const mainBandsWrapper = document.createElement("div"); mainBandsWrapper.className = "main-bands-wrapper";
  
  const swBandsContainer = document.createElement("div"); swBandsContainer.className = "sw-bands-container";
  const swBandsTopWrapper = document.createElement("div"); swBandsTopWrapper.className = "sw-bands-grid sw-bands-top-wrapper";
  const swBandsBottomWrapper = document.createElement("div"); swBandsBottomWrapper.className = "sw-bands-grid sw-bands-bottom-wrapper";

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

  const tuneToFrequency = (frequencyInMHz) => {
    if (typeof frequencyInMHz !== 'number') return;
    if (socket.readyState === WebSocket.OPEN) { socket.send("T" + Math.round(frequencyInMHz * 1000)); }
  };

  const getCurrentFrequencyInMHz = () => {
    const freqText = dataFrequencyElement.textContent;
    let freqValue = parseFloat(freqText);
    if (freqText.toLowerCase().includes('khz')) {
      freqValue /= 1000;
    }
    return freqValue;
  };
  
  const updateBottomDisplay = (start, end, unit) => {
    if (start === undefined || end === undefined) {
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

  const updateVisualsByFrequency = (freqInMHz) => {
    let activeMainBandName = null;
    for (const bandName in ACTIVE_BANDS) {
      const band = ACTIVE_BANDS[bandName];
      if (freqInMHz >= band.start && freqInMHz <= band.end) { activeMainBandName = bandName; break; }
    }
    mainBandsWrapper.querySelectorAll('.main-band-button').forEach(btn => btn.classList.toggle('active-band', btn.dataset.bandName === activeMainBandName));
    if (activeMainBandName) { activeBandForLooping = ALL_BANDS[activeMainBandName]; } 
    else { activeBandForLooping = null; }
    if (activeMainBandName === 'SW') {
      swBandsContainer.style.display = 'flex';
      let activeSwBandName = null;
      for (const swBandName in SW_BANDS) {
        const swBand = SW_BANDS[swBandName];
        if (freqInMHz >= swBand.start && freqInMHz <= swBand.end) { activeSwBandName = swBandName; break; }
      }
      swBandsContainer.querySelectorAll('.sw-band-button').forEach(btn => btn.classList.toggle('active-band', btn.dataset.bandName === activeSwBandName));
      const activeSwBand = SW_BANDS[activeSwBandName];
      if (activeSwBand) { 
        updateBottomDisplay(activeSwBand.start, activeSwBand.end, 'MHz');
        activeBandForLooping = activeSwBand;
      } else { 
        updateBottomDisplay(ALL_BANDS.SW.start, ALL_BANDS.SW.end, 'MHz');
        activeBandForLooping = ALL_BANDS.SW;
      }
    } else {
      swBandsContainer.style.display = 'none';
      const activeMainBand = ALL_BANDS[activeMainBandName];
      if (activeMainBand) { updateBottomDisplay(activeMainBand.start, activeMainBand.end, activeMainBand.displayUnit); }
      else { updateBottomDisplay(); }
    }
  };
  
  const handleTuneAttempt = (direction, event) => {
    if (!loopEnabled || !activeBandForLooping) return;
    const currentFreq = getCurrentFrequencyInMHz();
    if (isNaN(currentFreq)) return;
    const tolerance = 0.0001; 
    let shouldWrap = false;
    if (direction === 'up' && currentFreq >= activeBandForLooping.end - tolerance) {
      tuneToFrequency(activeBandForLooping.start); shouldWrap = true;
    } else if (direction === 'down' && currentFreq <= activeBandForLooping.start + tolerance) {
      tuneToFrequency(activeBandForLooping.end); shouldWrap = true;
    }
    if (shouldWrap && event) { event.preventDefault(); event.stopPropagation(); }
  };

  const createBandButton = (bandName, bandData, isSubBand = false) => {
    const button = document.createElement("button");
    button.className = isSubBand ? 'sw-band-button band-selector-button' : 'main-band-button band-selector-button';
    button.textContent = isSubBand ? bandName.replace('m', '') : bandName;
    button.dataset.bandName = bandName;
    button.title = `Go to ${bandData.tune.toFixed(3)} ${bandData.displayUnit || 'MHz'}`;
    button.addEventListener('click', () => {
      activeBandForLooping = bandData; tuneToFrequency(bandData.tune);
    });
    return button;
  };
  
  Object.keys(ACTIVE_BANDS).forEach((bandName) => mainBandsWrapper.appendChild(createBandButton(bandName, ACTIVE_BANDS[bandName])));
  
  let swButtonIndex = 0;
  Object.keys(SW_BANDS).forEach((swBandName) => {
    const button = createBandButton(swBandName, SW_BANDS[swBandName], true);
    if (swButtonIndex < 9) { swBandsTopWrapper.appendChild(button); } 
    else { swBandsBottomWrapper.appendChild(button); }
    swButtonIndex++;
  });

  const loopButton = document.createElement("button");
  loopButton.id = 'loop-toggle-button';
  loopButton.className = 'band-selector-button';
  loopButton.textContent = 'Loop';
  loopButton.title = 'Enable/disable frequency loop within selected band';
  if (loopEnabled) loopButton.classList.add('active');
  loopButton.addEventListener('click', () => {
    loopEnabled = !loopEnabled;
    loopButton.classList.toggle('active', loopEnabled);
    localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
  });
  
  pluginTopContainer.appendChild(mainBandsWrapper);
  pluginTopContainer.appendChild(loopButton);
  swBandsContainer.appendChild(swBandsTopWrapper);
  swBandsContainer.appendChild(swBandsBottomWrapper);

  startFreqSpan.addEventListener('click', (e) => {
    const freqMhz = parseFloat(e.target.dataset.freqMhz);
    if (!isNaN(freqMhz)) tuneToFrequency(freqMhz);
  });
  endFreqSpan.addEventListener('click', (e) => {
    const freqMhz = parseFloat(e.target.dataset.freqMhz);
    if (!isNaN(freqMhz)) tuneToFrequency(freqMhz);
  });

  freqContainer.addEventListener('wheel', (event) => handleTuneAttempt(event.deltaY < 0 ? 'up' : 'down', event), true);
  document.addEventListener('keydown', (event) => {
    let direction = null; if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = 'up'; else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = 'down';
    if (direction) handleTuneAttempt(direction, event);
  }, true);
  tuneUpButton.addEventListener('click', (event) => handleTuneAttempt('up', event), true);
  tuneDownButton.addEventListener('click', (event) => handleTuneAttempt('down', event), true);
  
  const style = document.createElement('style');
  style.textContent = `
    .main-band-button, .sw-band-button, #loop-toggle-button { background-color: rgba(0, 0, 0, 0.4); color: var(--color-text); border: 1px solid var(--color-2); border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: bold; cursor: pointer; opacity: 0.7; transition: all 0.2s ease; line-height: 1.4; }
    #freq-container { position: relative !important; overflow: hidden; }
    .plugin-top-container { position: absolute; top: 4px; left: 6px; z-index: 10; display: flex; align-items: flex-start; gap: 6px; }
    .main-bands-wrapper { display: flex; flex-direction: column; gap: 2px; }
    .main-band-button.active-band, .sw-band-button.active-band, #loop-toggle-button.active { background-color: var(--color-4); color: #fff; opacity: 1; }
    .sw-bands-container { position: absolute; top: 4px; right: 6px; z-index: 9; display: flex; flex-direction: column; gap: 2px; }
    .sw-bands-grid { display: grid; gap: 2px; }
    .sw-bands-top-wrapper { grid-template-columns: repeat(3, 1fr); }
    .sw-bands-bottom-wrapper { grid-template-columns: repeat(2, 1fr); }
    .sw-band-button { padding: 1px 2px; text-align: center; }
    
    #band-range-container {
        position: absolute;
        bottom: 0px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 5;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 11px;
        color: var(--color-text);
        opacity: 0.6;
        white-space: nowrap; 
    }
    .band-range-part {
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .band-range-part:hover { opacity: 1; }
    .range-separator {
        opacity: 0.7;
        pointer-events: none;
    }

	@media (max-width: 768px) {
    .plugin-top-container, .sw-bands-container, #band-range-container { display: none !important; }
	}
  `;

  document.head.appendChild(style);

  freqContainer.appendChild(pluginTopContainer);
  freqContainer.appendChild(swBandsContainer);
  
  bandRangeContainer.appendChild(startFreqSpan);
  bandRangeContainer.appendChild(rangeSeparator);
  bandRangeContainer.appendChild(endFreqSpan);
  freqContainer.appendChild(bandRangeContainer);
      
  const observer = new MutationObserver(() => {
    const currentFreqMhz = getCurrentFrequencyInMHz();
    if (!isNaN(currentFreqMhz)) updateVisualsByFrequency(currentFreqMhz);
  });
  observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });

  const initialFreq = getCurrentFrequencyInMHz();
  if (!isNaN(initialFreq)) updateVisualsByFrequency(initialFreq);

  console.log(`Band Selector Plugin (v1.5 - Centered Range) loaded.`);
});

})();

