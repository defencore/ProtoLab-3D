# Machine drive motors

The JGB3865-520R45-12 option reuses the source envelope previously authored for the Hiwonder tracked chassis: 64.40 × 38 × 12.01 mm gearbox, Ø34 × 35.15 mm motor and 6 mm output shaft. The housing, motor can and shaft are one purchased unit, not three manufactured parts. The Hiwonder chassis and 520-motor product pages provide supplier context; exact OEM identity, availability, order execution, mounting holes, encoder, shaft fit and ratings require confirmation against the delivered motor. No internal gearbox design is provided.

The BEVI 121116 motor supplies 2.2 kW at 2890 rpm, 50 Hz. Its nameplate is 230/400 V; a 230 V three-phase VFD output requires the delta connection. B3 mounting dimensions are A140, B125, C56, H90, K10; shaft D24x50 with 8 mm key. Housing cooling ribs, end shields and ventilated fan cover are visible; their cosmetic contours remain representative.

The closed-loop STEPPERONLINE motor uses a compatible external encoder driver. The published 1.85 Nm value is holding torque. Axis sizing must use the available running torque at the selected supply voltage and speed. Motor encoder feedback cannot detect stock slipping inside a gripper.

Stepper pilot and hole pattern are nominal NEMA23 planning dimensions and must be checked against the delivered supplier drawing before drilling.

The closed-loop model reuses the detailed `stepper-motor` geometry. It includes bearing rings, individual lamination sections, pilot and mounting bores, D shaft, separate end caps and a representative encoder cover. Encoder cover and mounting details need the ordered dimensional drawing.
