import { defaultLandscapeFilePath, defaultPortraitFilePath } from "./data.js";
import gui from "./gui.js";
import parseFile from "./parse.js";

const loadedFiles = new Map();
let data, path;

gui.events.addEventListener("statechanged", () => {
	// TODO
});

gui.events.addEventListener("advance", () => {
	// TODO
});

const load = async path => {
	gui.reset(path);
	if (!loadedFiles.has(path)) {
		const file = await fetch(path);
		if (!file.ok) {
			throw new Error(`${file.status}: ${file.statusText}`);
		}
		loadedFiles.set(path, await parseFile(await file.text()));
	}
	return loadedFiles.get(path);
};

const isPortrait = (
	screen.orientation?.type ?? "landscape-primary"
).startsWith("portrait");

const defaultPath = isPortrait ? defaultPortraitFilePath : defaultLandscapeFilePath;

const init = async () => {
	gui.showSplashPopup();

	path = defaultPath;
	try {
		data = await load(path);
		gui.setPaper(data);
		gui.hideSplashPopup();
	} catch (error) {
		console.log(error);
		// TODO: show different error messages based on the error.
		showErrorPopup(`Load failed.`, `Couldn't load "${path.split("/").pop()}".`);
		return;
	}
};

init();
