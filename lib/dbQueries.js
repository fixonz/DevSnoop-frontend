import { prisma } from './prisma.js';

// Token operations
export const tokenQueries = {
  // Create a new token record
  async create(tokenData) {
    return await prisma.token.create({
      data: tokenData
    });
  },

  // Get token by mint
  async getByMint(mint) {
    return await prisma.token.findUnique({
      where: { mint }
    });
  },

  // Update token
  async update(id, updates) {
    return await prisma.token.update({
      where: { id },
      data: updates
    });
  },

  // Get all tokens
  async getAll() {
    return await prisma.token.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
};

// Tracked tokens operations
export const trackedTokenQueries = {
  // Get all tracked tokens
  async getAll() {
    return await prisma.trackedToken.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  // Create a tracked token
  async create(data) {
    return await prisma.trackedToken.create({
      data
    });
  },

  // Get tracked token by address
  async getByAddress(tokenAddress) {
    return await prisma.trackedToken.findUnique({
      where: { tokenAddress }
    });
  },

  // Delete a tracked token
  async delete(tokenAddress) {
    return await prisma.trackedToken.delete({
      where: { tokenAddress }
    });
  }
};

// Chat message operations
export const chatMessageQueries = {
  // Create a chat message
  async create(messageData) {
    return await prisma.chatMessage.create({
      data: messageData
    });
  },

  // Get messages by token ID
  async getByTokenId(tokenId, limit = 100) {
    return await prisma.chatMessage.findMany({
      where: { tokenId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  },

  // Get messages by room ID
  async getByRoomId(roomId, limit = 100) {
    return await prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
};

// Wallet rating operations
export const walletRatingQueries = {
  // Create a wallet rating
  async create(ratingData) {
    return await prisma.walletRating.create({
      data: ratingData
    });
  },

  // Get wallet rating
  async getByAddresses(raterAddress, targetAddress) {
    return await prisma.walletRating.findUnique({
      where: {
        raterAddress_targetAddress: {
          raterAddress,
          targetAddress
        }
      }
    });
  },

  // Update wallet rating
  async update(raterAddress, targetAddress, updates) {
    return await prisma.walletRating.update({
      where: {
        raterAddress_targetAddress: {
          raterAddress,
          targetAddress
        }
      },
      data: updates
    });
  },

  // Get all ratings for a target wallet
  async getByTargetAddress(targetAddress) {
    return await prisma.walletRating.findMany({
      where: { targetAddress }
    });
  }
};

// Wallet reputation operations
export const walletReputationQueries = {
  // Create or update wallet reputation
  async upsert(walletAddress, reputationData) {
    return await prisma.walletReputation.upsert({
      where: { walletAddress },
      update: reputationData,
      create: {
        walletAddress,
        ...reputationData
      }
    });
  },

  // Get wallet reputation
  async getByAddress(walletAddress) {
    return await prisma.walletReputation.findUnique({
      where: { walletAddress }
    });
  },

  // Get top rated wallets
  async getTopRated(limit = 50) {
    return await prisma.walletReputation.findMany({
      orderBy: [
        { averageRating: 'desc' },
        { totalRatings: 'desc' }
      ],
      take: limit
    });
  }
};
