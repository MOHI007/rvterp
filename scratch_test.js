const url = 'https://jnbwcyvhwsukvgnbjxxt.supabase.co/functions/v1/verify-pin';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuYndjeXZod3N1a3ZnbmJqeHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjU3NDUsImV4cCI6MjEwNjEwMTc0NX0.8ngd6gRaQ_A9f28GL73eCEufnkhc74DnFn6ebVPOMS4';

async function test() {
  const ip = '10.0.0.' + Math.floor(Math.random()*255);
  console.log('Testing rate limit on verify-pin with IP ' + ip);
  for (let i = 1; i <= 6; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apikey}`, 'apikey': apikey, 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ pin: '0000' })
    });
    const body = await res.json();
    console.log(`Attempt ${i}: Status ${res.status} Body: ${JSON.stringify(body)}`);
  }
}
test();
