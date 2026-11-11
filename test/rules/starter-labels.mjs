// The 20 starter labels from spec section 8, with fixed ids so seeding is idempotent.
export const DAY = ['Muhurt Karane', 'Kelvan', 'Haldi & Mehendi (23 Jan)', 'Sangeet (23 Jan)', 'Wedding day (24 Jan)', 'Gruhapravesh', 'Satyanarayan', 'After the wedding'];
export const CAT = ['Rituals', 'Venue', 'Food', 'Attire', 'Jewellery', 'Decor', 'Photo/Video', 'Guests', 'Travel & Stay', 'Invitations', 'Payments', 'Legal'];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
export const labelId = (name) => `lbl-${slug(name)}`;

export const starterLabels = () => [
  ...DAY.map((name) => ({ id: labelId(name), name, group: 'day', color: 'gold' })),
  ...CAT.map((name) => ({ id: labelId(name), name, group: 'category', color: 'maroon' })),
];
