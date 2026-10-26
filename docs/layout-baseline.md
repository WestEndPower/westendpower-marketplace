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
- WarrantyResidentialUse and WarrantyCommercialUse supply the compact warranty line. WarrantyURL (also WarrantyStatementURL / ManufacturerWarrantyURL) supplies the optional manufacturer statement link. Missing warranty text retains an empty reserved warranty slot.

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
- Compact tractors start with loader only and R-4 tires where available. Explicit catalog filters still constrain defaults. Other equipment starts with the base unit; bags, mulch kits and other accessories are customer choices.
- Keep the bare/base price visible while the package or attachments change. Use a 55%/45% split for image/specs so the image gains about 24px on a typical desktop card, retaining aligned top/bottom edges.

## Compact tractor box parity (October 26, 2026)

- Compact tractor description and product image keep the bare-tractor identity (SA325BI for this family), while the SKU follows selected factory options and tires. Loader-only plus R-4 is the initial purchase selection where offered.
- Show separate Base Price and Package Price boxes using the approved battery card spacing, font sizes, manufacturer base background and selection borders. Package Price is above Factory Installed and Tires rows; the rows use bold left labels, equal insets, expanding buttons and grey selected choices. Preserve the tire guide and stock-unit locks.
- Clicking the tractor base box removes factory attachments by selecting the exact bare SKU. Option/tire changes and cart/builder links continue using exact selected catalog SKUs. Battery equipment markup, rules and module remain unchanged.

## Tractor correction details (October 26, 2026)

- SA325 starts with Loader and R-4 selected. Its description stays Yanmar SA325BI Compact Tractor; its SKU starts at SA325BI-L. The rebate, inventory and builder/cart links follow the selected configuration.
- Center the manufacturer Base Price text vertically. Use Factory Installed as the row heading. Tractor Inventory lists only the exact selected configuration, preserving store-level availability and locked stock selections. Battery inventory behavior remains unchanged.
- Use matching 18px tractor APR/term and monthly-payment text. Show (In lieu of customer rebate) after the expiration date only when the selected program's rebateCompatible flag is false.

- Place an underlined blue Guide disclosure immediately beside the Tires label, preserving the tire information popup.

## Tractor MSRP labeling (October 26, 2026)

- Keep the bare-tractor Base Price visible. Label the configured tractor reference amount Package MSRP: and show manufacturer MSRP before rebates or purchase discounts. Actual purchase/payment pricing remains in Out-the-Door Price and promotions.
- Preserve the fixed description as customers change options or tires; update the header SKU to the exact selected catalog configuration. Battery cards retain Package Price: and their approved behavior and layout.

- Do not show attachment-change messages such as Loader removed. Selection highlights, SKU and prices communicate configuration changes.

## RZ142 attachment package trial (October 26, 2026)

- STIHL RZ142 uses separate manufacturer Base Price and Package MSRP boxes, Attach and Access row labels, and a base-only default. Keep both option areas empty for now, even when compatible workbook rows exist. Options will be restored after the workbook labels are ready. Other equipment, battery and tractor layouts are unchanged.
- Match compatibility by explicit SKU/model before group flags, respecting explicit exclusions. Use current workbook MSRP for package reference totals; selling prices, required parts and quantity-linked cart rows continue to the builder and quote. No invented kit SKU is assigned.
- Requirements match their RequiredModel/SKU mapping, so the RZ142 bagger includes its mower boot kit once, rather than the other mower's blower. Required rows are included in totals and full cart/builder details. Catalog SortOrder and added/removed compatible rows drive the choices.
- The current exports classify mulch kit, LED lights, bagger and armrests as attachments, with no RZ142 accessories. Keep the workbook classification. Stock-unit selections retain their existing fixed-unit card flow.
- Use the existing RZ142.jpg photo for the known RZ14.jpg export typo. Module changes are scoped to this model; no manufacturer workbook bytes are modified.

## MS 362 C-M bar selection trial (October 26, 2026)

- Keep the approved purchase-box format and two option rows. For this model, replace Attach/Access with Std. Bar and Light Bar. Show only published active sizes, once per size in each row; leave absent choices empty. No safety/arborist chain selector yet.
- For duplicate sizes within a bar type, use the first active exact SKU by workbook SortOrder. Never merge SKU prices. Selected size updates the exact SKU, description, price, inventory, promotions, financing and builder/cart links. Fixed stock selections retain their existing flow.
- Preserve the battery and Yanmar compact modules, grid and card sizing. Missing data must retain its allotted space; no global rollout is included in this trial.

- Bar-size buttons stay only slightly wider than their labels (8px horizontal padding). Center each whole label/options line within the package box; additional choices stay compact and centered, wrapping centrally only when needed.

## Four rules across the shopping catalog (October 26, 2026)

- Apply the shared tags to all brands on Marketplace, Shop by Product, Shop by Brand and their filtered URLs. Battery power takes precedence, including battery chainsaws; preserve battery/package selections. If compatibility is not published, retain empty Batteries/Chargers slots without inventing components.
- Only Yanmar Compact Tractors use the existing factory-installed/tire layout. Other non-battery chainsaws use centered Std. Bar / Light Bar sizes, once per row, selecting the first active workbook SKU per size/type. All remaining equipment uses Base Price / Package MSRP and empty Attach / Access rows.
- Preserve selected stock SKUs, stock identifiers, included equipment and checkout pricing. Stock chainsaw bar choices are locked. Generic cart actions retain the established item-type and stock handling.
- Use three columns on desktop above 1100px, two on smaller landscape/tablet screens, one at 850px and below. Preserve blank specification, warranty and financing spaces so absent data does not collapse a tag. Battery and Yanmar selection mechanics are unchanged.
- Earlier trial-only scope notes are superseded by this rollout. Generated SEO catalog pages retain their separate toolbar/template until migrated; filtered shopping URLs already use these four rules.
