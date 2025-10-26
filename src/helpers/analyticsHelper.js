import prisma from "../configs/database.js";

class AnalyticsService {
  constructor() {
    this.prisma = prisma;
  }

  // Helper function to convert BigInt to string for JSON serialization
  convertBigIntToString(obj) {
    return JSON.parse(
      JSON.stringify(obj, (key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    );
  }

  async getDashboardStats(filters = {}) {
    try {
      const { startDate, endDate } = filters;
      const dateFilter = this.buildDateFilter(startDate, endDate);

      // Solution 1: Batch queries to reduce concurrent connections
      // Execute queries in smaller batches instead of all at once

      // Batch 1: Content statistics
      const [articlesStats, videosStats, dossiersStats, infographiesStats] =
        await Promise.all([
          this.getArticlesStats(dateFilter),
          this.getVideosStats(dateFilter),
          this.getDossiersStats(dateFilter),
          this.getInfographiesStats(dateFilter),
        ]);

      // Batch 2: More content statistics
      const [bannersStats, cahiersStats, galleriesStats, usersStats] =
        await Promise.all([
          this.getBannersStats(dateFilter),
          this.getCahiersStats(dateFilter),
          this.getGalleriesStats(dateFilter),
          this.getUsersStats(),
        ]);

      // Batch 3: User and session statistics
      const [subscribersStats, activeSessionsCount, activeSessions] =
        await Promise.all([
          this.getSubscribersStats(),
          this.getActiveSessionsCount(),
          this.getActiveSessions(),
        ]);

      // Batch 4: Top content (first half)
      const [topArticles, topVideos, topDossiers, topInfographies] =
        await Promise.all([
          this.getTopArticles(5),
          this.getTopVideos(5),
          this.getTopDossiers(5),
          this.getTopInfographies(5),
        ]);

      // Batch 5: Top content (second half) and counts
      const [topBanners, topCahiers, topGalleries, recentArticles] =
        await Promise.all([
          this.getTopBanners(5),
          this.getTopCahiers(5),
          this.getTopGalleries(5),
          this.getRecentArticles(10),
        ]);

      // Batch 6: Final counts
      const [categoriesCount, subCategoriesCount, tagsCount, totalImages] =
        await Promise.all([
          this.getCategoriesCount(),
          this.getSubCategoriesCount(),
          this.getTagsCount(),
          this.getTotalImages(),
        ]);

      // Calculate totals
      const totalContent =
        articlesStats.total +
        videosStats.total +
        dossiersStats.total +
        infographiesStats.total +
        bannersStats.total +
        cahiersStats.total +
        galleriesStats.total;

      const totalPublishedContent =
        articlesStats.published +
        videosStats.published +
        dossiersStats.published +
        infographiesStats.published +
        bannersStats.published +
        cahiersStats.published +
        galleriesStats.published;

      const totalViews =
        articlesStats.totalViews +
        videosStats.totalViews +
        dossiersStats.totalViews +
        infographiesStats.totalViews +
        bannersStats.totalViews +
        cahiersStats.totalViews +
        galleriesStats.totalViews;

      const result = {
        // Overview metrics
        overview: {
          totalContent,
          totalPublishedContent,
          totalViews,
          totalUsers: usersStats.total,
          activeUsers: usersStats.active,
          blockedUsers: usersStats.blocked,
          deactivatedUsers: usersStats.deactivated,
          totalSubscribers: subscribersStats.total,
          activeSubscribers: subscribersStats.active,
          blockedSubscribers: subscribersStats.blocked,
          deactivatedSubscribers: subscribersStats.deactivated,
          activeSessions: activeSessionsCount,
          totalCategories: categoriesCount,
          totalSubCategories: subCategoriesCount,
          totalTags: tagsCount,
          totalImages: totalImages,
        },

        // Content breakdown
        contentStats: {
          articles: articlesStats,
          videos: videosStats,
          dossiers: dossiersStats,
          infographies: infographiesStats,
          banners: bannersStats,
          cahiers: cahiersStats,
          galleries: galleriesStats,
        },

        // User statistics
        userStats: usersStats,
        subscriberStats: subscribersStats,

        sessionAcitve: activeSessions.map((user) => {
          const { aps2024_users, ...rest } = user;
          return {
            ...rest,
            username: aps2024_users.username,
            first_name: aps2024_users.first_name,
            last_name: aps2024_users.last_name,
          };
        }),

        // Top performing content
        topContent: {
          articles: topArticles.map((articles) => {
            const { aps2024_categories, aps2024_subCategories, ...rest } =
              articles;
            return {
              ...rest,
              categorie: aps2024_categories.name,
              subCategorie: aps2024_subCategories?.name || null,
            };
          }),
          videos: topVideos,
          dossiers: topDossiers,
          infographies: topInfographies,
          banners: topBanners,
          cahiers: topCahiers,
          galleries: topGalleries,
        },

        // Recent content
        recentContent: {
          articles: recentArticles.map((articles) => {
            const { aps2024_categories, aps2024_subCategories, ...rest } =
              articles;
            return {
              ...rest,
              categorie: aps2024_categories.name,
              subCategorie: aps2024_subCategories?.name || null,
            };
          }),
        },
      };

      return this.convertBigIntToString(result);
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch dashboard statistics");
    }
  }

  buildDateFilter(startDate, endDate) {
    const filter = {};
    if (startDate || endDate) {
      filter.created_date = {};
      if (startDate) filter.created_date.gte = new Date(startDate);
      if (endDate) filter.created_date.lte = new Date(endDate);
    }
    return filter;
  }

  // Solution 2: Optimize individual stat methods to use fewer connections
  async getArticlesStats(dateFilter) {
    // Use a single transaction to reduce connection usage
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, published, totalViews, publishedToday] = await Promise.all([
        tx.aps2024_articles.count({ where: dateFilter }),
        tx.aps2024_articles.count({
          where: { ...dateFilter, is_publish: true },
        }),
        tx.aps2024_articles.aggregate({
          _sum: { views: true },
          where: dateFilter,
        }),
        tx.aps2024_articles.count({
          where: {
            is_publish: true,
            publish_date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

      return {
        total,
        published,
        draft: total - published,
        totalViews: totalViews._sum.views || 0,
        publishedToday,
        avgViews:
          published > 0
            ? Math.round((totalViews._sum.views || 0) / published)
            : 0,
      };
    });

    return result;
  }

  async getVideosStats(dateFilter) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, published, totalViews] = await Promise.all([
        tx.aps2024_videos.count({ where: dateFilter }),
        tx.aps2024_videos.count({
          where: { ...dateFilter, is_publish: true },
        }),
        tx.aps2024_videos.aggregate({
          _sum: { views: true },
          where: dateFilter,
        }),
      ]);

      return {
        total,
        published,
        draft: total - published,
        totalViews: totalViews._sum.views || 0,
        avgViews:
          published > 0
            ? Math.round((totalViews._sum.views || 0) / published)
            : 0,
      };
    });

    return result;
  }

  async getDossiersStats(dateFilter) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, published, totalViews] = await Promise.all([
        tx.aps2024_dossiers.count({ where: dateFilter }),
        tx.aps2024_dossiers.count({
          where: { ...dateFilter, is_publish: true },
        }),
        tx.aps2024_dossiers.aggregate({
          _sum: { views: true },
          where: dateFilter,
        }),
      ]);

      return {
        total,
        published,
        draft: total - published,
        totalViews: totalViews._sum.views || 0,
        avgViews:
          published > 0
            ? Math.round((totalViews._sum.views || 0) / published)
            : 0,
      };
    });

    return result;
  }

  async getInfographiesStats(dateFilter) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, published, totalViews] = await Promise.all([
        tx.aps2024_infographies.count({ where: dateFilter }),
        tx.aps2024_infographies.count({
          where: { ...dateFilter, is_publish: true },
        }),
        tx.aps2024_infographies.aggregate({
          _sum: { views: true },
          where: dateFilter,
        }),
      ]);

      return {
        total,
        published,
        draft: total - published,
        totalViews: totalViews._sum.views || 0,
        avgViews:
          published > 0
            ? Math.round((totalViews._sum.views || 0) / published)
            : 0,
      };
    });

    return result;
  }

  async getBannersStats(dateFilter) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, published, totalViews] = await Promise.all([
        tx.aps2024_banners.count({ where: dateFilter }),
        tx.aps2024_banners.count({
          where: { ...dateFilter, is_publish: true },
        }),
        tx.aps2024_banners.aggregate({
          _sum: { views: true },
          where: dateFilter,
        }),
      ]);

      return {
        total,
        published,
        draft: total - published,
        totalViews: totalViews._sum.views || 0,
        avgViews:
          published > 0
            ? Math.round((totalViews._sum.views || 0) / published)
            : 0,
      };
    });

    return result;
  }

  async getCahiersStats(dateFilter) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, published, totalViews] = await Promise.all([
        tx.aps2024_cahiers_aps.count({ where: dateFilter }),
        tx.aps2024_cahiers_aps.count({
          where: { ...dateFilter, is_publish: true },
        }),
        tx.aps2024_cahiers_aps.aggregate({
          _sum: { views: true },
          where: dateFilter,
        }),
      ]);

      return {
        total,
        published,
        draft: total - published,
        totalViews: totalViews._sum.views || 0,
        avgViews:
          published > 0
            ? Math.round((totalViews._sum.views || 0) / published)
            : 0,
      };
    });

    return result;
  }

  async getGalleriesStats(dateFilter) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, published, totalViews] = await Promise.all([
        tx.aps2024_home_gallery.count({ where: dateFilter }),
        tx.aps2024_home_gallery.count({
          where: { ...dateFilter, is_publish: true },
        }),
        tx.aps2024_home_gallery.aggregate({
          _sum: { views: true },
          where: dateFilter,
        }),
      ]);

      return {
        total,
        published,
        draft: total - published,
        totalViews: totalViews._sum.views || 0,
        avgViews:
          published > 0
            ? Math.round((totalViews._sum.views || 0) / published)
            : 0,
      };
    });

    return result;
  }

  async getUsersStats() {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, active, blocked, deactivated, newUsersToday] =
        await Promise.all([
          tx.aps2024_users.count(),
          tx.aps2024_users.count({ where: { state: 1 } }),
          tx.aps2024_users.count({ where: { state: 2 } }),
          tx.aps2024_users.count({ where: { state: 0 } }),
          tx.aps2024_users.count({
            where: {
              register_date: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          }),
        ]);

      return {
        total,
        active,
        blocked,
        deactivated,
        newToday: newUsersToday,
      };
    });

    return result;
  }

  async getSubscribersStats() {
    const result = await this.prisma.$transaction(async (tx) => {
      const [total, active, blocked, deactivated, newSubscribersToday] =
        await Promise.all([
          tx.aps2024_subscriber.count(),
          tx.aps2024_subscriber.count({ where: { state: 1 } }),
          tx.aps2024_subscriber.count({ where: { state: 2 } }),
          tx.aps2024_subscriber.count({ where: { state: 0 } }),
          tx.aps2024_subscriber.count({
            where: {
              register_date: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          }),
        ]);

      return {
        total,
        active,
        blocked,
        deactivated,
        newToday: newSubscribersToday,
      };
    });

    return result;
  }

  async getActiveSessionsCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prisma.aps2024_sessions.count({
      where: {
        is_active: true,
        login_date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  async getActiveSessions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.prisma.aps2024_sessions.findMany({
      where: {
        is_active: true,
        login_date: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        id_user: true,
        login_date: true,
        aps2024_users: {
          select: {
            username: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  async getTopArticles(limit = 5) {
    return await this.prisma.aps2024_articles.findMany({
      select: {
        id_article: true,
        title: true,
        views: true,
        publish_date: true,
        aps2024_categories: {
          select: { name: true },
        },
        aps2024_subCategories: {
          select: { name: true },
        },
      },
      where: {
        is_publish: true,
        views: { gt: 0 },
      },
      orderBy: { views: "desc" },
      take: limit,
    });
  }

  async getTopVideos(limit = 5) {
    return await this.prisma.aps2024_videos.findMany({
      select: {
        id_video: true,
        name: true,
        views: true,
        publish_date: true,
      },
      where: {
        is_publish: true,
        views: { gt: 0 },
      },
      orderBy: { views: "desc" },
      take: limit,
    });
  }

  async getTopDossiers(limit = 5) {
    return await this.prisma.aps2024_dossiers.findMany({
      select: {
        id_dossier: true,
        name: true,
        views: true,
        publish_date: true,
      },
      where: {
        is_publish: true,
        views: { gt: 0 },
      },
      orderBy: { views: "desc" },
      take: limit,
    });
  }

  async getTopInfographies(limit = 5) {
    return await this.prisma.aps2024_infographies.findMany({
      select: {
        id_infographie: true,
        name: true,
        views: true,
        publish_date: true,
      },
      where: {
        is_publish: true,
        views: { gt: 0 },
      },
      orderBy: { views: "desc" },
      take: limit,
    });
  }

  async getTopBanners(limit = 5) {
    return await this.prisma.aps2024_banners.findMany({
      select: {
        id_banner: true,
        name: true,
        views: true,
        publish_date: true,
      },
      where: {
        is_publish: true,
        views: { gt: 0 },
      },
      orderBy: { views: "desc" },
      take: limit,
    });
  }

  async getTopCahiers(limit = 5) {
    return await this.prisma.aps2024_cahiers_aps.findMany({
      select: {
        id_cahier: true,
        name: true,
        views: true,
        publish_date: true,
      },
      where: {
        is_publish: true,
        views: { gt: 0 },
      },
      orderBy: { views: "desc" },
      take: limit,
    });
  }

  async getTopGalleries(limit = 5) {
    return await this.prisma.aps2024_home_gallery.findMany({
      select: {
        id_home_gallery: true,
        name: true,
        views: true,
        publish_date: true,
      },
      where: {
        is_publish: true,
        views: { gt: 0 },
      },
      orderBy: { views: "desc" },
      take: limit,
    });
  }

  async getRecentArticles(limit = 10) {
    return await this.prisma.aps2024_articles.findMany({
      select: {
        id_article: true,
        title: true,
        views: true,
        publish_date: true,
        aps2024_categories: {
          select: { name: true },
        },
        aps2024_subCategories: {
          select: { name: true },
        },
      },
      where: { is_publish: true },
      orderBy: { publish_date: "desc" },
      take: limit,
    });
  }

  async getCategoriesCount() {
    return await this.prisma.aps2024_categories.count({
      where: { state: true },
    });
  }

  async getSubCategoriesCount() {
    return await this.prisma.aps2024_subCategories.count({
      where: { state: true },
    });
  }

  async getTagsCount() {
    return await this.prisma.aps2024_tag.count();
  }

  async getTotalImages() {
    return await this.prisma.aps2024_images.count();
  }
}

const analyticsService = new AnalyticsService();
export default analyticsService;
