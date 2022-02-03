import { getDefaultURL } from "./data.js";
import { params, delay, fetchLocalText, fetchRemoteText } from "./utils.js";
import { gui } from "./gui.js";
import { paper } from "./paper.js";
import { parseFile } from "./parse.js";
import { timing } from "./timing.js";

const defaultEngineName = "auto";

const engineDefinitionsByName = {
	naive: {
		themeName: "regal",
		shallowWorker: "naive",
	},
	alive: {
		themeName: "gourd",
		shallowWorker: "alive",
	},
	neighbors: {
		themeName: "tamarind",
		shallowWorker: "neighbors",
	},
	linked: {
		themeName: "birthday",
		shallowWorker: "linked",
	},
	flat: {
		themeName: "frigid",
		shallowWorker: "flat",
	},
	macrocell: {
		themeName: "aubergine",
		shallowWorker: "macrocell",
	},
	auto: {
		themeName: "coffee",
		shallowWorker: "flat",
		deepWorker: "macrocell",
	},
};

const suppressSplash = params.nosplash ?? false;

let shallowWorker = null;
let deepWorker = null;
let engineName = params.engine ?? "auto";
let queuedRender = null;
let lastRender = null;

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
			if (worker === shallowWorker) {
				paper.initialize(engineDefinitionsByName[engineName].themeName, data);
				deepWorker.postMessage({ type: "initTransfer", args: [data.cellGridIndices] });
			} else {
				shallowWorker.postMessage({ type: "initTransfer", args: [data.cellGridIndices] });
			}
			break;
		case "render":
			const render = event.data.args[0];
			if (worker === shallowWorker) {
				if (lastRender != null) {
					for (const prop in lastRender) {
						delete lastRender[prop];
					}
				}
				lastRender = render;
				queuedRender = lastRender;
			} else {
				if (lastRender == null || lastRender.generation < render.generation) {
					shallowWorker.postMessage({ type: "transfer", args: [render] });
				}
			}
			break;
		case "debug":
			console.log(...event.data.args);
			break;
	}
};

const rebuildEngine = () => {
	if (shallowWorker != null) {
		shallowWorker.terminate();
		shallowWorker.removeEventListener("message", handleEngineMessage);
		shallowWorker = null;
	}
	if (deepWorker != null) {
		deepWorker.terminate();
		deepWorker.removeEventListener("message", handleEngineMessage);
		deepWorker = null;
	}
	const definition = engineDefinitionsByName[engineName] ?? engineDefinitionsByName[defaultEngineName];
	shallowWorker = new Worker(`./js/engines/${definition.shallowWorker}.js`);
	shallowWorker.addEventListener("message", handleEngineMessage);
	if (definition.deepWorker != null) {
		deepWorker = new Worker(`./js/engines/${definition.deepWorker}.js`);
		deepWorker.addEventListener("message", handleEngineMessage);
	}
};

rebuildEngine();

const swapEngines = (name) => {
	let saveData = null;
	const listenForSaveFile = (event) => {
		if (event.data.type !== "saveData") {
			return;
		}
		saveData = event.data.args[0];
		shallowWorker.removeEventListener("message", listenForSaveFile);
		engineName = name;
		rebuildEngine();
		shallowWorker.postMessage({ type: "initialize", args: [saveData] });
		timing.setRhythm(gui.state, true);
	};
	shallowWorker.addEventListener("message", listenForSaveFile);
	shallowWorker.postMessage({ type: "save" });
};

timing.initialize(
	(force, time) => shallowWorker.postMessage({ type: "advance", args: [force, time] }),
	() => shallowWorker.postMessage({ type: "startTurbo" }),
	() => shallowWorker.postMessage({ type: "stopTurbo" })
);

gui.events.addEventListener("statechanged", () => {
	if (engineName != gui.state.engineName) {
		swapEngines(gui.state.engineName);
	}
	timing.setRhythm(gui.state);
});

gui.events.addEventListener("advance", () => shallowWorker.postMessage({ type: "advance", args: [true, 0] }));

gui.events.addEventListener("resetsim", () => shallowWorker.postMessage({ type: "reset" }));

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

		gui.reset(filename);
		shallowWorker.postMessage({ type: "initialize", args: [data] });
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
