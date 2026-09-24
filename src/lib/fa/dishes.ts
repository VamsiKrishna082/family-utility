import type { FaFood, FaServing } from "@/lib/fa/types";

/**
 * The local Indian dish table (food.md, source #2): typical home-style
 * values per piece / katori / cup, in the spirit of IFCT composition data.
 * They're starting points, not lab values — every number is editable in the
 * add sheet, and an edit becomes that person's own version of the dish.
 *
 * Row: [id, name, unit, kcal, protein, carbs, fat, fibre, aliases?]
 * `unit` picks the serving presets below; the base values are for one unit.
 */
type Unit = "piece" | "mug" | "katori" | "cup" | "plate" | "glass" | "tbsp" | "tsp" | "g100" | "g30";
type Row = [string, string, Unit, number, number, number, number, number, string?];

const UNIT_BASE: Record<Unit, string> = {
  piece: "1 piece", mug: "1 cup", katori: "1 katori (150 ml)", cup: "1 cup", plate: "1 plate", glass: "1 glass (200 ml)",
  tbsp: "1 tbsp", tsp: "1 tsp", g100: "100 g", g30: "30 g",
};

const UNIT_SERVINGS: Record<Unit, FaServing[]> = {
  piece: [{ label: "1 piece", mult: 1 }],
  mug: [{ label: "1 cup", mult: 1 }, { label: "½ cup", mult: 0.5 }],
  katori: [{ label: "1 katori", mult: 1 }, { label: "½ katori", mult: 0.5 }, { label: "1 bowl (250 ml)", mult: 1.67 }],
  cup: [{ label: "1 cup", mult: 1 }, { label: "½ cup", mult: 0.5 }, { label: "2 cups", mult: 2 }],
  plate: [{ label: "1 plate", mult: 1 }, { label: "½ plate", mult: 0.5 }],
  glass: [{ label: "1 glass", mult: 1 }, { label: "½ glass", mult: 0.5 }],
  tbsp: [{ label: "1 tbsp", mult: 1 }, { label: "2 tbsp", mult: 2 }],
  tsp: [{ label: "1 tsp", mult: 1 }, { label: "2 tsp", mult: 2 }],
  g100: [{ label: "100 g", mult: 1 }, { label: "50 g", mult: 0.5 }, { label: "200 g", mult: 2 }],
  g30: [{ label: "30 g", mult: 1 }, { label: "15 g", mult: 0.5 }, { label: "60 g", mult: 2 }],
};

const ROWS: Row[] = [
  // Breakfast / tiffin
  ["idli", "Idli", "piece", 58, 2, 12, 0.2, 0.6],
  ["dosa", "Plain dosa", "piece", 135, 3, 20, 4.5, 1, "dosai"],
  ["masala-dosa", "Masala dosa", "piece", 330, 6, 45, 14, 3],
  ["ghee-roast", "Ghee roast dosa", "piece", 250, 4, 30, 12, 1],
  ["rava-dosa", "Rava dosa", "piece", 180, 3, 24, 8, 1],
  ["egg-dosa", "Egg dosa", "piece", 200, 9, 21, 9, 1],
  ["set-dosa", "Set dosa", "piece", 110, 2.5, 20, 2, 1],
  ["uttapam", "Onion uttapam", "piece", 190, 5, 30, 5, 2, "uthappam"],
  ["pesarattu", "Pesarattu", "piece", 160, 8, 22, 4, 4, "moong dosa"],
  ["appam", "Appam", "piece", 120, 2, 22, 2.5, 0.5],
  ["idiyappam", "Idiyappam", "piece", 70, 1, 15, 0.2, 0.4, "string hoppers"],
  ["puttu", "Puttu", "piece", 180, 3.5, 38, 1.5, 2],
  ["medu-vada", "Medu vada", "piece", 135, 4, 13, 7.5, 2, "uzhunnu vada ulundu vadai"],
  ["masala-vada", "Masala vada", "piece", 120, 5, 12, 6, 3, "paruppu vadai"],
  ["pongal", "Ven pongal", "katori", 250, 7, 33, 10, 1.5, "khara pongal"],
  ["upma", "Rava upma", "katori", 230, 5, 32, 9, 2],
  ["poha", "Poha", "katori", 200, 4, 33, 6, 1.5, "aval"],
  ["sabudana-khichdi", "Sabudana khichdi", "katori", 300, 3, 48, 11, 1],
  ["sabudana-vada", "Sabudana vada", "piece", 140, 1.5, 18, 7, 1],
  ["paratha", "Plain paratha", "piece", 180, 4, 24, 8, 2.5],
  ["aloo-paratha", "Aloo paratha", "piece", 260, 5, 36, 11, 3],
  ["gobi-paratha", "Gobi paratha", "piece", 230, 5, 30, 10, 3.5],
  ["paneer-paratha", "Paneer paratha", "piece", 290, 10, 30, 14, 2.5],
  ["thepla", "Methi thepla", "piece", 120, 3, 15, 5, 2],
  ["thalipeeth", "Thalipeeth", "piece", 200, 6, 28, 7, 4],
  ["puri", "Puri", "piece", 100, 1.5, 11, 5.5, 0.8, "poori"],
  ["chole-bhature", "Chole bhature", "plate", 450, 13, 55, 20, 8],
  ["moong-chilla", "Moong dal chilla", "piece", 120, 7, 15, 4, 3],
  ["besan-chilla", "Besan chilla", "piece", 150, 7, 15, 7, 3],
  ["dhokla", "Dhokla (2 pieces)", "piece", 150, 6, 22, 4, 2],
  ["bread-white", "White bread", "piece", 67, 2, 13, 0.8, 0.6, "slice"],
  ["bread-brown", "Brown bread", "piece", 65, 3, 11, 1, 1.8, "wheat bread slice"],
  ["toast-butter", "Bread toast with butter", "piece", 105, 2, 13, 5, 0.6],
  ["oats-milk", "Oats with milk", "katori", 180, 7, 27, 5, 3, "porridge"],
  ["cornflakes-milk", "Cornflakes with milk", "katori", 190, 6, 34, 3, 1, "cereal"],
  ["muesli", "Muesli", "g30", 115, 3, 20, 2.3, 2.3],
  ["oats-raw", "Rolled oats (dry)", "g30", 113, 4, 20, 2, 3],
  ["boiled-egg", "Boiled egg", "piece", 72, 6.3, 0.4, 4.8, 0, "egg"],
  ["egg-white", "Egg white", "piece", 17, 3.6, 0.2, 0, 0],
  ["omelette", "Omelette (2 eggs)", "piece", 190, 13, 2, 14, 0.3],
  ["egg-bhurji", "Egg bhurji (2 eggs)", "katori", 210, 13, 4, 16, 0.8, "scrambled egg podimas"],
  // Rice
  ["rice", "Rice, cooked", "cup", 195, 4, 43, 0.4, 0.6, "white rice sadam annam chawal"],
  ["brown-rice", "Brown rice, cooked", "cup", 180, 4, 37, 1.5, 2.7],
  ["curd-rice", "Curd rice", "katori", 200, 5, 30, 6, 0.7, "thayir sadam daddojanam"],
  ["lemon-rice", "Lemon rice", "katori", 250, 4, 38, 9, 1.2, "chitranna"],
  ["tamarind-rice", "Tamarind rice", "katori", 280, 4, 42, 10, 2, "puliyogare puliyodarai pulihora"],
  ["coconut-rice", "Coconut rice", "katori", 290, 4, 36, 14, 2.5],
  ["jeera-rice", "Jeera rice", "katori", 230, 4, 38, 6, 1],
  ["veg-pulao", "Veg pulao", "katori", 240, 5, 38, 7, 2.5],
  ["veg-biryani", "Veg biryani", "plate", 380, 8, 55, 13, 4],
  ["chicken-biryani", "Chicken biryani", "plate", 500, 24, 55, 19, 2],
  ["mutton-biryani", "Mutton biryani", "plate", 560, 24, 52, 26, 2],
  ["egg-biryani", "Egg biryani", "plate", 450, 16, 55, 17, 2],
  ["khichdi", "Dal khichdi", "katori", 200, 7, 32, 5, 3],
  ["bisibele-bath", "Bisi bele bath", "katori", 260, 7, 38, 8, 4],
  ["sweet-pongal", "Sweet pongal", "katori", 320, 5, 55, 9, 1.5, "sakkarai pongal"],
  ["veg-fried-rice", "Veg fried rice", "plate", 350, 7, 55, 11, 3],
  // Breads
  ["chapati", "Chapati", "piece", 100, 3, 18, 2, 2.5, "roti chappathi"],
  ["phulka", "Phulka", "piece", 75, 2.5, 15, 0.5, 2.5],
  ["naan", "Naan", "piece", 260, 8, 45, 5, 2],
  ["butter-naan", "Butter naan", "piece", 320, 8, 45, 11, 2],
  ["tandoori-roti", "Tandoori roti", "piece", 120, 4, 24, 1, 3],
  ["rumali-roti", "Rumali roti", "piece", 150, 4, 28, 2, 1],
  ["kerala-parotta", "Kerala parotta", "piece", 250, 5, 32, 11, 1.5, "porotta malabar"],
  ["kothu-parotta", "Kothu parotta", "plate", 480, 15, 50, 24, 3],
  ["bajra-roti", "Bajra roti", "piece", 110, 3, 20, 2, 3],
  ["jowar-roti", "Jowar roti", "piece", 110, 3, 22, 1, 3, "jolada rotti bhakri"],
  ["ragi-roti", "Ragi roti", "piece", 110, 3, 21, 2, 3.5],
  ["ragi-mudde", "Ragi mudde", "piece", 170, 4, 36, 0.8, 5, "ragi ball kali"],
  // Dals, curries, kuzhambu
  ["sambar", "Sambar", "katori", 105, 4.6, 14, 3, 3.6],
  ["rasam", "Rasam", "katori", 50, 1.5, 7, 2, 1, "saaru chaaru"],
  ["dal-tadka", "Dal tadka", "katori", 150, 7, 18, 5.5, 4, "dal"],
  ["dal-fry", "Dal fry", "katori", 160, 7, 19, 6, 4],
  ["moong-dal", "Moong dal (plain)", "katori", 120, 7, 17, 2.5, 3, "paruppu pappu"],
  ["dal-makhani", "Dal makhani", "katori", 260, 9, 24, 14, 6],
  ["rajma", "Rajma curry", "katori", 200, 9, 26, 7, 7],
  ["chole", "Chana masala", "katori", 220, 9, 28, 8, 8, "chole chickpea curry"],
  ["kadala-curry", "Kadala curry", "katori", 180, 8, 22, 6, 7],
  ["kadhi", "Kadhi", "katori", 150, 5, 12, 9, 0.5],
  ["mor-kuzhambu", "Mor kuzhambu", "katori", 110, 3, 8, 7, 1, "majjige huli"],
  ["vatha-kuzhambu", "Vatha kuzhambu", "katori", 140, 2, 12, 9, 2, "kara kuzhambu"],
  ["kootu", "Kootu", "katori", 140, 6, 15, 6, 4],
  ["keerai-kootu", "Keerai kootu", "katori", 110, 5, 10, 6, 4, "spinach dal palak"],
  ["avial", "Avial", "katori", 150, 3, 12, 10, 4],
  ["beans-poriyal", "Beans poriyal", "katori", 90, 2.5, 8, 5.5, 3.5, "thoran palya"],
  ["cabbage-poriyal", "Cabbage poriyal", "katori", 85, 2, 8, 5, 3, "thoran"],
  ["carrot-poriyal", "Carrot poriyal", "katori", 95, 1.5, 11, 5, 3.5],
  ["beetroot-poriyal", "Beetroot poriyal", "katori", 100, 2, 13, 4.5, 3],
  ["potato-roast", "Potato roast", "katori", 190, 3, 24, 9, 3, "aloo fry urulai"],
  ["bhindi-fry", "Bhindi fry", "katori", 120, 2.5, 9, 8, 4, "vendakkai okra ladies finger"],
  ["baingan-bharta", "Baingan bharta", "katori", 130, 3, 12, 8, 5, "brinjal eggplant"],
  ["aloo-gobi", "Aloo gobi", "katori", 150, 3.5, 15, 8, 4],
  ["mixed-veg", "Mixed veg curry", "katori", 140, 3.5, 13, 8, 4, "sabzi kurma"],
  ["veg-kurma", "Veg kurma", "katori", 180, 4, 14, 12, 4],
  ["palak-paneer", "Palak paneer", "katori", 260, 12, 9, 20, 3],
  ["paneer-butter-masala", "Paneer butter masala", "katori", 330, 12, 12, 26, 2],
  ["kadai-paneer", "Kadai paneer", "katori", 300, 12, 11, 23, 2.5],
  ["matar-paneer", "Matar paneer", "katori", 280, 12, 15, 19, 4],
  ["paneer-bhurji", "Paneer bhurji", "katori", 250, 14, 6, 19, 1],
  ["chicken-curry", "Chicken curry (home)", "katori", 250, 22, 6, 15, 1, "kozhi kulambu"],
  ["butter-chicken", "Butter chicken", "katori", 350, 24, 10, 24, 1.5],
  ["chettinad-chicken", "Chicken chettinad", "katori", 270, 22, 7, 17, 1.5],
  ["chicken-65", "Chicken 65", "g100", 290, 20, 12, 18, 0.5],
  ["tandoori-chicken", "Tandoori chicken (1 leg)", "piece", 250, 30, 4, 12, 0.5],
  ["grilled-chicken", "Grilled chicken breast", "g100", 165, 31, 0, 3.6, 0],
  ["mutton-curry", "Mutton curry", "katori", 320, 22, 6, 23, 1],
  ["keema", "Keema", "katori", 300, 20, 7, 21, 1.5],
  ["fish-curry", "Fish curry", "katori", 200, 18, 6, 11, 1, "meen kuzhambu"],
  ["fish-fry", "Fish fry", "piece", 220, 20, 6, 13, 0.3, "meen varuval"],
  ["prawn-masala", "Prawn masala", "katori", 200, 18, 7, 11, 1],
  ["egg-curry", "Egg curry (2 eggs)", "katori", 250, 13, 8, 18, 1.5],
  ["chilli-paneer", "Chilli paneer", "katori", 320, 14, 15, 23, 2],
  ["gobi-manchurian", "Gobi manchurian", "katori", 250, 4, 25, 15, 3],
  ["tomato-soup", "Tomato soup", "katori", 90, 2, 12, 4, 2],
  ["sweet-corn-soup", "Sweet corn soup", "katori", 110, 3, 20, 2, 2],
  ["chicken-soup", "Chicken clear soup", "katori", 60, 8, 3, 2, 0.5],
  // Sides
  ["curd", "Curd", "katori", 92, 5.3, 6.9, 4.8, 0, "yogurt dahi thayir mosaru"],
  ["greek-yogurt", "Greek yogurt", "g100", 60, 10, 3.6, 0.4, 0],
  ["raita", "Cucumber raita", "katori", 80, 4, 7, 4, 1],
  ["buttermilk", "Buttermilk", "glass", 40, 2, 4, 1.5, 0, "chaas majjiga mor neer"],
  ["coconut-chutney", "Coconut chutney", "tbsp", 54, 0.6, 2, 5, 1.2],
  ["tomato-chutney", "Tomato chutney", "tbsp", 30, 0.4, 3, 2, 0.5],
  ["mint-chutney", "Mint chutney", "tbsp", 10, 0.5, 1.5, 0.2, 0.5, "pudina green chutney"],
  ["peanut-chutney", "Peanut chutney", "tbsp", 60, 2.5, 2, 5, 0.8],
  ["podi", "Idli podi with oil", "tbsp", 80, 2.5, 5, 6, 2, "gunpowder milagai podi"],
  ["papad-roasted", "Papad, roasted", "piece", 35, 2.5, 6, 0.2, 1.5, "appalam pappadam"],
  ["papad-fried", "Papad, fried", "piece", 60, 2, 5, 3.5, 1],
  ["pickle", "Pickle", "tsp", 30, 0.2, 1, 3, 0.3, "achar oorugai"],
  ["green-salad", "Green salad", "katori", 30, 1.3, 6, 0.2, 2, "cucumber salad"],
  ["sprouts", "Sprouts salad", "katori", 110, 8, 17, 1, 5],
  ["ghee", "Ghee", "tsp", 45, 0, 0, 5, 0],
  ["butter", "Butter", "tsp", 34, 0, 0, 3.8, 0],
  ["oil", "Cooking oil", "tsp", 45, 0, 0, 5, 0],
  ["sugar", "Sugar", "tsp", 16, 0, 4, 0, 0],
  ["honey", "Honey", "tsp", 21, 0, 5.7, 0, 0],
  ["peanut-butter", "Peanut butter", "tbsp", 95, 4, 3, 8, 1],
  ["paneer", "Paneer", "g100", 265, 18, 1.2, 20.8, 0, "cottage cheese"],
  ["tofu", "Tofu", "g100", 144, 15, 3, 8.7, 2.3],
  // Snacks & street food
  ["samosa", "Samosa", "piece", 260, 4, 30, 14, 3],
  ["kachori", "Kachori", "piece", 190, 4, 20, 11, 2],
  ["onion-pakora", "Onion pakora (4 pieces)", "piece", 200, 4, 18, 12, 2.5, "pakoda bhaji"],
  ["bajji", "Bajji", "piece", 90, 1.5, 9, 5.5, 1, "bhajji"],
  ["murukku", "Murukku", "piece", 100, 2, 12, 5.5, 1, "chakli"],
  ["mixture", "Mixture", "g30", 160, 4, 13, 10, 2, "namkeen chivda"],
  ["bhel-puri", "Bhel puri", "plate", 250, 6, 40, 8, 4],
  ["pani-puri", "Pani puri (6 pieces)", "plate", 200, 4, 32, 6, 3, "golgappa gol gappa"],
  ["pav-bhaji", "Pav bhaji", "plate", 400, 10, 55, 16, 7],
  ["vada-pav", "Vada pav", "piece", 290, 6, 40, 12, 3],
  ["misal-pav", "Misal pav", "plate", 450, 15, 55, 18, 9],
  ["sundal", "Chana sundal", "katori", 160, 8, 24, 4, 7],
  ["roasted-chana", "Roasted chana", "g30", 110, 6, 18, 1.5, 5, "pottukadalai"],
  ["makhana", "Makhana, roasted", "g30", 110, 3, 20, 1, 4, "fox nuts"],
  ["peanuts", "Peanuts, roasted", "g30", 170, 7.5, 5, 14, 2.5, "groundnut kadalai"],
  ["almonds", "Almonds", "piece", 7, 0.25, 0.25, 0.6, 0.15, "badam"],
  ["cashews", "Cashews", "piece", 9, 0.3, 0.5, 0.7, 0.05, "kaju mundiri"],
  ["walnuts", "Walnut half", "piece", 13, 0.3, 0.3, 1.3, 0.1],
  ["dates", "Dates", "piece", 23, 0.2, 6, 0, 0.6, "khajur pericham"],
  ["marie-biscuit", "Marie biscuit", "piece", 25, 0.4, 4, 0.8, 0.1, "biscuit"],
  ["digestive-biscuit", "Digestive biscuit", "piece", 70, 1, 9.5, 3, 0.5, "biscuit"],
  ["cake", "Cake", "piece", 190, 2.5, 26, 9, 0.5, "slice pastry"],
  ["chocolate", "Chocolate (small bar)", "piece", 110, 1.5, 11, 6.5, 1],
  ["ice-cream", "Ice cream (1 scoop)", "piece", 125, 2, 14, 7, 0.3],
  ["maggi", "Instant noodles (1 pack)", "piece", 310, 7, 43, 12, 2.5, "maggi"],
  ["hakka-noodles", "Hakka noodles", "plate", 380, 8, 55, 14, 3, "chowmein"],
  ["veg-sandwich", "Veg sandwich", "piece", 220, 6, 30, 8, 3],
  ["cheese-sandwich", "Grilled cheese sandwich", "piece", 320, 12, 30, 17, 2],
  ["pizza", "Pizza slice", "piece", 270, 11, 33, 10, 2],
  ["veg-burger", "Veg burger", "piece", 350, 9, 45, 15, 3],
  ["fries", "French fries (medium)", "piece", 365, 4, 48, 17, 4],
  ["veg-momos", "Veg momos (6)", "plate", 250, 7, 40, 6, 2.5],
  ["chicken-momos", "Chicken momos (6)", "plate", 300, 15, 35, 10, 2],
  ["shawarma", "Chicken shawarma roll", "piece", 450, 25, 40, 20, 3],
  ["egg-roll", "Egg roll", "piece", 400, 14, 45, 18, 3, "kathi frankie"],
  // Sweets
  ["gulab-jamun", "Gulab jamun", "piece", 150, 2, 22, 6, 0.3],
  ["rasgulla", "Rasgulla", "piece", 110, 2, 23, 1.5, 0],
  ["jalebi", "Jalebi", "piece", 110, 0.5, 17, 4.5, 0],
  ["besan-laddu", "Besan laddu", "piece", 180, 3.5, 20, 10, 1, "ladoo"],
  ["boondi-laddu", "Boondi laddu", "piece", 185, 2.5, 24, 9, 0.5, "motichoor ladoo"],
  ["mysore-pak", "Mysore pak", "piece", 190, 2, 17, 13, 0.5],
  ["kaju-katli", "Kaju katli", "piece", 55, 1, 6, 3, 0.2, "barfi"],
  ["payasam", "Payasam", "katori", 220, 5, 32, 8, 0.5, "kheer"],
  ["rava-kesari", "Rava kesari", "katori", 300, 3, 45, 12, 0.5, "kesari bath sheera"],
  ["sooji-halwa", "Sooji halwa", "katori", 330, 4, 40, 17, 1],
  // Drinks
  ["filter-coffee", "Filter coffee", "mug", 90, 2.5, 11, 3.5, 0, "kaapi coffee"],
  ["tea", "Tea with milk", "mug", 80, 2, 11, 2.5, 0, "chai"],
  ["black-coffee", "Black coffee", "mug", 5, 0.3, 0, 0, 0],
  ["green-tea", "Green tea", "mug", 2, 0, 0, 0, 0],
  ["milk-toned", "Milk, toned", "glass", 120, 6, 9.4, 6, 0],
  ["milk-full", "Milk, full cream", "glass", 170, 6.5, 9.5, 12, 0],
  ["badam-milk", "Badam milk", "glass", 200, 6, 26, 8, 0.5],
  ["lassi", "Sweet lassi", "glass", 220, 6, 35, 6, 0],
  ["mango-lassi", "Mango lassi", "glass", 250, 6, 42, 6, 1],
  ["elaneer", "Tender coconut water", "piece", 45, 1.8, 9, 0.5, 2.6, "elanir elaneer ilaneer ilaneer tender coconut nariyal pani coconut water"],
  ["sugarcane-juice", "Sugarcane juice", "glass", 180, 0, 45, 0, 0, "karumbu"],
  ["orange-juice", "Fresh orange juice", "glass", 90, 1.5, 21, 0.4, 0.4],
  ["cola", "Soft drink (330 ml can)", "piece", 140, 0, 35, 0, 0, "coke pepsi soda"],
  ["beer", "Beer (330 ml)", "piece", 150, 1.6, 13, 0, 0],
  ["whey", "Whey protein (1 scoop, water)", "piece", 120, 24, 3, 1.5, 0.5, "protein shake"],
  // Fruit
  ["banana", "Banana", "piece", 105, 1.3, 27, 0.4, 3.1, "vazhaipazham kela"],
  ["apple", "Apple", "piece", 95, 0.5, 25, 0.3, 4.4],
  ["orange", "Orange", "piece", 62, 1.2, 15, 0.2, 3.1],
  ["guava", "Guava", "piece", 37, 1.4, 8, 0.5, 3, "koyya amrood"],
  ["chikoo", "Chikoo", "piece", 80, 0.5, 20, 1, 5, "sapota"],
  ["papaya", "Papaya", "cup", 62, 0.7, 16, 0.4, 2.5],
  ["mango", "Mango", "cup", 100, 1.4, 25, 0.6, 2.6],
  ["watermelon", "Watermelon", "cup", 46, 0.9, 11.5, 0.2, 0.6],
  ["grapes", "Grapes", "cup", 104, 1, 27, 0.2, 1.4],
  ["pineapple", "Pineapple", "cup", 82, 0.9, 22, 0.2, 2.3],
  ["pomegranate", "Pomegranate", "cup", 144, 3, 32, 2, 7, "anar"],
];

export const LOCAL_DISHES: FaFood[] = ROWS.map(([id, name, unit, kcal, protein, carbs, fat, fibre, aliases]) => ({
  key: `local:${id}`,
  name,
  source: "local" as const,
  baseLabel: UNIT_BASE[unit],
  base: { kcal, protein, carbs, fat, fibre },
  servings: UNIT_SERVINGS[unit],
  // search text only; stripped (stripSearch) before anything goes to the client
  _search: `${name} ${aliases ?? ""}`.toLowerCase(),
})) as (FaFood & { _search: string })[];

const byKey = new Map(LOCAL_DISHES.map((d) => [d.key, d]));
export function localDish(key: string): FaFood | undefined {
  return byKey.get(key);
}

/** Word-prefix match on name + aliases, name matches first. */
export function searchLocalDishes(q: string, limit = 12): FaFood[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored: { food: FaFood; score: number }[] = [];
  for (const d of LOCAL_DISHES as (FaFood & { _search: string })[]) {
    const words = d._search.split(/[^a-z0-9]+/);
    if (!terms.every((t) => words.some((w) => w.startsWith(t)))) continue;
    const nameHit = d.name.toLowerCase().startsWith(terms[0]) ? 0 : d.name.toLowerCase().includes(terms[0]) ? 1 : 2;
    scored.push({ food: d, score: nameHit });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map(({ food }) => stripSearch(food));
}

export function stripSearch(food: FaFood): FaFood {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _search, ...rest } = food as FaFood & { _search?: string };
  return rest;
}
