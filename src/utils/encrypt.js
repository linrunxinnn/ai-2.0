import CryptoJS from "crypto-js";

// const SECRET_KEY = import.meta.env.VITE_ENCRYPT_KEY;

// export function encryptData(data) {
//   try {
//     if (!data) return null;
//     const encrypted = CryptoJS.AES.encrypt(
//       data.toString(),
//       SECRET_KEY
//     ).toString();
//     return encrypted;
//   } catch (error) {
//     console.error("加密失败:", error);
//     return null;
//   }
// }

const SECRET_KEY = "1234567890123456"; // 16字节密钥（需与后端一致）

export function encryptData(data) {
  try {
    if (!data) return null;
    // 直接使用UTF-8密钥（确保长度16/24/32字节）
    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);

    // 生成随机IV（16字节）
    const iv = CryptoJS.lib.WordArray.random(16);

    // 加密（CBC模式 + PKCS7填充）
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 返回格式：Base64(IV + Ciphertext)
    const combined = iv.concat(encrypted.ciphertext);
    return combined.toString(CryptoJS.enc.Base64);
  } catch (error) {
    console.error("加密失败:", error);
    return null;
  }
}

export function decryptData(encryptedBase64Str) {
  try {
    if (!encryptedBase64Str) return null; // 处理空字符串或 null

    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
    const combinedWordArray = CryptoJS.enc.Base64.parse(encryptedBase64Str);

    // IV 长度是 16 字节，即 4 个 Word (一个 Word 是 4 字节)
    if (combinedWordArray.words.length < 4) {
      console.error("解密失败: 密文长度不足，无法提取 IV。");
      return null;
    }

    const iv = CryptoJS.lib.WordArray.create(
      combinedWordArray.words.slice(0, 4)
    );
    const ciphertext = CryptoJS.lib.WordArray.create(
      combinedWordArray.words.slice(4)
    );

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext,
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    console.log("Decrypted WordArray:", decrypted);
    console.log(
      "Decrypted String (UTF8):",
      decrypted.toString(CryptoJS.enc.Utf8)
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("解密失败:", error); // <-- 这里会打印错误
    return null;
  }
}
