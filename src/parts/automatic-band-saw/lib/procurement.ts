// Commercial identity and bore/stroke evidence, not supplier-certified mounting CAD.
export const sources = [
  {
    label: 'Prom.ua: Festo DSBC-63-500-PPSA-N3 double-acting head cylinder',
    url: 'https://prom.ua/ua/Pnevmotsilindr-63.html',
  },
  {
    label: 'Prom.ua: MA32x50-SCA magnetic clamp cylinder',
    url: 'https://prom.ua/ua/p1969399405-pnevmotsilindr-kruglyj-magnitom.html',
  },
  {
    label: 'Prom.ua: MA32x100-SCA shelf cylinder',
    url: 'https://prom.ua/p1969890636-pnevmotsilindr-kruglyj-magnitom.html',
  },
  {
    label: 'Prom.ua: 4V210-08 5/2 DC24V valve',
    url: 'https://prom.ua/ua/p2098352716-pnevmoklapan-elektromagnitnyj-4v210.html',
  },
  {
    label: 'Prom.ua: AR2000 G1/4 pressure regulator',
    url: 'https://prom.ua/p2081866525-regulyator-davleniya-ar2000.html',
  },
  {
    label: 'Prom.ua: AFR2000 filter regulator',
    url: 'https://prom.ua/ua/p2791833418-filtr-vlagootdelitel-reduktorom.html',
  },
  {
    label: 'Prom.ua: SFU1605 400 mm, BK12/BF12',
    url: 'https://prom.ua/p2333669726-shvp-sfu1605-400.html',
  },
  {
    label: 'Prom.ua: OMRON E3Z-LL81 BGS sensor (catalogue reference; confirm supply)',
    url: 'https://prom.ua/Fotoelektricheskij-datchik-omron-e3z-l81.html',
  },
  {
    label: 'Prom.ua: 2VD0102 G1/4 one-way flow control',
    url: 'https://prom.ua/p1913297936-drossel-obratnym-klapanom.html',
  },
];
export const bom = [
  {
    name: 'Festo DSBC-63-500-PPSA-N3, D20 rod, G3/8',
    quantity: 1,
    role: 'Extend to raise the free end of the pivoting bow; approximately 413 mm working travel inside 500 mm stroke',
    source: 0,
  },
  {
    name: 'MA32x50-SCA, Rc1/8, M10x1.25',
    quantity: 4,
    role: 'Shuttle side/top and station side/top pressure shoes; slotted angles and stroke switches',
    source: 1,
  },
  {
    name: 'MA32x100-SCA, Rc1/8, M10x1.25',
    quantity: 1,
    role: 'Shelf crank, adjustable clevises; mechanical closed stop carries part weight',
    source: 2,
  },
  {
    name: '4V210-08 5/2 DC24V',
    quantity: 5,
    role: 'Five process branches; shuttle side/top share one valve; head holding uses separate monitored retention',
    source: 3,
  },
  {
    name: 'AR2000 G1/4',
    quantity: 2,
    role: 'Separate clamp and descent pressure branches',
    source: 4,
  },
  {
    name: 'AFR2000 G1/4',
    quantity: 1,
    role: 'Filter/regulator with pressure switch and lockable inlet isolation',
    source: 5,
  },
  {
    name: 'SFU1605 reference kit; custom 425 mm shaft and supports required',
    quantity: 1,
    role: '155 mm shuttle travel; 425 mm custom shaft required; verify motor shaft/coupler bore (kit lists 6.35x10)',
    source: 6,
  },
  {
    name: 'E3Z-LL81 reflective BGS sensor',
    quantity: 1,
    role: 'Carriage-mounted nose scan and home-position presence, PNP 12–24 V; qualify surface response and confirm supply',
    source: 7,
  },
  {
    name: '2VD0102 G1/4 one-way flow control',
    quantity: 2,
    role: 'Separate lift/lower meter-out control; check supplied direction and banjo assembly',
    source: 8,
  },
];
