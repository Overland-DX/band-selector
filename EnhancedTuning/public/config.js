// ==========================================================================
// Enhanced Tuning – Configuration File
// ==========================================================================

/**
 * Choose the visual layout for the plugin.
 * 'modern': Side panel layout with a dedicated AM/SW view.
 * 'classic': Compact layout with buttons inside the frequency panel (v1 style).
 */
const LAYOUT_STYLE = 'classic'; // 'modern' or 'classic'

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
 * Only effective if LAYOUT_STYLE is 'modern'.
 */
const ENABLE_FREQUENCY_MEMORY = true;