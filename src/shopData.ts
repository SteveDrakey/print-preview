export interface Product {
  name: string;
  url: string;
}

export interface Review {
  text: string;
  reviewer: string;
  stars: number;
}

export const PRODUCTS: Product[] = [
  { name: 'Shanghai Tower', url: 'https://www.etsy.com/listing/4296407975/shanghai-tower-3d-printed-skyscraper' },
  { name: 'Burj Khalifa', url: 'https://www.etsy.com/listing/1888876448/burj-khalifa-3d-printed-skyscraper-model' },
  { name: 'Willis Tower', url: 'https://www.etsy.com/listing/4298120344/willis-tower-full-colour-3d-printed' },
  { name: 'The Gherkin', url: 'https://www.etsy.com/listing/4297239042/the-gherkin-3d-printed-model' },
  { name: "St. Peter's Basilica", url: 'https://www.etsy.com/listing/4316928048/st-peters-basilica-square-3d-printed' },
  { name: 'San Francisco Downtown', url: 'https://www.etsy.com/listing/4389099813/san-francisco-downtown-3d-printed-city' },
  { name: 'Taipei 101', url: 'https://www.etsy.com/listing/1889436528/taipei-101-3d-printed-skyscraper-model' },
  { name: 'Merdeka 118', url: 'https://www.etsy.com/listing/1887980746/merdeka-118-3d-printed-skyscraper-model' },
  { name: 'Miniature Shanghai Cityscape', url: 'https://www.etsy.com/listing/1905119807/miniature-shanghai-3d-printed-cityscape' },
];

export const REVIEWS: Review[] = [
  {
    text: 'The printed model was exactly as described and met my expectations perfectly. For the price, you can\'t beat the quality.',
    reviewer: 'Verified Buyer',
    stars: 5,
  },
  {
    text: 'Wonderful customer service. Was in consistent contact with the seller. They were attentive, friendly and went above expectations.',
    reviewer: 'Verified Buyer',
    stars: 5,
  },
  {
    text: 'The item was a gift and arrived quickly. Recipient was very happy with it!',
    reviewer: 'Verified Buyer',
    stars: 5,
  },
];

export function getRandomProduct(): Product {
  return PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
}

export function getRandomReview(): Review {
  return REVIEWS[Math.floor(Math.random() * REVIEWS.length)];
}
