const overlay = document.getElementById("overlay");
const speedEl = document.getElementById("speed");
const altitudeEl = document.getElementById("altitude");
const throttleEl = document.getElementById("throttle");
const gforceEl = document.getElementById("gforce");
const statusEl = document.getElementById("status");
const planeEl = document.getElementById("plane");
const afterburnerEl = planeEl.querySelector(".afterburner");
const throttleFill = document.getElementById("throttle-fill");
const speedLines = document.getElementById("speed-lines");

const state = {
  position: { lat: 37.6213, lng: -122.379 },
  heading: 120,
  pitch: -6,
  roll: 0,
  yaw: 0,
  altitude: 1200,
  speed: 220,
  throttle: 0.55,
  boost: false,
  brake: false,
  gforce: 1.0,
  muted: false,
};

const keys = new Set();
let lastPitch = state.pitch;
let lastRoll = state.roll;

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === "m") {
    state.muted = !state.muted;
    updateAudio();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("wheel", (event) => {
  const delta = Math.sign(event.deltaY);
  state.throttle = Math.min(1, Math.max(0.1, state.throttle - delta * 0.04));
  updateAudio();
});

const canvas = overlay;
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * scale;
  canvas.height = canvas.clientHeight * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let map;
let useGoogleMap = false;

function loadGoogleMaps() {
  const apiKey = window.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
    statusEl.textContent = "Running in stylized terrain mode. Add an API key for real 3D tiles.";
    return;
  }

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=beta&libraries=maps`;
  script.async = true;
  script.onload = () => {
    const mapId = window.GOOGLE_MAPS_MAP_ID || "";
    map = new google.maps.Map(document.getElementById("map"), {
      center: state.position,
      zoom: 12,
      heading: state.heading,
      tilt: 67.5,
      mapId,
      disableDefaultUI: true,
      gestureHandling: "none",
    });
    statusEl.textContent = "Photorealistic 3D tiles engaged. Fly safe!";
    useGoogleMap = true;
  };
  script.onerror = () => {
    statusEl.textContent = "Failed to load Google Maps. Staying in stylized terrain mode.";
  };
  document.head.appendChild(script);
}

loadGoogleMaps();

const audio = {
  context: null,
  gain: null,
  osc: null,
  noise: null,
  filter: null,
  compressor: null,
  panner: null,
};

function initAudio() {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const osc = context.createOscillator();
  const gain = context.createGain();
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const panner = context.createStereoPanner();

  const bufferSize = context.sampleRate * 2;
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  noise.buffer = noiseBuffer;
  noise.loop = true;

  osc.type = "sawtooth";
  filter.type = "lowpass";
  filter.frequency.value = 800;

  osc.connect(filter);
  filter.connect(gain);
  noise.connect(gain);
  gain.connect(compressor);
  compressor.connect(panner);
  panner.connect(context.destination);

  osc.start();
  noise.start();

  audio.context = context;
  audio.gain = gain;
  audio.osc = osc;
  audio.noise = noise;
  audio.filter = filter;
  audio.compressor = compressor;
  audio.panner = panner;

  updateAudio();
}

function updateAudio() {
  if (!audio.context) return;
  const throttle = state.throttle;
  const baseVolume = state.muted ? 0 : 0.12 + throttle * 0.65 + (state.boost ? 0.15 : 0);
  audio.gain.gain.setTargetAtTime(baseVolume, audio.context.currentTime, 0.06);
  const pitch = 120 + throttle * 320 + (state.boost ? 140 : 0);
  audio.osc.frequency.setTargetAtTime(pitch, audio.context.currentTime, 0.05);
  audio.filter.frequency.setTargetAtTime(600 + throttle * 1500, audio.context.currentTime, 0.08);
  audio.panner.pan.setTargetAtTime(state.roll / 90, audio.context.currentTime, 0.1);
}

window.addEventListener("click", () => {
  if (!audio.context) {
    initAudio();
  } else if (audio.context.state === "suspended") {
    audio.context.resume();
  }
});

const terrain = [];
for (let i = 0; i < 140; i += 1) {
  terrain.push({
    x: Math.random() * 1.2 - 0.1,
    y: Math.random() * 0.8 + 0.2,
    z: Math.random(),
  });
}

function updateControls(dt) {
  const pitchInput = (keys.has("w") ? -1 : 0) + (keys.has("s") ? 1 : 0);
  const rollInput = (keys.has("a") ? -1 : 0) + (keys.has("d") ? 1 : 0);
  const yawInput = (keys.has("q") ? -1 : 0) + (keys.has("e") ? 1 : 0);

  state.boost = keys.has("shift");
  state.brake = keys.has(" ");

  const rollSpeed = 65;
  const pitchSpeed = 48;

  state.roll += rollInput * rollSpeed * dt;
  state.pitch += pitchInput * pitchSpeed * dt;
  state.pitch = Math.max(-50, Math.min(30, state.pitch));
  state.roll = Math.max(-80, Math.min(80, state.roll));

  state.yaw += yawInput * 55 * dt;
  state.heading += (rollInput * 40 + state.yaw) * dt;
  state.heading = (state.heading + 360) % 360;
  state.yaw *= 0.88;

  const throttleChange = (state.boost ? 0.3 : 0.08) * dt;
  if (state.brake) {
    state.throttle = Math.max(0.1, state.throttle - 0.45 * dt);
  } else {
    state.throttle = Math.min(1, state.throttle + throttleChange);
  }

  updateAudio();
}

function updatePhysics(dt) {
  const targetSpeed = 150 + state.throttle * 520;
  state.speed += (targetSpeed - state.speed) * 0.45 * dt;

  const climbRate = Math.sin((state.pitch * Math.PI) / 180) * state.speed * 0.62;
  state.altitude += climbRate * dt;
  state.altitude = Math.max(120, Math.min(9000, state.altitude));

  const distance = (state.speed / 3600) * dt;
  const headingRad = (state.heading * Math.PI) / 180;
  const latOffset = Math.cos(headingRad) * distance * 0.3;
  const lngOffset = Math.sin(headingRad) * distance * 0.3;

  state.position.lat += latOffset;
  state.position.lng += lngOffset;

  const pitchDelta = Math.abs(state.pitch - lastPitch);
  const rollDelta = Math.abs(state.roll - lastRoll);
  state.gforce = Math.min(6, 1 + (pitchDelta + rollDelta) * 0.05);
  lastPitch = state.pitch;
  lastRoll = state.roll;
}

function updateMapCamera() {
  if (!useGoogleMap || !map) return;
  map.moveCamera({
    center: state.position,
    heading: state.heading,
    tilt: 68 + state.pitch * -0.35,
    zoom: 12.2 + state.speed / 620,
  });
}

function updatePlaneModel() {
  const pitch = state.pitch * 0.6;
  const roll = state.roll * 0.8;
  const yaw = state.yaw * 0.4;
  planeEl.style.transform = `rotateX(${pitch}deg) rotateZ(${roll}deg) rotateY(${yaw}deg) translateZ(20px)`;
  afterburnerEl.classList.toggle("active", state.boost);
  throttleFill.style.height = `${Math.round(state.throttle * 100)}%`;
}

function updateSpeedLines() {
  if (speedLines.childElementCount === 0) {
    for (let i = 0; i < 20; i += 1) {
      const line = document.createElement("span");
      line.style.left = `${Math.random() * 100}%`;
      line.style.animationDelay = `${Math.random() * 1.5}s`;
      line.style.animationDuration = `${1.6 - state.throttle * 0.9}s`;
      speedLines.appendChild(line);
    }
  }

  [...speedLines.children].forEach((line) => {
    line.style.animationDuration = `${1.8 - state.throttle * 1.1}s`;
    line.style.opacity = `${0.2 + state.throttle * 0.7}`;
  });
}

function drawHud() {
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(121, 214, 255, 0.65)";
  ctx.lineWidth = 2;
  ctx.translate(width / 2, height / 2);
  ctx.rotate((state.roll * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(-width, 0);
  ctx.lineTo(width, 0);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(121, 214, 255, 0.75)";
  ctx.fillRect(width - 40, height * 0.2, 6, height * 0.6);
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillRect(width - 44, height * (0.2 + 0.6 * (1 - state.throttle)), 14, 6);

  if (!useGoogleMap) {
    ctx.fillStyle = "rgba(9, 15, 35, 0.7)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(84, 168, 255, 0.6)";
    terrain.forEach((peak) => {
      const x = peak.x * width;
      const y = peak.y * height;
      const size = 80 + peak.z * 220;
      ctx.beginPath();
      ctx.moveTo(x - size, y + size);
      ctx.lineTo(x, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.fill();
    });
  }

  speedEl.textContent = `${Math.round(state.speed)} kts`;
  altitudeEl.textContent = `${Math.round(state.altitude)} ft`;
  throttleEl.textContent = `${Math.round(state.throttle * 100)}%`;
  gforceEl.textContent = `${state.gforce.toFixed(1)}g`;
}

let lastTime = performance.now();

function loop(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  updateControls(dt);
  updatePhysics(dt);
  updateMapCamera();
  updatePlaneModel();
  updateSpeedLines();
  drawHud();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
