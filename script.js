const overlay = document.getElementById("overlay");
const speedEl = document.getElementById("speed");
const altitudeEl = document.getElementById("altitude");
const throttleEl = document.getElementById("throttle");
const statusEl = document.getElementById("status");

const state = {
  position: { lat: 37.6213, lng: -122.379 },
  heading: 120,
  pitch: -6,
  roll: 0,
  altitude: 1200,
  speed: 220,
  throttle: 0.55,
  boost: false,
  brake: false,
  yaw: 0,
  muted: false,
};

const keys = new Set();

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

const canvas = overlay;
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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
};

function initAudio() {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const osc = context.createOscillator();
  const gain = context.createGain();
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();

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
  gain.connect(context.destination);

  osc.start();
  noise.start();

  audio.context = context;
  audio.gain = gain;
  audio.osc = osc;
  audio.noise = noise;
  audio.filter = filter;

  updateAudio();
}

function updateAudio() {
  if (!audio.context) return;
  const throttle = state.throttle;
  const baseVolume = state.muted ? 0 : 0.15 + throttle * 0.5;
  audio.gain.gain.setTargetAtTime(baseVolume, audio.context.currentTime, 0.05);
  const pitch = 120 + throttle * 280 + (state.boost ? 80 : 0);
  audio.osc.frequency.setTargetAtTime(pitch, audio.context.currentTime, 0.05);
  audio.filter.frequency.setTargetAtTime(600 + throttle * 1200, audio.context.currentTime, 0.05);
}

window.addEventListener("click", () => {
  if (!audio.context) {
    initAudio();
  } else if (audio.context.state === "suspended") {
    audio.context.resume();
  }
});

const terrain = [];
for (let i = 0; i < 120; i += 1) {
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

  const rollSpeed = 55;
  const pitchSpeed = 40;

  state.roll += rollInput * rollSpeed * dt;
  state.pitch += pitchInput * pitchSpeed * dt;
  state.pitch = Math.max(-45, Math.min(30, state.pitch));
  state.roll = Math.max(-75, Math.min(75, state.roll));

  state.yaw += yawInput * 50 * dt;
  state.heading += (rollInput * 35 + state.yaw) * dt;
  state.heading = (state.heading + 360) % 360;
  state.yaw *= 0.9;

  const throttleChange = (state.boost ? 0.25 : 0.08) * dt;
  if (state.brake) {
    state.throttle = Math.max(0.15, state.throttle - 0.4 * dt);
  } else {
    state.throttle = Math.min(1, state.throttle + throttleChange);
  }

  updateAudio();
}

function updatePhysics(dt) {
  const targetSpeed = 140 + state.throttle * 460;
  state.speed += (targetSpeed - state.speed) * 0.5 * dt;

  const climbRate = Math.sin((state.pitch * Math.PI) / 180) * state.speed * 0.6;
  state.altitude += climbRate * dt;
  state.altitude = Math.max(120, Math.min(8000, state.altitude));

  const distance = (state.speed / 3600) * dt;
  const headingRad = (state.heading * Math.PI) / 180;
  const latOffset = Math.cos(headingRad) * distance * 0.3;
  const lngOffset = Math.sin(headingRad) * distance * 0.3;

  state.position.lat += latOffset;
  state.position.lng += lngOffset;
}

function updateMapCamera() {
  if (!useGoogleMap || !map) return;
  map.moveCamera({
    center: state.position,
    heading: state.heading,
    tilt: 67.5 + state.pitch * -0.3,
    zoom: 12 + state.speed / 600,
  });
}

function drawHud() {
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(121, 214, 255, 0.6)";
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
      const size = 80 + peak.z * 200;
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
}

let lastTime = performance.now();

function loop(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  updateControls(dt);
  updatePhysics(dt);
  updateMapCamera();
  drawHud();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
