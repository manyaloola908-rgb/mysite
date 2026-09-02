// functions/stripe-webhook.js
// Listens for completed Checkout Sessions. When a subscription (monthly or
// quarterly plan) was just created, this sets it to automatically cancel
// 9 months from now — so monthly plans stop after 9 payments and quarterly
// plans stop after 3 payments, without billing forever.
//
// No npm packages required — signature verification is done manually with
// Node's built-in crypto module, and the follow-up Stripe call uses fetch.

const crypto = require('crypto');

function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    throw new Error('Malformed Stripe-Signature header');
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error('Signature verification failed');
  }

  const eventAge = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (eventAge > 300) {
    throw new Error('Webhook timestamp too old');
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const signatureHeader = event.headers['stripe-signature'];
  const rawBody = event.body;

  try {
    verifyStripeSignature(rawBody, signatureHeader, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const stripeEvent = JSON.parse(rawBody);

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    if (session.mode === 'subscription' && session.subscription) {
      const cancelDate = new Date();
      cancelDate.setMonth(cancelDate.getMonth() + 9);
      const cancelAtTimestamp = Math.floor(cancelDate.getTime() / 1000);

      const params = new URLSearchParams();
      params.append('cancel_at', String(cancelAtTimestamp));

      try {
        const response = await fetch(
          `https://api.stripe.com/v1/subscriptions/${session.subscription}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          console.error('Failed to set cancel_at on subscription:', result);
        } else {
          console.log(`Subscription ${session.subscription} set to cancel at ${cancelDate.toISOString()}`);
        }
      } catch (err) {
        console.error('Error updating subscription:', err.message);
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
