const mongoose = require('mongoose');
const Client = require('../../models/client.model');
const ServiceProvider = require('../../models/serviceProvider.model');

class SyncService {
  /**
   * Synchronisation atomique d'une vue de profil
   * @param {string} clientId - ID du client qui regarde
   * @param {string} providerId - ID du prestataire regardé
   * @param {number} duration - Durée de la consultation en secondes
   */
  async trackProfileView(clientId, providerId, duration = 0) {
    const session = await mongoose.startSession();
    
    try {
      let syncResult;
      await session.withTransaction(async () => {
        // 🔍 Vérification que les deux entités existent
        const [client, provider] = await Promise.all([
          Client.findById(clientId).session(session),
          ServiceProvider.findById(providerId).session(session)
        ]);

        if (!client) throw new Error(`Client ${clientId} non trouvé`);
        if (!provider) throw new Error(`Prestataire ${providerId} non trouvé`);

        // 🔄 Mise à jour synchronisée des deux côtés
        const [updatedClient, updatedProvider] = await Promise.all([
          // Mise à jour côté client
          Client.findByIdAndUpdate(
            clientId,
            { 
              $push: { 
                'activity.profilesViewed': {
                  providerId: providerId,
                  viewedAt: new Date(),
                  duration: duration
                }
              },
              $inc: { 'activity.stats.totalViews': 1 },
              $set: { 'activity.stats.lastActive': new Date() }
            },
            { session, new: true }
          ),
          
          // Mise à jour côté prestataire
          ServiceProvider.findByIdAndUpdate(
            providerId,
            {
              $inc: { 'profileStats.totalViews': 1 },
              $set: { 'lastViewed': new Date() }
            },
            { session, new: true }
          )
        ]);

        // 📊 Mise à jour des stats hebdomadaires du prestataire
        await this.updateWeeklyStats(providerId, clientId, session);

        syncResult = {
          client: updatedClient._id,
          provider: updatedProvider._id,
          duration: duration,
          timestamp: new Date()
        };
      });
      
      console.log(`✅ Vue synchronisée - Client:${clientId} → Provider:${providerId}`);
      return { success: true, data: syncResult };
      
    } catch (error) {
      console.error('❌ Erreur synchronisation vue:', error.message);
      throw new Error(`Échec synchronisation: ${error.message}`);
      
    } finally {
      await session.endSession();
    }
  }

  /**
   * Synchronisation d'un contact établi
   * @param {string} clientId - ID du client qui contacte
   * @param {string} providerId - ID du prestataire contacté
   * @param {string} serviceType - Type de service demandé
   */
  async trackContact(clientId, providerId, serviceType) {
    const session = await mongoose.startSession();
    
    try {
      let contactResult;
      await session.withTransaction(async () => {
        const [client, provider] = await Promise.all([
          Client.findById(clientId).session(session),
          ServiceProvider.findById(providerId).session(session)
        ]);

        if (!client || !provider) {
          throw new Error('Client ou prestataire non trouvé');
        }

        // 🎯 Vérification des limites pour les free users
        if (client.subscription.planType === 'free') {
          const canContact = await this.checkContactQuota(clientId, session);
          if (!canContact) {
            throw new Error('Quota de contacts hebdomadaire dépassé pour le plan free');
          }
        }

        // 📞 Création du contact synchronisé
        const [updatedClient, updatedProvider] = await Promise.all([
          // Côté client
          Client.findByIdAndUpdate(
            clientId,
            {
              $push: {
                'activity.contactsMade': {
                  providerId: providerId,
                  contactDate: new Date(),
                  serviceType: serviceType,
                  status: 'pending'
                }
              },
              $inc: { 'activity.stats.totalContacts': 1 },
              $set: { 'activity.stats.lastActive': new Date() }
            },
            { session, new: true }
          ),
          
          // Côté prestataire
          ServiceProvider.findByIdAndUpdate(
            providerId,
            {
              $inc: { 'contactCount': 1 },
              $push: {
                'profileStats.recentViews': {
                  clientId: clientId,
                  viewedAt: new Date(),
                  ledToContact: true
                }
              }
            },
            { session, new: true }
          )
        ]);

        contactResult = {
          client: updatedClient._id,
          provider: updatedProvider._id,
          serviceType: serviceType,
          contactDate: new Date(),
          status: 'pending'
        };
      });
      
      console.log(`✅ Contact synchronisé - Client:${clientId} → Provider:${providerId}`);
      return { success: true, data: contactResult };
      
    } catch (error) {
      console.error('❌ Erreur synchronisation contact:', error.message);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Vérifie le quota de contacts pour les free users
   * @param {string} clientId - ID du client
   * @param {object} session - Session MongoDB
   */
  async checkContactQuota(clientId, session) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const client = await Client.findById(clientId).session(session);
    const recentContacts = client.activity.contactsMade.filter(contact => 
      contact.contactDate >= oneWeekAgo
    );
    
    return recentContacts.length < 5; // 5 contacts/semaine max
  }

  /**
   * Met à jour les stats hebdomadaires du prestataire
   * @param {string} providerId - ID du prestataire
   * @param {string} clientId - ID du client
   * @param {object} session - Session MongoDB
   */
  async updateWeeklyStats(providerId, clientId, session) {
    const provider = await ServiceProvider.findById(providerId).session(session);
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekNumber = this.getWeekNumber(now);

    let weekStat = provider.profileStats.weeklyViews.find(w => 
      w.weekStart.getTime() === weekStart.getTime()
    );

    if (!weekStat) {
      weekStat = {
        weekStart: weekStart,
        weekNumber: weekNumber,
        viewCount: 0,
        uniqueViewers: 0
      };
      provider.profileStats.weeklyViews.unshift(weekStat);
      
      // Garder seulement les 52 dernières semaines
      if (provider.profileStats.weeklyViews.length > 52) {
        provider.profileStats.weeklyViews = provider.profileStats.weeklyViews.slice(0, 52);
      }
    }

    weekStat.viewCount += 1;

    // Compter les viewers uniques pour la semaine
    const uniqueViewersThisWeek = new Set(
      provider.profileStats.recentViews
        .filter(view => this.getWeekStart(view.viewedAt).getTime() === weekStart.getTime())
        .map(view => view.clientId.toString())
    );
    weekStat.uniqueViewers = uniqueViewersThisWeek.size;

    await provider.save({ session });
  }

  /**
   * Calcule le début de la semaine (lundi)
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  /**
   * Calcule le numéro de semaine
   */
  getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }
}

module.exports = new SyncService();