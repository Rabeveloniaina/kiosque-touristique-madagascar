export const mockAds = [
  {
    id: 1,
    title: {
      mg: "Vangio ny Tananan-dehibe Tranainy",
      fr: "Visitez la Haute-Ville Historique",
      en: "Explore the Historic Upper City"
    },
    subtitle: {
      mg: "Lova manan-tantara sy hatsaran-tarehy Betsileo",
      fr: "Un joyau d'architecture et de patrimoine classé",
      en: "A classified architectural and cultural heritage"
    },
    tag: "Patrimoine & Histoire",
    imageUrl: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1600&q=80",
    badge: "Incontournable"
  },
  {
    id: 2,
    title: {
      mg: "Ny Dite tokana eto Madagasikara",
      fr: "La Plantation de Thé de Sahambavy",
      en: "Sahambavy Tea Plantation"
    },
    subtitle: {
      mg: "Zaha-tany maitso sy fialan-tsasatra manodidina ny farihy",
      fr: "Dégustation et balade au bord du lac paisible",
      en: "Tasting and walking by the tranquil mountain lake"
    },
    tag: "Agrotourisme",
    imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1600&q=80",
    badge: "À 20 min du centre"
  },
  {
    id: 3,
    title: {
      mg: "Parikem-Pirenena Ranomafana",
      fr: "Parc National de Ranomafana",
      en: "Ranomafana Rainforest National Park"
    },
    subtitle: {
      mg: "Varika volamena, riandrano mahavariana ary hazoala mando",
      fr: "Observez le lémurien doré dans son sanctuaire naturel",
      en: "Spot the golden bamboo lemur in lush primary forest"
    },
    tag: "Biodiversité Unique",
    imageUrl: "https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1600&q=80",
    badge: "Patrimoine Mondial UNESCO"
  }
];

export const mockWeather = {
  city: "Fianarantsoa",
  temp: 23,
  condition: {
    mg: "Manome masoandro mahafinaritra",
    fr: "Ensoleillé avec brise légère",
    en: "Sunny with gentle mountain breeze"
  },
  humidity: "62%",
  wind: "14 km/h",
  altitude: "1 200 m"
};

export const mockSites = [
  {
    id: "haute_ville",
    name: "Haute-Ville (Vieille Ville)",
    category: "Patrimoine",
    rating: 4.8,
    lat: -21.4536,
    lng: 47.0858,
    desc: {
      fr: "Perchée sur la colline d'Ivone, avec ses maisons traditionnelles en briques rouges et ses 6 églises centenaires.",
      mg: "Eo an-tampon-kavoana, trano biriky gasy tranainy sy fiangonana manan-tantara miisa enina.",
      en: "Perched on Ivone hill, featuring 19th-century brick houses and historic hillside churches."
    }
  },
  {
    id: "ranomafana",
    name: "Parc National de Ranomafana",
    category: "Nature",
    rating: 4.9,
    lat: -21.2583,
    lng: 47.4208,
    desc: {
      fr: "Forêt tropicale humide abritant 12 espèces de lémuriens, cascades féeriques et thermes chauds.",
      mg: "Ala mando misy karazana varika 12, riandrano mahafinaritra ary loharano mafana.",
      en: "Lush tropical rainforest home to 12 lemur species, thermal springs, and scenic waterfalls."
    }
  },
  {
    id: "sahambavy",
    name: "Plantation de Thé Sahambavy",
    category: "Agrotourisme",
    rating: 4.7,
    lat: -21.4833,
    lng: 47.2167,
    desc: {
      fr: "350 hectares de champs de thé verdoyants ondulant sur les collines, avec usine de transformation ouverte à la visite.",
      mg: "Saha dite midadasika 350 hekitara, misy orinasa fanodinana azo tsidihina.",
      en: "Sprawling green tea hills over 350 hectares, factory tours, and a lakeside restaurant."
    }
  },
  {
    id: "gare_fce",
    name: "Ligne de Train FCE (Fianarantsoa - Côte Est)",
    category: "Aventure",
    rating: 4.6,
    lat: -21.4589,
    lng: 47.0833,
    desc: {
      fr: "Ligne ferroviaire mythique traversant 48 tunnels et 67 ponts à travers la falaise de l'Est jusqu'à Manakara.",
      mg: "Lalamby malaza mamakivaky tonelina 48 sy tetezana 67 mankany Manakara.",
      en: "Legendary jungle railway line spanning 48 tunnels and 67 bridges towards the Indian Ocean."
    }
  }
];

export const mockPhrases = [
  {
    fr: "Bonjour / Comment ça va ?",
    mg: "Manao ahoana ianao ? (Salama)",
    en: "Hello / How are you?",
    pronunciation: "Mah-now ow-nah"
  },
  {
    fr: "Merci beaucoup",
    mg: "Misaotra betsaka",
    en: "Thank you very much",
    pronunciation: "Mee-sow-trah bet-sah-kah"
  },
  {
    fr: "S'il vous plaît",
    mg: "Azafady",
    en: "Please / Excuse me",
    pronunciation: "Ah-zah-fah-dee"
  },
  {
    fr: "Combien ça coûte ?",
    mg: "Ohatrinona ity ?",
    en: "How much is this?",
    pronunciation: "Oo-ah-tree-noo-nah ee-tee"
  },
  {
    fr: "C'est délicieux !",
    mg: "Matsiro be !",
    en: "It's delicious!",
    pronunciation: "Mat-see-roo bay"
  },
  {
    fr: "Où se trouve... ?",
    mg: "Aiza ny... ?",
    en: "Where is...?",
    pronunciation: "Eye-zah nee"
  }
];

export const mockEmergency = [
  {
    name: "Police Centrale / Commissariat",
    number: "117 / +261 20 75 500 22",
    address: "Ampitakely, Fianarantsoa",
    icon: "ShieldAlert"
  },
  {
    name: "CHU Tambohobe (Urgences Médicales)",
    number: "+261 20 75 512 80",
    address: "Tambohobe, Fianarantsoa (24h/24)",
    icon: "Ambulance"
  },
  {
    name: "Sapeurs-Pompiers",
    number: "118 / +261 20 75 500 00",
    address: "Centre-ville",
    icon: "Flame"
  },
  {
    name: "Office Régional du Tourisme (ORTF)",
    number: "+261 20 75 506 67",
    address: "Gare ferroviaire FCE",
    icon: "Compass"
  }
];

export const mockPartners = [
  {
    name: "Vignobles Lazan'i Betsileo",
    type: "Vin & Cave locale",
    desc: "Vins rouge, blanc et gris issus du terroir de Fianarantsoa depuis 1971.",
    contact: "+261 20 75 502 11"
  },
  {
    name: "Hôtel & Restaurant Lac Hôtel Sahambavy",
    type: "Écolodge & Restauration",
    desc: "Bungalows sur pilotis au bord du lac, cuisine aux saveurs betsileo.",
    contact: "+261 34 02 048 55"
  },
  {
    name: "Papeterie Traditionnelle Antemoro",
    type: "Artisanat d'art",
    desc: "Fabrication de papier artisanal incrusté de fleurs naturelles séchées.",
    contact: "+261 32 40 123 45"
  }
];

