import { copyFile } from 'node:fs/promises';

// These files are generated mirrors for the Sites iframe. Edit original/ first.
for (const [source, target] of [['index.html', 'trip.html'], ['weather.js', 'weather.js'], ['weather-ui.js', 'weather-ui.js'], ['weather.css', 'weather.css'], ['today.js', 'today.js'], ['favicon.ico', 'favicon.ico'], ['favicon-32.png', 'favicon-32.png'], ['apple-touch-icon.png', 'apple-touch-icon.png']]) {
  await copyFile(new URL('../original/' + source, import.meta.url), new URL('../public/' + target, import.meta.url));
}
console.log('Synced itinerary, navigation and weather assets to the Sites public directory.');
