      
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
  if (typeof socket === 'undefined' || socket === null) {
    console.error("Band Selector Plugin: WebSocket object ('socket') not found.");
    return;
  }
  
  const ALL_BANDS = {
    'FM':   { tune: 87.500,  start: 87.500,  end: 108.000, displayType: 'standard', unit: 'MHz' },
    'OIRT': { tune: 65.900,  start: 65.900,  end: 74.000,  displayType: 'standard', unit: 'MHz' },
    'SW':   { tune: 9.400,   displayType: 'sw_bands', unit: 'MHz' },
    'MW':   { tune: 0.531,   start: 0.531,   end: 1.710,   displayType: 'standard', displayUnit: 'kHz' },
    'LW':   { tune: 0.153,   start: 0.153,   end: 0.279,   displayType: 'standard', displayUnit: 'kHz' },
  };

  const SW_BANDS = {
    '160m': 1.800, '120m': 2.300, '90m': 3.200, '75m': 3.900, '60m': 4.750,
    '49m':  6.200, '41m':  7.200, '31m': 9.400, '25m': 11.600,'22m': 13.570,
    '19m':  15.100,'16m':  17.480,'15m': 18.900,'13m': 21.450,'11m': 25.670
  };

  const ACTIVE_BANDS = {};
  ENABLED_BANDS.forEach(bandName => {
    if (ALL_BANDS[bandName]) {
      ACTIVE_BANDS[bandName] = ALL_BANDS[bandName];
    }
  });

  if (Object.keys(ACTIVE_BANDS).length === 0) {
    console.log("Band Selector Plugin: No bands enabled in configuration. Plugin will not load.");
    return;
  }

  const freqContainer = document.getElementById("freq-container");
  if (!freqContainer) {
    console.error("Band Selector Plugin: Could not find #freq-container.");
    return;
  }

  const tuneToFrequency = (frequencyInMHz) => {
    if (typeof frequencyInMHz !== 'number') return;
    if (socket.readyState === WebSocket.OPEN) {
      const formattedFrequency = Math.round(frequencyInMHz * 1000);
      socket.send("T" + formattedFrequency);
    } else {
      console.error("Band Selector Plugin: WebSocket connection is not open.");
    }
  };

  const bandSwitchWrapper = document.createElement("div");
  bandSwitchWrapper.className = "band-switch-wrapper";
  const bottomDisplayContainer = document.createElement("div");
  bottomDisplayContainer.className = "band-bottom-display";
  
  const startFreqDisplay = document.createElement("span");
  startFreqDisplay.className = "band-freq-display band-freq-start";
  startFreqDisplay.title = "Go to band start";

  const endFreqDisplay = document.createElement("span");
  endFreqDisplay.className = "band-freq-display band-freq-end";
  endFreqDisplay.title = "Go to band end";

  const swBandsContainer = document.createElement("div");
  swBandsContainer.className = "sw-bands-container";

  const updateBottomDisplay = (bandConfig) => {
    startFreqDisplay.style.display = 'none';
    endFreqDisplay.style.display = 'none';
    swBandsContainer.style.display = 'none';

    if (bandConfig.displayType === 'standard') {
      const start = bandConfig.start;
      const end = bandConfig.end;
      const displayStart = bandConfig.displayUnit === 'kHz' ? Math.round(start * 1000) : start.toFixed(3);
      const displayEnd = bandConfig.displayUnit === 'kHz' ? Math.round(end * 1000) : end.toFixed(3);
      const unit = bandConfig.displayUnit || 'MHz';
      startFreqDisplay.textContent = `${displayStart} ${unit}`;
      endFreqDisplay.textContent = `${displayEnd} ${unit}`;
      startFreqDisplay.dataset.freqMhz = start;
      endFreqDisplay.dataset.freqMhz = end;
      startFreqDisplay.style.display = 'inline';
      endFreqDisplay.style.display = 'inline';
    } else if (bandConfig.displayType === 'sw_bands') {
      swBandsContainer.style.display = 'flex';
    }
  };
  
  Object.keys(ACTIVE_BANDS).forEach((bandName) => {
    const button = document.createElement("button");
    button.className = "band-switch-button";
    button.textContent = bandName;
    button.addEventListener('click', () => {
      const bandInfo = ACTIVE_BANDS[bandName];
      bandSwitchWrapper.querySelectorAll('.band-switch-button').forEach(btn => btn.classList.remove('active-band'));
      button.classList.add('active-band');
      updateBottomDisplay(bandInfo);
      tuneToFrequency(bandInfo.tune);
    });
    bandSwitchWrapper.appendChild(button);
  });
  
  Object.entries(SW_BANDS).forEach(([name, freq]) => {
    const swButton = document.createElement('button');
    swButton.className = 'sw-band-button';
    swButton.textContent = name;
    swButton.title = `Go to ${freq.toFixed(3)} MHz`;
    swButton.addEventListener('click', () => tuneToFrequency(freq));
    swBandsContainer.appendChild(swButton);
  });

  startFreqDisplay.addEventListener('click', (e) => tuneToFrequency(parseFloat(e.target.dataset.freqMhz)));
  endFreqDisplay.addEventListener('click', (e) => tuneToFrequency(parseFloat(e.target.dataset.freqMhz)));

  const style = document.createElement('style');
  style.textContent = `
    #freq-container { position: relative !important; overflow: hidden; }
    .band-switch-wrapper { position: absolute; top: 4px; left: 6px; z-index: 10; display: flex; flex-direction: column; gap: 2px; }
    .band-switch-button { background-color: rgba(0, 0, 0, 0.4); color: var(--color-text); border: 1px solid var(--color-2); border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: bold; cursor: pointer; opacity: 0.7; transition: all 0.2s ease; line-height: 1.4; }
    .band-switch-button:hover { opacity: 1; border-color: var(--color-4); }
    .band-switch-button.active-band { background-color: var(--color-4); color: #fff; opacity: 1; }
    .band-bottom-display { position: absolute; bottom: 0; left: 0; right: 0; height: 22px; pointer-events: none; }
    .band-freq-display { position: absolute; bottom: 4px; z-index: 5; font-size: 12px; color: var(--color-text); opacity: 0.5; transition: opacity 0.2s ease; cursor: pointer; pointer-events: all; }
    .band-freq-display:hover { opacity: 0.9; }
    .band-freq-start { left: 8px; }
    .band-freq-end { right: 8px; }
    .sw-bands-container { display: flex; justify-content: space-around; align-items: center; width: 100%; height: 100%; padding: 0 5px; box-sizing: border-box; pointer-events: all; }
    .sw-band-button { background: none; border: none; color: var(--color-text); font-size: 10px; opacity: 0.6; cursor: pointer; padding: 2px 3px; transition: opacity 0.2s; }
    .sw-band-button:hover { opacity: 1; }
  `;
  document.head.appendChild(style);

  bottomDisplayContainer.appendChild(startFreqDisplay);
  bottomDisplayContainer.appendChild(endFreqDisplay);
  bottomDisplayContainer.appendChild(swBandsContainer);
  freqContainer.appendChild(bandSwitchWrapper);
  freqContainer.appendChild(bottomDisplayContainer);

  const initialBandName = Object.keys(ACTIVE_BANDS)[0];
  const initialBandInfo = ACTIVE_BANDS[initialBandName];
  bandSwitchWrapper.querySelector('.band-switch-button').classList.add('active-band');
  updateBottomDisplay(initialBandInfo);

  console.log(`Band Selector Plugin loaded with the following bands: ${Object.keys(ACTIVE_BANDS).join(', ')}`);
});

})();