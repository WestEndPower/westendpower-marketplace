# Model-specific recommended items

Attachment and accessory rows can recommend additional compatible items in Build & Buy for any manufacturer. Use the equipment SKU in each heading:

| Column | Example |
| --- | --- |
| 72530-Rec1 | 133-5386 |
| 72530-RecQty1 | 1 |
| 72530-Rec2 | 140-4310 |
| 72530-RecQty2 | 1 |

Continue with Rec3/RecQty3 as needed. Quantity defaults to one when blank and multiplies by the selected parent quantity. The current Toro export's `72530-RecQtyt1` typo is accepted for compatibility; use `72530-RecQty1` for new exports. Recommended SKUs must be active, priced and compatible with the equipment in their own data rows.

Selecting a parent automatically selects its recommendations and includes their normal installation choices in current quote pricing. Recommendations appear in the itemized quote with “Recommended with …” and the existing Remove action. Removing one persists through recalculation and reload for that build; selecting it again explicitly restores it. Separate configuration tabs retain separate choices. Editing a recommended quantity makes it an explicit choice.

Shared recommended items are listed once, using the largest recommended quantity, matching required-component quantity behavior. Removing the parent removes items selected only automatically; independent manual selections remain. Recommended items may have their own required components and recommendations. Missing, inactive or invalid recommendations display a notice and do not prevent buying the parent.

Req/Qty columns keep their existing mandatory behavior. If an item is both recommended and required, its required status wins and it cannot be removed while required.

Public option CSVs and the combined Marketplace catalog must include the recommendation columns after export. Pricing remains calculated by the existing quote service from the final selected SKU quantities; recommendation columns do not introduce a separate discount or charge.
