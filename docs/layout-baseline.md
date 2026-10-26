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
- Keep the image on the left and specifications on the right, aligned at the top and bottom. Specifications show four stacked rows, with additional rows available by scrolling. Purchase boxes span the full card width below that row. Battery cards show Base Price and Package Price boxes (combined MSRP/current price, battery row, charger row) with a shared inventory popup and compact Run Times action. Battery and charger names are single-choice toggle rows (click again to remove); quantity options use × 2. The lowest-priced complete promotional kit is selected by default when available; otherwise the lowest-priced complete listed kit is prefilled and the customer selects the purchase box. Prices use the exact kit SKU when contents match, otherwise the individual components. Add to Cart preserves distinct configurations; Cart → Build & Buy opens the combined quote. Compact tractors retain their workbook-backed factory and tire selectors.
- The purchase area follows the image/specification row. Base Price appears above the factory equipment and tire rows, with Package Price below. Warranty text appears directly below the image/specification row when supplied; a valid HTTP(S) WarrantyURL makes it a manufacturer statement link.
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

## Price-tag actions (October 26, 2026)

- Bare-tool heading, SKU and image stay fixed while battery/charger packages change. The image opens ProductURL, falling back to the internal product page.
- One action row below purchase boxes contains Inventory, Compare, Run Times when applicable, and cart icon + Add. Inventory lists tool, listed kits and compatible component options together.
- View Promos and Out-the-Door Price sit side by side below any financing offer. Both open the same builder with identical selections/payment options; View Promos opens the top, Out-the-Door Price jumps to the itemized quote. No separate View Details or Build & Buy card button.
- Component options wrap when necessary; do not hide choices in a horizontal scroller.

## Package price simplification (October 26, 2026)

- Use Base Price and Package Price without MSRP labels or a separate package-savings line. Compare the sum of bare-tool and selected-component MSRP with the current matching kit price (including active advertised promotions), or current separate-component total when no kit matches. Show one amount when equal; only cross out a higher, fully known combined MSRP.
- Center option rows with equal left/right insets and a subtle selected box border. Keep choices visible by wrapping.
- Default to the lowest-priced complete package with an active promotion when available; otherwise prefill the lowest-priced complete package. A promotional default is selected immediately so its image banner, pricing and purchase actions agree.
