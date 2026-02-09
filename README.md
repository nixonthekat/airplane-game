# F-15 Thunder Run

Fly an F-15 fighter through a photorealistic Google 3D world view (when a Google Maps API key is supplied), with throttle-controlled engine audio and a cinematic HUD overlay.

## Quick start

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Enable Google 3D tiles

1. Get a Google Maps JavaScript API key and create a Map ID with the **3D Tiles** basemap style.
2. In `index.html`, replace:

```js
window.GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
window.GOOGLE_MAPS_MAP_ID = "YOUR_MAP_ID";
```

3. Refresh the page. You should see photorealistic 3D tiles.

## Controls

- **W**: pitch down
- **S**: pitch up
- **A**: roll left
- **D**: roll right
- **Q / E**: yaw
- **Shift**: boost throttle
- **Space**: air brake
- **M**: mute engine

Click once in the page to unlock audio on browsers that require a gesture.
