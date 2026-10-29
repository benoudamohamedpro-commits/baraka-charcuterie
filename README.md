# Charcuterie Baraka

Site vitrine de Baraka – Charcuterie fine halal, publié sur https://baraka-charcuterie.be (GitHub Pages).

- `docs/` : le site en ligne (copie statique de la boutique Shopify cd70bx-gg.myshopify.com).
- `theme-shopify/` : copie du thème Shopify « Horizon - Structure Noir Blanc Rouge ».
- `outils/` : scripts pour refaire la copie.

## Mettre le site à jour après un changement sur Shopify

```bash
cd outils
npm install
node copier-site.mjs
node verifier.mjs
```

Puis envoyer les changements sur GitHub (`git add -A`, `git commit`, `git push`).

## Différences avec la boutique Shopify

- Pas de panier, de compte client ni de recherche (le site est statique).
- Le formulaire de contact ouvre WhatsApp (+32 495 315 500) avec le message prérempli.
- Le formulaire newsletter du pied de page est retiré.
