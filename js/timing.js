const minDelayMS = 10; // TODO: ought to be pinned to the RAF delay
const maxDelayMS = 1000;

let playing = false,
	speed = 1,
	delayMS = minDelayMS,
	turbo = false,
	timeoutID;

let _advance, _startTurbo, _stopTurbo;

const initialize = (advance, startTurbo, stopTurbo) => {
	_advance = advance;
	_startTurbo = startTurbo;
	_stopTurbo = stopTurbo;
};

const setRhythm = (rhythmData) => {
	const wasPlaying = playing;
	const wasTurbo = turbo;
	({ playing, speed, turbo } = rhythmData);
	recomputeDelayMS();

	if (playing && !wasPlaying) {
		if (turbo) {
			_startTurbo();
		} else {
			run();
		}
	} else if (!playing && wasPlaying) {
		if (turbo) {
			_stopTurbo();
		} else {
			stopRunning();
		}
	} else if (playing) {
		if (turbo && !wasTurbo) {
			stopRunning();
			_startTurbo();
		} else if (!turbo && wasTurbo) {
			_stopTurbo();
			run();
		}
	}
};

const stopRunning = () => {
	cancelAnimationFrame(run);
	clearTimeout(timeoutID);
	timeoutID = null;
};

const recomputeDelayMS = () => {
	const x = Math.pow(speed, 1 / 5);
	delayMS = minDelayMS * x + maxDelayMS * (1 - x);
};

const run = () => {
	_advance();
	if (playing) {
		if (speed >= 1) {
			requestAnimationFrame(run);
		} else {
			timeoutID = startTimeout(run, delayMS);
		}
	}
};

const timing = { initialize, setRhythm };

export { timing };
