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
- Keep the image on the left and specifications on the right, aligned at the top and bottom. Specifications show four stacked rows, with additional rows available by scrolling. Purchase boxes span the full card width below that row. Battery cards show Base Price and Package Price boxes (combined MSRP/current price, battery row, charger row) with a shared inventory popup and compact Run Times action. Battery and charger names are single-choice toggle rows (click again to remove); quantity options use × 2. The lowest-priced complete promotional kit is selected by default when available; otherwise the lowest-priced complete listed kit is selected; tools without a kit select the recommended battery and charger. Prices use the exact kit SKU when contents match, otherwise the individual components. Add to Cart preserves distinct configurations; Cart → Build & Buy opens the combined quote. Compact tractors retain their workbook-backed factory and tire selectors.
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
- View All Promotions and Out-the-Door Price sit side by side below any financing offer. Both open the same builder with identical selections/payment options; View All Promotions opens the top, Out-the-Door Price jumps to the itemized quote. No separate View Details or Build & Buy card button.
- Component options wrap when necessary; do not hide choices in a horizontal scroller.

## Package price simplification (October 26, 2026)

- Use Base Price and Package Price without MSRP labels or a separate package-savings line. Compare the sum of bare-tool and selected-component MSRP with the current matching kit price (including active advertised promotions), or current separate-component total when no kit matches. Show one amount when equal; only cross out a higher, fully known combined MSRP.
- Center option rows with equal left/right insets and a subtle selected box border. Keep choices visible by wrapping.
- Default to the lowest-priced complete package with an active promotion when available; otherwise select the lowest-priced complete package or recommended battery/charger combination. A promotional default is selected immediately so its image banner, pricing and purchase actions agree.

## Battery series and kit itemization (October 26, 2026)

- Center bold series headings beside equally sized option text: AP / AR Series, PRO AP Series, 82BD Series, CORE Series and Chargers. One battery selection spans all battery rows. Empty rows are hidden; wrapping keeps all options visible.
- Button labels omit shared series prefixes only in the named row. A short Includes line describes multi-battery/charger quantities or required connection items.
- Package component quantities are locked to the package SKU. Itemized builder, cart and quote displays retain full names/SKUs. The package total stays authoritative and component splits never introduce additional charges. See battery-series-and-kit-lines.md for allocation and workbook fields.

## Centered price and option rows (October 26, 2026)

- Center Base Unit Price: and Package Price: beside their amounts with matching label/amount font sizes; retain room for a crossed-out regular price when discounted.
- Center bold battery/charger row headings, use the same 12px size for option names, and let buttons expand when fewer options are present.
- Keep equal responsive outside insets (up to 48px, approximately half an inch) and wrap larger option groups without hiding choices.

## Base-price emphasis and action colors (October 26, 2026)

- Enlarge the centered Base Unit Price label and amount together, targeting roughly two-thirds or more of the box width at typical card sizes. Scale text with its box width and allow sale comparisons to wrap.
- Use dark grey backgrounds with white text for View All Promotions and Out-the-Door Price; match the Save banner red gradient with white text for the cart Add action. Selected battery and charger buttons use light grey with a darker grey selected border. Keep the shared scope on shopping cards.

- Keep Base Unit Price vertical padding compact: 2px at each box edge and no additional button padding, retaining the enlarged centered text.

## Manufacturer base-price labels (October 26, 2026)

- Label base prices with the manufacturer name, such as STIHL Base Price: and YANMAR Base Price:, without MSRP terminology.
- Give the base price a solid manufacturer color: STIHL orange with dark text; Yanmar/Toro/Honda/RedMax red with white text; Greenworks green with dark text. Use a neutral pale background for unconfigured brands. The price uses the same contrasting text color as its label.
- Keep the same neutral unselected border and green selected border as the package box. Background color never indicates selection. Preserve compact padding and centered large text on tool/package cards.

- Use 2px borders on both tool and package boxes, retaining the green selected treatment. Package Price label and amounts use 16px text, below the responsive 20px–36px manufacturer Base Price.

## Equipment defaults (October 26, 2026)

- Battery equipment starts with a complete kit selected (active promotional kit preferred), or the recommended battery and charger when no kit exists. Customers can remove/change components; preserve their choices after initialization.
- Compact tractors start with a loader-only configuration, preferring R-4 tires where available. Explicit catalog filters still constrain defaults. Other equipment starts with the base unit; bags, mulch kits and other accessories are customer choices.
- Keep the bare/base price visible while the package or attachments change. Use a 55%/45% split for image/specs so the image gains about 24px on a typical desktop card, retaining aligned top/bottom edges.
