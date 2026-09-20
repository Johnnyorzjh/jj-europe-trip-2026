import { copyFile } from 'node:fs/promises';

// These files are generated mirrors for the Sites iframe. Edit original/ first.
for (const [source, target] of [['index.html', 'trip.html'], ['weather.js', 'weather.js'], ['weather-ui.js', 'weather-ui.js'], ['weather.css', 'weather.css']]) {
  await copyFile(new URL('../original/' + source, import.meta.url), new URL('../public/' + target, import.meta.url));
}
console.log('Synced itinerary and weather assets to the Sites public directory.');
