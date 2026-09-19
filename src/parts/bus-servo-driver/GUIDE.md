# Waveshare Bus Servo Driver HAT (A)

Fixed supplier SKU 27577. The official STEP is baked into private `lib/hat-native.json`; the preview and FreeCAD use the same geometry. `scripts/prepare-bus-servo-hat.py` records the source hash, source-solid indices, coordinate normalization and three repairs. Two invalid small underside ICs are represented by their measured envelopes; the large connector topology is repaired without volume change. Colours are illustrative. No mating cables or Raspberry Pi are supplied by this model.

PCB 57×65×1.6 mm, four Ø3 mounting holes, 49×58 mm pattern. Z=0 is the component-side PCB face. Input 9–25 V **must match the servo supply**. Onboard host power conversion does not regulate the servo rail. 3S Li-ion (11.1 V nominal, 12.6 V full) is compatible with the standard ST3215 12 V variant, not the 7.4 V variant.

Official sources: https://www.waveshare.com/bus-servo-driver-hat-a.htm and https://www.waveshare.com/wiki/Bus_Servo_Driver_HAT_(A).

The rocket-release package has a private copy of the prepared asset and adapter to preserve the independent-package contract. Refresh both explicitly with the preparation script; neither package imports the other.
