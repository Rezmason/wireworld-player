const preventTouchDefault = func => event => {
  event.preventDefault();
  func(event);
};

export { preventTouchDefault };
