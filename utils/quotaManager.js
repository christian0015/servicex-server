// utils/quotaManager.js
const moment = require('moment');
const User = require('../models/User');

// 🔹 Définition des quotas
const DAILY_QUOTA = {
    free: 5,
    basic: 5,
    premium: 10
};

const PAID_QUOTA = {
    basic: 20,
    premium: 50
};

// 🔹 Coût des modèles payants
const MODEL_COST = {
    'claude-opus-4': 6,
    'claude-sonnet-4': 3,
    default: 1
};

/**
 * Vérifie si l'utilisateur a assez de quota pour générer
 * @param {string} userId 
 * @param {boolean} isPaidRequest 
 * @param {string} model 
 * @returns {Promise<{user: any, error: string|null}>}
 */
async function checkQuota(userId, isPaidRequest = false, model = 'default') {
    const user = await User.findById(userId);
    if (!user) return { user: null, error: "Utilisateur introuvable" };

    const today = moment().startOf('day');

    // 🔹 Reset daily si nouveau jour
    if (!user.lastReset || moment(user.lastReset).isBefore(today)) {
        user.dailyGenerations = 0; 
        user.lastReset = new Date();
    }

    // 🔹 Vérification quota journalier
    if (!isPaidRequest) {
        const dailyLimit = DAILY_QUOTA[user.subscription.type] || 5;
        if (user.dailyGenerations >= dailyLimit) {
            return { user, error: `Quota journalier atteint (${dailyLimit})` };
        }
        return { user, error: null };
    }

    // 🔹 Vérification quota payant
    const cost = MODEL_COST[model] || MODEL_COST.default;
    if (user.subscription.type === 'free') {
        return { user, error: "Compte gratuit: pas de quota payant disponible" };
    }

    const paidLimit = PAID_QUOTA[user.subscription.type] || 0;
    if (user.paidGenerations < cost) {
        return { user, error: `Quota payant insuffisant (${cost} nécessaire)` };
    }

    return { user, error: null };
}

/**
 * Applique la génération réussie sur l'utilisateur
 * @param {string} userId 
 * @param {boolean} isPaidRequest 
 * @param {string} model 
 * @returns {Promise<User>}
 */
async function applyQuota(userId, isPaidRequest = false, model = 'default') {
    const user = await User.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");


    // 🔹 Décrément payant si applicable
    if (isPaidRequest) {
        const cost = MODEL_COST[model] || MODEL_COST.default;
        user.paidGenerations -= cost;
        if (user.paidGenerations < 0) user.paidGenerations = 0;
    }else{
        // 🔹 Incrément journalier gratuit
        user.dailyGenerations += 1;
    }

    await user.save();
    return user;
}

module.exports = { checkQuota, applyQuota };
