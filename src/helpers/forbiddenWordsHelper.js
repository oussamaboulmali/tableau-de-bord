import prisma from "../configs/database.js";

class ForbiddenWordsService {
  constructor() {
    this.forbiddenWords = new Set();
    this.fieldMappings = {
      title: "titre",
      fulltext: "contenu",
      introtext: "introduction",
      tags: "étiquettes",
      description: "description",
      name: "nom",
      supTitle: "super titre",
    };
  }

  async loadForbiddenWords() {
    try {
      const words = await prisma.aps2024_forbiddenword.findMany({
        select: { word: true },
      });

      this.forbiddenWords = new Set(
        words.map((w) => w.word.toLowerCase().trim())
      );

      console.log(`Loaded ${this.forbiddenWords.size} forbidden words`);
      return this.forbiddenWords;
    } catch (error) {
      console.error("Error loading forbidden words:", error);
      throw error;
    }
  }

  // Normalize text for comparison (handles Arabic, Cyrillic, Latin scripts)
  normalizeText(text) {
    if (!text || typeof text !== "string") return "";

    return (
      text
        .toLowerCase()
        .trim()
        // Remove diacritics for Arabic
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        // Remove punctuation
        .replace(/[^\w\s\u0600-\u06FF\u0400-\u04FF]/g, " ")
    );
  }

  // Check if text contains forbidden words
  containsForbiddenWords(text) {
    if (!text) return [];

    const normalizedText = this.normalizeText(text);
    const words = normalizedText.split(/\s+/);
    const foundWords = [];

    // Check individual words
    for (const word of words) {
      if (word && this.forbiddenWords.has(word)) {
        foundWords.push(word);
      }
    }

    // Check for phrases (2-3 words combinations)
    for (let i = 0; i < words.length - 1; i++) {
      const twoWordPhrase = `${words[i]} ${words[i + 1]}`;
      if (this.forbiddenWords.has(twoWordPhrase)) {
        foundWords.push(twoWordPhrase);
      }

      if (i < words.length - 2) {
        const threeWordPhrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (this.forbiddenWords.has(threeWordPhrase)) {
          foundWords.push(threeWordPhrase);
        }
      }
    }

    return [...new Set(foundWords)]; // Remove duplicates
  }

  // Get French field name
  getLocalizedFieldName(fieldName) {
    return this.fieldMappings[fieldName] || fieldName;
  }

  // Add new forbidden word
  async addForbiddenWord(word, created_by) {
    try {
      const normalizedWord = this.normalizeText(word);
      if (!normalizedWord) return null;

      const forbiddenWord = await prisma.aps2024_forbiddenword.create({
        data: {
          word: normalizedWord,
          created_by,
        },
      });

      this.forbiddenWords.add(normalizedWord);
      return forbiddenWord;
    } catch (error) {
      if (error.code === "P2002") {
        throw new Error("Forbidden word already exists");
      }
      throw error;
    }
  }

  // Remove forbidden word
  async removeForbiddenWord(word) {
    try {
      const normalizedWord = this.normalizeText(word);
      await prisma.aps2024_forbiddenword.delete({
        where: { word: normalizedWord },
      });

      this.forbiddenWords.delete(normalizedWord);
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Reload forbidden words (useful for updates)
  async reloadForbiddenWords() {
    return await this.loadForbiddenWords();
  }
}

/* ---------- singleton export ---------- */
const forbiddenWordsService = new ForbiddenWordsService();

export default forbiddenWordsService;
