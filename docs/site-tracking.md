# Public traffic and product interest

## What counts

- Successful product details or Build & Buy loads qualify. Rendering a catalog card is not a view.
- Count an exact manufacturer/SKU once per browser storage context per New York calendar day. Counter receipts are deduplicated by the API, including reloads and the details-to-builder transition. Browsers with Web Locks also serialize simultaneous tabs.
- Dealer use counts. No customer/staff identity is recorded or used to exclude a view.
- The badge shows recorded views over the last 168 hours, not unique people. Browser storage clearing, another browser profile, or a different device is a different context. Do not describe these as unique customers or verified human visitors.
- Each badge follows the currently selected purchase SKU (including a selected kit/factory configuration), not a sum across a model family.
- Show a real count of one or more. Zero and unavailable totals are hidden. Never use sample or historical backfilled counts in production.
- Counts are requested in batches of at most 100, refreshed at most once a minute, and occupy the reserved image-box footer. Existing image-box/card heights stay unchanged at zero and nonzero counts.

Localhost, file URLs, unapproved hosts, local API mode, manufacturer demos, browser automation, dealer editors and builder previews make no analytics or counter requests. Known bot user agents are excluded by the API. Ordinary browser views are not a tamper-proof measurement of human identity.

## Privacy and Analytics release prerequisite

**Before deploying this shared tag, turn OFF Enhanced measurement for the existing G-B7KTECFBFB web stream in Google Analytics.** The old stream has it enabled. The shared module supplies explicitly allowed page/action events instead. Leaving Google's automatic outbound-link, history and form measurements enabled can add event data outside this code's allowlist, including query strings on clicked links. Confirm in a real browser's Network panel that only the intended fields are sent before treating the traffic rollout as passed.

The tag reads `GA4MeasurementID` from the dealer settings CSV; a blank ID loads no Google tag. It does not hard-code a dealer's measurement ID, activate Google signals, or load an additional Tag Manager container. Page locations exclude query strings and fragments; referrers include only their origin. Search events contain query length, never search terms. Customer names, contact fields, notes, quote identifiers/tokens, payment details and form values are not passed to tracking. Private customer quote pages do not load this module. Existing GA browser identifiers/technical processing are separate from the counter and are not anonymous customer identities.

The counter API saves only manufacturer, SKU, New York day, a hash of a random per-SKU/day receipt, and server observation time. It does not save IP addresses, user agents, source URLs, quote/customer records or the raw receipt. Expired receipts are purged on new records and the existing API cron. Only aggregate counts are public. No customer identifiers or counter receipts are sent to Google.

Public page/action events include navigation, searches, filters, product/configurator opens, cart additions, checkout starts, acknowledged quote requests, submitted orders and confirmed non-test payments. `order_submitted` is not a paid sale. `purchase_confirmed` is a browser confirmation event, not an accounting sales total. Key events/report definitions still need to be selected in Analytics; this code does not change property administration.

## Dealer Spike handoff

Set its shared Request Price & Availability link to:

`https://westendpower.github.io/westendpower-marketplace/shop-by-product.html?entry=dealerspike`

The explicit link marker emits `dealer_spike_entry`. Its entry-source classification carries across pages in the same tab, expires after 30 idle minutes, and resets on a new external arrival. It measures arrivals using that link; it does not prove the visitor originally came from a search engine. Compare this group with direct/search arrivals and landing paths on `/pages/...`. Full cross-domain visitor stitching with Dealer Spike is not configured by this change.

## Deployment and verification

1. Turn off the stream's Enhanced measurement (above).
2. Merge/deploy the API companion first. It uses the existing `QUOTES_DB` binding and creates its isolated counter table automatically; no existing quote, inventory, customer or price table is changed.
3. Merge/publish these marketplace assets. Generated-page templates are in the API companion and include the same tag/CSS; editor previews stay excluded. No manufacturer CSV or workbook changes are needed.
4. Check GA Realtime separately on Marketplace, Shop by Product, Shop by Brand, Promotions and a generated public page. Confirm one page view per navigation and verify event payloads contain no private data. Do not mark this verified from a successful upload alone.
5. Open an active SKU in details/Build & Buy, return to its tag and check the real count after the refresh. Reopen/refresh in the same browser/day: the counter must not increase. Test a second SKU separately. Major repeated tests should use localhost and the automated test suites, which never record live counts.
6. Check the reserved label on all three shopping routes at desktop/phone widths and a generated page. Browser visual QA could not run in the cloud environment because its browser cannot reach the local server; this remains a deployment check.

Counter requests fail quietly so shopping, quoting and checkout do not depend on tracking availability.

## Regression baseline

The full frontend test run has two existing failures on unchanged main: Greenworks SKU 7503102 in equipment-package-pricing and the missing Toro 78690 image path in toro-option-images. Both were reproduced from a clean detached checkout before attributing them to this work. Manufacturer data is unchanged by this branch.
