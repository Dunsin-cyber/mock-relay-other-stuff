import {
	SimplePool,
	finalizeEvent,
	generateSecretKey,
	getPublicKey,
	nip04,
} from "nostr-tools";
import { bytesToHex } from "@noble/hashes/utils";
import "websocket-polyfill";
import * as readline from "readline"; // Import readline for keyboard input

// Configuration: LIST ON BOTH RELAYS
const RELAYS = ["ws://localhost:7777","wss://relay.getalby.com/v1" ];

// Keys Setup
const walletSecretKey = generateSecretKey();
const walletSecretKeyHex = bytesToHex(walletSecretKey);
const walletPubKey = getPublicKey(walletSecretKey);

const clientSecretKey = generateSecretKey();
const clientSecretHex = bytesToHex(clientSecretKey);
const clientPubKey = getPublicKey(clientSecretKey); // Derived so we know who to encrypt for

console.log(`\n=== MOCK WALLET (REDUNDANT) STARTED ===`);
console.log(`Wallet Pubkey: ${walletPubKey}`);
console.log(`\nUse this connection string in your client:`);
console.log(
	`nostr+walletconnect://${walletPubKey}?relay=${RELAYS[0]}&relay=${RELAYS[1]}&secret=${clientSecretHex}\n`
);

const pool = new SimplePool();

// ====================================================
// 1. PUBLISH INFO EVENT
// ====================================================
const infoEvent = finalizeEvent(
	{
		kind: 13194,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["p", walletPubKey],
			["content-types", "text/plain"],
			["encryption", "nip04"],
		],
		// Add "notifications" to list of supported commands
		content:
			"pay_invoice pay_keysend get_info make_invoice lookup_invoice notifications",
	},
	walletSecretKey
);

Promise.allSettled(pool.publish(RELAYS, infoEvent)).then((results) => {
	const success = results.some((r) => r.status === "fulfilled");
	if (success) console.log(`✅ Info Event published.`);
	else console.error(`⚠️ Info Event failed on ALL relays.`);
});

// ====================================================
// 2. HELPER: SEND NOTIFICATIONS
// ====================================================
const sendNotification = async (type: "payment_received" | "payment_sent") => {
	console.log(`\n🔔 Mocking ${type}...`);

	// Random fake data
	const amount = Math.floor(Math.random() * 10000) * 1000; // Random msats
	const randomHash = bytesToHex(generateSecretKey()); // Just using random bytes for hash

	const notificationData = {
		notification_type: type,
		notification: {
			amount: amount,
			invoice: "lnbc" + randomHash, // Fake invoice string
			payment_hash: randomHash,
			preimage:
				type === "payment_sent"
					? "0000000000000000000000000000000000000000000000000000000000000000"
					: undefined,
		},
	};

	const encryptedContent = await nip04.encrypt(
		walletSecretKeyHex,
		clientPubKey, // Encrypt FOR the client
		JSON.stringify(notificationData)
	);

	const event = finalizeEvent(
		{
			kind: 23196, // NWC Response Kind
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				["p", clientPubKey], // Tag the client
			],
			content: encryptedContent,
		},
		walletSecretKey
	);

	await Promise.any(pool.publish(RELAYS, event));
	console.log(`✅ Notification Sent: ${amount / 1000} sats`);
};

// ====================================================
// 3. REQUEST HANDLER
// ====================================================
const handleRequest = async (event: any) => {
	if (event.kind !== 23194) return;
	console.log(`\n[Request Received] via relay ${event.relay || "unknown"}`);

	try {
		const decryptedContent = await nip04.decrypt(
			walletSecretKeyHex,
			event.pubkey,
			event.content
		);
		const request = JSON.parse(decryptedContent);
		console.log(`Method: ${request.method}`);

		// Mock Response
		let result = {};
		if (request.method === "pay_invoice" || request.method === "pay_keysend") {
			result = {
				preimage:
					"0000000000000000000000000000000000000000000000000000000000000000",
			};
		} else if (request.method === "get_info") {
			result = {
				methods: ["pay_invoice", "pay_keysend", "get_info", "notifications"],
				notifications: ["payment_received", "payment_sent"], // Advertise support
			};
		}

		const responseContent = JSON.stringify({
			result_type: request.method,
			result: result,
		});

		const encryptedResponse = await nip04.encrypt(
			walletSecretKeyHex,
			event.pubkey,
			responseContent
		);

		const responseEvent = finalizeEvent(
			{
				kind: 23195,
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					["p", event.pubkey],
					["e", event.id],
				],
				content: encryptedResponse,
			},
			walletSecretKey
		);

		await Promise.any(pool.publish(RELAYS, responseEvent));
		console.log(`[Response Sent] Success for ${request.method}`);
	} catch (error) {
		console.error("Failed to process request:", error);
	}
};

// 4. LISTEN ON *ALL* RELAYS
const sub = pool.subscribeMany(
	RELAYS,
	{
		kinds: [23194],
		"#p": [walletPubKey],
		since: Math.floor(Date.now() / 1000) - 60,
	},
	{
		onevent: handleRequest,
		oneose: () => console.log(`Listening on relays...`),
	}
);

// ====================================================
// 5. INTERACTIVE CLI COMMANDS
// ====================================================
//
console.log(`\n--- CONTROLS ---`);
console.log(`Press 'i' to simulate INCOMING payment (payment_received)`);
console.log(`Press 'o' to simulate OUTGOING payment (payment_sent)`);
console.log(`Press 'q' to quit\n`);

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on("keypress", async (str, key) => {
	if (key.ctrl && key.name === "c") process.exit();
	if (key.name === "q") {
		console.log("Exiting...");
		process.exit();
	}

	if (key.name === "i") {
		await sendNotification("payment_received");
	} else if (key.name === "o") {
		await sendNotification("payment_sent");
	}
});
