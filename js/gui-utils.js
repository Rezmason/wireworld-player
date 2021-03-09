const wheelDeltaMagnifiers = {
  [0]: 1,
  [1]: 40,
  [2]: 40 // TODO: find an example
};

const preventTouchDefault = func => event => {
  event.preventDefault();
  func(event);
};

const makeSlider = (upButton, downButton, rangeInput, speed) => {
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

  const onWheel = ({ target, deltaY, deltaMode }) => {
    const amount = deltaY * -0.0001 * (wheelDeltaMagnifiers[deltaMode] ?? 0);
    if (setValue(value + amount)) {
      dispatch();
    }
  };

  rangeInput.addEventListener("wheel", onWheel);

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

  const beginAnimatedSlider = amount => () => {
    animatedDelta = amount;
    animateSlider();
  };

  const endAnimatedSlider = () => (animatedDelta = 0);

  upButton.addEventListener("mousedown", beginAnimatedSlider(speed));
  upButton.addEventListener(
    "touchstart",
    preventTouchDefault(beginAnimatedSlider(speed))
  );
  downButton.addEventListener("mousedown", beginAnimatedSlider(-speed));
  downButton.addEventListener(
    "touchstart",
    preventTouchDefault(beginAnimatedSlider(-speed))
  );

  document.body.addEventListener("mouseup", endAnimatedSlider);
  document.body.addEventListener("touchend", endAnimatedSlider);
  document.body.addEventListener("mouseleave", endAnimatedSlider);
  window.addEventListener("blur", endAnimatedSlider);

  return slider;
};

export { makeSlider, wheelDeltaMagnifiers, preventTouchDefault };
