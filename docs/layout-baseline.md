# Marketplace and generated-page layouts

John requested that approved layouts be preserved across later changes (October 25, 2026).

## Marketplace, Shop by Product, Shop by Brand

- Keep the search box, Clear button, and main navigation. On shopping pages, Dealer Portal sits immediately to the right of Clear; pages without that search box retain the standalone dealer entry.
- Keep compact spacing above and below main navigation in both normal and brand modes. Do not add a divider or extra top padding between navigation and Models / Series.
- Keep the filter pills and results/comparison bar compact (12px desktop control text). Preserve their actions while reducing padding.
- Keep the model/series, promotion, package, power, and workbook specification buttons.
- Keep the left filter panel on desktop: Brand, Availability, Online Purchase, and applicable workbook F fields.
- On mobile, use the Filters button to open that panel as a drawer, including the compact button controls.
- Keep the results count, Compare Selected, and Compare All in View. Comparison uses the currently filtered products.
- Keep the current equipment cards and responsive grid.
- Do not replace these controls with the generated-page dropdown toolbar.

## Generated builder pages

- Keep applicable dropdown filters and comparison controls together in the compact results toolbar.
- Do not add the marketplace sidebar or its full browse controls here.
- Keep server-rendered brand navigation and stable page URLs.
- Keep card layout, inventory controls, and financing presentation unchanged by navigation/filter work.

## Shared files and validation

`universal/catalog-cards.css` styles both kinds of page. Marketplace rules must stay scoped to `#market-app`; generated-page toolbar rules use `.wep-catalog-toolbar`.

`universal/brand-navigation.css` owns navigation spacing, including the normal menu in `#we-shared-nav`.

`universal/marketplace.js` and the inline copies in the shop pages must retain these respective layouts. When changing shared filtering behavior, check Marketplace, Shop by Product, and Shop by Brand explicitly.

Before publishing layout changes, check the Yanmar Compact Tractors results on all three routes at desktop and phone widths: sidebar location, series and specification filters, visible product count, comparison, mobile drawer, navigation spacing, and no horizontal page overflow. Also check a generated mower page to confirm its compact toolbar remains intact.

Change a baseline only when John requests or approves that layout change.
