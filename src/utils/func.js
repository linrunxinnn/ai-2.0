export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

export async function formDataImagesToBase64Json(formData) {
  const files = formData.getAll("images");
  const base64Json = {};
  var imgs = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const base64 = await fileToBase64(file);
    imgs.push(base64);
  }

  return imgs;
}
