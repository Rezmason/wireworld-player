import { getDefaultURL } from "./data.js";
import { params, delay, fetchLocalText, fetchRemoteText } from "./utils.js";
import { gui } from "./gui.js";
import { paper } from "./paper.js";
import { parseFile } from "./parse.js";
import { timing } from "./timing.js";
import themes from "./themes.js";

const defaultEngineName = "auto";

const engineDefinitionsByName = {
	naive: {
		themeName: "regal",
		hardWorker: "naive",
	},
	alive: {
		themeName: "gourd",
		hardWorker: "alive",
	},
	neighbors: {
		themeName: "tamarind",
		hardWorker: "neighbors",
	},
	linked: {
		themeName: "birthday",
		hardWorker: "linked",
	},
	flat: {
		themeName: "frigid",
		hardWorker: "flat",
	},
	macrocell: {
		themeName: "aubergine",
		hardWorker: "macrocell",
	},
	auto: {
		themeName: "coffee",
		fastWorker: "flat",
		hardWorker: "macrocell",
	},
};

const suppressSplash = params.nosplash ?? false;

let fastWorker = null;
let hardWorker = null;
let engineName = params.engine ?? "auto";
let queuedRender = null;
let lastRender = null;

let playing = false;
let renderFastWorker = false;
let isHybridEngine = false;

const checkRenderQueue = () => {
	if (queuedRender != null) {
		paper.update(queuedRender);
		queuedRender = null;
	}
	requestAnimationFrame(checkRenderQueue);
};
checkRenderQueue();

const handleEngineMessage = (event) => {
	const worker = event.target;
	switch (event.data.type) {
		case "initializePaper":
			const data = event.data.args[0];
			paper.registerWorker(data);
			if (isHybridEngine) {
				if (worker === fastWorker) {
					hardWorker.postMessage({ type: "initTransfer", args: [data.cellGridIndices] });
				} else {
					fastWorker.postMessage({ type: "initTransfer", args: [data.cellGridIndices] });
				}
			}
			break;
		case "render":
			const render = event.data.args[0];
			if (lastRender != null) {
				if (lastRender.generation >= render.generation) {
					return;
				}
				for (const prop in lastRender) {
					delete lastRender[prop];
				}
			}
			if (worker === hardWorker && playing) {
				renderFastWorker = render.slow && isHybridEngine;
				if (renderFastWorker) {
					fastWorker.postMessage({ type: "transfer", args: [render] });
				}
			}
			lastRender = render;
			queuedRender = lastRender;
			break;
		case "debug":
			console.log(...event.data.args);
			break;
	}
};

const rebuildEngine = () => {
	if (hardWorker != null) {
		hardWorker.terminate();
		hardWorker.removeEventListener("message", handleEngineMessage);
		hardWorker = null;
	}
	if (fastWorker != null) {
		fastWorker.terminate();
		fastWorker.removeEventListener("message", handleEngineMessage);
		fastWorker = null;
	}
	const definition = engineDefinitionsByName[engineName];
	hardWorker = new Worker(`./js/engines/${definition.hardWorker}.js`);
	hardWorker.addEventListener("message", handleEngineMessage);
	hardWorker.postMessage({ type: "initialize", args: [definition.hardWorker] });
	isHybridEngine = definition.fastWorker != null;
	if (isHybridEngine) {
		fastWorker = new Worker(`./js/engines/${definition.fastWorker}.js`);
		fastWorker.addEventListener("message", handleEngineMessage);
		fastWorker.postMessage({ type: "initialize", args: [definition.fastWorker] });
	}
	const theme = themes[engineDefinitionsByName[engineName].themeName];
	paper.setTheme(theme);
	gui.setTheme(theme);
};

rebuildEngine();

const swapEngines = (name) => {
	let saveData = null;
	const listenForSaveFile = (event) => {
		if (event.data.type !== "saveData") {
			return;
		}
		saveData = event.data.args[0];
		hardWorker.removeEventListener("message", listenForSaveFile);
		engineName = name;
		rebuildEngine();
		hardWorker.postMessage({ type: "load", args: [saveData] });
		fastWorker?.postMessage({ type: "load", args: [saveData] });
		timing.setRhythm(gui.state, true);
	};
	hardWorker.addEventListener("message", listenForSaveFile);
	hardWorker.postMessage({ type: "save" });
};

timing.initialize(
	(force, time) => {
		if (playing || !isHybridEngine) {
			hardWorker.postMessage({ type: "advance", args: [force, time] });
		}
		if (!playing || renderFastWorker) {
			fastWorker?.postMessage({ type: "advance", args: [force, time] });
		}
	},
	() => {
		hardWorker.postMessage({ type: "startTurbo" });
		fastWorker?.postMessage({ type: "startTurbo" });
	},
	() => {
		hardWorker.postMessage({ type: "stopTurbo" });
		fastWorker?.postMessage({ type: "stopTurbo" });
	}
);

gui.events.addEventListener("statechanged", () => {
	if (engineName != gui.state.engineName) {
		swapEngines(gui.state.engineName);
	}
	renderFastWorker = isHybridEngine && gui.state.playing && !playing;
	playing = gui.state.playing;
	timing.setRhythm(gui.state);
});

gui.events.addEventListener("advance", () => {
	(fastWorker ?? hardWorker).postMessage({ type: "advance", args: [true, 0] });
});

gui.events.addEventListener("resetsim", () => {
	hardWorker.postMessage({ type: "reset" });
	fastWorker?.postMessage({ type: "reset" });
});

gui.events.addEventListener("load", () => load(gui.state.file ?? gui.state.url, false));

const load = async (target, splash) => {
	let filename;
	try {
		if (splash && !suppressSplash) {
			gui.showAboutPopup(true);
		}

		const popupPromise = delay(splash ? 2 : 1);
		const isFile = target instanceof File;
		filename = isFile ? target.name : target.split("/").pop();
		const key = isFile ? `__local__${target.name}_${target.lastModified}` : target;
		const data = parseFile(await (isFile ? fetchLocalText : fetchRemoteText)(target));
		paper.reset();
		playing = false;
		gui.reset(filename);
		hardWorker.postMessage({ type: "load", args: [data] });
		fastWorker?.postMessage({ type: "load", args: [data] });
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
		gui.showErrorPopup(`Load failed.`, `Couldn't load "${filename ?? "file"}".`, error.message);
	}
};

const isPortrait = (screen.orientation?.type ?? "landscape-primary").startsWith("portrait");

const defaultURL = getDefaultURL(isPortrait);

load(defaultURL, true);
