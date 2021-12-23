import { getDefaultURL } from "./data.js";
import { params, delay, fetchLocalText, fetchRemoteText } from "./utils.js";
import { gui } from "./gui.js";
import { paper } from "./paper.js";
import { parseFile } from "./parse.js";
import { timing } from "./timing.js";

const engineDefinitionsByName = {
	["default"]: {
		filename: "auto",
	},
	naive: {
		filename: "naive",
	},
	alive: {
		filename: "alive",
	},
	neighbors: {
		filename: "neighbors",
	},
	linked: {
		filename: "linked",
	},
	flat: {
		filename: "flat",
	},
	macrocell: {
		filename: "macrocell",
	},
	auto: {
		filename: "auto",
		children: ["flat", "macrocell"],
	},
};

const suppressSplash = params.nosplash ?? false;

let messageChannel;
let engine;
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
	switch (event.data.type) {
		case "initializePaper":
			paper.initialize(event.data.args[0]);
			break;
		case "render":
			if (lastRender != null) {
				for (const prop in lastRender) {
					delete lastRender[prop];
				}
			}
			lastRender = event.data.args[0];
			queuedRender = lastRender;
			break;
		case "debug":
			console.log(...event.data.args);
			break;
	}
};

const rebuildEngine = () => {
	if (engine != null) {
		engine.terminate();
		messageChannel.port1.removeEventListener("message", handleEngineMessage);
		messageChannel.port1.close();
	}
	const definition = engineDefinitionsByName[engineName] ?? engineDefinitionsByName["default"];
	engine = new Worker(`./js/engines/${definition.filename}.js`);

	messageChannel = new MessageChannel();
	engine.postMessage({ type: "channel", port: messageChannel.port2 }, [messageChannel.port2]);

	messageChannel.port1.addEventListener("message", handleEngineMessage);
	messageChannel.port1.start();
};

rebuildEngine();

const swapEngines = (name) => {
	let saveData = null;
	const listenForSaveFile = (event) => {
		if (event.data.type !== "saveData") {
			return;
		}
		saveData = event.data.args[0];
		engine.removeEventListener("message", listenForSaveFile);
		engineName = name;
		rebuildEngine();
		messageChannel.port1.postMessage({ type: "initialize", args: [saveData] });
		timing.setRhythm(gui.state, true);
	};
	engine.addEventListener("message", listenForSaveFile);
	messageChannel.port1.postMessage({ type: "save" });
};

timing.initialize(
	(force, time) => messageChannel.port1.postMessage({ type: "advance", args: [force, time] }),
	() => messageChannel.port1.postMessage({ type: "startTurbo" }),
	() => messageChannel.port1.postMessage({ type: "stopTurbo" })
);

gui.events.addEventListener("statechanged", () => {
	if (engineName != gui.state.engineName) {
		swapEngines(gui.state.engineName);
	}
	timing.setRhythm(gui.state);
});

gui.events.addEventListener("advance", () => {
	messageChannel.port1.postMessage({ type: "advance", args: [true, 0] });
});

gui.events.addEventListener("resetsim", () => {
	messageChannel.port1.postMessage({ type: "reset" });
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
		const isFile = target instanceof File;
		filename = isFile ? target.name : target.split("/").pop();
		const key = isFile ? `__local__${target.name}_${target.lastModified}` : target;
		const data = parseFile(await (isFile ? fetchLocalText : fetchRemoteText)(target));

		gui.reset(filename);
		messageChannel.port1.postMessage({ type: "initialize", args: [data] });
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
