const validateInventoryProofs = (files = []) => {
  if (files.length !== 2) return 'Each donation requires exactly one document and one image.';
  let documents = 0;
  let images = 0;
  for (const file of files) {
    if (file?.size > 15 * 1024 * 1024) return 'Each proof file must be 15 MB or smaller.';
    const name = String(typeof file === 'string' ? file : file?.originalname || file?.name || '').split(/[?#]/)[0];
    if (/\.(pdf|doc|docx)$/i.test(name)) documents += 1;
    else if (/\.(jpg|jpeg|png|webp)$/i.test(name)) images += 1;
    else return 'Proofs must be PDF, DOC, DOCX, JPG, JPEG, PNG or WEBP files.';
  }
  return documents === 1 && images === 1 ? '' : 'Each donation requires exactly one document and one image.';
};
module.exports = { validateInventoryProofs };
