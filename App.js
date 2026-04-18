// ═══════════════════════════════════════════════════════════════
//  Wind Turbine Suitability Dashboard — app.js
//  Tirupati, Andhra Pradesh | QGIS + Leaflet.js + TensorFlow.js ML
// ═══════════════════════════════════════════════════════════════

const TIRUPATI_CENTER = [13.6288, 79.4192];
const TIRUPATI_ZOOM   = 11;

// ── TIRUPATI APPROXIMATE BOUNDING BOX (EPSG:4326) ─────────────
// Used for ML spatial grid generation & raster overlay bounds
// Adjust these if your actual boundary differs:
const TIRUPATI_BOUNDS = {
  south: 13.52,
  north: 13.75,
  west:  79.28,
  east:  79.58
};

const GEOJSON_FILES = {
  boundary:        'geojson/boundary.geojson',
  buildings:       'geojson/buildings.geojson',
  schools:         'geojson/schools.geojson',
  hospitals:       'geojson/hospitals.geojson',
  waterways:       'geojson/waterways.geojson',
  waterbodies:     'geojson/waterbodies.geojson',
  wildlife:        'geojson/wildlife.geojson',
  landuse:         'geojson/landuse.geojson',
  powerlines:      'geojson/powerlines.geojson',
  powerstations:   'geojson/powerstations.geojson',
  query1final:     'geojson/query1final.geojson',
  query2final:     'geojson/query2final.geojson',
  query5final:     'geojson/query5final.geojson',
  query7final:     'geojson/query7final.geojson',
  query25final:    'geojson/query25final.geojson',
  final_sites:     'geojson/final_turbine_sites.geojson',
};

// ─── LAYER STYLES ─────────────────────────────────────────────
const STYLES = {
  boundary:      { color: '#38bdf8', weight: 2.5, fill: false, dashArray: '6,4' },
  buildings:     { color: '#ef4444', weight: 1, fillColor: '#ef4444', fillOpacity: 0.55, radius: 5 },
  schools:       { color: '#f97316', weight: 1, fillColor: '#f97316', fillOpacity: 0.6,  radius: 6 },
  hospitals:     { color: '#e11d48', weight: 1, fillColor: '#e11d48', fillOpacity: 0.6,  radius: 7 },
  query1final:   { color: '#84cc16', weight: 1.5, fillColor: '#84cc16', fillOpacity: 0.25 },
  waterways:     { color: '#3b82f6', weight: 2,   fill: false },
  waterbodies:   { color: '#60a5fa', weight: 1,   fillColor: '#60a5fa', fillOpacity: 0.45 },
  query2final:   { color: '#eab308', weight: 1.5, fillColor: '#eab308', fillOpacity: 0.25 },
  wildlife:      { color: '#22c55e', weight: 1.5, fillColor: '#22c55e', fillOpacity: 0.3  },
  landuse:       { color: '#16a34a', weight: 1,   fillColor: '#16a34a', fillOpacity: 0.2  },
  query5final:   { color: '#ec4899', weight: 1.5, fillColor: '#ec4899', fillOpacity: 0.25 },
  powerlines:    { color: '#fde68a', weight: 2,   fill: false, dashArray: '4,3' },
  powerstations: { color: '#fbbf24', weight: 1,   fillColor: '#fbbf24', fillOpacity: 0.7, radius: 7 },
  query7final:   { color: '#a855f7', weight: 1.5, fillColor: '#a855f7', fillOpacity: 0.25 },
  query25final:  { color: '#00d4aa', weight: 2,   fillColor: '#00d4aa', fillOpacity: 0.3  },
  final_sites:   { color: '#ff6b35', weight: 2.5, fillColor: '#ff6b35', fillOpacity: 0.55 },
};

// ─── QUERY METADATA ───────────────────────────────────────────
const QUERY_INFO = {
  q1: {
    title: 'Query 1 — Urban Avoidance',
    goal: 'Exclude areas within 5km of buildings, schools, and hospitals to ensure safety and compliance.',
    formula: 'Centroids → Merge(buildings+schools+hospitals) → Buffer(5000m, dissolve=ON) → Difference(Boundary − Buffer)',
    output: 'Query1final.shp',
    layers: ['buildings','schools','hospitals','query1final','boundary'],
    legend: [
      { color: '#ef4444', label: 'Buildings (input)' },
      { color: '#f97316', label: 'Schools (input)' },
      { color: '#e11d48', label: 'Hospitals (input)' },
      { color: '#84cc16', label: '✅ Q1 Result — Suitable area after urban exclusion' },
    ]
  },
  q2: {
    title: 'Query 2 — Water Safety',
    goal: 'Exclude areas within 200m of rivers, canals, and water bodies to avoid flood risk.',
    formula: 'Polygons to Lines → Merge(waterways+waterbodies+rivers) → Buffer(200m, dissolve=ON) → Difference(Boundary − Buffer)',
    output: 'Query2final.shp',
    layers: ['waterways','waterbodies','query2final','boundary'],
    legend: [
      { color: '#3b82f6', label: 'Waterways (input)' },
      { color: '#60a5fa', label: 'Water Bodies (input)' },
      { color: '#eab308', label: '✅ Q2 Result — Non-flood suitable land' },
    ]
  },
  q5: {
    title: 'Query 5 — Wildlife & Land Use',
    goal: 'Exclude wildlife protected zones and unsuitable land use areas.',
    formula: 'Merge(wildlife+landuse) → Buffer(1000m, dissolve=ON) → Difference(Boundary − Buffer)',
    output: 'Query5final.shp',
    layers: ['wildlife','landuse','query5final','boundary'],
    legend: [
      { color: '#22c55e', label: 'Wildlife Zones (input)' },
      { color: '#16a34a', label: 'Land Use (input)' },
      { color: '#ec4899', label: '✅ Q5 Result — Non-wildlife suitable land' },
    ]
  },
  q7: {
    title: 'Query 7 — Power Proximity',
    goal: 'Identify areas near power lines/stations while excluding wildlife zones and unsuitable land use.',
    formula: 'Buffer(PowerLines:2000m) + Buffer(Stations:1000m) → Merge → Difference(Landuse) → Difference(Wildlife)',
    output: 'Query7final.shp',
    layers: ['powerlines','powerstations','wildlife','query7final','boundary'],
    legend: [
      { color: '#fde68a', label: 'Power Lines (input)' },
      { color: '#fbbf24', label: 'Power Stations (input)' },
      { color: '#22c55e', label: 'Wildlife — excluded (input)' },
      { color: '#a855f7', label: '✅ Q7 Result — Power-accessible safe zones' },
    ]
  },
  final_vector: {
    title: 'Final Vector — All Exclusions Combined',
    goal: 'Intersection of all four vector queries. Areas that pass ALL spatial exclusion criteria simultaneously.',
    formula: 'Intersection(Q1∩Q2) → Intersection(∩Q5) → Intersection(∩Q7) = query25final',
    output: 'query25final.shp',
    layers: ['query25final','boundary'],
    legend: [
      { color: '#00d4aa', label: '✅ Final Vector — All criteria passed' },
    ]
  },
  ndvi: {
    title: 'Spectral Indices — NDVI / NDBI / NDWI / BSI',
    goal: 'Derived from Bhuvan 6-band satellite imagery. Used to identify vegetation, built-up, water, and open land.',
    formula: 'NDVI=(B4−B3)/(B4+B3) | NDBI=(B5−B4)/(B5+B4) | NDWI=(B2−B4)/(B2+B4) | BSI=((B5+B3)−(B4+B1))/((B5+B3)+(B4+B1))',
    output: 'NDVI.tif, NDBI.tif, NDWI.tif, BSI.tif',
    layers: ['boundary'],
    legend: [
      { color: '#2d6a4f', label: 'High NDVI (dense vegetation)' },
      { color: '#74c69d', label: 'Low NDVI (open land)' },
    ],
    isRaster: true,
    rasterNote: 'Raster outputs (NDVI/NDBI/NDWI/BSI .tif) computed in QGIS Raster Calculator. Display your exported PNG screenshots here.'
  },
  land_mask: {
    title: 'Raster Q1 — Land Suitability Mask',
    goal: 'Binary mask: 1 = open suitable land, 0 = excluded. Combines all spectral indices.',
    formula: '("NDVI@1" < 0.2) AND ("NDBI@1" < 0.0) AND ("NDWI@1" < 0.0) AND ("BSI@1" > 0.1)',
    output: 'LandMask.tif (1=Suitable, 0=Excluded)',
    layers: ['boundary'],
    legend: [
      { color: '#22c55e', label: '1 — Suitable open land' },
      { color: '#dc2626', label: '0 — Excluded (urban/water/forest)' },
    ],
    isRaster: true,
    rasterNote: 'LandMask.tif — binary raster with 1=suitable, 0=excluded pixels. Export as PNG from QGIS to display here.'
  },
  energy: {
    title: 'Raster Q4 — Energy Sustainability Score',
    goal: 'Combines normalized wind speed (60%) and power density (40%) into a composite energy score.',
    formula: '(0.6 × Norm_WindSpeed) + (0.4 × Norm_PowerDensity)\nNormalization: (value − MIN) / (MAX − MIN)',
    output: 'EnergySustainability.tif (0–1 scale)',
    layers: ['boundary'],
    legend: [
      { color: '#dc2626', label: '0.0 — Low energy potential' },
      { color: '#fbbf24', label: '0.5 — Medium' },
      { color: '#22c55e', label: '1.0 — High energy potential' },
    ],
    isRaster: true,
    rasterNote: 'EnergySustainability.tif — styled with RdYlGn color ramp in QGIS. Export as PNG to display here.'
  },
  final_raster: {
    title: 'Raster Q5 — Final Suitability Score',
    goal: 'Multiplies energy score by land mask. Unsuitable land is zeroed out. Values 0–1.',
    formula: '"EnergySustainability@1" × "LandMask@1"\nValues closer to 1.0 = Highly suitable for wind turbines',
    output: 'FinalSuitability.tif (0–1)',
    layers: ['boundary'],
    legend: [
      { color: '#dc2626', label: '< 0.3 Low suitability' },
      { color: '#f59e0b', label: '0.3–0.6 Medium' },
      { color: '#22c55e', label: '> 0.6 High suitability' },
    ],
    isRaster: true,
    rasterNote: 'FinalSuitability.tif — RdYlGn pseudocolor ramp applied in QGIS. Export as PNG to display here.'
  },
  final_combined: {
    title: '🎯 FINAL RESULT — Combined Turbine Sites',
    goal: 'Areas satisfying ALL criteria: outside all exclusion zones + high energy potential + ML classified as High suitability.',
    formula: 'Intersect(query25final ∩ ML_HighSuitability) = FINAL_TurbineSites',
    output: 'FINAL_ML_TurbineSites.shp',
    layers: ['query25final','final_sites','boundary'],
    legend: [
      { color: '#00d4aa', label: 'Vector suitable zones' },
      { color: '#ff6b35', label: '🎯 Final Turbine Sites' },
    ]
  },
};

// ─── STATE ────────────────────────────────────────────────────
let map, baseLayers = {}, allGeoLayers = {}, activeQuery = 'q1';
let loadedData = {};

// ═══════════════════════════════════════════════════════════════
//  ML MODEL — SPATIAL SUITABILITY CLASSIFIER
//  Uses TensorFlow.js. Trains entirely in the browser on features
//  derived from your loaded vector GeoJSON layers (no wind/power
//  raster data needed — those are skipped intentionally).
//
//  FEATURES USED (all from vector layers that work fine):
//   1. dist_urban   : distance to nearest building/school/hospital (normalized)
//   2. dist_water   : distance to nearest waterway/waterbody (normalized)
//   3. dist_wildlife: distance to nearest wildlife/landuse area (normalized)
//   4. dist_power   : distance to nearest power line/station (normalized)
//   5. lat_norm     : normalized latitude within Tirupati bounds
//   6. lng_norm     : normalized longitude within Tirupati bounds
//
//  OUTPUT: 3 classes  →  0=Low | 1=Medium | 2=High suitability
//
//  TRAINING STRATEGY:
//   • Points that fall INSIDE query1final+query2final+query5final
//     AND near query7final → labelled as High (2)
//   • Points inside some but not all → Medium (1)
//   • Points outside most results → Low (0)
//   • 500 random spatial points generated across Tirupati bounds
// ═══════════════════════════════════════════════════════════════

const ML = {
  model: null,
  trained: false,
  training: false,
  predictionLayer: null,    // L.LayerGroup holding prediction circles on map
  featurePoints: [],        // { lat, lng, features[6], label } — training set
  history: [],              // loss/acc per epoch for the chart
  GRID_SIZE: 22,            // grid resolution for prediction map (22×22 = 484 cells)
  NUM_TRAIN_POINTS: 500,
  EPOCHS: 40,

  // ── Haversine distance in km between two lat/lng points ──────
  haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
              Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // ── Extract centroid coords from a GeoJSON feature ───────────
  featureCentroid(feature) {
    const geom = feature.geometry;
    if (!geom) return null;
    if (geom.type === 'Point') return { lat: geom.coordinates[1], lng: geom.coordinates[0] };
    if (geom.type === 'MultiPoint') return { lat: geom.coordinates[0][1], lng: geom.coordinates[0][0] };
    if (geom.type === 'LineString') {
      const mid = Math.floor(geom.coordinates.length / 2);
      return { lat: geom.coordinates[mid][1], lng: geom.coordinates[mid][0] };
    }
    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      // simple centroid approximation — average first ring coords
      const coords = geom.type === 'Polygon' ? geom.coordinates[0]
                     : geom.coordinates[0][0];
      const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
      const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
      return { lat, lng };
    }
    return null;
  },

  // ── Minimum distance from point to any feature in a GeoJSON ──
  minDistToLayer(lat, lng, geojsonData) {
    if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) return 999;
    let minD = 999;
    for (const f of geojsonData.features) {
      const c = this.featureCentroid(f);
      if (c) {
        const d = this.haversine(lat, lng, c.lat, c.lng);
        if (d < minD) minD = d;
      }
    }
    return minD;
  },

  // ── Check if a point is "inside" any polygon of a GeoJSON ────
  // Uses ray-casting for polygons. Returns 1 if inside, 0 if not.
  pointInGeoJSON(lat, lng, geojsonData) {
    if (!geojsonData || !geojsonData.features) return 0;
    for (const f of geojsonData.features) {
      if (!f.geometry) continue;
      const polys = f.geometry.type === 'Polygon'   ? [f.geometry.coordinates]
                  : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      for (const poly of polys) {
        if (this._pointInRing(lng, lat, poly[0])) return 1;
      }
    }
    return 0;
  },

  _pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  },

  // ── Build 6 normalized features for a given lat/lng ──────────
  buildFeatures(lat, lng) {
    const { south, north, west, east } = TIRUPATI_BOUNDS;

    // Distances in km to each layer group (capped at 20km then /20 → 0..1)
    // Invert: large distance = bad for urban exclusion, but we want raw dist
    const dUrban    = Math.min(this.minDistToLayer(lat, lng, loadedData.buildings)  , 20) / 20;
    const dSchool   = Math.min(this.minDistToLayer(lat, lng, loadedData.schools)    , 20) / 20;
    const dHospital = Math.min(this.minDistToLayer(lat, lng, loadedData.hospitals)  , 20) / 20;
    const dWater    = Math.min(this.minDistToLayer(lat, lng, loadedData.waterways)  , 20) / 20;
    const dWBody    = Math.min(this.minDistToLayer(lat, lng, loadedData.waterbodies), 20) / 20;
    const dWildlife = Math.min(this.minDistToLayer(lat, lng, loadedData.wildlife)   , 20) / 20;
    const dLanduse  = Math.min(this.minDistToLayer(lat, lng, loadedData.landuse)    , 20) / 20;
    const dPowerL   = Math.min(this.minDistToLayer(lat, lng, loadedData.powerlines) , 20) / 20;
    const dPowerS   = Math.min(this.minDistToLayer(lat, lng, loadedData.powerstations),20)/20;

    // Aggregate into 6 features that match query semantics:
    const f1 = (dUrban + dSchool + dHospital) / 3;   // avg dist to urban features
    const f2 = (dWater + dWBody) / 2;                  // avg dist to water
    const f3 = (dWildlife + dLanduse) / 2;             // avg dist to wildlife/landuse
    const f4 = Math.min(dPowerL, dPowerS);             // min dist to power (want CLOSE)
    const f5 = (lat  - south) / (north - south);       // spatial lat
    const f6 = (lng  - west)  / (east  - west);        // spatial lng

    return [f1, f2, f3, f4, f5, f6];
  },

  // ── Label a point based on which query result polygons it's in ─
  // High(2): inside Q1final AND Q2final AND (Q5final or Q7final)
  // Medium(1): inside at least 2 of the 4 query finals
  // Low(0): inside 0 or 1 query results
  labelPoint(lat, lng) {
    const inQ1 = this.pointInGeoJSON(lat, lng, loadedData.query1final);
    const inQ2 = this.pointInGeoJSON(lat, lng, loadedData.query2final);
    const inQ5 = this.pointInGeoJSON(lat, lng, loadedData.query5final);
    const inQ7 = this.pointInGeoJSON(lat, lng, loadedData.query7final);
    const total = inQ1 + inQ2 + inQ5 + inQ7;
    if (inQ1 && inQ2 && (inQ5 || inQ7)) return 2; // High
    if (total >= 2) return 1;                       // Medium
    return 0;                                        // Low
  },

  // ── Generate training dataset ─────────────────────────────────
  generateTrainingData() {
    const { south, north, west, east } = TIRUPATI_BOUNDS;
    this.featurePoints = [];

    for (let i = 0; i < this.NUM_TRAIN_POINTS; i++) {
      const lat = south + Math.random() * (north - south);
      const lng  = west  + Math.random() * (east  - west);
      const features = this.buildFeatures(lat, lng);
      const label    = this.labelPoint(lat, lng);
      this.featurePoints.push({ lat, lng, features, label });
    }

    // Log class distribution
    const counts = [0,0,0];
    this.featurePoints.forEach(p => counts[p.label]++);
    console.log(`ML Training set: Low=${counts[0]}, Medium=${counts[1]}, High=${counts[2]}`);
  },

  // ── Build & train TensorFlow.js model ────────────────────────
  async trainModel(onProgress) {
    if (this.training) return;
    this.training = true;
    this.history  = [];

    // Generate training data from loaded GeoJSON
    this.generateTrainingData();

    // Prepare tensors
    const xs = tf.tensor2d(this.featurePoints.map(p => p.features));  // [N, 6]
    const ys = tf.oneHot(
      tf.tensor1d(this.featurePoints.map(p => p.label), 'int32'), 3
    );  // [N, 3]

    // Neural network: 6 inputs → 16 → 8 → 3 outputs (softmax)
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [6], units: 16, activation: 'relu',
          kernelInitializer: 'heNormal' }),
        tf.layers.dropout({ rate: 0.15 }),
        tf.layers.dense({ units: 8,  activation: 'relu' }),
        tf.layers.dense({ units: 3,  activation: 'softmax' }),
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Train
    await this.model.fit(xs, ys, {
      epochs:          this.EPOCHS,
      batchSize:       32,
      validationSplit: 0.15,
      shuffle:         true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          this.history.push({ epoch: epoch+1, loss: logs.loss, acc: logs.acc });
          if (onProgress) onProgress(epoch + 1, this.EPOCHS, logs.loss, logs.acc);
        }
      }
    });

    xs.dispose(); ys.dispose();
    this.trained  = true;
    this.training = false;
    console.log('ML model training complete.');
  },

  // ── Predict suitability class for a single point ─────────────
  predictPoint(lat, lng) {
    if (!this.model) return null;
    const features = this.buildFeatures(lat, lng);
    const inputTensor = tf.tensor2d([features]);
    const predTensor  = this.model.predict(inputTensor);
    const probs = predTensor.dataSync();   // Float32Array [3]
    inputTensor.dispose(); predTensor.dispose();
    return {
      probs: Array.from(probs),
      classIdx: probs.indexOf(Math.max(...probs)),
      confidence: Math.max(...probs)
    };
  },

  // ── Run prediction over a GRID and draw on map ───────────────
  runPredictionGrid() {
    if (!this.model || !map) return;

    // Clear old prediction layer
    if (this.predictionLayer) {
      map.removeLayer(this.predictionLayer);
    }
    this.predictionLayer = L.layerGroup().addTo(map);

    const { south, north, west, east } = TIRUPATI_BOUNDS;
    const latStep = (north - south) / this.GRID_SIZE;
    const lngStep = (east  - west)  / this.GRID_SIZE;

    const CLASS_COLORS = ['#ef4444', '#f59e0b', '#22c55e'];  // Low=Red, Med=Amber, High=Green
    const CLASS_LABELS = ['Low','Medium','High'];

    // Build batch of all grid points for efficient TF inference
    const gridPoints = [];
    for (let i = 0; i < this.GRID_SIZE; i++) {
      for (let j = 0; j < this.GRID_SIZE; j++) {
        const lat = south + (i + 0.5) * latStep;
        const lng  = west  + (j + 0.5) * lngStep;
        gridPoints.push({ lat, lng });
      }
    }

    const featureMatrix = gridPoints.map(p => this.buildFeatures(p.lat, p.lng));
    const inputTensor   = tf.tensor2d(featureMatrix);
    const predTensor    = this.model.predict(inputTensor);
    const allProbs      = predTensor.arraySync();  // [N, 3]
    inputTensor.dispose(); predTensor.dispose();

    allProbs.forEach((probs, idx) => {
      const { lat, lng } = gridPoints[idx];
      const classIdx = probs.indexOf(Math.max(...probs));
      const confidence = Math.max(...probs);

      // Only draw if confidence is meaningful enough to display
      if (confidence < 0.38) return;

      const bounds = [
        [lat - latStep/2, lng - lngStep/2],
        [lat + latStep/2, lng + lngStep/2]
      ];

      const rect = L.rectangle(bounds, {
        color:       CLASS_COLORS[classIdx],
        weight:      0.4,
        fillColor:   CLASS_COLORS[classIdx],
        fillOpacity: 0.28 + confidence * 0.22,
      });

      rect.bindPopup(`
        <div class="popup-title">ML Prediction Cell</div>
        <div class="popup-row"><span>Class</span><span><b>${CLASS_LABELS[classIdx]}</b></span></div>
        <div class="popup-row"><span>Confidence</span><span>${(confidence*100).toFixed(1)}%</span></div>
        <div class="popup-row"><span>Low</span><span>${(probs[0]*100).toFixed(1)}%</span></div>
        <div class="popup-row"><span>Medium</span><span>${(probs[1]*100).toFixed(1)}%</span></div>
        <div class="popup-row"><span>High</span><span>${(probs[2]*100).toFixed(1)}%</span></div>
        <div class="popup-row"><span>Coords</span><span>${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</span></div>
      `, { maxWidth: 240 });

      rect.addTo(this.predictionLayer);
    });

    // Bring boundary to front
    if (allGeoLayers['boundary'] && map.hasLayer(allGeoLayers['boundary'])) {
      allGeoLayers['boundary'].bringToFront();
    }
  },

  // ── Draw training chart in the ML panel ──────────────────────
  drawChart() {
    const canvas = document.getElementById('ml-train-chart');
    if (!canvas || this.history.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const pad = 28;
    const chartW = W - pad * 2;
    const chartH = H - pad * 2;

    // Draw grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px Space Mono, monospace';
    ctx.fillText('loss', 3, pad + 4);
    ctx.fillText('1.0', 3, pad + 4);
    ctx.fillText('0.0', 3, H - pad + 4);
    ctx.fillText('acc', W - 22, pad + 4);
    ctx.fillText(`ep ${this.EPOCHS}`, W - 32, H - pad + 12);

    const maxLoss = Math.max(...this.history.map(h => h.loss), 1.2);
    const epochs  = this.history.length;

    const toX = (i)    => pad + (i / (epochs - 1 || 1)) * chartW;
    const toYL = (val) => pad + chartH - (val / maxLoss) * chartH;
    const toYA = (val) => pad + chartH - val * chartH;

    // Loss line (red)
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.history.forEach((h, i) => {
      i === 0 ? ctx.moveTo(toX(i), toYL(h.loss)) : ctx.lineTo(toX(i), toYL(h.loss));
    });
    ctx.stroke();

    // Accuracy line (green)
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.history.forEach((h, i) => {
      i === 0 ? ctx.moveTo(toX(i), toYA(h.acc)) : ctx.lineTo(toX(i), toYA(h.acc));
    });
    ctx.stroke();

    // Legend dots
    ctx.fillStyle = '#f87171'; ctx.fillRect(pad, 4, 10, 6);
    ctx.fillStyle = '#94a3b8'; ctx.font = '8px Space Mono,monospace';
    ctx.fillText('Loss', pad + 13, 10);
    ctx.fillStyle = '#4ade80'; ctx.fillRect(pad + 46, 4, 10, 6);
    ctx.fillStyle = '#94a3b8'; ctx.fillText('Acc', pad + 59, 10);

    // Final values
    const last = this.history[this.history.length - 1];
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 9px Space Mono, monospace';
    ctx.fillText(`Loss: ${last.loss.toFixed(3)}  Acc: ${(last.acc*100).toFixed(1)}%`, pad, H - 4);
  },

  // ── Interactive map click prediction ─────────────────────────
  // Call this to predict for user-clicked lat/lng and show result
  predictClick(lat, lng) {
    if (!this.model) return;
    const result = this.predictPoint(lat, lng);
    const CLASS_LABELS = ['Low 🔴', 'Medium 🟡', 'High 🟢'];
    const CLASS_COLORS = ['#ef4444', '#f59e0b', '#22c55e'];

    L.popup({ maxWidth: 280 })
      .setLatLng([lat, lng])
      .setContent(`
        <div class="popup-title">🤖 ML Prediction</div>
        <div class="popup-row">
          <span>Suitability</span>
          <span style="color:${CLASS_COLORS[result.classIdx]};font-weight:700">
            ${CLASS_LABELS[result.classIdx]}
          </span>
        </div>
        <div class="popup-row"><span>Confidence</span><span>${(result.confidence*100).toFixed(1)}%</span></div>
        <div style="margin-top:6px;font-size:10px;color:#94a3b8">
          Low: ${(result.probs[0]*100).toFixed(1)}% &nbsp;
          Med: ${(result.probs[1]*100).toFixed(1)}% &nbsp;
          High: ${(result.probs[2]*100).toFixed(1)}%
        </div>
        <div style="font-size:9px;color:#475569;margin-top:4px">${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>
      `)
      .openOn(map);
  }
};

// ═══════════════════════════════════════════════════════════════
//  ML UI CONTROLLER  — wires ML object to the DOM panel
// ═══════════════════════════════════════════════════════════════

let mlClickModeActive = false;

function mlUpdateStatus(msg, type = 'info') {
  const el = document.getElementById('ml-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'ml-status ml-status-' + type;
}

function mlUpdateProgress(epoch, total, loss, acc) {
  const bar = document.getElementById('ml-progress-bar');
  const pct = Math.round((epoch / total) * 100);
  if (bar) bar.style.width = pct + '%';
  mlUpdateStatus(`Training… epoch ${epoch}/${total} | loss: ${loss.toFixed(3)} | acc: ${(acc*100).toFixed(1)}%`, 'training');

  // Live chart update every 5 epochs
  if (epoch % 5 === 0) ML.drawChart();
}

async function mlTrain() {
  if (ML.training) return;

  // Check that at least query1final is loaded (minimum viable)
  if (!loadedData.query1final) {
    mlUpdateStatus('⚠️ Wait for GeoJSON layers to load first.', 'warn');
    return;
  }

  const btn = document.getElementById('ml-train-btn');
  if (btn) btn.disabled = true;

  mlUpdateStatus('🔄 Generating spatial training data…', 'training');
  const progressBar = document.getElementById('ml-progress-bar');
  if (progressBar) progressBar.style.width = '0%';

  // Small delay so UI can repaint before heavy JS
  await new Promise(r => setTimeout(r, 80));

  try {
    await ML.trainModel(mlUpdateProgress);
    ML.drawChart();
    mlUpdateStatus(`✅ Training complete! ${ML.NUM_TRAIN_POINTS} samples, ${ML.EPOCHS} epochs.`, 'success');
    document.getElementById('ml-predict-btn').disabled  = false;
    document.getElementById('ml-click-btn').disabled    = false;
    if (progressBar) progressBar.style.width = '100%';
  } catch(err) {
    mlUpdateStatus('❌ Training error: ' + err.message, 'error');
    console.error(err);
  }
  if (btn) btn.disabled = false;
}

function mlPredict() {
  if (!ML.trained) {
    mlUpdateStatus('⚠️ Train the model first.', 'warn');
    return;
  }
  mlUpdateStatus('🗺️ Running prediction grid… this may take a moment.', 'training');
  setTimeout(() => {
    ML.runPredictionGrid();
    mlUpdateStatus('✅ Prediction grid drawn on map! Click cells for details.', 'success');
    // Show the ML result query info
    activateQuery('final_combined', document.querySelector('[data-query="final_combined"]'));
    // Put prediction layer on top
    if (ML.predictionLayer) {
      ML.predictionLayer.addTo(map);
      if (allGeoLayers['boundary']) allGeoLayers['boundary'].bringToFront();
    }
  }, 60);
}

function mlToggleClickMode() {
  if (!ML.trained) {
    mlUpdateStatus('⚠️ Train the model first.', 'warn');
    return;
  }
  mlClickModeActive = !mlClickModeActive;
  const btn = document.getElementById('ml-click-btn');
  if (mlClickModeActive) {
    map.getContainer().style.cursor = 'crosshair';
    if (btn) { btn.textContent = '🛑 Stop Click Mode'; btn.classList.add('active'); }
    mlUpdateStatus('👆 Click anywhere on the map to predict suitability for that point.', 'info');
  } else {
    map.getContainer().style.cursor = '';
    if (btn) { btn.textContent = '👆 Click-to-Predict Mode'; btn.classList.remove('active'); }
    mlUpdateStatus(ML.trained ? '✅ Model ready. Use Predict Grid or Click Mode.' : '', 'info');
  }
}

function mlClearPredictions() {
  if (ML.predictionLayer) {
    map.removeLayer(ML.predictionLayer);
    ML.predictionLayer = null;
  }
  mlUpdateStatus('Prediction layer cleared.', 'info');
}

// ─── INIT MAP ─────────────────────────────────────────────────
function initMap() {
  map = L.map('map', {
    center: TIRUPATI_CENTER,
    zoom: TIRUPATI_ZOOM,
    zoomControl: false,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19
  }).addTo(map);

  baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri World Imagery', maxZoom: 19
  });

  baseLayers.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap', maxZoom: 17
  });

  map.on('mousemove', e => {
    document.getElementById('coord-display').textContent =
      `${e.latlng.lat.toFixed(4)}°N, ${e.latlng.lng.toFixed(4)}°E`;
  });

  // Click-to-predict mode
  map.on('click', e => {
    if (mlClickModeActive) {
      ML.predictClick(e.latlng.lat, e.latlng.lng);
    }
  });

  loadAllLayers().then(() => {
    buildLayerToggles();
    activateQuery('q1', document.querySelector('[data-query=q1]'));
  });
}

// ─── LOAD ALL GEOJSON ─────────────────────────────────────────
async function loadAllLayers() {
  const promises = Object.entries(GEOJSON_FILES).map(async ([key, path]) => {
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      loadedData[key] = data;

      const style = STYLES[key] || { color: '#888', weight: 1, fillOpacity: 0.3 };
      const isPoint = isPointLayer(data);

      let layer;
      if (isPoint) {
        layer = L.geoJSON(data, {
          pointToLayer: (f, latlng) => L.circleMarker(latlng, {
            radius: style.radius || 5,
            fillColor: style.fillColor || style.color,
            color: style.color,
            weight: 1,
            opacity: 1,
            fillOpacity: style.fillOpacity || 0.7
          }),
          onEachFeature: (f, l) => addPopup(f, l, key)
        });
      } else {
        layer = L.geoJSON(data, {
          style: style,
          onEachFeature: (f, l) => addPopup(f, l, key)
        });
      }

      allGeoLayers[key] = layer;
    } catch (e) {
      allGeoLayers[key] = null;
      loadedData[key] = null;
    }
  });
  await Promise.all(promises);
}

function isPointLayer(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0) return false;
  const t = geojson.features[0].geometry.type;
  return t === 'Point' || t === 'MultiPoint';
}

// ─── POPUP ────────────────────────────────────────────────────
function addPopup(feature, layer, layerKey) {
  const props = feature.properties || {};
  const name = props.name || props.NAME || props.osm_id || layerKey;
  const area = props.area || props.Shape_Area || props.AREA || '';

  let html = `<div class="popup-title">${humanize(layerKey)}</div>`;
  if (name && name !== layerKey) html += `<div class="popup-row"><span>Name</span><span>${name}</span></div>`;
  if (area) html += `<div class="popup-row"><span>Area</span><span>${parseFloat(area).toFixed(2)} m²</span></div>`;
  if (props.type) html += `<div class="popup-row"><span>Type</span><span>${props.type}</span></div>`;

  layer.bindPopup(html, { maxWidth: 260 });
}

function humanize(key) {
  const names = {
    boundary:'Study Boundary', buildings:'Building', schools:'School',
    hospitals:'Hospital', waterways:'Waterway', waterbodies:'Water Body',
    wildlife:'Wildlife Zone', landuse:'Land Use', powerlines:'Power Line',
    powerstations:'Power Station', query1final:'Q1 — Urban Exclusion Result',
    query2final:'Q2 — Water Exclusion Result', query5final:'Q5 — Wildlife Exclusion Result',
    query7final:'Q7 — Power Proximity Result', query25final:'Final Vector Result',
    final_sites:'🎯 Final Turbine Site'
  };
  return names[key] || key;
}

// ─── RESET ────────────────────────────────────────────────────
function resetMap() {
  Object.entries(allGeoLayers).forEach(([key, layer]) => {
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
  });

  removeRasterOverlay();
  mlClearPredictions();

  // Disable click mode if active
  if (mlClickModeActive) mlToggleClickMode();

  const noticeEl = document.getElementById('raster-notice');
  if (noticeEl) noticeEl.style.display = 'none';

  document.querySelectorAll('.toggle-check').forEach(chk => chk.checked = false);
  document.querySelectorAll('.query-btn').forEach(b => b.classList.remove('active'));
  activeQuery = null;

  document.getElementById('query-info').innerHTML = `
    <div class="info-title" style="color:#64748b">No query selected</div>
    <div class="info-goal" style="color:#475569">
      Click any query button on the left to load that analysis layer on the map.
    </div>
  `;

  document.getElementById('legend-content').innerHTML = '';

  if (allGeoLayers['boundary']) {
    allGeoLayers['boundary'].addTo(map);
    const chk = document.getElementById('chk-boundary');
    if (chk) chk.checked = true;
  }

  map.setView(TIRUPATI_CENTER, TIRUPATI_ZOOM);

  const btn = document.getElementById('reset-btn');
  if (btn) {
    btn.style.background = 'rgba(0,212,170,0.2)';
    btn.style.borderColor = '#00d4aa';
    btn.style.color = '#00d4aa';
    btn.textContent = '✓ Reset Done';
    setTimeout(() => {
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.textContent = '↺ Reset';
    }, 1400);
  }
}

// ─── RASTER OVERLAY HELPERS ───────────────────────────────────
let currentRasterOverlay = null;

function removeRasterOverlay() {
  if (currentRasterOverlay && map.hasLayer(currentRasterOverlay)) {
    map.removeLayer(currentRasterOverlay);
  }
  currentRasterOverlay = null;
}

// addRasterOverlay — use this to display any exported QGIS PNG on the map.
// bounds = [[south_lat, west_lng], [north_lat, east_lng]]
// Example: addRasterOverlay('geojson/finalsuitability_screenshot.png',
//            [[13.52, 79.28], [13.75, 79.58]])
function addRasterOverlay(imagePath, bounds, opacity = 0.65) {
  removeRasterOverlay();
  currentRasterOverlay = L.imageOverlay(imagePath, bounds, { opacity });
  currentRasterOverlay.addTo(map);
}

// ─── ACTIVATE QUERY ───────────────────────────────────────────
function activateQuery(queryKey, btnEl) {
  activeQuery = queryKey;
  const info = QUERY_INFO[queryKey];
  if (!info) return;

  document.querySelectorAll('.query-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  Object.values(allGeoLayers).forEach(l => { if (l && map.hasLayer(l)) map.removeLayer(l); });
  removeRasterOverlay();

  info.layers.forEach(lk => {
    const l = allGeoLayers[lk];
    if (l) {
      l.addTo(map);
      if (lk === 'boundary') l.bringToFront();
    }
  });

  // Re-add prediction layer on top if it exists
  if (ML.predictionLayer && queryKey === 'final_combined') {
    ML.predictionLayer.addTo(map);
  }

  const noticeEl = document.getElementById('raster-notice');
  if (info.isRaster) {
    const html = `
      <strong>📡 Raster Layer — ${info.title}</strong><br><br>
      ${info.rasterNote}<br><br>
      <strong>Output:</strong> <code>${info.output}</code>
    `;
    if (!noticeEl) {
      const div = document.createElement('div');
      div.id = 'raster-notice'; div.className = 'no-data-notice'; div.style.display = 'block';
      div.innerHTML = html;
      document.querySelector('.map-area').appendChild(div);
    } else {
      noticeEl.innerHTML = html;
      noticeEl.style.display = 'block';
    }
  } else {
    if (noticeEl) noticeEl.style.display = 'none';
  }

  const resultKey = info.layers[info.layers.length - 2];
  if (allGeoLayers[resultKey] && map.hasLayer(allGeoLayers[resultKey])) {
    allGeoLayers[resultKey].bringToFront();
  }
  if (allGeoLayers['boundary'] && map.hasLayer(allGeoLayers['boundary'])) {
    allGeoLayers['boundary'].bringToFront();
  }

  updateInfoPanel(info);
  updateLegend(info);
  updateLayerToggleChecks(info.layers);
}

// ─── INFO PANEL ───────────────────────────────────────────────
function updateInfoPanel(info) {
  document.getElementById('query-info').innerHTML = `
    <div class="info-title">${info.title}</div>
    <div class="info-goal">${info.goal}</div>
    <div class="info-formula">
      <div class="formula-label">Formula / Method:</div>
      <div class="formula-code">${info.formula.replace(/\n/g, '<br>')}</div>
    </div>
    <div class="info-output">Output: <code>${info.output}</code></div>
  `;
}

// ─── LEGEND ───────────────────────────────────────────────────
function updateLegend(info) {
  const el = document.getElementById('legend-content');
  el.innerHTML = info.legend.map(item => `
    <div class="legend-item">
      <div class="legend-color" style="background:${item.color}"></div>
      <span>${item.label}</span>
    </div>
  `).join('');

  if (info.isRaster && (info === QUERY_INFO.final_raster || info === QUERY_INFO.energy)) {
    el.innerHTML += `
      <div style="margin-top:8px">
        <div class="legend-gradient" style="background:linear-gradient(to right,#dc2626,#fbbf24,#22c55e)"></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#64748b;font-family:'Space Mono',monospace">
          <span>0.0 Low</span><span>0.5 Med</span><span>1.0 High</span>
        </div>
      </div>
    `;
  }
}

// ─── LAYER TOGGLES ────────────────────────────────────────────
function buildLayerToggles() {
  const container = document.getElementById('layer-toggles');
  const layerDefs = [
    { key: 'boundary',      label: 'Study Boundary',    color: '#38bdf8' },
    { key: 'buildings',     label: 'Buildings',          color: '#ef4444' },
    { key: 'schools',       label: 'Schools',            color: '#f97316' },
    { key: 'hospitals',     label: 'Hospitals',          color: '#e11d48' },
    { key: 'waterways',     label: 'Waterways',          color: '#3b82f6' },
    { key: 'waterbodies',   label: 'Water Bodies',       color: '#60a5fa' },
    { key: 'wildlife',      label: 'Wildlife Zones',     color: '#22c55e' },
    { key: 'landuse',       label: 'Land Use',           color: '#16a34a' },
    { key: 'powerlines',    label: 'Power Lines',        color: '#fde68a' },
    { key: 'powerstations', label: 'Power Stations',     color: '#fbbf24' },
    { key: 'query1final',   label: 'Q1 Result (Lime)',   color: '#84cc16' },
    { key: 'query2final',   label: 'Q2 Result (Amber)',  color: '#eab308' },
    { key: 'query5final',   label: 'Q5 Result (Pink)',   color: '#ec4899' },
    { key: 'query7final',   label: 'Q7 Result (Purple)', color: '#a855f7' },
    { key: 'query25final',  label: 'Final Vector (Teal)',color: '#00d4aa' },
    { key: 'final_sites',   label: '🎯 Final Sites',     color: '#ff6b35' },
  ];

  container.innerHTML = layerDefs.map(ld => `
    <div class="layer-toggle" id="toggle-${ld.key}">
      <div class="toggle-dot" style="background:${ld.color}"></div>
      <span>${ld.label}</span>
      <input type="checkbox" class="toggle-check" id="chk-${ld.key}"
        onchange="toggleLayer('${ld.key}', this.checked)"
        ${allGeoLayers[ld.key] ? '' : 'disabled'}>
    </div>
  `).join('');
}

function updateLayerToggleChecks(activeLayers) {
  Object.keys(allGeoLayers).forEach(key => {
    const chk = document.getElementById(`chk-${key}`);
    if (chk) chk.checked = activeLayers.includes(key);
  });
}

function toggleLayer(key, visible) {
  const layer = allGeoLayers[key];
  if (!layer) return;
  if (visible) layer.addTo(map);
  else map.removeLayer(layer);
}

// ─── BASEMAP SWITCHER ─────────────────────────────────────────
function setBasemap(name, btn) {
  document.querySelectorAll('.map-toolbar .tool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  Object.values(baseLayers).forEach(l => map.removeLayer(l));
  baseLayers[name].addTo(map);
  baseLayers[name].bringToBack();
}

// ─── SHOW / HIDE ALL ──────────────────────────────────────────
function showAllLayers() {
  Object.entries(allGeoLayers).forEach(([key, layer]) => {
    if (layer && !map.hasLayer(layer)) {
      layer.addTo(map);
      const chk = document.getElementById(`chk-${key}`);
      if (chk) chk.checked = true;
    }
  });
}

function hideAllLayers() {
  Object.entries(allGeoLayers).forEach(([key, layer]) => {
    if (layer && map.hasLayer(layer) && key !== 'boundary') {
      map.removeLayer(layer);
      const chk = document.getElementById(`chk-${key}`);
      if (chk) chk.checked = false;
    }
  });
}

// ─── ZOOM TO BOUNDARY ─────────────────────────────────────────
function zoomToBoundary() {
  const bl = allGeoLayers['boundary'];
  if (bl) {
    try { map.fitBounds(bl.getBounds(), { padding: [20, 20] }); }
    catch(e) { map.setView(TIRUPATI_CENTER, TIRUPATI_ZOOM); }
  } else {
    map.setView(TIRUPATI_CENTER, TIRUPATI_ZOOM);
  }
}

// ─── MODAL ────────────────────────────────────────────────────
function closeModal() {
  document.getElementById('info-modal').classList.add('hidden');
}

// ─── START ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initMap);