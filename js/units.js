// The 17 units of the Personal Body Unit Index (CW&T, 2nd edition, 2025).
// All geometry is in poster viewBox units: 1000 x 1900 = 10" x 19", 100 units per inch,
// measured from a straight-on photo of the print.

export const POSTER_W = 1000;
export const POSTER_H = 1900;

export const COLORS = {
  paper: '#4a4a48',
  orange: '#ff6a13',
  bar: '#e9e9e4',
  ink: '#f4f4f0',
  pen: '#2b4bb5',
};

// Label bars: left-side bars sit at x=141..278 with the orange tab on the right end,
// right-side bars at x=729..865 with the tab on the left end.
export const BAR = { h: 17, tab: 10, left: { x: 141, w: 137 }, right: { x: 729, w: 136 } };

// Figures: extracted line art (assets/figures/*.png) placed by center + width or height.
export const FIGURES = {
  torso:    { src: 'torso.png',    cx: 508, cy: 279,  w: 323,  h: 155 },
  rings:    { src: 'rings.png',    cx: 502, cy: 458,  w: 130,  h: 135.6 },
  whole:    { src: 'whole.png',    cx: 503, cy: 599,  w: 153,  h: 96.2 },
  span:     { src: 'span.png',     cx: 498, cy: 770,  w: 133,  h: 128.2 },
  peek:     { src: 'peek.png',     cx: 503, cy: 915,  w: 113,  h: 60 },
  phalanx:  { src: 'phalanx.png',  cx: 495, cy: 1037, w: 90,   h: 80.8 },
  cubit:    { src: 'cubit.png',    cx: 481, cy: 1137, w: 158,  h: 73.4 },
  kneeling: { src: 'kneeling.png', cx: 468, cy: 1286, w: 177,  h: 97.5 },
  foot:     { src: 'foot.png',     cx: 501, cy: 1423, w: 41.9, h: 103 },
  reach:    { src: 'reach.png',    cx: 501, cy: 1635, w: 57.6, h: 265 },
};

// Each unit: label as printed, which side its bar is on, the bar's top y, the orange
// leader path from the bar tab to the dimension, the dimension marks (path + dots +
// circles), the figure it belongs to, and how to take the measurement.
export const UNITS = [
  {
    id: 'fathom', label: 'FATHOM', side: 'R', barY: 141, figure: 'torso',
    leader: 'M729,149.5 H542 L505,186.5',
    dim: 'M345,186 H675', ext: 'M345,171 V232 M675,171 V232', dots: [[345, 186], [675, 186]],
    howto: 'Stand with both arms stretched straight out to the sides. Measure from the tip of one middle finger to the tip of the other.',
    aka: 'your wingspan',
  },
  {
    id: 'brachom', label: 'BRACHOM', side: 'L', barY: 370, figure: 'torso',
    leader: 'M278,378.5 H560 L613,325.5',
    dim: 'M542,325 H675', ext: 'M542,287 V332 M675,287 V332', dots: [[542, 325], [675, 325]],
    howto: 'Arm stretched straight out to the side. Measure from the center of your chest (sternum) to the tip of your middle finger.',
    aka: 'half a fathom',
  },
  {
    id: 'index_diameter', label: 'INDEX DIAMETER Ø', side: 'R', barY: 391, figure: 'rings',
    leader: 'M729,399.5 H515 L482,432',
    dim: 'M472,438 H480 M476,434 V442', circles: [[476, 438, 8]], dots: [],
    howto: 'Touch the tip of your index finger to the tip of your thumb to make a ring. Measure the inside diameter of the hole.',
    aka: 'the "OK" sign hole',
  },
  {
    id: 'middle_diameter', label: 'Ø MIDDLE DIAMETER', side: 'L', barY: 502, figure: 'rings',
    leader: 'M278,510.5 H482 L525,477',
    dim: 'M527,471 H535 M531,467 V475', circles: [[531, 471, 8]], dots: [],
    howto: 'Touch the tip of your middle finger to the tip of your thumb to make a ring. Measure the inside diameter of the hole.',
    aka: 'the bigger finger ring',
  },
  {
    id: 'whole_diameter', label: 'WHOLE DIAMETER Ø', side: 'R', barY: 530, figure: 'whole',
    leader: 'M729,538.5 H570 L521,587.5',
    dim: 'M498,606 H506 M502,602 V610', circles: [[502, 606, 27]], dots: [],
    howto: 'Make a circle with both hands, fingertips touching and thumbs touching. Measure the inside diameter of the circle.',
    aka: 'the two-hand circle',
  },
  {
    id: 'span', label: 'SPAN', side: 'L', barY: 661, figure: 'span',
    leader: 'M278,669.5 H472 L499,696',
    dim: 'M429,696 H570', ext: 'M429,690 V782 M570,690 V782', dots: [[429, 696], [570, 696]],
    howto: 'Spread your hand as wide as it goes. Measure from the tip of your thumb to the tip of your pinky.',
    aka: 'the hand span',
  },
  {
    id: 'peek', label: 'PEEK', side: 'R', barY: 842, figure: 'peek',
    leader: 'M729,850.5 H532 L507,875.5',
    dim: 'M502,875 V890 M497,875 H507 M497,890 H507', dots: [],
    howto: 'Hold both hands together, thumbs touching, and open the gap between your index fingertips just enough to peek through. Measure the gap.',
    aka: 'the smallest gap you can gauge',
  },
  {
    id: 'index_phalanx', label: 'INDEX PHALANX', side: 'L', barY: 959, figure: 'phalanx',
    leader: 'M278,967.5 H458 L476,985.5',
    dim: 'M474,985 H500 M474,978 V993 M500,978 V993', dots: [[474, 985], [500, 985]],
    howto: 'Bend your index finger. Measure the last segment, from the fingertip to the first knuckle crease.',
    aka: 'the tip of your index finger',
  },
  {
    id: 'middle_phalanx', label: 'MIDDLE PHALANX', side: 'R', barY: 996, figure: 'phalanx',
    leader: 'M729,1004.5 H547 L533,1010',
    dim: 'M525,1010 V1036 M519,1010 H533 M519,1036 H533', dots: [[525, 1010], [525, 1036]],
    howto: 'Bend your middle finger. Measure the last segment, from the fingertip to the first knuckle crease.',
    aka: 'the tip of your middle finger',
  },
  {
    id: 'cubit', label: 'CUBIT', side: 'L', barY: 1202, figure: 'cubit',
    leader: 'M278,1210.5 H452 L481,1180.5',
    dim: 'M402,1180 H560', ext: 'M402,1150 V1195 M560,1165 V1195', dots: [[402, 1180], [560, 1180]],
    howto: 'Bend your elbow. Measure from the point of your elbow to the tip of your middle finger.',
    aka: 'the ancient forearm unit',
  },
  {
    id: 'upper_knee', label: 'UPPER KNEE HEIGHT', side: 'R', barY: 1265, figure: 'kneeling',
    leader: 'M729,1273.5 H612 L593,1254.5',
    dim: 'M593,1251 V1330', ext: 'M542,1251 H593 M567,1330 H595', dots: [[593, 1251], [593, 1330]],
    howto: 'Kneel on one knee with the other foot flat on the floor. Measure from the floor to the top of the raised thigh.',
    aka: 'a kneeling table height',
  },
  {
    id: 'lower_knee', label: 'LOWER KNEE HEIGHT', side: 'R', barY: 1307, figure: 'kneeling',
    leader: 'M729,1315.5 H597 L572,1290.5',
    dim: 'M571,1269 V1330', ext: 'M552,1269 H571', dots: [[571, 1269], [571, 1330]],
    howto: 'Kneel on one knee with the other foot flat on the floor. Measure from the floor to the top of the raised knee.',
    aka: 'a kneeling knee height',
  },
  {
    id: 'foot', label: 'FOOT', side: 'R', barY: 1414, figure: 'foot',
    leader: 'M729,1422.5 H550',
    dim: 'M550,1370 V1472', ext: 'M517,1370 H550 M515,1472 H550', dots: [[550, 1370], [550, 1472]],
    howto: 'Stand on a sheet of paper and mark your heel and the tip of your longest toe. Measure between the marks.',
    aka: 'the original foot',
  },
  {
    id: 'foot_width', label: 'FOOT WIDTH', side: 'L', barY: 1451, figure: 'foot',
    leader: 'M278,1459.5 H454 L481,1432',
    dim: 'M481,1431 H522 M481,1424 V1438 M522,1424 V1438', dots: [[481, 1431], [522, 1431]],
    howto: 'Stand on a sheet of paper and mark the widest points of your foot, across the ball. Measure between the marks.',
    aka: 'across the ball of the foot',
  },
  {
    id: 'reach', label: 'REACH', side: 'L', barY: 1626, figure: 'reach',
    leader: 'M278,1634.5 H450',
    dim: 'M450,1500 V1772', ext: 'M450,1500 H477 M450,1772 H572', dots: [[450, 1500], [450, 1772]],
    howto: 'Stand flat-footed and reach one arm straight up. Measure from the floor to the tip of your middle finger.',
    aka: 'how high you can reach',
  },
  {
    id: 'height', label: 'HEIGHT', side: 'R', barY: 1654, figure: 'reach',
    leader: 'M729,1662.5 H570',
    dim: 'M570,1554 V1772', ext: 'M505,1554 H570', dots: [[570, 1554], [570, 1772]],
    howto: 'Stand straight against a wall, shoes off. Measure from the floor to the top of your head.',
    aka: 'the one you already know',
  },
  {
    id: 'cubisolum', label: 'CUBISOLUM', side: 'R', barY: 1694, figure: 'reach',
    leader: 'M729,1702.5 H550',
    dim: 'M550,1632 V1772', ext: 'M517,1632 H550', dots: [[550, 1632], [550, 1772]],
    howto: 'Stand straight with your arms crossed. Measure from the floor to the bottom of your elbow.',
    aka: 'floor to elbow',
  },
];

export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));

export const TITLE = 'PERSONAL BODY UNIT INDEX';
export const FOOTER = 'CW&T // 2ND EDITION // CWT_HSP1WR3_1400 // ©2025';
