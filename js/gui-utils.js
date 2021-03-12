const wheelDeltaMagnifiers = {
	[0]: 1,
	[1]: 40,
	[2]: 40 // TODO: find an example
};

const preventTouchDefault = func => event => {
	event.preventDefault();
	func(event);
}

const listenForWheel = (target, func) => {
	target.addEventListener("wheel", event => {
		const magnifier = (wheelDeltaMagnifiers[event.deltaMode] ?? 0) / 10000;
		func({
			target,
			clientX: event.clientX,
			clientY: event.clientY,
			deltaX: event.deltaX * magnifier,
			deltaY: event.deltaY * magnifier,
			deltaZ: event.deltaZ * magnifier
		});
	});
};

const makeSlider = (
	decreaseButton,
	increaseButton,
	rangeInput,
	speed = 0.01
) => {
	const event = new Event("change");
	const slider = new EventTarget();
	const dispatch = () => slider.dispatchEvent(event);

	let value = 0;
	let animatedDelta = 0;

	const setValue = _value => {
		if (_value < 0) {
			_value = 0;
		}
		if (_value > 1) {
			_value = 1;
		}
		if (value === _value) {
			return false;
		}
		value = _value;
		rangeInput.value = _value;
		return true;
	};
	slider.setValue = setValue;

	Object.defineProperty(slider, "value", {
		get: () => value,
		set: _value => setValue(_value)
	});

	listenForWheel(rangeInput, ({ deltaY }) => {
		if (setValue(value - deltaY)) {
			dispatch();
		}
	});

	rangeInput.addEventListener("input", e => {
		if (setValue(rangeInput.valueAsNumber)) {
			dispatch();
		}
	});

	const animateSlider = () => {
		if (animatedDelta !== 0) {
			if (setValue(value + animatedDelta)) {
				dispatch();
			}
			requestAnimationFrame(animateSlider);
		}
	};

	const beginAnimatedSlider = amount => event => {
		event.preventDefault();
		animatedDelta = amount;
		animateSlider();
	};

	const endAnimatedSlider = event => {
		event.preventDefault();
		animatedDelta = 0;
	};

	decreaseButton.addEventListener("mousedown", beginAnimatedSlider(speed));
	decreaseButton.addEventListener("touchstart", beginAnimatedSlider(speed));
	increaseButton.addEventListener("mousedown", beginAnimatedSlider(-speed));
	increaseButton.addEventListener("touchstart", beginAnimatedSlider(-speed));

	document.body.addEventListener("mouseup", endAnimatedSlider);
	document.body.addEventListener("touchend", endAnimatedSlider);
	document.body.addEventListener("mouseleave", endAnimatedSlider);
	window.addEventListener("blur", endAnimatedSlider);

	return slider;
};

export { makeSlider, listenForWheel, preventTouchDefault };
