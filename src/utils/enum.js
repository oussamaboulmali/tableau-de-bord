export class BannerPosition {
  static POSITIONS = Object.freeze({
    "BANNIÈRE HAUT LA UNE": 1,
    "BANNIÈRE DROITE LA UNE": 2,
    "BANNIÈRE ÉVÉNEMENT": 3,
    "BANNIÈRE APRÈS LA UNE SECONDAIRE": 4,
    "BANNIÈRE APRÈS BLOC ACTUALITÉ": 5,
    "BANNIÈRE APRÈS BLOC DOSSIER": 6,
    "BANNIÈRE APRÈS BLOC VIDÉO": 7,
    "BANNIÈRE MENU CATÉGORIE": "MEGA_MENU",
    "BANNIÈRE LISTE ARTICLES CATÉGORIE": "ARTICLE_LIST",
  });

  static values() {
    return Object.values(this.POSITIONS);
  }

  static keys() {
    return Object.keys(this.POSITIONS);
  }

  static entries() {
    return Object.entries(this.POSITIONS).map(([key, value]) => ({
      [toSentenceCase(key)]: value,
    }));
  }

  static getKeyByValue(value) {
    return (
      Object.keys(this.POSITIONS).find(
        (key) => this.POSITIONS[key] === value
      ) || null
    );
  }
}

function toSentenceCase(str) {
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
