import  secp256k1 from "@savingsatoshi/secp256k1js";
// View the library source code
// https://github.com/saving-satoshi/secp256k1js/blob/main/secp256k1.js

const GE = secp256k1.GE;
const FE = secp256k1.FE;
const ORDER = secp256k1.ORDER;
// Message digest from step 9:
const msg_fe =
	0x73a16290e005b119b9ce0ceea52949f0bd4f925e808b5a54c631702d3fea1242n;

// Signature values from step 10:
const sig_r_fe =
	0x8bd06d50f4a4b2bba64ccfb68f011e8babcec06b1cc07741fe686159abef8d69n;
const sig_s_fe =
	0x3f0754da6e85699666c61e12707c45a037a5142f6a1b43e7014979a8c16d87c9n;

// Public key values
// Remember they need to be of the format new GE(new FE(x.hex()), new FE(y.hex())) to be read by verify()
const keys = [
	"04bbb554daf8811b95c8af5272fa8b4e2d6335bf19fff24d3187b8781497299aa4d27c900c367e4e506d671a4ea3aa50843f182a090d701f3bc8e6578d2455d81e",
	"04cc679cd88b28444049aa9db8f88864ace38f79ba6310d0d3f027c9462a9f420befaaf888ce372cbf6f0ece99e5ada86436c960c1c0840a588ea7dbd78187445d",
	"049d57ded01d3a7652a957cf86fd4c3d2a76e76e83d3c965e1dca45f1ee06630636b8bcbc3df3fbc9669efa2ccd5d7fa5a89fe1c0045684189f01ea915b8a746a6",
	"0461bfb73040740c12f57146b3a7f2ccfd75b6cd2a0d5df7a789cfaeb77bda4dcd222df570946cb6de62d6b1a939f55da85859f575e84ba86c67c4aa97d85ba516",
	"042a87d97397b2c43dff63670e38e78db159daa0e1070ec42181d0ed44a7d1aa508d42bd9759659c4a3194dea56da71325fb25acda6ee931cd8b93172b5d0f3c8f",
	"04d1cdabaea3be5d8161b93b7e20b0375cefee0a36259d654185555deff881406a421384e927328e2dcb5ed87103365ef3007bd31e12591e5d1c56c83516db26ec",
];

function verify(sig_r, sig_s, key, msg) {
	// Verify an ECDSA signature given a public key and a message.
	// All input values will be 32-byte BigInt()'s.
	// Start by creating a curve point representation of the public key
	// Next, check the range limits of the signature values
	if (sig_r == 0n || sig_r >= ORDER) {
		console.log("invalid r value");
		return false;
	}
	if (sig_s == 0n || sig_s >= ORDER) {
		console.log("invalid s value");
		return false;
	}
	// Helper function:
	// Find modular multiplicative inverse using Extended Euclidean Algorithm
	function invert(value, modulus = ORDER) {
		let x0 = 0n;
		let x1 = 1n;
		let a = value;
		let m = modulus;

		while (a > 1n) {
			const q = a / m;
			let t = m;
			m = a % m;
			a = t;
			t = x0;
			x0 = x1 - q * x0;
			x1 = t;
		}

		if (x1 < 0n) x1 += modulus;

		return x1;
	}

	const sig_s_inverted = invert(sig_s);
	const u1 = (msg * sig_s_inverted) % ORDER;
	const u2 = (sig_r * sig_s_inverted) % ORDER;
	const R = secp256k1.G.mul(u1).add(key.mul(u2));
	return R.x.equals(new FE(sig_r));
}

function verify_keys(keys) {
	// YOUR CODE HERE
	for (let i = 0; i < keys.length; i++) {
	// console.log("Verifying key ", keys[i]);
	const pubKey = keys[i].slice(2);
	const x0 = pubKey.slice(0, 64);
	const y0 = pubKey.slice(64, 128);
	const key_fe = new GE(new FE(BigInt("0x" + x0)), new FE(BigInt("0x" + y0)));
		if (key_fe) {
			const isValid = verify(sig_r_fe, sig_s_fe, key_fe, msg_fe);
			if (isValid) {
				return keys[i];
			}
		}
	}
	return null;
}

console.log("Verifying ECDSA signatures...", verify_keys(keys));