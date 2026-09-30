# Machine control components

Fixed external dimensions follow each linked manufacturer document. Terminal contours, fascia and vent positions are simplified; these are cabinet-planning models, not drill templates. Revision CL57T V3.0 must not be confused with later versions.

A PLC handles normal sequencing. The safety relay, guard locking, standstill monitoring, contactor feedback and pneumatic load holding require a separate validated design. The ATV12 does not supply an assumed safety-rated STO function. Keep guards locked during blade coast-down and keep the work clamped until the blade is safely retracted and stopped when required by the risk assessment.

The ATV12HU22M2 input line current exceeds 20 A at full rating. A 230 V supply description does not establish that a 16 A branch circuit is adequate.

DDCS v4.1 is available as a separate model with its fascia, screen and 17 keys, alongside the two-NC Schneider XB5AS8444 emergency stop. DDCS supplies the motion/HMI role; its three 50 mA sinking outputs cannot directly drive the saw's pneumatic sequence. Use a process PLC with sufficient I/O and electrically compatible isolated handshakes. Its manual's panel-cutout text conflicts with the adjacent drawing, so verify the delivered unit before machining the console.
