#!/usr/bin/env node
/**
 * NyumbaLink — Seed Script
 * Seeds the live API with realistic sample bookings and complaints.
 *
 * Usage:
 *   node seed-nyumbalink.js
 *   node seed-nyumbalink.js --dry-run     (preview only, no requests sent)
 *
 * Requirements: Node 18+ (uses built-in fetch)
 */

const BASE_URL = 'https://rentfinda-api-production.up.railway.app/api/v1';
const DRY_RUN  = process.argv.includes('--dry-run');

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function post(path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] POST ${path}`, JSON.stringify(body, null, 2));
    return { id: 'dry-run-id', ...body };
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(data.message ?? data)}`);
  }
  return data;
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(data.message ?? data)}`);
  return data;
}

// ── Sample data pools ─────────────────────────────────────────────────────────

const UGANDAN_NAMES = [
  'Sarah Nakato', 'Moses Ssemakula', 'Grace Atim', 'Brian Mugisha',
  'Fatuma Nabirye', 'Kenneth Okello', 'Annet Kyomugisha', 'David Tumusiime',
  'Josephine Akello', 'Patrick Ssebatta', 'Miriam Nankya', 'Geoffrey Nsubuga',
  'Esther Nambi', 'Ronald Kato', 'Immaculate Apio', 'Henry Wasswa',
  'Doreen Namusisi', 'Alex Muwonge', 'Christine Acayo', 'Emmanuel Ssali',
];

const UGANDAN_PHONES = [
  '+256701234567', '+256782345678', '+256753456789', '+256774567890',
  '+256700123456', '+256712345678', '+256793456789', '+256756789012',
  '+256771234567', '+256783456789', '+256704567890', '+256765432100',
  '+256720987654', '+256741234567', '+256799876543', '+256752345678',
];

const UGANDAN_EMAILS = [
  'sarah.nakato@gmail.com', 'moses.ssemakula@yahoo.com', 'grace.atim@outlook.com',
  'brian.mugisha@gmail.com', 'fatuma.nabirye@gmail.com', 'kenneth.okello@yahoo.com',
  null, null, null, null, // ~50% omit email (realistic)
];

const BOOKING_NOTES = [
  'I am a final year student at Makerere University. Can I view the room first?',
  'Looking for a quiet place to stay while working at Mulago Hospital.',
  'Moving from Gulu. Will need the place by end of month.',
  'Are utilities included in the rent? Please confirm before I proceed.',
  'I have two young children. Is the area safe and near a school?',
  'Can we negotiate the price slightly? I plan to stay for at least one year.',
  'I will be sharing with one friend. Is that allowed?',
  'I work night shifts — is the neighbourhood quiet during the day?',
  null, null, null, // some bookings have no notes
];

const COMPLAINT_DESCRIPTIONS = {
  PROPERTY_CONDITION: [
    'The roof has been leaking for over three weeks and the landlord is not responding to calls. During heavy rain the bedroom gets completely wet.',
    'There is a broken water pipe in the kitchen that has been ignored for over a month. Water pressure has dropped to almost nothing.',
    'The electrical wiring is exposed in two rooms and poses a serious safety hazard. Several socket outlets have stopped working.',
    'The toilet is blocked and sewage water is overflowing into the bathroom floor. This has been the case for five days now.',
    'The windows have no mosquito nets and the property has a serious termite infestation that is destroying the wooden furniture.',
  ],
  CONTACT_CONDUCT: [
    'The agent is demanding an extra two months deposit that was not mentioned when we signed the agreement.',
    'The property owner keeps entering the apartment without prior notice or permission, sometimes when I am asleep.',
    'Our agent has been completely unreachable for over three weeks. Calls go to voicemail and WhatsApp messages are ignored.',
    'The landlord is threatening to evict us without following proper legal notice, claiming we are "too noisy" with no evidence.',
    'The agent showed us a different unit from the one we ended up in. The actual room is smaller and has no window.',
  ],
  PRICING: [
    'The landlord increased rent by 40% with only one week notice, claiming "inflation". Our contract says changes require 3 months notice.',
    'We are being charged separately for water, security, and garbage collection which was supposed to be included in the agreed monthly rent.',
    'The property was listed on this app at UGX 450,000/month but the agent is demanding UGX 600,000 when we arrive to view.',
    'Extra charges were added to our final statement when moving out that were never mentioned in our tenancy agreement.',
  ],
  BOOKING: [
    'I submitted a booking request three weeks ago and have heard nothing. The property is now shown as unavailable on the app.',
    'My booking was confirmed but when I arrived on the move-in date the landlord said the property was already rented to someone else.',
    'I paid a viewing fee to the agent who promised to arrange a viewing "tomorrow" — that was two weeks ago and they have since blocked me.',
    'The cancellation process is unclear. I need to cancel my booking but there is no clear way to do so from the app.',
  ],
  GENERAL: [
    'I would like to report general disorganisation at the property. Multiple tenants share one water meter and the split is never transparent.',
    'The compound has become very unsafe at night. Security lighting has not worked for months and the guard was removed without notice.',
    'Garbage has not been collected from the compound in over a month. The smell is unbearable and attracting rodents.',
  ],
  APP_ISSUE: [
    'The property images are very outdated — the unit looks completely different in person from the photos on the app.',
    'I tried to submit a booking request but the app gave me an error: "Network request failed" even with good internet.',
    'The search filter for price range does not seem to work. All properties appear regardless of the max price I set.',
    'The app crashed twice when I tried to open the booking confirmation screen. I am using a Samsung Galaxy A32.',
  ],
  OTHER: [
    'I am not sure which category this falls under but I want to report that a property listed on this app appears to be a scam.',
    'There are multiple listings for the same property with different prices. This is confusing and misleading.',
  ],
};

// Date helpers
function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  NyumbaLink Seed Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (DRY_RUN) console.log('⚠️   DRY RUN — no data will be written\n');

  // ── Step 1: Fetch available properties ──────────────────────────────────────
  console.log('📋  Fetching available properties...');
  let properties = [];
  try {
    const result = await get('/properties?limit=50&status=AVAILABLE');
    properties = result.data ?? [];
    console.log(`    Found ${properties.length} properties\n`);
  } catch (err) {
    console.error('❌  Could not fetch properties:', err.message);
    process.exit(1);
  }

  if (properties.length === 0) {
    console.error('❌  No properties found. Please add some properties first, then re-run this script.');
    process.exit(1);
  }

  // Separate hostel and non-hostel properties
  const regularProps = properties.filter((p) => p.type !== 'HOSTEL');
  const hostelProps  = properties.filter((p) => p.type === 'HOSTEL');
  console.log(`    ${regularProps.length} regular | ${hostelProps.length} hostel\n`);

  // ── Step 2: Seed Bookings ───────────────────────────────────────────────────
  console.log('📅  Seeding bookings...');

  const bookingTargets = [];

  // Use regular properties for standard bookings
  for (const prop of regularProps.slice(0, Math.min(regularProps.length, 8))) {
    bookingTargets.push({ propertyId: prop.id, hostelRoomId: undefined, label: prop.title });
  }

  // For hostels, fetch available rooms and book those
  for (const hostel of hostelProps.slice(0, 3)) {
    try {
      const roomResult = await get(`/properties/${hostel.id}/rooms`);
      const availableRooms = (roomResult ?? []).filter((r) => r.status === 'AVAILABLE').slice(0, 2);
      for (const room of availableRooms) {
        bookingTargets.push({
          propertyId: hostel.id,
          hostelRoomId: room.id,
          label: `${hostel.title} — Room ${room.roomNumber}`,
        });
      }
    } catch (_) {
      // hostel might have no rooms yet, skip silently
    }
  }

  let bookingOk = 0, bookingFail = 0;

  for (const target of bookingTargets) {
    const name  = pick(UGANDAN_NAMES);
    const phone = pick(UGANDAN_PHONES);
    const email = pick(UGANDAN_EMAILS);

    const body = {
      renterName:  name,
      renterPhone: phone,
      propertyId:  target.propertyId,
      moveInDate:  pick([
        futureDate(7), futureDate(14), futureDate(21), futureDate(30),
        futureDate(45), futureDate(60),
      ]),
      notes: pick(BOOKING_NOTES) ?? undefined,
    };

    if (email)             body.renterEmail  = email;
    if (target.hostelRoomId) body.hostelRoomId = target.hostelRoomId;

    // ~30% have a move-out date
    if (Math.random() < 0.3) {
      const moveIn = new Date(body.moveInDate);
      moveIn.setMonth(moveIn.getMonth() + pick([6, 9, 12]));
      body.moveOutDate = moveIn.toISOString().split('T')[0];
    }

    try {
      await post('/bookings', body);
      console.log(`  ✅  Booking: ${name} → ${target.label}`);
      bookingOk++;
      await sleep(120); // be gentle with the API
    } catch (err) {
      console.log(`  ⚠️  Booking skipped (${target.label}): ${err.message}`);
      bookingFail++;
    }
  }

  console.log(`\n    Done: ${bookingOk} created, ${bookingFail} skipped\n`);

  // ── Step 3: Seed Complaints ─────────────────────────────────────────────────
  console.log('📣  Seeding complaints...');

  const allCategories = Object.keys(COMPLAINT_DESCRIPTIONS);
  const complaintsToCreate = [];

  // Property-linked complaints (use some of the fetched properties)
  const propsForComplaints = properties.slice(0, Math.min(properties.length, 10));
  for (const prop of propsForComplaints) {
    const category = pick(['PROPERTY_CONDITION', 'CONTACT_CONDUCT', 'PRICING', 'BOOKING']);
    complaintsToCreate.push({ propertyId: prop.id, category });
  }

  // App-level and general complaints (no property)
  for (let i = 0; i < 5; i++) {
    complaintsToCreate.push({
      propertyId: undefined,
      category: pick(['APP_ISSUE', 'GENERAL', 'OTHER']),
    });
  }

  let complaintOk = 0, complaintFail = 0;

  for (const c of complaintsToCreate) {
    const name  = pick(UGANDAN_NAMES);
    const phone = pick(UGANDAN_PHONES);
    const email = pick(UGANDAN_EMAILS);
    const descriptions = COMPLAINT_DESCRIPTIONS[c.category] ?? COMPLAINT_DESCRIPTIONS.GENERAL;

    const body = {
      submitterName:  name,
      submitterPhone: phone,
      category:       c.category,
      description:    pick(descriptions),
    };

    if (email)       body.submitterEmail = email;
    if (c.propertyId) body.propertyId    = c.propertyId;

    try {
      await post('/complaints', body);
      const propLabel = c.propertyId ? `property linked` : `no property`;
      console.log(`  ✅  Complaint [${c.category}] by ${name} (${propLabel})`);
      complaintOk++;
      await sleep(120);
    } catch (err) {
      console.log(`  ⚠️  Complaint skipped [${c.category}]: ${err.message}`);
      complaintFail++;
    }
  }

  console.log(`\n    Done: ${complaintOk} created, ${complaintFail} skipped\n`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉  Seeding complete!`);
  console.log(`    Bookings  : ${bookingOk} created`);
  console.log(`    Complaints: ${complaintOk} created`);
  console.log('');
  console.log('    Reload the admin dashboard to see the data:');
  console.log('    https://nyumba-link-swart.vercel.app/bookings');
  console.log('    https://nyumba-link-swart.vercel.app/complaints');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌  Unexpected error:', err);
  process.exit(1);
});