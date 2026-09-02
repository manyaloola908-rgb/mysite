// functions/create-checkout-session.js
// No npm packages required — talks to Stripe directly over HTTPS using fetch,
// so this works with plain Netlify drag-and-drop deploys.

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
        body: JSON.stringify({ error: 'Invalid plan selected' }),
      };
    }

    // Number of children — default to 1, clamp to a sane range
    let qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) qty = 1;
    if (qty > 10) qty = 10;

    const siteUrl = process.env.URL || 'http://localhost:8888';

    // Build the request body as URL-encoded form data (what Stripe's API expects)
    const params = new URLSearchParams();
    params.append('line_items[0][price]', PRICE_IDS[plan]);
    params.append('line_items[0][quantity]', String(qty));
    params.append('success_url', `${siteUrl}/success.html`);
    params.append('cancel_url', `${siteUrl}/cancel.html`);
    params.append('allow_promotion_codes', 'true');

    if (plan === 'full') {
      params.append('mode', 'payment');
    } else {
      params.append('mode', 'subscription');
      // Note: cancel_at can't be set during Checkout Session creation.
      // A webhook (checkout.session.completed) will set the auto-cancel
      // date on the subscription after it's created.
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe API error:', session);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: session.error?.message || 'Stripe request failed' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
