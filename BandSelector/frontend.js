      
// BandSelector – A plugin to switch bands on the FM-DX Webserver
// --------------------------------------------------------------------------
// Features:
// - The server owner can easily select which bands to display.
// - More compact design for the band buttons.
// - Correct frequency conversion.
// --------------------------------------------------------------------------

/* global document, socket, WebSocket */
(() => {
// ==========================================================================
// ⚙️ SERVER OWNER CONFIGURATION ⚙️
// ==========================================================================
// Here you can select which bands should be available in the plugin.
// Remove or comment out the bands you do not wish to display.
// Example: To only show FM and SW, change this to: ['FM', 'SW']
// Available bands: ['FM', 'OIRT', 'SW', 'MW', 'LW']

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
  
  let lockedBand = null;
  let longPressTimer;
  let shortClickAllowed = true;
  const LONG_PRESS_DURATION = 750;

  const ALL_BANDS = {
    'FM':   { tune: 87.500,  start: 87.5,    end: 108.0,   displayUnit: 'MHz' },
    'OIRT': { tune: 65.900,  start: 65.9,    end: 74.0,    displayUnit: 'MHz' },
    'SW':   { tune: 9.400,   start: 1.8,     end: 26.1,    displayUnit: 'MHz' },
    'MW':   { tune: 0.531,   start: 0.520,   end: 1.710,   displayUnit: 'kHz' },
    'LW':   { tune: 0.153,   start: 0.150,   end: 0.283,   displayUnit: 'kHz' },
  };

  const SW_BANDS = {
    '160m': { tune: 1.800,  start: 1.800,  end: 2.000 }, '120m': { tune: 2.300,  start: 2.300,  end: 2.500 },
    '90m':  { tune: 3.200,  start: 3.200,  end: 3.400 }, '75m':  { tune: 3.900,  start: 3.900,  end: 4.000 },
    '60m':  { tune: 4.750,  start: 4.750,  end: 5.060 }, '49m':  { tune: 6.200,  start: 5.900,  end: 6.200 },
    '41m':  { tune: 7.200,  start: 7.200,  end: 7.600 }, '31m':  { tune: 9.400,  start: 9.400,  end: 9.900 },
    '25m':  { tune: 11.600, start: 11.600, end: 12.100 }, '22m':  { tune: 13.570, start: 13.570, end: 13.870 },
    '19m':  { tune: 15.100, start: 15.100, end: 15.830 }, '16m':  { tune: 17.480, start: 17.480, end: 17.900 },
    '15m':  { tune: 18.900, start: 18.900, end: 19.020 }, '13m':  { tune: 21.450, start: 21.450, end: 21.850 },
    '11m':  { tune: 25.670, start: 25.670, end: 26.100 }
  };

  const ACTIVE_BANDS = {};
  ENABLED_BANDS.forEach(bandName => { if (ALL_BANDS[bandName]) ACTIVE_BANDS[bandName] = ALL_BANDS[bandName]; });
  if (Object.keys(ACTIVE_BANDS).length === 0) return;

  const freqContainer = document.getElementById("freq-container");
  const dataFrequencyElement = document.getElementById('data-frequency');
  const tuneUpButton = document.getElementById('freq-up');
  const tuneDownButton = document.getElementById('freq-down');
  if (!freqContainer || !dataFrequencyElement || !tuneUpButton || !tuneDownButton) return;
  
  const mainBandsWrapper = document.createElement("div"); mainBandsWrapper.className = "main-bands-wrapper";
  const swBandsWrapper = document.createElement("div"); swBandsWrapper.className = "sw-bands-wrapper";
  const bottomDisplayContainer = document.createElement("div"); bottomDisplayContainer.className = "band-bottom-display";
  const startFreqDisplay = document.createElement("span"); startFreqDisplay.className = "band-freq-display band-freq-start"; startFreqDisplay.title = "Go to band start";
  const endFreqDisplay = document.createElement("span"); endFreqDisplay.className = "band-freq-display band-freq-end"; endFreqDisplay.title = "Go to band end";
  
  const tuneToFrequency = (frequencyInMHz) => {
    if (typeof frequencyInMHz !== 'number') return;
    if (socket.readyState === WebSocket.OPEN) { socket.send("T" + Math.round(frequencyInMHz * 1000)); }
  };
  
  const clearAllLocks = () => {
    lockedBand = null;
    document.querySelectorAll('.band-selector-button.locked').forEach(btn => btn.classList.remove('locked'));
  };

  const updateBottomDisplay = (start, end, unit) => {
    if (start === undefined || end === undefined) {
      startFreqDisplay.style.display = 'none'; endFreqDisplay.style.display = 'none'; return;
    }
    const displayStart = unit === 'kHz' ? Math.round(start * 1000) : start.toFixed(3);
    const displayEnd = unit === 'kHz' ? Math.round(end * 1000) : end.toFixed(3);
    startFreqDisplay.textContent = `${displayStart} ${unit}`; endFreqDisplay.textContent = `${displayEnd} ${unit}`;
    startFreqDisplay.dataset.freqMhz = start; endFreqDisplay.dataset.freqMhz = end;
    startFreqDisplay.style.display = 'inline'; endFreqDisplay.style.display = 'inline';
  };

  const updateVisualsByFrequency = (freq) => {
    let activeMainBandName = null;
    for (const bandName in ACTIVE_BANDS) {
      const band = ACTIVE_BANDS[bandName];
      if (freq >= band.start && freq <= band.end) { activeMainBandName = bandName; break; }
    }
    mainBandsWrapper.querySelectorAll('.main-band-button').forEach(btn => btn.classList.toggle('active-band', btn.dataset.bandName === activeMainBandName));

    if (activeMainBandName === 'SW') {
      swBandsWrapper.style.display = 'grid';
      let activeSwBandName = null;
      for (const swBandName in SW_BANDS) {
        const swBand = SW_BANDS[swBandName];
        if (freq >= swBand.start && freq <= swBand.end) { activeSwBandName = swBandName; break; }
      }
      swBandsWrapper.querySelectorAll('.sw-band-button').forEach(btn => btn.classList.toggle('active-band', btn.dataset.bandName === activeSwBandName));
      const activeSwBand = SW_BANDS[activeSwBandName];
      if (activeSwBand) { updateBottomDisplay(activeSwBand.start, activeSwBand.end, 'MHz'); }
      else { updateBottomDisplay(ALL_BANDS.SW.start, ALL_BANDS.SW.end, 'MHz'); }
    } else {
      swBandsWrapper.style.display = 'none';
      const activeMainBand = ALL_BANDS[activeMainBandName];
      if (activeMainBand) { updateBottomDisplay(activeMainBand.start, activeMainBand.end, activeMainBand.displayUnit); }
      else { updateBottomDisplay(); }
    }
  };

  const handleTuneAttempt = (direction, event) => {
    if (!lockedBand) return;
    const band = ALL_BANDS[lockedBand] || SW_BANDS[lockedBand];
    if (!band) return;
    const currentFreq = parseFloat(dataFrequencyElement.textContent);
    const tolerance = 0.001;
    let shouldWrap = false;
    if (direction === 'up' && currentFreq >= band.end - tolerance) {
      tuneToFrequency(band.start); shouldWrap = true;
    } else if (direction === 'down' && currentFreq <= band.start + tolerance) {
      tuneToFrequency(band.end); shouldWrap = true;
    }
    if (shouldWrap && event) { event.preventDefault(); event.stopPropagation(); }
  };

  const createBandButton = (bandName, bandData, isSubBand = false) => {
    const button = document.createElement("button");
    button.className = isSubBand ? 'sw-band-button band-selector-button' : 'main-band-button band-selector-button';
    button.textContent = isSubBand ? bandName.replace('m', '') : bandName;
    button.dataset.bandName = bandName;
    button.title = isSubBand ? `Go to ${bandData.tune.toFixed(3)} MHz. Hold to lock.` : 'Press to tune, hold to lock band';
    const handleLongPress = () => {
      shortClickAllowed = false;
      if (lockedBand === bandName) { clearAllLocks(); } else { clearAllLocks(); lockedBand = bandName; button.classList.add('locked'); }
    };
    button.addEventListener('mousedown', () => { shortClickAllowed = true; longPressTimer = setTimeout(handleLongPress, LONG_PRESS_DURATION); });
    button.addEventListener('mouseup', () => { clearTimeout(longPressTimer); if (shortClickAllowed) { clearAllLocks(); tuneToFrequency(bandData.tune); } });
    button.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
    return button;
  };
  
  Object.keys(ACTIVE_BANDS).forEach((bandName) => mainBandsWrapper.appendChild(createBandButton(bandName, ACTIVE_BANDS[bandName])));
  Object.keys(SW_BANDS).forEach((swBandName) => swBandsWrapper.appendChild(createBandButton(swBandName, SW_BANDS[swBandName], true)));

  freqContainer.addEventListener('wheel', (event) => handleTuneAttempt(event.deltaY < 0 ? 'up' : 'down', event), true);
  document.addEventListener('keydown', (event) => {
    let direction = null; if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = 'up'; else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = 'down';
    if (direction) handleTuneAttempt(direction, event);
  }, true);
  tuneUpButton.addEventListener('click', (event) => handleTuneAttempt('up', event), true);
  tuneDownButton.addEventListener('click', (event) => handleTuneAttempt('down', event), true);
  
  startFreqDisplay.addEventListener('click', (e) => tuneToFrequency(parseFloat(e.target.dataset.freqMhz)));
  endFreqDisplay.addEventListener('click', (e) => tuneToFrequency(parseFloat(e.target.dataset.freqMhz)));

  const style = document.createElement('style');
  style.textContent = `
    .main-band-button, .sw-band-button { background-color: rgba(0, 0, 0, 0.4); color: var(--color-text); border: 1px solid var(--color-2); border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: bold; cursor: pointer; opacity: 0.7; transition: all 0.2s ease; line-height: 1.4; }
    #freq-container { position: relative !important; overflow: hidden; }
    .main-bands-wrapper { position: absolute; top: 4px; left: 6px; z-index: 10; display: flex; flex-direction: column; gap: 2px; }
    .main-band-button.active-band, .sw-band-button.active-band { background-color: var(--color-4); color: #fff; opacity: 1; }
    .band-selector-button.locked { box-shadow: 0 0 0 2px var(--color-red) !important; border-color: var(--color-red) !important; }
    .sw-bands-wrapper { position: absolute; top: 4px; right: 6px; z-index: 10; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; width: 90px; }
    .sw-band-button { padding: 1px 2px; text-align: center; }
    .band-bottom-display { position: absolute; bottom: 0; left: 0; right: 0; height: 22px; pointer-events: none; }
    .band-freq-display { position: absolute; bottom: 4px; z-index: 5; font-size: 12px; color: var(--color-text); opacity: 0.5; transition: opacity 0.2s ease; cursor: pointer; pointer-events: all; }
    .band-freq-start { left: 8px; }
    .band-freq-end { right: 8px; }
  `;
  document.head.appendChild(style);

  bottomDisplayContainer.appendChild(startFreqDisplay); bottomDisplayContainer.appendChild(endFreqDisplay);
  freqContainer.appendChild(mainBandsWrapper); freqContainer.appendChild(swBandsWrapper);
  freqContainer.appendChild(bottomDisplayContainer);

  const observer = new MutationObserver((mutations) => {
    const currentFreqMhz = parseFloat(mutations[0].target.textContent);
    if (!isNaN(currentFreqMhz)) { updateVisualsByFrequency(currentFreqMhz); }
  });
  observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });

  const initialFreq = parseFloat(dataFrequencyElement.textContent);
  if (!isNaN(initialFreq)) { updateVisualsByFrequency(initialFreq); }

  console.log(`Band Selector Plugin (v1.3) loaded.`);
});

})();
