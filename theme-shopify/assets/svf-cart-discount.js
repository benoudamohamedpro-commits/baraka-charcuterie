// Code de réduction du panier, repris du thème d'origine : ajoute ou retire un code, puis met le panier à jour.

class CartDiscount extends HTMLElement {
  connectedCallback() {
    this.applyButton = this.querySelector('[data-ref="apply-discount"]');
    this.inputDiscount = this.querySelector('[data-ref="discount-input"]');

    this.applyButton?.addEventListener('click', (event) => this.submitDiscount(event));
    for (const button of this.querySelectorAll('[data-ref="remove-discount"]')) {
      button.addEventListener('click', (event) => this.removeDiscount(event));
    }
  }

  submitDiscount(event) {
    event.preventDefault();
    event.stopPropagation();

    this.setButtonLoading();

    const discountCode = this.inputDiscount.value.trim();
    if (discountCode === '') {
      this.setErrorMode(this.dataset.pleaseInsertACode);
    } else {
      this.applyCode(discountCode);
    }
  }

  async removeDiscount(event) {
    event.preventDefault();
    event.stopPropagation();

    const badge = event.target.closest('[data-ref="discount-badge"]');
    const discountCode = badge?.dataset.discountCode;
    if (!discountCode) return;

    const remaining = this.#existingDiscounts().filter((code) => code !== discountCode);

    try {
      await this.#updateDiscounts(remaining);
      this.#refresh();
    } catch (error) {
      console.error(error);
      this.#toast(this.dataset.errorRemoveDiscount);
    }
  }

  async applyCode(discountCode) {
    try {
      const existingDiscounts = this.#existingDiscounts();

      if (existingDiscounts.includes(discountCode)) {
        this.setErrorMode(this.dataset.codeAlreadyApplied);
        return;
      }

      const data = await this.#updateDiscounts([...existingDiscounts, discountCode]);
      const failed = data.discount_codes?.find((discount) => discount.code === discountCode && discount.applicable === false);

      if (failed) {
        this.setErrorMode(this.dataset.codeNotApplicable);
        return;
      }

      this.#refresh();
    } catch (error) {
      console.error(error);
      this.setErrorMode(this.dataset.errorApplyDiscount);
    }
  }

  async #updateDiscounts(codes) {
    const response = await fetch(Theme.routes.cart_update_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ discount: codes.join(',') }),
    });

    return response.json();
  }

  // Dans le tiroir du panier, seul le tiroir est mis à jour ; sur la page panier, la page est rechargée.
  #refresh() {
    const drawer = this.closest('svf-tiroir');
    if (drawer) return drawer.refresh();

    window.location.reload();
  }

  #existingDiscounts() {
    return [...this.querySelectorAll('[data-ref="discount-badge"]')].map((badge) => badge.dataset.discountCode).filter(Boolean);
  }

  #toast(message) {
    document.dispatchEvent(new CustomEvent('toast:open', { detail: { type: 'error', message } }));
  }

  setErrorMode(message) {
    this.setButtonLoaded();
    this.#toast(message);

    const field = this.inputDiscount.closest('.textfield');
    field?.classList.add('textfield--error');
    this.inputDiscount.value = '';

    setTimeout(() => field?.classList.remove('textfield--error'), 2000);
  }

  setButtonLoading() {
    this.applyButton.disabled = true;
    this.applyButton.classList.add('is-loading');
  }

  setButtonLoaded() {
    this.applyButton.disabled = false;
    this.applyButton.classList.remove('is-loading');
  }
}

if (!customElements.get('cart-discount')) {
  customElements.define('cart-discount', CartDiscount);
}
