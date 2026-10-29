// Page panier reprise du thème d'origine : changer une quantité ou supprimer une ligne met le panier à jour
// puis recharge la page (même fonctionnement que le thème d'origine, sans sa gestion des cadeaux automatiques).

class CartComponent extends HTMLElement {
  connectedCallback() {
    this.checkoutButton = this.querySelector('[data-ref="checkout-button"]');
    this.checkoutButton?.addEventListener('click', (event) => event.currentTarget.classList.add('is-loading'));
  }
}

if (!customElements.get('cart-component')) {
  customElements.define('cart-component', CartComponent);
}

class CartItem extends HTMLElement {
  connectedCallback() {
    this.removeItemButton = this.querySelector('[data-ref="remove-item"]');
    this.quantitySelectorInput = this.querySelector('[data-ref="quantity-selector-input"]');
    this.cartForm = this.closest('[data-ref="cart-form"]');

    this.removeItemButton?.addEventListener('click', (event) => {
      event.preventDefault();
      this.#updateLineItemQuantity(this.dataset.index, 0);
    });

    this.quantitySelectorInput?.addEventListener('change', (event) => {
      event.preventDefault();
      this.#updateLineItemQuantity(this.dataset.index, this.quantitySelectorInput.value);
    });
  }

  #updateLineItemQuantity(line, quantity) {
    this.cartForm?.classList.add('cart__form--loading');

    fetch(Theme.routes.cart_change_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line, quantity }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.errors) {
          const message = Array.isArray(data.errors) ? data.errors.join(', ') : String(data.errors);
          document.dispatchEvent(new CustomEvent('toast:open', { detail: { type: 'error', message } }));
        }
      })
      .catch((error) => console.error(error))
      .finally(() => window.location.reload());
  }
}

if (!customElements.get('cart-item')) {
  customElements.define('cart-item', CartItem);
}
