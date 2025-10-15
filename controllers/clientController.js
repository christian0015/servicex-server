const Client = require('../models/client.model');
const ServiceProvider = require('../models/serviceProvider.model');
const syncService = require('../services/analytics/syncService');
const statsService = require('../services/analytics/statsService');
const recommendationService = require('../services/analytics/recommendationService');
const notificationService = require('../services/notifications/notificationService');
const emailService = require('../services/notifications/emailService');

class ClientController {
  
  /**
   * 🎯 Récupérer le profil complet d'un client
   */
  async getClientProfile(req, res) {
    try {
      const clientId = req.params.id || req.user.id;
      
      const client = await Client.findById(clientId)
        .select('-__v') // Exclure le champ version de MongoDB
        .populate('activity.contactsMade.providerId', 'fullName profilePhoto services rating')
        .populate('activity.profilesViewed.providerId', 'fullName profilePhoto services')
        .populate('favorites.providerId', 'fullName profilePhoto services rating zones')
        .populate('searchHistory.savedResults.providerId', 'fullName profilePhoto services');
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      res.json({
        success: true,
        data: {
          profile: client,
          stats: {
            totalContacts: client.activity.stats.totalContacts,
            totalViews: client.activity.stats.totalViews,
            favoriteCount: client.favorites.length,
            memberSince: client.createdAt
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération profil client:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération du profil'
      });
    }
  }

  /**
   * ✏️ Mettre à jour le profil client
   */
  async updateClientProfile(req, res) {
    try {
      const clientId = req.params.id || req.user.id;
      const updates = req.body;
      
      // Champs autorisés pour la mise à jour
      const allowedUpdates = [
        'fullName', 'email', 'profilePhoto', 'address', 
        'preferences', 'behavioralPreferences'
      ];
      
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });
      
      const client = await Client.findByIdAndUpdate(
        clientId,
        { 
          ...filteredUpdates,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).select('-__v');
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      res.json({
        success: true,
        message: 'Profil mis à jour avec succès',
        data: client
      });
      
    } catch (error) {
      console.error('❌ Erreur mise à jour profil client:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Données de validation invalides',
          errors: Object.values(error.errors).map(e => e.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour du profil'
      });
    }
  }

  /**
   * 📊 Récupérer les statistiques détaillées d'un client
   */
  async getClientStats(req, res) {
    try {
      const clientId = req.params.id || req.user.id;
      
      const stats = await statsService.getClientStats(clientId);
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération stats client:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des statistiques'
      });
    }
  }

  /**
   * 🔍 Rechercher des prestataires de service
   */
  async searchProviders(req, res) {
    try {
      const clientId = req.user.id;
      const {
        query = '',
        serviceType,
        zone,
        minRating = 0,
        maxPrice,
        availability,
        page = 1,
        limit = 20,
        sortBy = 'rating'
      } = req.query;
      
      // Construction de la requête de recherche
      const searchQuery = {
        isActive: true,
        'rating.average': { $gte: parseFloat(minRating) }
      };
      
      // Filtre par type de service
      if (serviceType) {
        searchQuery['services.label'] = new RegExp(serviceType, 'i');
      }
      
      // Filtre par zone
      if (zone) {
        searchQuery['zones'] = new RegExp(zone, 'i');
      }
      
      // Filtre par prix maximum
      if (maxPrice) {
        searchQuery['services.price'] = { $lte: parseFloat(maxPrice) };
      }
      
      // Filtre par disponibilité
      if (availability) {
        searchQuery['availability.day'] = availability;
      }
      
      // Recherche textuelle
      if (query) {
        searchQuery.$or = [
          { fullName: new RegExp(query, 'i') },
          { description: new RegExp(query, 'i') },
          { 'services.label': new RegExp(query, 'i') }
        ];
      }
      
      // Options de tri
      const sortOptions = {};
      switch (sortBy) {
        case 'rating':
          sortOptions['rating.average'] = -1;
          break;
        case 'views':
          sortOptions['profileStats.totalViews'] = -1;
          break;
        case 'price':
          sortOptions['services.price'] = 1;
          break;
        case 'name':
          sortOptions['fullName'] = 1;
          break;
        default:
          sortOptions['rating.average'] = -1;
      }
      
      // Exécution de la recherche
      const providers = await ServiceProvider.find(searchQuery)
        .sort(sortOptions)
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select('fullName profilePhoto rating services zones availability description profileStats currentStatus');
      
      const totalResults = await ServiceProvider.countDocuments(searchQuery);
      
      // Sauvegarde de l'historique de recherche
      if (query || serviceType || zone) {
        await Client.findByIdAndUpdate(clientId, {
          $push: {
            searchHistory: {
              query: query || `${serviceType || ''} ${zone || ''}`.trim(),
              filters: { serviceType, zone, minRating, maxPrice },
              resultsCount: providers.length,
              searchedAt: new Date()
            }
          }
        });
      }
      
      res.json({
        success: true,
        data: {
          providers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalResults,
            totalPages: Math.ceil(totalResults / parseInt(limit))
          },
          filters: {
            query,
            serviceType,
            zone,
            minRating,
            maxPrice,
            availability
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur recherche prestataires:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la recherche'
      });
    }
  }

  /**
   * 🧠 Obtenir des recommandations personnalisées
   */
  async getRecommendations(req, res) {
    try {
      const clientId = req.params.id || req.user.id;
      const { limit = 10, includeExplanation = false, type = 'personalized' } = req.query;
      
      let recommendations;
      
      if (type === 'trending') {
        recommendations = await recommendationService.getTrendingRecommendations(parseInt(limit));
      } else {
        recommendations = await recommendationService.getPersonalizedRecommendations(
          clientId, 
          { 
            limit: parseInt(limit), 
            includeExplanation: includeExplanation === 'true' 
          }
        );
      }
      
      res.json(recommendations);
      
    } catch (error) {
      console.error('❌ Erreur recommandations client:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la génération des recommandations'
      });
    }
  }

  /**
   * 👁️ Track une vue de profil prestataire
   */
  async trackProfileView(req, res) {
    try {
      const clientId = req.user.id;
      const { providerId, duration = 0 } = req.body;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          message: 'ID prestataire requis'
        });
      }
      
      const result = await syncService.trackProfileView(clientId, providerId, parseInt(duration));
      
      res.json(result);
      
    } catch (error) {
      console.error('❌ Erreur tracking vue profil:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du tracking de la vue'
      });
    }
  }

  /**
   * 📞 Contacter un prestataire
   */
  async contactProvider(req, res) {
    try {
      const clientId = req.user.id;
      const { providerId, serviceType, message } = req.body;
      
      if (!providerId || !serviceType) {
        return res.status(400).json({
          success: false,
          message: 'ID prestataire et type de service requis'
        });
      }
      
      // Vérifier si le client peut contacter (limites free users)
      const client = await Client.findById(clientId);
      if (!client.canMakeContact()) {
        return res.status(429).json({
          success: false,
          message: 'Limite de contacts hebdomadaire atteinte. Passez premium pour des contacts illimités.'
        });
      }
      
      const provider = await ServiceProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }
      
      // Synchronisation du contact
      const contactResult = await syncService.trackContact(clientId, providerId, serviceType);
      
      // Notification au prestataire
      await notificationService.notifyNewContact(providerId, client, serviceType);
      
      // 📧 Email au prestataire (avec gestion d'erreur)
      try {
        await emailService.sendNewContactNotification(provider, client, serviceType);
      } catch (emailError) {
        console.log('⚠️ Email notification prestataire échoué:', emailError.message);
        // Ne pas bloquer le processus
      }
      
      // 📧 Notification de confirmation au client (avec gestion d'erreur)
      try {
        await emailService.sendContactConfirmation(client, provider, serviceType);
      } catch (emailError) {
        console.log('⚠️ Email confirmation client échoué:', emailError.message);
        // Ne pas bloquer le processus
      }
      
      res.json({
        success: true,
        message: 'Demande de contact envoyée avec succès',
        data: {
          contact: contactResult.data,
          provider: {
            name: provider.fullName,
            phone: provider.phoneNumber,
            expectedResponse: 'sous 24 heures'
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur contact prestataire:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'envoi du contact'
      });
    }
  }

  /**
   * ⭐ Ajouter un prestataire aux favoris
   */
  async addToFavorites(req, res) {
    try {
      const clientId = req.user.id;
      const { providerId, notes } = req.body;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          message: 'ID prestataire requis'
        });
      }
      
      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      // Vérifier si déjà en favoris
      const alreadyFavorite = client.favorites.some(fav => 
        fav.providerId.toString() === providerId
      );
      
      if (alreadyFavorite) {
        return res.status(409).json({
          success: false,
          message: 'Prestataire déjà dans les favoris'
        });
      }
      
      await client.addToFavorites(providerId, notes);
      
      res.json({
        success: true,
        message: 'Prestataire ajouté aux favoris',
        data: {
          favoritesCount: client.favorites.length + 1
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur ajout favoris:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'ajout aux favoris'
      });
    }
  }

  /**
   * 🗑️ Retirer un prestataire des favoris
   */
  async removeFromFavorites(req, res) {
    try {
      const clientId = req.user.id;
      const { providerId } = req.params;
      
      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      client.favorites = client.favorites.filter(fav => 
        fav.providerId.toString() !== providerId
      );
      
      await client.save();
      
      res.json({
        success: true,
        message: 'Prestataire retiré des favoris',
        data: {
          favoritesCount: client.favorites.length
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur suppression favoris:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression des favoris'
      });
    }
  }

  /**
   * 📋 Récupérer la liste des favoris
   */
  async getFavorites(req, res) {
    try {
      const clientId = req.user.id;
      
      const client = await Client.findById(clientId)
        .populate('favorites.providerId', 'fullName profilePhoto services rating zones description currentStatus');
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      res.json({
        success: true,
        data: {
          favorites: client.favorites,
          total: client.favorites.length
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération favoris:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des favoris'
      });
    }
  }

  /**
   * 🔔 Récupérer les notifications du client
   */
  async getNotifications(req, res) {
    try {
      const clientId = req.user.id;
      const { page = 1, limit = 20, unreadOnly = false } = req.query;
      
      const result = await notificationService.getUserNotifications(
        clientId, 
        'Client', 
        {
          page: parseInt(page),
          limit: parseInt(limit),
          unreadOnly: unreadOnly === 'true'
        }
      );
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des notifications'
      });
    }
  }

  /**
   * ✅ Marquer une notification comme lue
   */
  async markNotificationAsRead(req, res) {
    try {
      const clientId = req.user.id;
      const { notificationId } = req.params;
      
      const notification = await notificationService.markAsRead(notificationId, clientId);
      
      res.json({
        success: true,
        message: 'Notification marquée comme lue',
        data: notification
      });
      
    } catch (error) {
      console.error('❌ Erreur marquage notification:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du marquage de la notification'
      });
    }
  }

  /**
   * 📝 Mettre à jour les préférences du client
   */
  async updatePreferences(req, res) {
    try {
      const clientId = req.user.id;
      const { notifications, language, preferredZones, budgetRange } = req.body;
      
      const client = await Client.findByIdAndUpdate(
        clientId,
        {
          $set: {
            'preferences.notifications': notifications,
            'preferences.language': language,
            'preferences.preferredZones': preferredZones,
            'preferences.budgetRange': budgetRange,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).select('preferences');
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      res.json({
        success: true,
        message: 'Préférences mises à jour avec succès',
        data: client.preferences
      });
      
    } catch (error) {
      console.error('❌ Erreur mise à jour préférences:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour des préférences'
      });
    }
  }

  /**
   * 📈 Récupérer l'historique d'activité
   */
  async getActivityHistory(req, res) {
    try {
      const clientId = req.user.id;
      const { type = 'all', limit = 50 } = req.query; // 'contacts', 'views', 'all'
      
      const client = await Client.findById(clientId)
        .populate('activity.contactsMade.providerId', 'fullName profilePhoto services')
        .populate('activity.profilesViewed.providerId', 'fullName profilePhoto services')
        .select('activity');
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      let activity = [];
      
      switch (type) {
        case 'contacts':
          activity = client.activity.contactsMade.slice(0, parseInt(limit));
          break;
        case 'views':
          activity = client.activity.profilesViewed.slice(0, parseInt(limit));
          break;
        case 'all':
        default:
          // Combiner et trier par date
          const allActivity = [
            ...client.activity.contactsMade.map(c => ({ ...c.toObject(), type: 'contact' })),
            ...client.activity.profilesViewed.map(v => ({ ...v.toObject(), type: 'view' }))
          ];
          activity = allActivity
            .sort((a, b) => new Date(b.contactDate || b.viewedAt) - new Date(a.contactDate || a.viewedAt))
            .slice(0, parseInt(limit));
          break;
      }
      
      res.json({
        success: true,
        data: {
          activity,
          stats: client.activity.stats
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur historique activité:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération de l\'historique'
      });
    }
  }

  /**
   * 🗑️ Supprimer le compte client
   */
  async deleteAccount(req, res) {
    try {
      const clientId = req.user.id;
      const { confirmation } = req.body;
      
      if (confirmation !== 'SUPPRIMER_MON_COMPTE') {
        return res.status(400).json({
          success: false,
          message: 'Confirmation requise pour supprimer le compte'
        });
      }
      
      const client = await Client.findByIdAndDelete(clientId);
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      // TODO: Supprimer aussi les données associées (notifications, etc.)
      
      res.json({
        success: true,
        message: 'Compte supprimé avec succès'
      });
      
    } catch (error) {
      console.error('❌ Erreur suppression compte:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression du compte'
      });
    }
  }

  /**
   * 🔄 Mettre à jour l'abonnement
   */
  async updateSubscription(req, res) {
    try {
      const clientId = req.user.id;
      const { planType, autoRenew = false } = req.body;
      
      const validPlans = ['free', 'premium_monthly', 'premium_yearly'];
      if (!validPlans.includes(planType)) {
        return res.status(400).json({
          success: false,
          message: 'Type d\'abonnement invalide'
        });
      }
      
      const client = await Client.findByIdAndUpdate(
        clientId,
        {
          $set: {
            'subscription.planType': planType,
            'subscription.autoRenew': autoRenew,
            'subscription.startDate': new Date(),
            'subscription.status': 'active',
            updatedAt: new Date()
          }
        },
        { new: true }
      ).select('subscription');
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }
      
      // Notification de changement d'abonnement
      await notificationService.notifySubscriptionActivated(
        clientId, 
        'Client', 
        planType, 
        new Date() // TODO: Calculer la date de fin réelle
      );
      
      res.json({
        success: true,
        message: 'Abonnement mis à jour avec succès',
        data: client.subscription
      });
      
    } catch (error) {
      console.error('❌ Erreur mise à jour abonnement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour de l\'abonnement'
      });
    }
  }
}

module.exports = new ClientController();