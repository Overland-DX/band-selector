# Enhanced Tuning

Enhanced Tuning Plugin v2.6 for FM-DX-Webserver
<br>
<br>
*A plugin for FM-DX-Webserver that enhances the user's tuning experience.*
<br><br>

 - Band buttons to make it easier to navigate across a wide frequency range.

 - Adjustable tune step for both fine and coarse tuning. (FM: 10 kHz, 100 kHz and 1 MHz. AM: 1 kHz, 10 kHz, 100 kHz and 1 MHz)

 - AM bandwidth control to improve the DX experience. (3kHz, 4kHz, 6kHz, 8kHz) *

 - USA tuning steps for the FM (200kHz) and MW (10kHz) bands.

 - You can choose between two layouts and configure what is displayed in the config file.

<br>
    
>**AM mode bandwidth works with all of the TEF6686_ESP32 firmware by Sjef Verhoeven, for example on portable units.<br>For the FM-DX-Tuner firmware by Konrad, it only works with units using the 6686 (F8602) TEF chip. For use with 6686 (F8605) and 6687 (F8705), such as the HeadLess TEF, a small modification to the firmware is required.*

<br>
If you feel you have the skills to flash your own Headless TEF, I have created a guide on how I did it [here](https://github.com/Overland-DX/Enhanced-Tuning/wiki/Flash-Headless-TEF-with-FM%E2%80%90DX%E2%80%90Tuner%E2%80%90Modded.bin).  

---
*With the Classic layout:*
<br>
<img width="794" height="368" alt="bilde" src="https://github.com/user-attachments/assets/2fbb5904-ecc2-4fff-bd95-f3214c165008" />
<br>

 
<br>
<img width="795" height="366" alt="bilde" src="https://github.com/user-attachments/assets/23bc4cd0-7b53-4c24-a9f0-48575281b704" />
<br>


<br>
<img width="792" height="369" alt="bilde" src="https://github.com/user-attachments/assets/a42aebd0-9858-43f6-a201-37670d2c41c0" />

---
*With the Modern layout:*
<br>
<img width="785" height="375" alt="bilde" src="https://github.com/user-attachments/assets/a59462ea-7253-498b-a511-751f1ca7e4ec" />
<br>
<br>
<img width="790" height="368" alt="bilde" src="https://github.com/user-attachments/assets/94ac071d-e393-4f5f-a859-a2373bf81d91" />

<br>
<br>
<img width="797" height="373" alt="bilde" src="https://github.com/user-attachments/assets/affd5b1b-e52b-4ffa-bc1e-fa5dc3697c38" />


---



<br><br>
How to Install:

 1. Download the plugin and place it in the web server's plugin folder.

 2. Restart the server and activate the plugin in the admin panel.

 3. Restart the server again.

 4. If you want to customize the plugin, go to: plugins\Enhanced_Tuning\public\config.js
    Set your preferences and save.

    

<br><br>
***For those updating from Band Selector, it is recommended to deactivate the old plugin and delete its files before installing Enhanced Tuning.***

<br><br><br>
Default values ​​in config.js:
<br><br>
```
// ==========================================================================
// Enhanced Tuning – Configuration File
// ==========================================================================

/**
 * Choose the visual layout for the plugin.
 * 'modern': Side panel layout with a dedicated AM/SW view.
 * 'classic': Compact layout with buttons inside the frequency panel (v1 style).
 */
const LAYOUT_STYLE = 'modern'; // 'modern' or 'classic'

/**
 * Show/hide all new UI elements (side buttons, AM view, etc.).
 * Only effective if LAYOUT_STYLE is 'modern'.
 */
const HIDE_ALL_BUTTONS = false;

/**
 * Show/hide the "Band Loop" button.
 * If false, the loop functionality is completely disabled.
 */
const SHOW_LOOP_BUTTON = true;

/**
 * Show/hide the start ↔ end frequency range display under the main frequency.
 */
const SHOW_BAND_RANGE = true;

/**
 * Enable/disable the new "Tune Step" feature.
 * If set to false, clicking the frequency display will do nothing,
 * and tuning will always use the original system steps.
 */
const ENABLE_TUNE_STEP_FEATURE = true;

/**
 * Automatically reset the tune step to default after a period of inactivity.
 * Set to 0 to disable this feature (step will remain selected until clicked off).
 * Any other number is the timeout in seconds.
 */
const TUNE_STEP_TIMEOUT_SECONDS = 20; // 0 = disabled

/**
 * Enable USA tuning mode (10kHz AM steps, 200kHz odd-decimal FM steps).
 * This replaces the default tuning step when the custom step feature is not active.
 */
const ENABLE_USA_TUNING_MODE = false;

/**
 * Enable custom AM bandwidth handling.
 * REQUIRES the TEF6686_ESP32' firmware by Sjef Verhoeven (PE5PVB).
 * If your firmware does not accept AM BW, set this to false.
 * Note: This feature is currently being tested. Please provide feedback on Discord.
 */
const ENABLE_AM_BW = true;

/**
 * Select the firmware compatibility mode.
 * This setting is ONLY effective if ENABLE_AM_BW is set to true.
 * It adjusts the AM bandwidth commands to match your hardware's firmware.
 *
 * Valid options are:
 * - 'TEF6686_ESP32': For TEF6686 modules with Sjef Verhoeven's (PE5PVB) ESP32 firmware.
 * - 'FM-DX-Tuner':  For Arduino modules with kkonrad's FM-DX-Tuner firmware.
 *                    (Note: Does not currently support the 'headless tef' and 'ESP32 + tef 8705/8605 module devices.)
 */
const FIRMWARE_TYPE = 'FM-DX-Tuner';

/**
 * Automatically select a default AM bandwidth when entering AM mode (< 27 MHz).
 * EFFECTIVE ONLY if:
 *   - ENABLE_AM_BW === true, and
 *   - You are running the TEF6686_ESP32' firmware.
 * Set to false to keep the firmware/server’s default selection.
 */
const ENABLE_DEFAULT_AM_BW = false;

/**
 * The default AM bandwidth to select when ENABLE_DEFAULT_AM_BW is true.
 * EFFECTIVE ONLY with TEF6686_ESP32' AND when ENABLE_AM_BW === true.
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
