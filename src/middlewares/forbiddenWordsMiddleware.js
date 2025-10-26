import forbiddenWordsService from "../helpers/forbiddenWordsHelper.js";

export const forbiddenWordsMiddleware = (req, res, next) => {
  try {
    // Skip middleware for certain routes
    const skipRoutes = [
      "/api/v1/auth/login",
      "/api/v1/auth/close",
      "/api/v1/auth/resend",
      "/api/v1/auth/verifiy",
      "/api/v1/auth/logout",
      "/api/v1/auth/verifiy",
      "/api/v1/logs/",
      "/api/v1/logs/file",
      "/api/v1/logs/session",
      "/api/v1/logs/front",
    ];

    // Skip for GET requests (only check POST/PUT/PATCH)
    if (req.method === "GET" || req.method === "DELETE") {
      return next();
    }

    // Skip for specific routes
    if (skipRoutes.some((route) => req.path.startsWith(route))) {
      return next();
    }

    // Skip if no body or empty body
    if (!req.body || Object.keys(req.body).length === 0) {
      return next();
    }

    // Check if forbidden words are loaded
    if (forbiddenWordsService.forbiddenWords.size === 0) {
      return next();
    }

    // Default fields to check
    const fieldsToCheck = [
      "title",
      "fulltext",
      "introtext",
      "description",
      "tags",
      "name",
      "supTitle",
    ];
    const violations = [];

    // Check specified fields in request body
    for (const field of fieldsToCheck) {
      if (req.body[field]) {
        const forbiddenWords = forbiddenWordsService.containsForbiddenWords(
          req.body[field]
        );

        if (forbiddenWords.length > 0) {
          const localizedFieldName =
            forbiddenWordsService.getLocalizedFieldName(field);

          violations.push({
            field,
            localizedField: localizedFieldName,
            forbiddenWords,
            message: `Vous avez entré un mot interdit "${forbiddenWords.join(
              ", "
            )}" dans le champ ${localizedFieldName}`,
          });
        }
      }
    }

    if (violations.length > 0) {
      // Group violations by forbidden word
      const wordViolations = {};
      violations.forEach((violation) => {
        violation.forbiddenWords.forEach((word) => {
          if (!wordViolations[word]) {
            wordViolations[word] = [];
          }
          wordViolations[word].push(violation.localizedField);
        });
      });

      const wordCount = Object.keys(wordViolations).length;

      if (wordCount === 1) {
        // Single forbidden word
        const [word, fields] = Object.entries(wordViolations)[0];
        const uniqueFields = [...new Set(fields)];
        if (uniqueFields.length === 1) {
          return res.status(400).json({
            success: false,
            message: `Vous avez entré un mot interdit "${word}" dans le champ ${uniqueFields[0]}`,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: `Vous avez entré un mot interdit "${word}" dans les champs ${uniqueFields.join(
              ", "
            )}`,
          });
        }
      } else {
        // Multiple forbidden words - use generic message
        const allWords = [
          ...new Set(violations.flatMap((v) => v.forbiddenWords)),
        ];
        const allFields = [...new Set(violations.map((v) => v.localizedField))];
        return res.status(400).json({
          success: false,
          message: `Vous avez entré des mots interdits "${allWords.join(
            ", "
          )}" dans les champs ${allFields.join(", ")}`,
        });
      }
    }

    next();
  } catch (error) {
    console.error("Forbidden words middleware error:", error);
    next(error);
  }
};
