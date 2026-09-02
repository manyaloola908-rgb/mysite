// functions/create-checkout-session.js
// FINAL VERSION — live mode, no npm packages needed

const PRICE_IDS = {
  full: 'price_1UBIb4JV3cpnuuS3ZoexygPL',      // Pay in full: $1,250 (one-time) [LIVE]
  monthly: 'price_1UBIbeJV3cpnuuS30uXTV804',   // Monthly: $138.89 x 9 payments [LIVE]
  quarterly: 'price_1UBIbyJV3cpnuuS3RjGmK8ym', // Quarterly: $416.67 x 3 payments [LIVE]
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

    const params = new URLSearchParams();
    params.append('line_items[0][price]', PRICE_IDS[plan]);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${siteUrl}/success.html`);
    params.append('cancel_url', `${siteUrl}/cancel.html`);

    if (plan === 'full') {
      params.append('mode', 'payment');
    } else {
      params.append('mode', 'subscription');
      // cancel_at is set later by stripe-webhook.js after the subscription is created
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
