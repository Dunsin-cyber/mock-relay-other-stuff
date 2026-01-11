function solveChallenge(privateKeyHex, secretMessageHex) {
    // 1. Clean the strings (remove '0x' if present)
    const key = privateKeyHex.replace(/^0x/, '');
    const msg = secretMessageHex.replace(/^0x/, '');

    // 2. Ensure we can loop through bytes (2 hex chars = 1 byte)
    let result = '';
    
    for (let i = 0; i < msg.length; i += 2) {
        // Get the byte from the key and the message
        // If the key is shorter than the message, we loop the key (modulo)
        const keyByte = parseInt(key.substring((i % key.length), (i % key.length) + 2), 16);
        const msgByte = parseInt(msg.substring(i, i + 2), 16);

        // 3. XOR them
        const xorResult = keyByte ^ msgByte;

        // 4. Convert to ASCII character
        result += String.fromCharCode(xorResult);
    }

    console.log("🔓 DECODED MESSAGE:", result);
}

// REPLACE THE VALUES BELOW
const myPrivateKey =
	"f7d758d7fcd9c20ec395b5bdac295c661022f222fbcef24d2465c4c8e0ab0eb0"; 
const secretMessage =
	"d7f778bf88adb27df9ba9ad9c55a3f096246dc459ce196064c52a39d95c139d7"; 

solveChallenge(myPrivateKey, secretMessage);