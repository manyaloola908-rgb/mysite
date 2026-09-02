// netlify/functions/create-checkout-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Your three Price IDs from Stripe
const PRICE_IDS = {
  full: 'price_1UAuWhJV3cpnuuS3lzrZ1xjz',      // Pay in full (one-time)
  monthly: 'price_1UAuWhJV3cpnuuS3psgc3BhS',   // Monthly, billed over 9 months
  quarterly: 'price_1UAuWhJV3cpnuuS31tKnWToi', // Quarterly, billed over 9 months
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { plan } = JSON.parse(event.body);

    if (!PRICE_IDS[plan]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid plan selected' }),
      };
    }

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const sessionConfig = {
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${siteUrl}/success.html`,
      cancel_url: `${siteUrl}/cancel.html`,
    };

    if (plan === 'full') {
      // One-time payment, no subscription involved
      sessionConfig.mode = 'payment';
    } else {
      // monthly or quarterly — both auto-stop after 9 months
      sessionConfig.mode = 'subscription';

      const cancelDate = new Date();
      cancelDate.setMonth(cancelDate.getMonth() + 9);

      sessionConfig.subscription_data = {
        cancel_at: Math.floor(cancelDate.getTime() / 1000),
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
