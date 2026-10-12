import { RestaurantFoodCategory, RestaurantFoodItem } from '../types';

export const DEFAULT_RESTAURANT_FOOD_CATEGORIES: RestaurantFoodCategory[] = [
  { id: 'cat-grills', name: 'Nyama Choma & Grills', description: 'Fresh charcoal-grilled meats and poultry', displayOrder: 1 },
  { id: 'cat-mains', name: 'Main Dishes & African Stews', description: 'Traditional local dishes and hearty stews', displayOrder: 2 },
  { id: 'cat-fastfood', name: 'Burgers, Bites & Fast Food', description: 'Crispy snacks, burgers and quick meals', displayOrder: 3 },
  { id: 'cat-sides', name: 'Sides & Accompaniments', description: 'Ugali, greens, mukimo, chapati and chips', displayOrder: 4 },
  { id: 'cat-platters', name: 'Platters & Sharing Combos', description: 'Family and group feast combos', displayOrder: 5 },
  { id: 'cat-beverages', name: 'Non-Alcoholic Drinks & Juices', description: 'Fresh squeezed juices, sodas and water', displayOrder: 6 }
];

export const buildInitialRestaurantFoodItems = (branchId: string): RestaurantFoodItem[] => [
  {
    id: `food-${branchId}-01`,
    branchId,
    name: 'Mbuzi Choma (Goat Ribs) 1kg',
    categoryId: 'cat-grills',
    categoryName: 'Nyama Choma & Grills',
    priceKes: 1400,
    costPriceKes: 850,
    description: 'Slow roasted prime goat ribs served with kachumbari',
    isAvailable: true,
    preparationTimeMinutes: 35,
    servingPortion: '1kg (Serves 2-3)'
  },
  {
    id: `food-${branchId}-02`,
    branchId,
    name: 'Full Kuku Choma (Free-Range Chicken)',
    categoryId: 'cat-grills',
    categoryName: 'Nyama Choma & Grills',
    priceKes: 1600,
    costPriceKes: 950,
    description: 'Charcoal grilled local whole chicken with peri-peri marinade',
    isAvailable: true,
    preparationTimeMinutes: 40,
    servingPortion: 'Whole Chicken (Serves 3-4)'
  },
  {
    id: `food-${branchId}-03`,
    branchId,
    name: 'Half Kuku Choma',
    categoryId: 'cat-grills',
    categoryName: 'Nyama Choma & Grills',
    priceKes: 850,
    costPriceKes: 500,
    description: 'Half grilled chicken with herb seasoning and chili dip',
    isAvailable: true,
    preparationTimeMinutes: 25,
    servingPortion: 'Half Chicken (Serves 1-2)'
  },
  {
    id: `food-${branchId}-04`,
    branchId,
    name: 'Whole Lake Tilapia Wet Fry',
    categoryId: 'cat-mains',
    categoryName: 'Main Dishes & African Stews',
    priceKes: 950,
    costPriceKes: 550,
    description: 'Fresh deep-fried whole tilapia simmered in rich tomato, garlic and coriander sauce',
    isAvailable: true,
    preparationTimeMinutes: 25,
    servingPortion: 'Whole Medium Fish'
  },
  {
    id: `food-${branchId}-05`,
    branchId,
    name: 'Beef Wet Fry (Karanga Special)',
    categoryId: 'cat-mains',
    categoryName: 'Main Dishes & African Stews',
    priceKes: 650,
    costPriceKes: 380,
    description: 'Tender beef cubes tossed with bell peppers and onions',
    isAvailable: true,
    preparationTimeMinutes: 20,
    servingPortion: '500g plate'
  },
  {
    id: `food-${branchId}-06`,
    branchId,
    name: 'Classic Gourmet Beef Burger with Fries',
    categoryId: 'cat-fastfood',
    categoryName: 'Burgers, Bites & Fast Food',
    priceKes: 750,
    costPriceKes: 400,
    description: '200g pure beef patty, melted cheddar, lettuce, pickles, and crispy fries',
    isAvailable: true,
    preparationTimeMinutes: 18,
    servingPortion: '1 Burger + Regular Fries'
  },
  {
    id: `food-${branchId}-07`,
    branchId,
    name: 'Loaded Chips Masala',
    categoryId: 'cat-fastfood',
    categoryName: 'Burgers, Bites & Fast Food',
    priceKes: 350,
    costPriceKes: 160,
    description: 'Golden fries drenched in aromatic tomato chili masala gravy and fresh coriander',
    isAvailable: true,
    preparationTimeMinutes: 12,
    servingPortion: '1 Full Plate'
  },
  {
    id: `food-${branchId}-08`,
    branchId,
    name: 'Traditional White Ugali',
    categoryId: 'cat-sides',
    categoryName: 'Sides & Accompaniments',
    priceKes: 100,
    costPriceKes: 40,
    description: 'Hot freshly made traditional maize meal accompaniment',
    isAvailable: true,
    preparationTimeMinutes: 10,
    servingPortion: '1 Portion'
  },
  {
    id: `food-${branchId}-09`,
    branchId,
    name: 'Steamed Sukuma Wiki & Traditional Greens (Managu)',
    categoryId: 'cat-sides',
    categoryName: 'Sides & Accompaniments',
    priceKes: 150,
    costPriceKes: 60,
    description: 'Locally sourced collard greens sautéed with onions and tomatoes',
    isAvailable: true,
    preparationTimeMinutes: 10,
    servingPortion: '1 Bowl'
  },
  {
    id: `food-${branchId}-10`,
    branchId,
    name: 'Soft Layered Chapatis (Pair of 2)',
    categoryId: 'cat-sides',
    categoryName: 'Sides & Accompaniments',
    priceKes: 120,
    costPriceKes: 50,
    description: 'Flaky handmade Kenyan flatbreads',
    isAvailable: true,
    preparationTimeMinutes: 8,
    servingPortion: '2 Chapatis'
  },
  {
    id: `food-${branchId}-11`,
    branchId,
    name: 'Sizzling Meat Platter (Goat, Sausage & Chicken Wings)',
    categoryId: 'cat-platters',
    categoryName: 'Platters & Sharing Combos',
    priceKes: 2800,
    costPriceKes: 1650,
    description: 'Mbuzi choma 1kg, 4 beef sausages, grilled chicken wings, fries, and kachumbari',
    isAvailable: true,
    preparationTimeMinutes: 45,
    servingPortion: 'Feast Platter (Serves 4-6)'
  },
  {
    id: `food-${branchId}-12`,
    branchId,
    name: 'Fresh Passion Fruit Juice (1 Litre Carafe)',
    categoryId: 'cat-beverages',
    categoryName: 'Non-Alcoholic Drinks & Juices',
    priceKes: 400,
    costPriceKes: 180,
    description: 'Chilled freshly blended real passion fruit juice',
    isAvailable: true,
    preparationTimeMinutes: 5,
    servingPortion: '1 Litre'
  }
];
