const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

for (const details of document.querySelectorAll('.questions details')) {
  const summary = details.querySelector('summary');
  let animation = null;
  let expanded = details.open;

  const finish = () => {
    details.open = expanded;
    animation?.cancel();
    animation = null;
    details.style.overflow = '';
    details.removeAttribute('data-closing');
  };

  summary.addEventListener('click', event => {
    if (typeof details.animate !== 'function') return;
    event.preventDefault();

    const startHeight = details.getBoundingClientRect().height;
    expanded = !(animation ? expanded : details.open);
    animation?.cancel();
    animation = null;

    if (reducedMotion.matches) {
      finish();
      return;
    }

    details.open = expanded;
    const endHeight = details.getBoundingClientRect().height;
    // Keep the answer rendered until the closing animation finishes.
    details.open = true;
    details.toggleAttribute('data-closing', !expanded);
    details.style.overflow = 'hidden';
    animation = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 260, easing: 'ease', fill: 'both' },
    );
    animation.onfinish = finish;
  });

  window.addEventListener('resize', () => {
    if (animation) finish();
  });
  reducedMotion.addEventListener('change', () => {
    if (animation && reducedMotion.matches) finish();
  });
}
