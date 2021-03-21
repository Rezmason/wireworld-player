import { getDefaultURL } from "./data.js";
import { delay } from "./utils.js";
import gui from "./gui.js";
import parseFile from "./parse.js";

const params = new URL(document.location).searchParams;
const suppressSplash = params.has("nosplash");

const loadedFiles = new Map();

let data;

gui.events.addEventListener("statechanged", () => {
	// TODO
});

gui.events.addEventListener("advance", () => {
	// TODO
});

gui.events.addEventListener("resetsim", () => {
	// TODO
});

gui.events.addEventListener("load", () => {
	load(gui.state.file ?? gui.state.url, false);
});

const load = async (target, splash) => {
	let filename;
	try {
		if (splash && !suppressSplash) {
			gui.showAboutPopup(true);
		}

		const popupPromise = delay(splash ? 2 : 1);
		if (target instanceof File) {
			const file = target;
			filename = file.name;
			data = await loadFromDisk(file);
		} else {
			const url = target;
			filename = url.split("/").pop();
			data = await loadFromURL(url);
		}
		gui.reset(filename);
		gui.setPaper(data);
		if (!splash || !suppressSplash) {
			await popupPromise;
			if (splash) {
				gui.hideAboutPopup();
			} else {
				gui.hideLoadingPopup();
			}
		}
	} catch (error) {
		console.log(error);
		gui.showErrorPopup(`Load failed.`, `Couldn't load "${filename}".`, error.message);
	}
};

const loadFromDisk = file =>
	new Promise((resolve, reject) => {
		const localURL = `__local__${file.name}_${file.lastModified}`;
		if (loadedFiles.has(localURL)) {
			return loadedFiles.get(localURL);
		}

		const reader = new FileReader();
		reader.onerror = () => reject(`${reader.error.name}: ${reader.error.message}`);
		reader.onload = async () => {
			try {
				const data = await parseFile(reader.result);
				loadedFiles.set(localURL, data);
				resolve(data);
			} catch (error) {
				reject(error);
			}
		};
		reader.readAsText(file);
	});

const loadFromURL = async url => {
	gui.reset(url);
	if (!loadedFiles.has(url)) {
		const file = await fetch(url);
		if (!file.ok) {
			throw new Error(`${file.status}: ${file.statusText}`);
		}
		loadedFiles.set(url, await parseFile(await file.text()));
	}
	return loadedFiles.get(url);
};

const isPortrait = (screen.orientation?.type ?? "landscape-primary").startsWith("portrait");

const defaultURL = getDefaultURL(isPortrait);

load(defaultURL, true);
