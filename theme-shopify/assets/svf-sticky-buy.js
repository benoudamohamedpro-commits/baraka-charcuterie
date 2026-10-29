// Fiche produit : la ligne d'achat (quantité + bouton « Ajouter au panier ») reste collée en bas de l'écran
// quand elle n'est plus visible et que le pied de page n'est pas à l'écran, comme dans le thème d'origine.
const block = document.querySelector('.product-details .buy-buttons-block');
const row = block?.querySelector('.product-form-buttons');

if (block && row) {
  const footers = [...document.querySelectorAll('.shopify-section-group-footer-group')];
  const footersInView = new Set();
  let formInView = true;
  let closingTimeout;

  const update = () => {
    const shouldBeActive = !formInView && footersInView.size === 0;
    const isActive = block.dataset.svfSticky === 'true';
    if (shouldBeActive === isActive) return;

    clearTimeout(closingTimeout);

    if (shouldBeActive) {
      delete block.dataset.svfClosing;
      block.dataset.svfSticky = 'true';
      return;
    }

    block.dataset.svfSticky = 'false';
    block.dataset.svfClosing = 'true';
    closingTimeout = setTimeout(() => delete block.dataset.svfClosing, 300);
  };

  requestAnimationFrame(() => {
    // La place de la ligne reste réservée dans la page : sans cela la page raccourcit quand la ligne se détache.
    block.style.minHeight = `${block.offsetHeight}px`;

    new IntersectionObserver(([entry]) => {
      formInView = entry.isIntersecting;
      update();
    }).observe(block);

    for (const footer of footers) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) footersInView.add(footer);
        else footersInView.delete(footer);
        update();
      }).observe(footer);
    }
  });
}
