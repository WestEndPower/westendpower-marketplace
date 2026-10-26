# Battery rows, requirements and kit components

The package SKU remains the authoritative priced and inventory-controlled item. Included components are presentation allocations, never additional charges or separate stock reservations. Only the package quantity is editable. Component quantities are multiplied from its definition. Additional batteries/chargers entered separately remain ordinary editable order lines.

## Workbook data

Existing Products, Batteries, Chargers, Packages, Accessories, Attachments, Parts and compatibility-runtime exports remain the source of truth. There are no invented future products or compatibility rules.

- Optional Batteries.BatterySeries overrides the displayed row heading. Automatic defaults: STIHL AP / AR Series, PRO AP Series; Greenworks 82BD Series, CORE Series. Other systems use Batteries.
- ButtonLabel optionally overrides a compact button label. The full Description, Model and SKU remain in itemized outputs. PRO AP buttons omit the AP prefix; 82BD/CORE buttons omit the prefix supplied by their row heading. Multiple included batteries/chargers are described below the buttons rather than creating duplicate quantity-labeled buttons.
- SellRemainingStockOnly=T hides a battery/charger when no stock remains across stores. Normal orderable rows remain visible at zero. The old AP300S row is flagged. Keep that flag in the master workbook when publishing subsequent exports.
- Packages.ToolSKU (or BaseToolSKU) explicitly identifies the bare tool. If absent, a single active bare product in the same BuildFamily, MarketplaceFamily or Model may identify it. Ambiguity leaves the kit intact and marks the component allocation for confirmation.
- Packages uses the existing numbered BatterySKU/Qty, ChargerSKU/Qty, AttachmentSKU/Qty, AccessorySKU/Qty and PartSKU/Qty fields. Quantities are per package.
- The new optional battery-requirements export has ToolSKU,BatterySKU,RequiredType,RequiredSKU,RequiredQty,PerBattery,Active. ToolSKU is the bare tool, BatterySKU is its battery SKU (BatteryID also supported); RequiredType is accessory, attachment, part, battery or charger. RequiredQty defaults to 1. PerBattery=T multiplies it by selected battery quantity; otherwise the requirement is per tool. Multiple rules support multiple required items. Map each required item to an active catalog row with current pricing. No AR mappings are inferred; the empty STIHL/Greenworks tables are ready for verified combinations.

Required connection items are added once to card prices and builder selections, omitted when already included in a factory kit, carried into cart/quote and validated again by the quote service. Switching batteries restores separately selected options and removes dependencies belonging only to the previous battery. Missing required-item data/prices must be confirmed, not silently priced as zero.

## Selling allocations

Work in cents. Preserve the exact bare-tool selling price. Allocate fixed included accessories at their current prices. Allocate the remaining balance to batteries up to their standalone value, rounding each battery unit allocation up to $10. Allocate any remaining balance to the charger rows, preserving the exact kit total. Multiple chargers share the remaining balance by their standalone prices; final cents go to the last charger. A charger may legitimately have a $0 allocation. Without a charger, the last battery receives any exact remaining balance.

Never create a negative amount. If the bare tool, required parts or battery rounding exceed the kit total, preserve the kit price and show component allocation needs confirmation. The kit total is never increased to force a split. Missing or ambiguous bare-tool/component mappings also preserve the kit and disclose that its split needs confirmation.

## Dealer allocations

Costs are calculated only within the existing password-protected dealer flow, never from public data. Preserve actual bare-tool equipment cost and actual charger equipment costs without $10 rounding. Deduct those and fixed included accessory costs from the actual kit equipment cost (inbound freight remains separate); allocate the exact remaining cost to included batteries. Preserve cents and quantity-weighted totals. Missing costs or negative balances produce a component-cost confirmation message while retaining the actual parent kit cost/profit calculation. Included cost rows are explanatory; parent kit rows alone contribute to profit totals.

The API changes require a Cloudflare deployment. Public package mappings may be read from the published CSV when no private mapping dataset has been synced. Actual selling prices and all dealer costs still use the existing private pricing engine.
