# Enhanced Tuning

Enhanced Tuning Plugin v2.6 for FM-DX-Webserver
<br>

A plugin for FM-DX-Webserver that enhances the user's tuning experience.

 - Band buttons to make it easier to navigate across a wide frequency range.

 - Adjustable tune step for both fine and coarse tuning. (FM: 10 kHz, 100 kHz and 1 Mhz. AM: 1 kHz, 10 kHz, 100 kHz and 1 mHz)

 - AM bandwidth control to improve the DX experience.*

 - USA tuning steps for the FM (200kHz) and MW (10kHz) bands.

 - Highly customizable. You can choose between two layouts and configure what is displayed in the config file.

<br>
* AM mode bandwidth control only works with the TEF6686_ESP32 firmware by Sjef Verhoeven, for example on portable units. For the FM-DX-Tuner firmware by Konrad, it only works with units using the 6686 (F8602) TEF chip. For use with 6686 (F8605) and 6687 (F8705), such as the HeadLess TEF, a small modification to the firmware is required.

---
With the Classic layout:
<br>
<img width="794" height="368" alt="bilde" src="https://github.com/user-attachments/assets/2fbb5904-ecc2-4fff-bd95-f3214c165008" />
<br>

 
<br>
<img width="795" height="366" alt="bilde" src="https://github.com/user-attachments/assets/23bc4cd0-7b53-4c24-a9f0-48575281b704" />
<br>


<br>
<img width="792" height="369" alt="bilde" src="https://github.com/user-attachments/assets/a42aebd0-9858-43f6-a201-37670d2c41c0" />

---
With the Modern layout:
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
For those updating from Band Selector, it is recommended to deactivate the old plugin and delete its files before installing Enhanced Tuning.

<br><br>


