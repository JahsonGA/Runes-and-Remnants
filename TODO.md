# Runes & Remnants — Development TODO

## 1. Stabilize the Existing Harvest System

* Fix broken imports in `src/harvest/menu.js`
* Define a shared `MODULE_ID` constant and import it where needed
* Replace incorrect function references like `outcome(...)` with the actual exported logic function
* Verify the harvest workflow runs end-to-end without runtime errors
* Validate compendium item loading and flag parsing
* Confirm chat output, material granting, and Item Piles fallback behavior work correctly
* Update the README so it accurately reflects the current feature set

## 2. Establish a Shared Module Architecture

* Create a shared `src/core/` area for constants, settings, and helpers
* Separate feature code into clear folders such as:

  * `src/features/harvest/`
  * `src/features/crafting/`
  * `src/features/enchanting/`
* Add shared utility functions for inventory checks, chat output, and workflow results
* Keep UI logic separate from service/feature logic
* Standardize naming and import patterns across the project

## 3. Create a Main Runes & Remnants Hub

* Build a root application window for the module
* Add navigation for:

  * Harvest
  * Crafting
  * Enchanting
* Make the harvest menu accessible from the hub
* Keep the Token HUD shortcut optional for fast access
* Plan for future expansion such as Recipes, Materials, or Ancestral Weapons

## 4. Define the Functional Purpose of Each System

* Harvest = obtain materials from creatures
* Crafting = turn harvested materials into usable items or components
* Enchanting = enhance existing items with magical effects or rune properties
* Decide how these systems connect into one gameplay loop
* Define how materials, recipes, and enchantments are represented in data

## 5. Build the Crafting System

* Create a crafting feature folder and application
* Define a recipe data format
* Decide where recipe data lives:

  * compendium pack
  * JSON-like definitions
  * item flags
* Build a crafting UI that allows users to:

  * browse recipes
  * view required materials
  * choose a crafter
  * preview output
* Add logic to validate ingredient ownership in actor inventory
* Add logic to consume required materials
* Add logic to create crafted output items
* Post crafting results to chat
* Decide whether crafting requires checks, tools, or is deterministic

## 6. Build the Enchanting System

* Create an enchanting feature folder and application
* Define an enchantment data format
* Decide how enchantments apply to items:

  * flags
  * Active Effects
  * embedded item changes
* Build an enchanting UI that allows users to:

  * choose an owned item
  * choose an enchantment
  * view required materials or catalysts
  * preview the result
* Add logic to validate valid target items
* Add logic to validate and consume enchanting materials
* Add logic to apply enchantments to items safely
* Post enchanting results to chat
* Decide whether items can hold multiple enchantments

## 7. Make the Project More Data-Driven

* Move toward compendium- or data-based definitions for:

  * harvestables
  * materials
  * recipes
  * enchantments
* Avoid hardcoding content directly in feature scripts
* Validate missing or malformed data safely
* Create reusable schemas or helper functions for content parsing

## 8. Improve Testing and Reliability

* Expand unit tests for harvest logic
* Add tests for crafting validation and recipe resolution
* Add tests for enchanting validation and effect application
* Test missing data, bad flags, and invalid actor states
* Test workflow behavior in Foundry for common edge cases
* Keep CI workflows working for releases and validation

## 9. Maintain Good Development Practices

* Preserve the separation of logic and UI
* Keep files focused and small
* Use shared constants instead of repeated strings
* Keep styling centralized in CSS instead of duplicating inline styles
* Use consistent naming for features, services, templates, and helpers
* Write README updates as features are added
* Keep features working before adding visual polish

## 10. Plan for Later Art and Presentation

* Leave placeholders for future icons and menu art
* Decide what art is needed for:

  * main hub
  * harvest menu
  * crafting menu
  * enchanting menu
  * material and recipe visuals
* Focus on functional workflow first
* Add visual polish after Harvest, Crafting, and Enchanting all work correctly

## 11. Suggested Development Order

1. Stabilize Harvest
2. Create shared constants and common architecture
3. Build the main hub menu
4. Implement Crafting
5. Implement Enchanting
6. Expand data packs and tests
7. Add art and interface polish

## 12. MVP Goal

The first complete usable version of the module should allow players or GMs to:

* harvest creature materials
* open a central Runes & Remnants menu
* craft at least a small set of items from harvested materials
* enchant at least a small set of existing items
* navigate between all three systems from one project hub
