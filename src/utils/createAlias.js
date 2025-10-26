export const createAlias = (input) => {
  let shortId = Date.now().toString(36);

  // Check if the string contains at least one digit
  if (!/\d/.test(shortId)) {
    // Replace the middle character with a digit based on timestamp
    const middleIndex = Math.floor(shortId.length / 2);
    const digit = Math.floor(Date.now() / 1000) % 10;
    shortId =
      shortId.substring(0, middleIndex) +
      digit +
      shortId.substring(middleIndex + 1);
  }

  // Normalize to decompose diacritics (optional for Latin-based languages)
  let result = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Convert to lowercase (only affects Latin-based letters)
  result = result.toLowerCase();

  // Replace all punctuation/whitespace with hyphens
  result = result.replace(/[\s\p{P}\p{S}]+/gu, "-");

  // Remove leading/trailing hyphens
  result = result.replace(/^-+|-+$/g, "");

  return shortId + "-" + result;
};


export const updateAlias = (oldAlias, newTitle) => {
  // Extract shortId (the part before the first hyphen)
  const shortId = oldAlias.split("-")[0];

  // Normalize new title: remove diacritics (accents, etc.)
  let result = newTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Convert to lowercase (Latin-based)
  result = result.toLowerCase();

  // Replace all punctuation/whitespace with hyphens
  result = result.replace(/[\s\p{P}\p{S}]+/gu, "-");

  // Remove leading/trailing hyphens
  result = result.replace(/^-+|-+$/g, "");

  // Return old shortId + new normalized title
  return `${shortId}-${result}`;
};