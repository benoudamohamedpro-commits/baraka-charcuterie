// Vente croisée à cocher sur la fiche produit (reprise du thème d'origine).
// Les produits cochés sont ajoutés au panier en même temps que le produit principal.

const formatMoney = (cents) => {
  const amount = (Number(cents) / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
  const currency = window.Shopify?.currency?.active || 'EUR';
  return currency === 'EUR' ? `${amount}€` : `${amount} ${currency}`;
};

const notifyUpdate = () => document.dispatchEvent(new CustomEvent('toggle-cross-sells:updated'));

class ToggleCrossSellList extends HTMLElement {
  connectedCallback() {
    this.crossSells = this.querySelectorAll('[data-ref="toggle-cross-sell"]');
  }

  getSelectedItems() {
    const items = [];
    this.crossSells.forEach((crossSell) => {
      const checkbox = crossSell.querySelector('[data-ref="toggle-cross-sell-checkbox"]');
      const button = crossSell.querySelector('[data-ref="toggle-cross-sell-button"]');
      if (checkbox?.checked) items.push({ id: checkbox.dataset.variantId, quantity: 1 });
      if (button?.classList.contains('button--active')) items.push({ id: button.dataset.variantId, quantity: 1 });
    });
    return items;
  }

  reset() {
    this.querySelectorAll('[data-ref="toggle-cross-sell-checkbox"]').forEach((checkbox) => (checkbox.checked = false));
  }
}

if (!customElements.get('toggle-cross-sell-list')) customElements.define('toggle-cross-sell-list', ToggleCrossSellList);

class ToggleCrossSell extends HTMLElement {
  connectedCallback() {
    this.checkbox = this.querySelector('[data-ref="toggle-cross-sell-checkbox"]');
    this.button = this.querySelector('[data-ref="toggle-cross-sell-button"]');
    this.select = this.querySelector('[data-ref="toggle-cross-sell-select"]');
    this.image = this.querySelector('[data-ref="toggle-cross-sell-image"]');
    this.price = this.querySelector('[data-ref="toggle-cross-sell-price"]');

    this.select?.addEventListener('change', () => this.variantChanged());
    this.button?.addEventListener('click', () => this.toggleAddButton());
    this.checkbox?.addEventListener('change', notifyUpdate);
  }

  toggleAddButton(active) {
    const on = active === true || !this.button.classList.contains('button--active');
    this.button.classList.toggle('button--active', on);
    this.button.classList.toggle('button--secondary', !on);
    notifyUpdate();
  }

  variantChanged() {
    const option = this.select.options[this.select.selectedIndex];

    this.price.querySelector('.price').innerHTML = formatMoney(option.dataset.price);
    this.dataset.price = option.dataset.price;
    if (option.dataset.compareAtPrice != null) {
      this.price.querySelector('.compare-at-price').innerHTML = formatMoney(option.dataset.compareAtPrice);
      this.dataset.compareAtPrice = option.dataset.compareAtPrice;
    }

    if (option.dataset.variantImage != null && this.image != null) this.image.querySelector('img').src = option.dataset.variantImage;

    if (this.checkbox != null) {
      this.checkbox.dataset.variantId = option.value;
      this.checkbox.checked = true;
    }
    if (this.button != null) {
      this.button.dataset.variantId = option.value;
      this.toggleAddButton(true);
    }
    notifyUpdate();
  }
}

if (!customElements.get('toggle-cross-sell')) customElements.define('toggle-cross-sell', ToggleCrossSell);

// À l'ajout au panier du produit principal : on ajoute d'abord les produits cochés,
// puis on laisse le formulaire d'Horizon ajouter le produit et mettre le panier à jour.
if (!window.svfCrossSellSubmit) {
  window.svfCrossSellSubmit = true;
  const done = new WeakSet();

  document.addEventListener(
    'submit',
    async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.closest('product-form-component')) return;
      if (done.has(form)) {
        done.delete(form);
        return;
      }

      const list = form.closest('.product-details')?.querySelector('toggle-cross-sell-list') || document.querySelector('toggle-cross-sell-list');
      const items = list?.getSelectedItems?.() || [];
      if (!items.length) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items }),
        });
        list.reset();
      } finally {
        done.add(form);
        form.requestSubmit(event.submitter || undefined);
      }
    },
    true
  );
}
