// function hashToAddress(hash) {
// 	const witnessPgrm = hash;
//   return Buffer.concat([
//     witnessPgrm,
//     Buffer.from([0x00]),
//   ]);
// }


// const compressedPublicKeyHash = Buffer.from(
// 	"ac16370f2596589439b80c567ed480de61163ecd",
// 	"hex"
// );

// console.log(hashToAddress(compressedPublicKeyHash));

const crypto = require("crypto");


function GenerateHash(input) {
  const hash = crypto.createHash("sha256");
  hash.update(input);
  return hash.digest("hex");
}

const inputString = 901_112_352_853_282_400n.toString();
const hashResult = GenerateHash(inputString);
console.log(`SHA-256 hash of "${inputString}": ${hashResult}`);