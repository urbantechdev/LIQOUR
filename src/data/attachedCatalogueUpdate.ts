/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, StockCategory } from '../types';
import { getProductImageUrl } from '../utils/productImages';

export interface AttachedCatalogueRow {
  sku: string;
  category: string;
  subcategory: string;
  productName: string;
  brand: string;
  packSize: string;
  retailPriceKes: number;
  priceSource: string;
  observationDate: string;
  imageFilename: string;
}

export const ATTACHED_CATALOGUE_CSV_ROWS: AttachedCatalogueRow[] = [
  // Beer / Cider / RTD
  { sku: 'WHITE-CAP-WHITE-CAP-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'White Cap', brand: 'White Cap', packSize: '500ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WHITE-CAP-WHITE-CAP-500ML.jpg' },
  { sku: 'PILSNER-PILSNER-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Pilsner', brand: 'Pilsner', packSize: '500ml', retailPriceKes: 280, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'PILSNER-PILSNER-500ML.jpg' },
  { sku: 'GUINNESS-GUINNESS-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Guinness', brand: 'Guinness', packSize: '500ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'GUINNESS-GUINNESS-500ML.jpg' },
  { sku: 'GUINNESS-GUINNESS-SMOOTH-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Guinness Smooth', brand: 'Guinness', packSize: '500ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'GUINNESS-GUINNESS-SMOOTH-500ML.jpg' },
  { sku: 'GUINNESS-GUINNESS-HOP-HOUSE-13-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Guinness Hop House 13', brand: 'Guinness', packSize: '500ml', retailPriceKes: 430, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'GUINNESS-GUINNESS-HOP-HOUSE-13-500ML.jpg' },
  { sku: 'TUSKER-TUSKER-LAGER-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Tusker Lager', brand: 'Tusker', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'TUSKER-TUSKER-LAGER-500ML.jpg' },
  { sku: 'TUSKER-TUSKER-LITE-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Tusker Lite', brand: 'Tusker', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'TUSKER-TUSKER-LITE-500ML.jpg' },
  { sku: 'TUSKER-TUSKER-MALT-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Tusker Malt', brand: 'Tusker', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'TUSKER-TUSKER-MALT-500ML.jpg' },
  { sku: 'TUSKER-TUSKER-CIDER-500ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Tusker Cider', brand: 'Tusker', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'TUSKER-TUSKER-CIDER-500ML.jpg' },
  { sku: 'HEINEKEN-HEINEKEN-BOTTLE-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Heineken Bottle', brand: 'Heineken', packSize: '330ml', retailPriceKes: 320, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'HEINEKEN-HEINEKEN-BOTTLE-330ML.jpg' },
  { sku: 'HEINEKEN-HEINEKEN-CAN-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Heineken Can', brand: 'Heineken', packSize: '500ml', retailPriceKes: 380, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'HEINEKEN-HEINEKEN-CAN-500ML.jpg' },
  { sku: 'HEINEKEN-HEINEKEN-0-0-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Heineken 0.0', brand: 'Heineken', packSize: '330ml', retailPriceKes: 290, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'HEINEKEN-HEINEKEN-0-0-330ML.jpg' },
  { sku: 'HUNTER-S-HUNTERS-DRY-330ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Hunters Dry', brand: "Hunter's", packSize: '330ml', retailPriceKes: 350, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'HUNTER-S-HUNTERS-DRY-330ML.jpg' },
  { sku: 'HUNTER-S-HUNTER-S-GOLD-CIDER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: "Hunter's Gold Cider", brand: "Hunter's", packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'HUNTER-S-HUNTER-S-GOLD-CIDER-330ML.jpg' },
  { sku: 'HIKE-HIKE-PREMIUM-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Hike Premium', brand: 'Hike', packSize: '500ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'HIKE-HIKE-PREMIUM-500ML.jpg' },
  { sku: 'SIKERA-SIKERA-APPLE-CIDER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Sikera Apple Cider', brand: 'Sikera', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SIKERA-SIKERA-APPLE-CIDER-330ML.jpg' },
  { sku: 'LEFFE-LEFFE-BLOND-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Leffe Blond', brand: 'Leffe', packSize: '330ml', retailPriceKes: 400, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'LEFFE-LEFFE-BLOND-330ML.jpg' },
  { sku: 'O-J-O-J-12-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'O J 12', brand: 'O J', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'O-J-O-J-12-500ML.jpg' },
  { sku: 'O-J-O-J-16-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'O J 16', brand: 'O J', packSize: '500ml', retailPriceKes: 360, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'O-J-O-J-16-500ML.jpg' },
  { sku: 'CASTLE-CASTLE-MILK-STOUT-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Castle Milk Stout', brand: 'Castle', packSize: '500ml', retailPriceKes: 320, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'CASTLE-CASTLE-MILK-STOUT-500ML.jpg' },
  { sku: 'OBOLON-OBOLON-PREMIUM-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Obolon Premium', brand: 'Obolon', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'OBOLON-OBOLON-PREMIUM-500ML.jpg' },
  { sku: 'OBOLON-OBOLON-8-6-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Obolon 8.6', brand: 'Obolon', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'OBOLON-OBOLON-8-6-500ML.jpg' },
  { sku: 'BALOZI-BALOZI-LAGER-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Balozi Lager', brand: 'Balozi', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BALOZI-BALOZI-LAGER-500ML.jpg' },
  { sku: 'WINDHOEK-WINDHOEK-PREMIUM-DRAUGHT-440ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Windhoek Premium Draught', brand: 'Windhoek', packSize: '440ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WINDHOEK-WINDHOEK-PREMIUM-DRAUGHT-440ML.jpg' },
  { sku: 'WINDHOEK-WINDHOEK-PREMIUM-LAGER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Windhoek Premium Lager', brand: 'Windhoek', packSize: '330ml', retailPriceKes: 310, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WINDHOEK-WINDHOEK-PREMIUM-LAGER-330ML.jpg' },
  { sku: 'WILLIAM-LAWSON-S-WILLIAM-LAWSONS-APPLE-RTD-330ML', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'William Lawsons Apple RTD', brand: "William Lawson's", packSize: '330ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WILLIAM-LAWSON-S-WILLIAM-LAWSONS-APPLE-RTD-330ML.jpg' },
  { sku: 'STELLA-ARTOIS-STELLA-ARTOIS-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Stella Artois', brand: 'Stella Artois', packSize: '330ml', retailPriceKes: 350, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'STELLA-ARTOIS-STELLA-ARTOIS-330ML.jpg' },
  { sku: 'BUDWEISER-BUDWEISER-6-PACK', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Budweiser (6 Pack)', brand: 'Budweiser', packSize: '6 Pack', retailPriceKes: 1800, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BUDWEISER-BUDWEISER-6-PACK.jpg' },
  { sku: 'SUMMIT-SUMMIT-MALT-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Summit Malt', brand: 'Summit', packSize: '330ml', retailPriceKes: 250, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SUMMIT-SUMMIT-MALT-330ML.jpg' },
  { sku: 'BAVARIA-BAVARIA-ORIGINAL-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bavaria Original', brand: 'Bavaria', packSize: '500ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BAVARIA-BAVARIA-ORIGINAL-500ML.jpg' },
  { sku: 'BAVARIA-BAVARIA-BLACK-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bavaria Black', brand: 'Bavaria', packSize: '500ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BAVARIA-BAVARIA-BLACK-500ML.jpg' },
  { sku: 'SNAPP-SNAPP-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Snapp', brand: 'Snapp', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SNAPP-SNAPP-330ML.jpg' },
  { sku: 'SNAPP-SNAPP-CAN-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Snapp Can', brand: 'Snapp', packSize: '500ml', retailPriceKes: 280, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SNAPP-SNAPP-CAN-500ML.jpg' },
  { sku: 'TUBORG-TUBORG-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Tuborg', brand: 'Tuborg', packSize: '500ml', retailPriceKes: 250, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'TUBORG-TUBORG-500ML.jpg' },
  { sku: 'TUBORG-TUBORG-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Tuborg', brand: 'Tuborg', packSize: '330ml', retailPriceKes: 350, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'TUBORG-TUBORG-330ML.jpg' },
  { sku: 'CORONA-CORONA-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Corona', brand: 'Corona', packSize: '330ml', retailPriceKes: 320, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'CORONA-CORONA-330ML.jpg' },
  { sku: 'CARLSBERG-CARLSBERG-CAN-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Carlsberg Can', brand: 'Carlsberg', packSize: '500ml', retailPriceKes: 350, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'CARLSBERG-CARLSBERG-CAN-500ML.jpg' },
  { sku: 'CARLSBERG-CARLSBERG-BOTTLE-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Carlsberg Bottle', brand: 'Carlsberg', packSize: '330ml', retailPriceKes: 280, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'CARLSBERG-CARLSBERG-BOTTLE-330ML.jpg' },
  { sku: 'ATLAS-ATLAS-10-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Atlas 10', brand: 'Atlas', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'ATLAS-ATLAS-10-500ML.jpg' },
  { sku: 'ATLAS-ATLAS-12-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Atlas 12', brand: 'Atlas', packSize: '500ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'ATLAS-ATLAS-12-500ML.jpg' },
  { sku: 'ATLAS-ATLAS-16-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Atlas 16', brand: 'Atlas', packSize: '500ml', retailPriceKes: 380, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'ATLAS-ATLAS-16-500ML.jpg' },
  { sku: 'SAVANNA-SAVANNA-DRY-330ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Savanna Dry', brand: 'Savanna', packSize: '330ml', retailPriceKes: 360, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SAVANNA-SAVANNA-DRY-330ML.jpg' },
  { sku: 'DESPERADOS-DESPERADOS-BOTTLE-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Desperados Bottle', brand: 'Desperados', packSize: '330ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'DESPERADOS-DESPERADOS-BOTTLE-330ML.jpg' },
  { sku: 'DESPERADOS-DESPERADOS-CAN-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Desperados Can', brand: 'Desperados', packSize: '500ml', retailPriceKes: 320, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'DESPERADOS-DESPERADOS-CAN-500ML.jpg' },
  { sku: 'FAXE-FAXE-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Faxe', brand: 'Faxe', packSize: '500ml', retailPriceKes: 380, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'FAXE-FAXE-500ML.jpg' },
  { sku: 'PERONI-PERONI-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Peroni', brand: 'Peroni', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'PERONI-PERONI-330ML.jpg' },
  { sku: 'REDDS-REDDS-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Redds', brand: 'Redds', packSize: '330ml', retailPriceKes: 250, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'REDDS-REDDS-330ML.jpg' },
  { sku: 'REDD-S-REDD-S-ORIGINAL-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: "Redd's Original", brand: "Redd's", packSize: '330ml', retailPriceKes: 250, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'REDD-S-REDD-S-ORIGINAL-330ML.jpg' },
  { sku: 'ROYAL-DUTCH-ROYAL-DUTCH-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Royal Dutch', brand: 'Royal Dutch', packSize: '500ml', retailPriceKes: 280, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'ROYAL-DUTCH-ROYAL-DUTCH-500ML.jpg' },
  { sku: 'KENYAN-ORIGINALS-KENYAN-ORIGINALS-GINGER-CIDER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Kenyan Originals Ginger Cider', brand: 'Kenyan Originals', packSize: '330ml', retailPriceKes: 280, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'KENYAN-ORIGINALS-KENYAN-ORIGINALS-GINGER-CIDER-330ML.jpg' },
  { sku: 'KENYAN-ORIGINALS-KO-CIDER-PASSION-FRUIT-LIME-330ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'KO Cider Passion Fruit & Lime', brand: 'Kenyan Originals', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'KENYAN-ORIGINALS-KO-CIDER-PASSION-FRUIT-LIME-330ML.jpg' },
  { sku: 'KENYAN-ORIGINALS-KENYAN-ORIGINALS-PINEAPPLE-MINT-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Kenyan Originals Pineapple & Mint', brand: 'Kenyan Originals', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'KENYAN-ORIGINALS-KENYAN-ORIGINALS-PINEAPPLE-MINT-330ML.jpg' },
  { sku: 'KENYAN-ORIGINALS-KO-BEER-PINEAPPLE-MINT-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'KO Beer Pineapple & Mint', brand: 'Kenyan Originals', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'KENYAN-ORIGINALS-KO-BEER-PINEAPPLE-MINT-330ML.jpg' },
  { sku: 'KENYAN-ORIGINALS-KO-CIDER-LIME-GINGER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'KO Cider Lime & Ginger', brand: 'Kenyan Originals', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'KENYAN-ORIGINALS-KO-CIDER-LIME-GINGER-330ML.jpg' },
  { sku: 'KENYAN-ORIGINALS-KENYAN-ORIGINALS-MANGO-GINGER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Kenyan Originals Mango & Ginger', brand: 'Kenyan Originals', packSize: '330ml', retailPriceKes: 300, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'KENYAN-ORIGINALS-KENYAN-ORIGINALS-MANGO-GINGER-330ML.jpg' },
  { sku: '254-254-SAMBRUBRU-SAISON-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: '254 Sambrubru Saison', brand: '254', packSize: '330ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: '254-254-SAMBRUBRU-SAISON-330ML.jpg' },
  { sku: '254-254-GOLDEN-RUMP-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: '254 Golden Rump', brand: '254', packSize: '330ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: '254-254-GOLDEN-RUMP-330ML.jpg' },
  { sku: '254-254-KARIBREW-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: '254 Karibrew', brand: '254', packSize: '330ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: '254-254-KARIBREW-330ML.jpg' },
  { sku: '254-254-CLIFF-HANGER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: '254 Cliff Hanger', brand: '254', packSize: '330ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: '254-254-CLIFF-HANGER-330ML.jpg' },
  { sku: '254-254-SAND-TRAP-IPA-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: '254 Sand Trap IPA', brand: '254', packSize: '330ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: '254-254-SAND-TRAP-IPA-330ML.jpg' },
  { sku: '254-254-NI-HOW-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: '254 Ni How', brand: '254', packSize: '330ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: '254-254-NI-HOW-330ML.jpg' },
  { sku: '254-254-AMBERSELI-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: '254 Amberseli', brand: '254', packSize: '330ml', retailPriceKes: 370, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: '254-254-AMBERSELI-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-TANDALA-WEISSBIER-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Tandala Weissbier', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-TANDALA-WEISSBIER-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-DIRTY-HAIRY-COPPER-ALE-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Dirty Hairy Copper Ale', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-DIRTY-HAIRY-COPPER-ALE-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-FRUIT-FLY-MANGO-IPA-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Fruit Fly Mango IPA', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 350, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-FRUIT-FLY-MANGO-IPA-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-CHEZ-GUERRILLA-IMPERIAL-STOUT-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Chez Guerrilla Imperial Stout', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 400, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-CHEZ-GUERRILLA-IMPERIAL-STOUT-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-JUA-KALI-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Jua Kali', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-JUA-KALI-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-BILA-SHAKA-IPA-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Bila Shaka IPA', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 380, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-BILA-SHAKA-IPA-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-MANTIS-SESSION-ALE-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Mantis Session Ale', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 350, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-MANTIS-SESSION-ALE-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-DIRE-STRAITS-PILSEN-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Dire Straits Pilsen', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-DIRE-STRAITS-PILSEN-330ML.jpg' },
  { sku: 'BATELEUR-BATELEUR-HONEY-BADGER-BLONDE-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bateleur Honey Badger Blonde', brand: 'Bateleur', packSize: '330ml', retailPriceKes: 330, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BATELEUR-BATELEUR-HONEY-BADGER-BLONDE-330ML.jpg' },
  { sku: 'WESTONS-WESTONS-WYLD-WOOD-ORGANIC-500ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Westons Wyld Wood Organic', brand: 'Westons', packSize: '500ml', retailPriceKes: 700, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WESTONS-WESTONS-WYLD-WOOD-ORGANIC-500ML.jpg' },
  { sku: 'WESTONS-STOWFORD-PRESS-500ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Stowford Press', brand: 'Westons', packSize: '500ml', retailPriceKes: 700, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WESTONS-STOWFORD-PRESS-500ML.jpg' },
  { sku: 'WESTONS-HENRY-WESTONS-PERRY-500ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Henry Westons Perry', brand: 'Westons', packSize: '500ml', retailPriceKes: 700, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WESTONS-HENRY-WESTONS-PERRY-500ML.jpg' },
  { sku: 'WESTONS-HENRY-WESTONS-VINTAGE-CIDER-500ML', category: 'Beer / Cider / RTD', subcategory: 'Cider', productName: 'Henry Westons Vintage Cider', brand: 'Westons', packSize: '500ml', retailPriceKes: 700, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'WESTONS-HENRY-WESTONS-VINTAGE-CIDER-500ML.jpg' },
  { sku: 'COOLBERG-COOLBERG-CRANBERRY-0-0-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Coolberg Cranberry 0.0', brand: 'Coolberg', packSize: '330ml', retailPriceKes: 260, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'COOLBERG-COOLBERG-CRANBERRY-0-0-330ML.jpg' },
  { sku: 'COOLBERG-COOLBERG-MALT-0-0-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Coolberg Malt 0.0', brand: 'Coolberg', packSize: '330ml', retailPriceKes: 260, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'COOLBERG-COOLBERG-MALT-0-0-330ML.jpg' },
  { sku: 'COOLBERG-COOLBERG-MINT-0-0-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Coolberg Mint 0.0', brand: 'Coolberg', packSize: '330ml', retailPriceKes: 260, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'COOLBERG-COOLBERG-MINT-0-0-330ML.jpg' },
  { sku: 'COOLBERG-COOLBERG-STRAWBERRY-0-0-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Coolberg Strawberry 0.0', brand: 'Coolberg', packSize: '330ml', retailPriceKes: 260, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'COOLBERG-COOLBERG-STRAWBERRY-0-0-330ML.jpg' },
  { sku: 'COOLBERG-COOLBERG-PEACH-0-0-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Coolberg Peach 0.0', brand: 'Coolberg', packSize: '330ml', retailPriceKes: 260, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'COOLBERG-COOLBERG-PEACH-0-0-330ML.jpg' },
  { sku: 'COOLBERG-COOLBERG-GINGER-0-0-330ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Coolberg Ginger 0.0', brand: 'Coolberg', packSize: '330ml', retailPriceKes: 260, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'COOLBERG-COOLBERG-GINGER-0-0-330ML.jpg' },
  { sku: 'BAVARIA-BAVARIA-0-0-ORIGINAL-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bavaria 0.0 Original', brand: 'Bavaria', packSize: '500ml', retailPriceKes: 270, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BAVARIA-BAVARIA-0-0-ORIGINAL-500ML.jpg' },
  { sku: 'BAVARIA-BAVARIA-0-0-GINGER-LIME-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bavaria 0.0 Ginger & Lime', brand: 'Bavaria', packSize: '500ml', retailPriceKes: 220, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BAVARIA-BAVARIA-0-0-GINGER-LIME-500ML.jpg' },
  { sku: 'BAVARIA-BAVARIA-0-0-MANGO-PASSION-500ML', category: 'Beer / Cider / RTD', subcategory: 'Beer', productName: 'Bavaria 0.0 Mango Passion', brand: 'Bavaria', packSize: '500ml', retailPriceKes: 460, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BAVARIA-BAVARIA-0-0-MANGO-PASSION-500ML.jpg' },
  { sku: 'SMIRNOFF-SMIRNOFF-GUARANA-250ML', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'Smirnoff Guarana', brand: 'Smirnoff', packSize: '250ml', retailPriceKes: 250, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SMIRNOFF-SMIRNOFF-GUARANA-250ML.jpg' },
  { sku: 'SMIRNOFF-SMIRNOFF-ELECTRIC-GINSENG-250ML', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'Smirnoff Electric Ginseng', brand: 'Smirnoff', packSize: '250ml', retailPriceKes: 250, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SMIRNOFF-SMIRNOFF-ELECTRIC-GINSENG-250ML.jpg' },
  { sku: 'SMIRNOFF-SMIRNOFF-DOUBLE-BLACK-ICE-250ML', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'Smirnoff Double Black Ice', brand: 'Smirnoff', packSize: '250ml', retailPriceKes: 250, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'SMIRNOFF-SMIRNOFF-DOUBLE-BLACK-ICE-250ML.jpg' },
  { sku: 'BACARDI-BREEZER-BACARDI-BREEZER-PEACH-6-PACK', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'Bacardi Breezer Peach (6 Pack)', brand: 'Bacardi Breezer', packSize: '6 Pack', retailPriceKes: 1950, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BACARDI-BREEZER-BACARDI-BREEZER-PEACH-6-PACK.jpg' },
  { sku: 'BACARDI-BREEZER-BACARDI-BREEZER-WATERMELON-6-PACK', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'Bacardi Breezer Watermelon (6 Pack)', brand: 'Bacardi Breezer', packSize: '6 Pack', retailPriceKes: 1950, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BACARDI-BREEZER-BACARDI-BREEZER-WATERMELON-6-PACK.jpg' },
  { sku: 'BACARDI-BREEZER-BACARDI-BREEZER-PINEAPPLE-6-PACK', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'Bacardi Breezer Pineapple (6 Pack)', brand: 'Bacardi Breezer', packSize: '6 Pack', retailPriceKes: 1950, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BACARDI-BREEZER-BACARDI-BREEZER-PINEAPPLE-6-PACK.jpg' },
  { sku: 'BACARDI-BREEZER-BACARDI-BREEZER-LIME-6-PACK', category: 'Beer / Cider / RTD', subcategory: 'RTD', productName: 'Bacardi Breezer Lime (6 Pack)', brand: 'Bacardi Breezer', packSize: '6 Pack', retailPriceKes: 1950, priceSource: 'DrinksZone / Drinks Vine', observationDate: '2026-10-05', imageFilename: 'BACARDI-BREEZER-BACARDI-BREEZER-LIME-6-PACK.jpg' }
];

function parseVolumeMl(packSize: string): number {
  const lower = (packSize || '').toLowerCase().trim();
  if (lower.includes('6 pack') || lower.includes('6-pack')) {
    return 1980;
  }
  const litreMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:l|litre|liter)\b/);
  if (litreMatch) {
    return Math.round(parseFloat(litreMatch[1]) * 1000);
  }
  const mlMatch = lower.match(/(\d+)\s*ml/);
  if (mlMatch) {
    return parseInt(mlMatch[1], 10);
  }
  return 500;
}

function resolveSubCategory(category: string, subcategory: string): string {
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();
  if (cat.includes('beer') || cat.includes('cider') || cat.includes('rtd') || sub === 'beer' || sub === 'cider' || sub === 'rtd') {
    return 'Beer & Cider';
  }
  if (cat.includes('whisky') || cat.includes('whiskey') || sub.includes('whisky')) return 'Whisky';
  if (cat.includes('cognac') || cat.includes('brandy')) return 'Cognac & Brandy';
  if (cat.includes('gin')) return 'Gin';
  if (cat.includes('vodka')) return 'Vodka';
  if (cat.includes('rum')) return 'Rum';
  if (cat.includes('tequila')) return 'Tequila';
  if (cat.includes('cream')) return 'Cream Liqueur';
  if (cat.includes('liqueur')) return 'Liqueur & Cream';
  if (cat.includes('wine') || cat.includes('champagne')) return 'Champagne & Wine';
  return 'Beer & Cider';
}

function deterministicBarcode(seed: string, prefix = '616110'): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const digits = String(Math.abs(hash)).padStart(7, '0').slice(0, 7);
  return `${prefix}${digits}`;
}

export function convertAttachedCatalogueRowToProduct(row: AttachedCatalogueRow, index: number): Product {
  const volumeMl = parseVolumeMl(row.packSize);
  const subCategory = resolveSubCategory(row.category, row.subcategory);
  const isSixPack = row.packSize.toLowerCase().includes('6 pack');
  const displayName = row.productName.includes(`(${row.packSize})`)
    ? row.productName
    : `${row.productName} (${row.packSize})`;

  const localBrands = new Set([
    'Tusker',
    'White Cap',
    'Pilsner',
    'Guinness',
    'Balozi',
    'Snapp',
    'Sikera',
    'Summit',
    'Kenyan Originals',
    '254',
    'Bateleur',
    'Smirnoff',
    'O J'
  ]);
  const isLocal = localBrands.has(row.brand);
  const category: StockCategory = isLocal ? 'LPS' : 'IPS';
  const retailPriceKes = Math.max(50, Math.round(row.retailPriceKes));
  const wholesalePriceKes = Math.max(40, Math.round(retailPriceKes * 0.86));
  const warehouseCostKes = Math.max(30, Math.round(retailPriceKes * 0.72));
  const barcode = deterministicBarcode(row.sku, isLocal ? '616110' : '500029');
  const caseBarcode = `1${barcode}`;

  const baseProduct: Product = {
    id: `cat-upd-${String(index + 1).padStart(3, '0')}`,
    sku: row.sku,
    barcode,
    caseBarcode,
    name: displayName,
    category,
    subCategory,
    brand: row.brand,
    volumeMl,
    alcoholPercentage: row.productName.includes('0.0') ? 0.0 : subCategory === 'Beer & Cider' ? 5.0 : 40.0,
    packSize: isSixPack ? 4 : 24,
    countryOfOrigin: isLocal ? 'Kenya' : 'Imported',
    warehouseCostKes,
    wholesalePriceKes,
    retailPriceKes,
    minWholesaleQty: isSixPack ? 4 : 12,
    vatRate: 0.16,
    exciseDutyPerLitreKes: subCategory === 'Beer & Cider' ? 142.44 : 356.4,
    kraExciseStampType: isLocal ? 'DIGITAL_EXCISE_STAMP' : 'IMPORT_DUTY_STAMP',
    sourceUrl: `https://urbantechdev.com/catalog/${row.sku.toLowerCase()}`
  };

  return {
    ...baseProduct,
    image: getProductImageUrl(baseProduct)
  };
}

function normalizeMatchKey(name: string, volumeMl: number): string {
  const cleanName = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(bottle|can|6\s*pack|6-pack|500ml|330ml|440ml|250ml)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return `${cleanName}__${volumeMl}`;
}

export function mergeAttachedCatalogueWithExistingProducts(baseProducts: Product[]): Product[] {
  const result = [...baseProducts];
  const bySku = new Map<string, number>();
  const byNameVol = new Map<string, number>();

  result.forEach((p, idx) => {
    bySku.set(p.sku.toUpperCase(), idx);
    byNameVol.set(normalizeMatchKey(p.name, p.volumeMl), idx);
  });

  ATTACHED_CATALOGUE_CSV_ROWS.forEach((row, rowIdx) => {
    const converted = convertAttachedCatalogueRowToProduct(row, rowIdx);
    const skuIdx = bySku.get(converted.sku.toUpperCase());
    const nameVolKey = normalizeMatchKey(row.productName, converted.volumeMl);
    const matchIdx = skuIdx !== undefined ? skuIdx : byNameVol.get(nameVolKey);

    if (matchIdx !== undefined) {
      const existing = result[matchIdx];
      result[matchIdx] = {
        ...existing,
        brand: converted.brand || existing.brand,
        retailPriceKes: converted.retailPriceKes,
        wholesalePriceKes: converted.wholesalePriceKes,
        warehouseCostKes: converted.warehouseCostKes,
        image: existing.image || converted.image
      };
    } else {
      const newIdx = result.length;
      result.push(converted);
      bySku.set(converted.sku.toUpperCase(), newIdx);
      byNameVol.set(nameVolKey, newIdx);
    }
  });

  return result;
}
