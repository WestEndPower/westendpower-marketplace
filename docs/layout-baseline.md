# Marketplace and generated-page layouts

John requested that approved layouts be preserved across later changes (October 25, 2026).

## Marketplace, Shop by Product, Shop by Brand

- Keep the search box, Clear button, and main navigation. On shopping pages, Dealer Portal sits at the far right of the shopping header; pages without that search box retain the standalone dealer entry.
- Keep compact spacing above and below main navigation in both normal and brand modes. Do not add a divider or extra top padding between navigation and Models / Series.
- Keep the filter pills and results/comparison bar compact (12px desktop control text). Preserve their actions while reducing padding.
- Keep the model/series, promotion, package, power, and workbook specification buttons.
- Keep the left filter panel on desktop: Brand, Availability, Online Purchase, and applicable workbook F fields.
- On mobile, use the Filters button to open that panel as a drawer, including the compact button controls.
- Keep the results count, Compare Selected, and Compare All in View. Comparison uses the currently filtered products.
- Keep the responsive equipment-card grid. The three shopping routes use `universal/marketplace-card.js` for card markup.
- Keep card headings on one line inside the header; fit long descriptions to the available width.
- Keep the image on the left and specifications on the right, aligned at the top and bottom. Specifications show four stacked rows, with additional rows available by scrolling. Purchase boxes span the full card width below that row. Battery cards show Unit and Package Price boxes (price, savings, battery row, charger row, inventory) with inventory checks and Run & Charge Times. Battery and charger names are single-choice toggle rows (click again to remove); quantity options use × 2. The lowest-priced complete listed kit is prefilled, while the customer explicitly selects the purchase box. Prices use the exact kit SKU when contents match, otherwise the individual components. Add to Cart preserves distinct configurations; Cart → Build & Buy opens the combined quote. Compact tractors retain their workbook-backed factory and tire selectors.
- The purchase area follows the image/specification row. Tractor Only MSRP appears above the factory equipment and tire rows, with selected-package MSRP below. Warranty text appears at the bottom of the card when supplied; a valid HTTP(S) WarrantyURL makes it a manufacturer statement link.
- Image banners contain only rebate/save amounts and `Expires Oct. 31, 2026` style dates; financing remains in its payment area.
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

## Package and warranty data

- Keep factory tractor P flags unchanged. Battery/charger kit contents come from public Packages rows: ParentSKU, BatterySKU1 / BatteryQty1, ChargerSKU1 / ChargerQty1, and additional numbered slots. ParentSKU resolves to the product row that owns kit MSRP and sale pricing.
- Battery and charger names, compatibility and recommendations come from their existing public tables and compatibility-runtime. Component buttons never display raw SKUs. Kit-only products without a published bare-tool SKU retain their fixed kit purchase option.
- WarrantyResidentialUse and WarrantyCommercialUse supply the compact warranty line. WarrantyURL (also WarrantyStatementURL / ManufacturerWarrantyURL) supplies the optional manufacturer statement link. No warranty text means no empty placeholder.
