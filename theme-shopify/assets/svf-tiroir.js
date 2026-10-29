// Tiroir du panier repris du thème d'origine (sections/svf-cart-drawer.liquid).
// Il s'ouvre au clic sur le panier de l'en-tête et après un ajout au panier ; changer une quantité ou supprimer
// une ligne met son contenu à jour sans recharger la page (sans la gestion des cadeaux automatiques d'origine).
import { StandardEvents } from '@shopify/events';

const CART_LINK = '.header-actions__action.action__cart';

class SvfTiroir extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#onClick);
    document.addEventListener('click', this.#onDocumentClick);
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#onCartLinesUpdate);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    document.removeEventListener('click', this.#onDocumentClick);
    document.removeEventListener(StandardEvents.cartLinesUpdate, this.#onCartLinesUpdate);
  }

  get sectionId() {
    return this.dataset.sectionId;
  }

  #onClick = (event) => {
    // Clic sur le fond assombri, en dehors du tiroir.
    if (event.target === this) {
      this.close();
      return;
    }

    event.target.closest('[data-ref="checkout-button"]')?.classList.add('is-loading');
  };

  // Le panier de l'en-tête est un lien vers la page panier : il ouvre le tiroir à la place.
  #onDocumentClick = (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element) || !event.target.closest(CART_LINK)) return;

    event.preventDefault();
    this.open();
  };

  // Ajout au panier depuis une fiche ou une carte produit (événement d'Horizon).
  #onCartLinesUpdate = (event) => {
    const isAdd = event.action === 'add';
    const update = async (result) => {
      if (result?.detail?.didError) return;
      await this.refresh();
      if (isAdd) this.open();
    };

    if (event.promise) {
      event.promise.then(update).catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[svf-tiroir]', error);
      });
    } else {
      update();
    }
  };

  open() {
    this.classList.remove('is-closing');
    this.classList.add('is-open');
    document.body.classList.add('svf-overflow-hidden');
  }

  close() {
    this.classList.add('is-closing');

    // Le temps de l'animation de fermeture.
    setTimeout(() => {
      this.classList.remove('is-open', 'is-closing');
      document.body.classList.remove('svf-overflow-hidden');
    }, 125);
  }

  isOpen() {
    return this.classList.contains('is-open');
  }

  async refresh() {
    // Sans en-tête « Accept: application/json » : sur une fiche produit, Shopify renverrait le produit au lieu des sections.
    const url = `${window.location.pathname}?sections=${encodeURIComponent(this.sectionId)}`;
    const response = await fetch(url);
    const sections = await response.json();

    this.render(sections?.[this.sectionId]);
  }

  render(html) {
    if (!html) return;

    const next = new DOMParser().parseFromString(html, 'text/html').querySelector('svf-tiroir');
    const nextInner = next?.querySelector('.svf-tiroir__inner');
    const inner = this.querySelector('.svf-tiroir__inner');
    if (!next || !nextInner || !inner) return;

    inner.innerHTML = nextInner.innerHTML;

    const itemCount = Number(next.dataset.itemCount) || 0;
    this.dataset.itemCount = String(itemCount);
    this.classList.toggle('svf-tiroir--empty', itemCount === 0);

    // Pastille du panier de l'en-tête.
    document.querySelector('cart-icon')?.renderCartBubble?.(itemCount);
  }
}

if (!customElements.get('svf-tiroir')) {
  customElements.define('svf-tiroir', SvfTiroir);
}

class SvfTiroirItem extends HTMLElement {
  connectedCallback() {
    this.removeItemButton = this.querySelector('[data-ref="remove-item"]');
    this.quantitySelectorInput = this.querySelector('[data-ref="quantity-selector-input"]');

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
    const drawer = this.closest('svf-tiroir');
    if (!drawer) return;

    this.classList.add('svf-tiroir__item--loading');

    fetch(Theme.routes.cart_change_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line, quantity, sections: drawer.sectionId, sections_url: window.location.pathname }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.errors || data.status) {
          const message = data.description || data.message || String(data.errors);
          document.dispatchEvent(new CustomEvent('toast:open', { detail: { type: 'error', message } }));
          return drawer.refresh();
        }

        const html = data.sections?.[drawer.sectionId];
        return html ? drawer.render(html) : drawer.refresh();
      })
      .catch((error) => console.error(error))
      .finally(() => this.classList.remove('svf-tiroir__item--loading'));
  }
}

if (!customElements.get('svf-tiroir-item')) {
  customElements.define('svf-tiroir-item', SvfTiroirItem);
}
