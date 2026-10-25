// Globtrop – country "meta" table: everything the 3D scene needs to look like a given country.
// Keys: w weight, r region, d drive side, cl centre line, el edge line, ds direction-sign [bg,fg],
// ts town-sign [bg,fg,border], bo bollard, po poles, pl plate, sc script, cw "centre" in local lang,
// u units, sp speed [rural,urban], bs building style, bi biome default, br biome rules
// [latMin,latMax,lonMin,lonMax,biome], te terrain default, tr terrain rules, dirt unpaved chance,
// sl speed-sign style, lit hint litter/fence style, gc google car colour.
(function (root) {
  const EU = { u: 'km', sl: 'eu', sp: [90, 50], el: 'w', cl: 'w', d: 'R', po: 'conc', dirt: 0.05 };
  const P = (base, o) => Object.assign({}, EU, base, o);

  const WEU = { r: 'weu', bs: 'euw', bi: 'temperate', te: 'hilly' };
  const NEU = { r: 'neu', bs: 'nordic', bi: 'boreal', te: 'hilly', po: 'wood' };
  const EEU = { r: 'eeu', bs: 'eue', bi: 'temperate', te: 'flat' };
  const SEU = { r: 'seu', bs: 'med', bi: 'mediterranean', te: 'hilly' };
  const BAL = { r: 'bal', bs: 'eue', bi: 'temperate', te: 'hilly' };
  const LAT = { r: 'sam', u: 'km', sl: 'eu', sp: [80, 40], cl: 'y', el: 'w', d: 'R', bs: 'latam', po: 'conc', dirt: 0.25 };
  const AFR = { r: 'afr', u: 'km', sl: 'eu', sp: [80, 50], cl: 'w', el: 'w', bs: 'afr', po: 'wood', dirt: 0.45, bi: 'savanna', te: 'flat' };
  const SEA = { r: 'sea', u: 'km', sl: 'eu', sp: [80, 50], cl: 'w', el: 'w', bs: 'sea', po: 'conc', dirt: 0.15, bi: 'tropical', te: 'hilly' };

  const META = {
    // ---------- Western / Central Europe
    PL: P(EEU, { w: 3, ds: ['#1f7a3d', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'pl', po: 'holey', pl: 'eu:PL', sc: 'latn', cw: 'Centrum', cl: 'ww', bi: 'temperate' }),
    DE: P(WEU, { w: 4, ds: ['#f2c500', '#111'], ts: ['#f2c500', '#111', '#111'], bo: 'de', pl: 'eu:D', sc: 'latn', cw: 'Zentrum', sp: [100, 50], po: 'wood' }),
    FR: P(WEU, { w: 5, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#c8102e'], bo: 'fr', pl: 'eu:F', sc: 'latn', cw: 'Centre-ville', sp: [80, 50], br: [[41, 44.6, 2.8, 8, 'mediterranean']] }),
    GB: P(WEU, { w: 4, d: 'L', ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'uk', sc: 'latn', cw: 'Town Centre', u: 'mi', sp: [60, 30], bs: 'uk', sl: 'eu', el: 'w', br: [[56, 61, -8, 0, 'moor']] }),
    IE: P(WEU, { w: 1.5, d: 'L', ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'ie', sc: 'latn', cw: 'An Lár', sp: [80, 50], bs: 'uk', el: 'yd', po: 'wood' }),
    NL: P(WEU, { w: 1.5, ds: ['#fff', '#1a3c8f'], ts: ['#1a3c8f', '#fff', '#fff'], bo: null, pl: 'nl', sc: 'latn', cw: 'Centrum', te: 'flat', sp: [80, 50], bs: 'nl', po: 'none', cl: 'w' }),
    BE: P(WEU, { w: 1.5, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: 'be', pl: 'be', sc: 'latn', cw: 'Centrum', te: 'flat', sp: [70, 50], bs: 'nl' }),
    LU: P(WEU, { w: 0.5, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: 'de', pl: 'lu', sc: 'latn', cw: 'Centre', sp: [90, 50] }),
    CH: P(WEU, { w: 1.5, ds: ['#1a5fb4', '#fff'], ts: ['#1a5fb4', '#fff', '#fff'], bo: 'de', pl: 'ch', sc: 'latn', cw: 'Zentrum', te: 'mount', sp: [80, 50], bs: 'alpine', cl: 'w', el: 'w' }),
    AT: P(WEU, { w: 1.5, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#c8102e'], bo: 'de', pl: 'eu:A', sc: 'latn', cw: 'Zentrum', te: 'mount', sp: [100, 50], bs: 'alpine' }),
    CZ: P(EEU, { w: 1.5, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'cz', pl: 'eu:CZ', sc: 'latn', cw: 'Centrum', te: 'hilly' }),
    SK: P(EEU, { w: 1, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'cz', pl: 'eu:SK', sc: 'latn', cw: 'Centrum', te: 'hilly' }),
    HU: P(EEU, { w: 1.5, ds: ['#1f7a3d', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'hu', po: 'holey', pl: 'eu:H', sc: 'latn', cw: 'Centrum', te: 'flat' }),
    SI: P(BAL, { w: 0.8, ds: ['#f2c500', '#111'], ts: ['#fff', '#111', '#111'], bo: 'si', pl: 'eu:SLO', sc: 'latn', cw: 'Center', te: 'mount' }),
    HR: P(BAL, { w: 1.2, ds: ['#f2c500', '#111'], ts: ['#fff', '#111', '#111'], bo: 'hu', pl: 'eu:HR', sc: 'latn', cw: 'Centar', bs: 'med', br: [[42, 45.3, 13.5, 18.5, 'mediterranean']] }),
    RS: P(BAL, { w: 1, ds: ['#f2c500', '#111'], ts: ['#fff', '#111', '#111'], bo: 'rs', pl: 'eu:SRB', sc: 'cyrl2', cw: 'Центар', te: 'hilly' }),
    ME: P(BAL, { w: 0.5, ds: ['#f2c500', '#111'], ts: ['#fff', '#111', '#111'], bo: 'si', pl: 'eu:MNE', sc: 'latn', cw: 'Centar', te: 'mount', bs: 'med' }),
    MK: P(BAL, { w: 0.6, ds: ['#f2c500', '#111'], ts: ['#fff', '#111', '#111'], bo: 'hu', pl: 'eu:NMK', sc: 'cyrl', cw: 'Центар', te: 'mount', bi: 'steppe' }),
    AL: P(BAL, { w: 0.6, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'it', pl: 'eu:AL', sc: 'latn', cw: 'Qendra', te: 'mount', bs: 'med', bi: 'mediterranean' }),
    BG: P(EEU, { w: 1, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'hu', pl: 'eu:BG', sc: 'cyrl', cw: 'Център', te: 'hilly' }),
    RO: P(EEU, { w: 1.5, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: null, po: 'holey', pl: 'eu:RO', sc: 'latn', cw: 'Centru', te: 'hilly', dirt: 0.12 }),
    // ---------- Southern Europe
    IT: P(SEU, { w: 3, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'it', pl: 'eu:I', sc: 'latn', cw: 'Centro', sp: [90, 50], br: [[44, 47.2, 6, 14, 'temperate']] }),
    ES: P(SEU, { w: 3, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#c8102e'], bo: null, pl: 'eu:E', sc: 'latn', cw: 'Centro', sp: [90, 50], bi: 'steppe', br: [[42, 44, -9.5, -1.5, 'temperate'], [36, 39, -6, 0, 'mediterranean']] }),
    PT: P(SEU, { w: 1.5, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'eu:P', sc: 'latn', cw: 'Centro', sp: [90, 50], br: [[40.5, 42.2, -9, -6, 'temperate']] }),
    GR: P(SEU, { w: 1.5, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'gr', pl: 'eu:GR', sc: 'grek', cw: 'Κέντρο', sp: [90, 50], te: 'mount', el: 'y' }),
    TR: P(SEU, { w: 2.5, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'eu:TR', sc: 'latn', cw: 'Merkez', sp: [90, 50], bi: 'steppe', bs: 'med', br: [[40.8, 42.2, 27, 42, 'temperate'], [36, 38.5, 27, 33, 'mediterranean']], te: 'mount' }),
    CY: P(SEU, { w: 0.3, d: 'L', ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'cy', sc: 'grek', cw: 'Κέντρο', sp: [80, 50] }),
    MT: P(SEU, { w: 0.3, d: 'L', ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'eu:M', sc: 'latn', cw: 'Ċentru', sp: [80, 50], te: 'flat' }),
    // ---------- Nordics & Baltics
    SE: P(NEU, { w: 3, ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'se', pl: 'eu:S', sc: 'latn', cw: 'Centrum', sp: [80, 50], br: [[55, 58.5, 11, 17, 'temperate']] }),
    NO: P(NEU, { w: 2.5, cl: 'y', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'no', pl: 'eu:N', sc: 'latn', cw: 'Sentrum', sp: [80, 50], te: 'mount', br: [[68, 72, 15, 32, 'tundra']] }),
    FI: P(NEU, { w: 2.5, cl: 'y', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'fi', pl: 'eu:FIN', sc: 'latn', cw: 'Keskusta', sp: [80, 50], te: 'flat', dirt: 0.15 }),
    DK: P(NEU, { w: 1.2, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: 'dk', pl: 'eu:DK', sc: 'latn', cw: 'Centrum', sp: [80, 50], te: 'flat', bi: 'temperate', bs: 'nl', po: 'none' }),
    IS: P(NEU, { w: 0.8, ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'is', pl: 'is', sc: 'latn', cw: 'Miðbær', sp: [90, 50], te: 'mount', bi: 'tundra', po: 'none', el: 'n', dirt: 0.25 }),
    EE: P(NEU, { w: 0.8, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: 'fi', pl: 'eu:EST', sc: 'latn', cw: 'Kesklinn', sp: [90, 50], te: 'flat', bs: 'eue', dirt: 0.2 }),
    LV: P(NEU, { w: 0.8, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'fi', pl: 'eu:LV', sc: 'latn', cw: 'Centrs', sp: [90, 50], te: 'flat', bs: 'eue', bi: 'temperate', dirt: 0.25 }),
    LT: P(NEU, { w: 0.8, ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'fi', pl: 'eu:LT', sc: 'latn', cw: 'Centras', sp: [90, 50], te: 'flat', bs: 'eue', bi: 'temperate', dirt: 0.2, po: 'conc' }),
    // ---------- Eastern Europe & Central Asia
    UA: P(EEU, { w: 2, ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'ua', pl: 'ua', sc: 'cyrl', cw: 'Центр', el: 'n', dirt: 0.15, bi: 'steppe', br: [[49, 52.5, 22, 34, 'temperate']] }),
    RU: P(EEU, { w: 6, ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'ru', pl: 'ru', sc: 'cyrl', cw: 'Центр', el: 'n', dirt: 0.2, bi: 'boreal', br: [[44, 52, 34, 60, 'steppe'], [52, 57, 30, 50, 'temperate'], [41, 44.6, 38, 48, 'mountainsteppe']], po: 'conc', bs: 'rus' }),
    KZ: P(EEU, { w: 1.2, r: 'cas', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'ru', pl: 'kz', sc: 'cyrl', cw: 'Орталық', el: 'n', bi: 'steppe', dirt: 0.25, bs: 'rus' }),
    KG: P(EEU, { w: 0.6, r: 'cas', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'ru', pl: 'kz', sc: 'cyrl', cw: 'Борбор', el: 'n', bi: 'mountainsteppe', te: 'mount', dirt: 0.3, bs: 'rus' }),
    MN: P(EEU, { w: 0.6, r: 'cas', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, pl: 'mn', sc: 'cyrl', cw: 'Төв', el: 'n', bi: 'steppe', dirt: 0.55, bs: 'rus', po: 'conc' }),
    // ---------- North America
    US: { w: 10, r: 'nam', d: 'R', cl: 'yy', el: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, po: 'wood', pl: 'us', sc: 'latn', cw: 'Downtown', u: 'mi', sp: [55, 30], sl: 'us', bs: 'us', bi: 'temperate', te: 'flat', dirt: 0.08,
      br: [[31, 37.5, -118, -103, 'desert'], [37.5, 42, -120, -109, 'steppe'], [32, 49, -109, -97, 'prairie'], [25, 31, -98, -80, 'subtropical'], [43, 49, -96, -67, 'boreal'], [42, 49, -125, -120, 'pnw'], [32, 42, -124.5, -118, 'mediterranean']],
      tr: [[35, 49, -122, -105, 'mount'], [34, 42, -84, -77, 'hilly']] },
    CA: { w: 4, r: 'nam', d: 'R', cl: 'y', el: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, po: 'wood', pl: 'ca', sc: 'latn', cw: 'Centre-ville', u: 'km', sp: [80, 50], sl: 'ca', bs: 'us', bi: 'boreal', te: 'flat', dirt: 0.15,
      br: [[49, 54, -114, -97, 'prairie']], tr: [[48, 60, -130, -114, 'mount']] },
    MX: P(LAT, { w: 2.5, r: 'cam', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'mx', sc: 'latn', cw: 'Centro', bi: 'steppe', br: [[14, 21.5, -100, -86, 'tropical'], [26, 33, -116, -104, 'desert']], te: 'mount' }),
    GT: P(LAT, { w: 0.7, r: 'cam', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'mx', sc: 'latn', cw: 'Centro', bi: 'tropical', te: 'mount' }),
    // ---------- South America
    BR: P(LAT, { w: 6, ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'br', sc: 'latn', cw: 'Centro', bi: 'tropical', soil: 'red', br: [[-34, -24, -58, -47, 'subtropical'], [-16, -3, -46, -35, 'caatinga']], te: 'hilly' }),
    AR: P(LAT, { w: 3, cl: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'ar', sc: 'latn', cw: 'Centro', bi: 'pampa', br: [[-55, -40, -75, -62, 'patagonia'], [-33, -22, -70, -64, 'desert'], [-28, -22, -62, -53, 'subtropical']], te: 'flat', dirt: 0.3 }),
    CL: P(LAT, { w: 2, cl: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'cl', sc: 'latn', cw: 'Centro', bi: 'mediterranean', br: [[-30, -17, -76, -66, 'desert'], [-56, -38, -76, -66, 'pnw']], te: 'mount' }),
    CO: P(LAT, { w: 1.5, ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'co', sc: 'latn', cw: 'Centro', bi: 'tropical', te: 'mount' }),
    PE: P(LAT, { w: 1.5, ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'pe', sc: 'latn', cw: 'Centro', bi: 'highland', br: [[-19, -3, -82, -77.5, 'desert']], te: 'mount', dirt: 0.35 }),
    EC: P(LAT, { w: 0.8, ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'ec', sc: 'latn', cw: 'Centro', bi: 'highland', br: [[-5, 2, -81, -79.2, 'tropical'], [-5, 2, -77.5, -75, 'tropical']], te: 'mount' }),
    BO: P(LAT, { w: 0.8, ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'bo', sc: 'latn', cw: 'Centro', bi: 'highland', br: [[-18, -10, -65, -57, 'tropical']], te: 'mount', dirt: 0.45 }),
    UY: P(LAT, { w: 0.6, cl: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'uy', sc: 'latn', cw: 'Centro', bi: 'pampa', te: 'flat', dirt: 0.3 }),
    // ---------- East Asia
    JP: { w: 4, r: 'eas', d: 'L', cl: 'w', el: 'w', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, po: 'conc', pl: 'jp', sc: 'jpan', cw: '中心', u: 'km', sp: [50, 40], sl: 'eu', bs: 'jp', bi: 'temperate', te: 'mount', dirt: 0.02, br: [[24, 34, 122, 135, 'subtropical']] },
    KR: { w: 2, r: 'eas', d: 'R', cl: 'yy', el: 'w', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, po: 'conc', pl: 'kr', sc: 'kore', cw: '중심', u: 'km', sp: [60, 50], sl: 'eu', bs: 'kr', bi: 'temperate', te: 'mount', dirt: 0.03 },
    TW: { w: 1.2, r: 'eas', d: 'R', cl: 'yy', el: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, po: 'conc', pl: 'tw', sc: 'hani', cw: '市中心', u: 'km', sp: [60, 50], sl: 'eu', bs: 'tw', bi: 'subtropical', te: 'mount', dirt: 0.03 },
    // ---------- South-East & South Asia
    TH: P(SEA, { w: 2.5, d: 'L', cl: 'y', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: 'th', pl: 'th', sc: 'thai', cw: 'ตัวเมือง', te: 'flat' }),
    MY: P(SEA, { w: 1.2, d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: 'th', pl: 'my', sc: 'latn', cw: 'Pusat Bandar' }),
    ID: P(SEA, { w: 2.5, d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'id', sc: 'latn', cw: 'Pusat Kota', dirt: 0.2 }),
    PH: P(SEA, { w: 2, d: 'R', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'ph', sc: 'latn', cw: 'Poblacion', cl: 'w' }),
    KH: P(SEA, { w: 0.8, d: 'R', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, pl: 'kh', sc: 'khmr', cw: 'ទីប្រជុំជន', te: 'flat', dirt: 0.5 }),
    VN: P(SEA, { w: 1, d: 'R', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, pl: 'vn', sc: 'latn', cw: 'Trung tâm', dirt: 0.15 }),
    SG: P(SEA, { w: 0.3, d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'sg', sc: 'latn', cw: 'City Centre', te: 'flat', dirt: 0 }),
    IN: P(SEA, { w: 2.5, r: 'sas', d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#ffd400', '#111', '#111'], bo: null, pl: 'in', sc: 'deva', cw: 'केंद्र', bi: 'savanna', bs: 'sas', br: [[8, 20, 72, 80, 'tropical'], [24, 30, 68, 76, 'desert']], te: 'flat', dirt: 0.25 }),
    BD: P(SEA, { w: 0.6, r: 'sas', d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'in', sc: 'beng', cw: 'কেন্দ্র', bs: 'sas', te: 'flat', dirt: 0.3 }),
    LK: P(SEA, { w: 0.6, r: 'sas', d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'lk', sc: 'sinh', cw: 'නගරය', bs: 'sas' }),
    // ---------- Middle East
    IL: { w: 1, r: 'mea', d: 'R', cl: 'w', el: 'y', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, po: 'conc', pl: 'il', sc: 'hebr', cw: 'מרכז', u: 'km', sp: [80, 50], sl: 'eu', bs: 'mea', bi: 'mediterranean', br: [[29, 31.3, 34, 36, 'desert']], te: 'hilly', dirt: 0.05 },
    JO: { w: 0.6, r: 'mea', d: 'R', cl: 'w', el: 'w', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, po: 'conc', pl: 'jo', sc: 'arab', cw: 'وسط المدينة', u: 'km', sp: [80, 50], sl: 'eu', bs: 'mea', bi: 'desert', te: 'hilly', dirt: 0.1 },
    AE: { w: 0.6, r: 'mea', d: 'R', cl: 'w', el: 'y', ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, po: 'none', pl: 'ae', sc: 'arab', cw: 'وسط المدينة', u: 'km', sp: [100, 60], sl: 'eu', bs: 'mea', bi: 'desert', te: 'flat', dirt: 0 },
    TN: { w: 0.6, r: 'mea', d: 'R', cl: 'w', el: 'w', ds: ['#1a4fa0', '#fff'], ts: ['#fff', '#111', '#111'], bo: 'th', po: 'conc', pl: 'tn', sc: 'arab', cw: 'وسط المدينة', u: 'km', sp: [90, 50], sl: 'eu', bs: 'mea', bi: 'mediterranean', br: [[30, 34.5, 7, 12, 'steppe']], te: 'flat', dirt: 0.15 },
    // ---------- Africa
    ZA: P(AFR, { w: 3, d: 'L', el: 'y', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: 'za', pl: 'za', sc: 'latn', cw: 'Town Centre', bi: 'savanna', br: [[-35, -32, 17, 27, 'fynbos'], [-32, -26, 16, 23, 'semidesert'], [-31, -26, 29, 33, 'subtropical']], te: 'hilly', dirt: 0.25, po: 'wood' }),
    BW: P(AFR, { w: 0.8, d: 'L', el: 'y', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: 'za', pl: 'bw', sc: 'latn', cw: 'Town Centre', bi: 'semidesert', dirt: 0.35 }),
    KE: P(AFR, { w: 1.2, d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'ke', sc: 'latn', cw: 'Town Centre', bi: 'savanna', soil: 'red', te: 'hilly' }),
    UG: P(AFR, { w: 0.8, d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'ke', sc: 'latn', cw: 'Town Centre', bi: 'tropical', soil: 'red', te: 'hilly' }),
    NG: P(AFR, { w: 1.2, ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'ng', sc: 'latn', cw: 'Town Centre', bi: 'savanna', br: [[4, 8, 2, 10, 'tropical']], soil: 'red' }),
    GH: P(AFR, { w: 0.8, ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'gh', sc: 'latn', cw: 'Town Centre', bi: 'tropical', soil: 'red', br: [[8, 12, -3.5, 1.5, 'savanna']] }),
    SN: P(AFR, { w: 0.8, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'sn', sc: 'latn', cw: 'Centre-ville', bi: 'sahel' }),
    TZ: P(AFR, { w: 0.8, d: 'L', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: null, pl: 'ke', sc: 'latn', cw: 'Mjini', bi: 'savanna', soil: 'red' }),
    RW: P(AFR, { w: 0.5, ds: ['#1a4fa0', '#fff'], ts: ['#1a4fa0', '#fff', '#fff'], bo: null, pl: 'rw', sc: 'latn', cw: 'Centre', bi: 'tropical', soil: 'red', te: 'mount' }),
    MG: P(AFR, { w: 0.6, ds: ['#fff', '#111'], ts: ['#fff', '#111', '#111'], bo: null, pl: 'mg', sc: 'latn', cw: 'Afovoany', bi: 'highland', soil: 'red', te: 'hilly', dirt: 0.5 }),
    // ---------- Oceania
    AU: { w: 5, r: 'oce', d: 'L', cl: 'w', el: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: 'au', po: 'wood', pl: 'au', sc: 'latn', cw: 'Town Centre', u: 'km', sp: [100, 50], sl: 'eu', bs: 'au', bi: 'outback', te: 'flat', dirt: 0.25, soil: 'red',
      br: [[-39, -28, 140, 154, 'eucalypt'], [-35.5, -30, 114, 120, 'eucalypt'], [-44, -40, 144, 149, 'eucalypt'], [-19, -10, 141, 146.5, 'tropical']] },
    NZ: { w: 2, r: 'oce', d: 'L', cl: 'w', el: 'w', ds: ['#0b6b3a', '#fff'], ts: ['#0b6b3a', '#fff', '#fff'], bo: 'nz', po: 'wood', pl: 'nz', sc: 'latn', cw: 'Town Centre', u: 'km', sp: [100, 50], sl: 'eu', bs: 'au', bi: 'nzpasture', te: 'mount', dirt: 0.15 },
  };

  // Script info & tiny transliterators so place names on signs appear in the local alphabet.
  const CYR = { a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'ы', z: 'з' };
  const CYR2 = [['shch', 'щ'], ['sch', 'ш'], ['zh', 'ж'], ['kh', 'х'], ['ch', 'ч'], ['sh', 'ш'], ['ts', 'ц'], ['ya', 'я'], ['yu', 'ю'], ['yo', 'ё'], ['ye', 'е'], ['iy', 'ий'], ['yy', 'ый']];
  const GRK = { a: 'α', b: 'μπ', c: 'κ', d: 'δ', e: 'ε', f: 'φ', g: 'γ', h: 'χ', i: 'ι', j: 'ι', k: 'κ', l: 'λ', m: 'μ', n: 'ν', o: 'ο', p: 'π', q: 'κ', r: 'ρ', s: 'σ', t: 'τ', u: 'ου', v: 'β', w: 'ου', x: 'ξ', y: 'ι', z: 'ζ' };
  const GRK2 = [['th', 'θ'], ['ch', 'χ'], ['ps', 'ψ'], ['ks', 'ξ'], ['ph', 'φ'], ['ou', 'ου'], ['ai', 'αι'], ['ei', 'ει'], ['oi', 'οι'], ['mp', 'μπ'], ['nt', 'ντ'], ['gk', 'γκ']];
  function strip(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function translit(name, sc) {
    if (sc !== 'cyrl' && sc !== 'grek') return null;
    const pairs = sc === 'cyrl' ? CYR2 : GRK2, single = sc === 'cyrl' ? CYR : GRK;
    const words = strip(name).split(/(\s|-)/);
    return words.map(w => {
      let out = '', lw = w.toLowerCase(), i = 0;
      while (i < lw.length) {
        let hit = null;
        for (const [k, v] of pairs) if (lw.startsWith(k, i)) { hit = [k, v]; break; }
        if (hit) { out += hit[1]; i += hit[0].length; continue; }
        const ch = lw[i]; out += single[ch] !== undefined ? single[ch] : ch; i++;
      }
      if (sc === 'grek') out = out.replace(/σ$/, 'ς');
      return w && w[0] !== w[0].toLowerCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
    }).join('');
  }

  const REGION_NAMES = { weu: 'Europa Zachodnia', neu: 'Europa Północna', eeu: 'Europa Wschodnia', seu: 'Europa Południowa', bal: 'Bałkany', cas: 'Azja Środkowa', nam: 'Ameryka Północna', cam: 'Ameryka Środkowa', sam: 'Ameryka Południowa', eas: 'Azja Wschodnia', sea: 'Azja Południowo-Wschodnia', sas: 'Azja Południowa', mea: 'Bliski Wschód', afr: 'Afryka', oce: 'Oceania' };
  // Regions bots confuse with each other when they only half-know a clue
  const NEAR_REGIONS = { weu: ['neu', 'eeu', 'seu'], neu: ['weu', 'eeu'], eeu: ['bal', 'neu', 'cas'], seu: ['weu', 'bal'], bal: ['eeu', 'seu'], cas: ['eeu'], nam: ['oce', 'neu'], cam: ['sam'], sam: ['cam', 'seu'], eas: ['sea'], sea: ['eas', 'sas', 'sam'], sas: ['sea', 'mea'], mea: ['seu', 'sas'], afr: ['sam', 'sas'], oce: ['nam', 'afr'] };

  const api = { META, translit, REGION_NAMES, NEAR_REGIONS };
  if (typeof module !== 'undefined') module.exports = api; else root.GT_META = api;
})(this);
