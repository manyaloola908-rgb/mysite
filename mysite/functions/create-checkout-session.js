// functions/create-checkout-session.js
// FINAL VERSION — live mode, no npm packages needed

const PRICE_IDS = {
  full: 'price_1UBIb4JV3cpnuuS3ZoexygPL',      // Pay in full: $1,250 (one-time) [LIVE]
  monthly: 'price_1UBIbeJV3cpnuuS30uXTV8O4',   // Monthly: $138.89 x 9 payments [LIVE]
  quarterly: 'price_1UBIbyJV3cpnuuS3RjGmK8ym', // Quarterly: $416.67 x 3 payments [LIVE]
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan, quantity } = JSON.parse(event.body);

    if (!PRICE_IDS[plan]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid plan
