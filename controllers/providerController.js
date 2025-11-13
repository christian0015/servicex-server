const ServiceProvider = require('../models/serviceProvider.model');
const Client = require('../models/client.model');
const syncService = require('../services/analytics/syncService');
const statsService = require('../services/analytics/statsService');
const rankingService = require('../services/analytics/rankingService');
const notificationService = require('../services/notifications/notificationService');
const emailService = require('../services/notifications/emailService');

class ProviderController {
  
  /**
   * 🎯 RÉCUPÉRER TOUS LES PRESTATAIRES (avec pagination et filtres)
   */
  async getAllProviders(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        service,
        zone,
        minRating,
        maxPrice,
        availability,
        sortBy = 'rating'
      } = req.query;

      // 🔍 Construction de la query de filtrage
      const query = { isActive: true };
      
      if (service) query['services.label'] = service;
      if (zone) query.zones = { $in: [zone] };
      if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };
      if (availability) query['currentStatus.status'] = availability;

      // 💰 Filtre par prix si spécifié
      if (maxPrice) {
        query['services.price'] = { $lte: parseFloat(maxPrice) };
      }

      // 📊 Options de tri
      const sortOptions = {};
      switch(sortBy) {
        case 'rating':
          sortOptions['rating.average'] = -1;
          break;
        case 'views':
          sortOptions['profileStats.totalViews'] = -1;
          break;
        case 'price':
          sortOptions['services.price'] = 1;
          break;
        case 'recent':
          sortOptions['createdAt'] = -1;
          break;
        default:
          sortOptions['rating.average'] = -1;
      }

      // 🎯 Exécution de la requête
      const providers = await ServiceProvider.find(query)
        .select('fullName profilePhoto rating services zones availability currentStatus description profileStats gamification')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      // 📈 Métadonnées de pagination
      const total = await ServiceProvider.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: providers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        },
        filters: {
          service,
          zone,
          minRating,
          availability
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération prestataires:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des prestataires'
      });
    }
  }

  /**
   * 👤 RÉCUPÉRER UN PRESTATAIRE PAR ID
   */
  async getProviderById(req, res) {
    try {
      const { id } = req.params;
      
      const provider = await ServiceProvider.findById(id)
        .select('-phoneNumber -email -subscription') // Exclure données sensibles
        .populate('rating.reviews.clientId', 'fullName profilePhoto');

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      // 📊 Track de la vue si un client est connecté
      if (req.user && req.user.model === 'Client') {
        try {
          await syncService.trackProfileView(req.user.id, id, 0);
        } catch (trackError) {
          console.log('⚠️ Tracking vue échoué:', trackError.message);
        }
      }

      res.json({
        success: true,
        data: provider
      });

    } catch (error) {
      console.error('❌ Erreur récupération prestataire:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du prestataire'
      });
    }
  }

  /**
   * ✏️ METTRE À JOUR LE PROFIL PRESTATAIRE
   */
  async updateProvider(req, res) {
    try {
      const { id } = req.params;
      
      // 🔒 Vérification que l'utilisateur peut modifier ce profil
      if (req.user.id !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé à modifier ce profil'
        });
      }

      const updates = req.body;
      
      // 🚫 Champs non modifiables
      delete updates.phoneNumber;
      delete updates.email;
      delete updates.whatsappVerified;
      delete updates.rating;
      delete updates.profileStats;
      delete updates.gamification;

      const provider = await ServiceProvider.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-phoneNumber -email');

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      // 🔄 Mise à jour des badges si services ou disponibilités changés
      if (updates.services || updates.availability) {
        await provider.updateBadges();
      }

      res.json({
        success: true,
        message: 'Profil mis à jour avec succès',
        data: provider
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour prestataire:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil'
      });
    }
  }

  
  /**
   * 🛠️ METTRE À JOUR LES SERVICES D'UN PRESTATAIRE
   */
  async updateProviderServices(req, res) {
    try {
      const { id } = req.params;
      const { services } = req.body;

      // 🔒 Vérification des permissions
      if (req.user.id !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé à modifier les services'
        });
      }

      // 📝 Validation des données
      if (!services || !Array.isArray(services)) {
        return res.status(400).json({
          success: false,
          message: 'Le format des services est invalide'
        });
      }

      const provider = await ServiceProvider.findById(id);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      // ✨ Mise à jour des services
      provider.services = services.map(service => ({
        label: service.label,
        price: service.price || 0,
        isCustom: service.isCustom || false
      }));

      await provider.save();

      // 🔄 Mise à jour des badges (les nouveaux services peuvent débloquer des badges)
      await provider.updateBadges();

      res.json({
        success: true,
        message: 'Services mis à jour avec succès',
        data: {
          services: provider.services,
          updatedAt: provider.updatedAt
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour services:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour des services'
      });
    }
  }

  /**
   * 🎯 METTRE À JOUR LE STATUT TEMPS RÉEL
   */
  async updateProviderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, nextAvailable } = req.body;

      if (req.user.id !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé à modifier ce statut'
        });
      }

      const provider = await ServiceProvider.findById(id);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      await provider.updateStatus(status, nextAvailable);

      res.json({
        success: true,
        message: `Statut mis à jour: ${status}`,
        data: {
          currentStatus: provider.currentStatus,
          isAvailableNow: provider.isAvailableNow()
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }
  }

  /**
   * 📊 RÉCUPÉRER LES STATISTIQUES D'UN PRESTATAIRE
   */
  async getProviderStats(req, res) {
    try {
      const { id } = req.params;

      // 🔒 Vérification des permissions
      if (req.user.id !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé à voir ces statistiques'
        });
      }

      const stats = await statsService.getProviderStats(id);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Erreur récupération stats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  /**
   * 🏆 RÉCUPÉRER LE CLASSEMENT D'UN PRESTATAIRE
   */
  async getProviderRanking(req, res) {
    try {
      const { id } = req.params;

      const provider = await ServiceProvider.findById(id)
        .select('gamification services');

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      // 📈 Récupération du classement général
      const rankings = await rankingService.getRankings({
        category: provider.services[0]?.label,
        limit: 100
      });

      const providerRanking = rankings.find(rank => 
        rank._id.toString() === id
      );

      res.json({
        success: true,
        data: {
          ranking: providerRanking,
          badges: provider.gamification.badges,
          points: provider.gamification.points
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération classement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du classement'
      });
    }
  }

  /**
   * ⭐ AJOUTER UN AVIS À UN PRESTATAIRE
   */
  async addProviderReview(req, res) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      const clientId = req.user.id;

      // 📝 Validation des données
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'La note doit être entre 1 et 5 étoiles'
        });
      }

      const provider = await ServiceProvider.findById(id);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      // 🔍 Vérifier si le client a déjà noté ce prestataire
      const existingReview = provider.rating.reviews.find(
        review => review.clientId.toString() === clientId
      );

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'Vous avez déjà noté ce prestataire'
        });
      }

      // ✨ Ajout de la review
      provider.rating.reviews.push({
        clientId,
        rating,
        comment,
        createdAt: new Date()
      });

      // 📊 Recalcul de la moyenne
      const totalRatings = provider.rating.reviews.reduce((sum, review) => 
        sum + review.rating, 0
      );
      
      provider.rating.average = totalRatings / provider.rating.reviews.length;
      provider.rating.totalVotes = provider.rating.reviews.length;

      await provider.save();

      // 🔄 Mise à jour des badges
      await provider.updateBadges();

      // 🔔 Notification au prestataire
      const client = await Client.findById(clientId);
      await notificationService.notifyNewReview(id, client, rating, comment);

      // 📧 Email de notification (optionnel)
      try {
        await emailService.sendNewReviewNotification(provider, client, rating, comment);
      } catch (emailError) {
        console.log('⚠️ Email notification échoué:', emailError.message);
      }

      res.json({
        success: true,
        message: 'Avis ajouté avec succès',
        data: {
          review: {
            rating,
            comment,
            createdAt: new Date()
          },
          newAverage: provider.rating.average
        }
      });

    } catch (error) {
      console.error('❌ Erreur ajout avis:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout de l\'avis'
      });
    }
  }

  /**
   * 📞 CONTACTER UN PRESTATAIRE
   */
  async contactProvider(req, res) {
    try {
      const { id } = req.params;
      const { serviceType, message } = req.body;
      const clientId = req.user.id;

      const provider = await ServiceProvider.findById(id);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé'
        });
      }

      // 🎯 Vérification des limites de contact
      if (!client.canMakeContact()) {
        return res.status(400).json({
          success: false,
          message: 'Limite de contacts hebdomadaires atteinte. Passez à un abonnement premium pour des contacts illimités.'
        });
      }

      // 🔄 Synchronisation du contact
      const contactResult = await syncService.trackContact(
        clientId, 
        id, 
        serviceType
      );

      // 🔔 Notification au prestataire
      await notificationService.notifyNewContact(id, client, serviceType);

      // 📧 Emails de notification
      try {
        await emailService.sendNewContactNotification(provider, client, serviceType);
        await emailService.sendContactConfirmation(client, provider, serviceType);
      } catch (emailError) {
        console.log('⚠️ Emails notification échoués:', emailError.message);
      }

      res.json({
        success: true,
        message: 'Demande de contact envoyée avec succès',
        data: {
          contact: contactResult.data,
          provider: {
            name: provider.fullName,
            phone: provider.phoneNumber
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur contact prestataire:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de la demande de contact'
      });
    }
  }

  /**
   * 🔍 RECHERCHER DES PRESTATAIRES - VERSION AMÉLIORÉE
   */
  async searchProviders(req, res) {
    try {
      const {
        q: searchQuery,
        service,
        zone,
        minRating = 0,
        maxPrice,
        availability,
        sortBy = 'relevance',
        page = 1,
        limit = 20
      } = req.query;

      console.log('🔍 Search request received:', {
        searchQuery,
        service,
        zone,
        minRating,
        maxPrice,
        availability
      });

      // 🎯 Construction de la query de recherche
      const query = { isActive: true };

      // 🔧 CORRECTION : Recherche texte plus flexible
      if (searchQuery) {
        const searchWords = searchQuery.split(' ').filter(word => word.length > 0);
        
        // Créer un tableau de conditions regex pour chaque mot
        const searchConditions = searchWords.map(word => ({
          $or: [
            { fullName: { $regex: word, $options: 'i' } },
            { description: { $regex: word, $options: 'i' } },
            { 'services.label': { $regex: word, $options: 'i' } },
            { zones: { $regex: word, $options: 'i' } }
          ]
        }));

        // Combiner avec $and pour que tous les mots soient trouvés (recherche ET)
        query.$and = searchConditions;
      }

      // 🔧 CORRECTION : Filtres plus flexibles
      if (service) {
        // Recherche partielle dans les services
        query['services.label'] = { $regex: service, $options: 'i' };
      }
      
      if (zone) {
        // Recherche partielle dans les zones
        query.zones = { $in: [new RegExp(zone, 'i')] };
      }
      
      if (minRating) {
        query['rating.average'] = { $gte: parseFloat(minRating) };
      }
      
      if (maxPrice) {
        query['services.price'] = { $lte: parseFloat(maxPrice) };
      }
      
      if (availability) {
        query['currentStatus.status'] = availability;
      }

      console.log('🎯 Final search query:', JSON.stringify(query, null, 2));

      // Options de tri
      const sortOptions = {};
      switch(sortBy) {
        case 'rating':
          sortOptions['rating.average'] = -1;
          break;
        case 'price_low':
          sortOptions['services.price'] = 1;
          break;
        case 'price_high':
          sortOptions['services.price'] = -1;
          break;
        case 'views':
          sortOptions['profileStats.totalViews'] = -1;
          break;
        case 'recent':
          sortOptions['createdAt'] = -1;
          break;
        default: // relevance
          sortOptions['rating.average'] = -1;
          sortOptions['profileStats.totalViews'] = -1;
      }

      const providers = await ServiceProvider.find(query)
        .select('fullName profilePhoto rating services zones availability currentStatus description profileStats')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await ServiceProvider.countDocuments(query);

      console.log(`📊 Search results: ${providers.length} providers found`);

      // 💾 Sauvegarde de la recherche si client connecté
      if (req.user && req.user.model === 'Client') {
        try {
          await Client.findByIdAndUpdate(req.user.id, {
            $push: {
              searchHistory: {
                query: searchQuery || '',
                filters: { service, zone, minRating, maxPrice },
                resultsCount: providers.length,
                searchedAt: new Date()
              }
            }
          });
        } catch (searchError) {
          console.log('⚠️ Sauvegarde recherche échouée:', searchError.message);
        }
      }

      res.json({
        success: true,
        data: providers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        },
        search: {
          query: searchQuery,
          filters: { service, zone, minRating, maxPrice, availability },
          sortBy
        }
      });

    } catch (error) {
      console.error('❌ Erreur recherche prestataires:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche'
      });
    }
  }

  /**
   * 🔍 RECHERCHER DES PRESTATAIRES
   */
  // async searchProviderss(req, res) {
  //   try {
  //     const {
  //       q: searchQuery,
  //       service,
  //       zone,
  //       minRating = 0,
  //       maxPrice,
  //       availability,
  //       sortBy = 'relevance',
  //       page = 1,
  //       limit = 20
  //     } = req.query;

  //     // 🎯 Construction de la query de recherche
  //     const query = { isActive: true };

  //     // Recherche texte dans nom, description, services
  //     if (searchQuery) {
  //       query.$or = [
  //         { fullName: { $regex: searchQuery, $options: 'i' } },
  //         { description: { $regex: searchQuery, $options: 'i' } },
  //         { 'services.label': { $regex: searchQuery, $options: 'i' } },
  //         { zones: { $regex: searchQuery, $options: 'i' } }
  //       ];
  //     }

  //     // Filtres additionnels
  //     if (service) query['services.label'] = service;
  //     if (zone) query.zones = { $in: [new RegExp(zone, 'i')] };
  //     if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };
  //     if (maxPrice) query['services.price'] = { $lte: parseFloat(maxPrice) };
  //     if (availability) query['currentStatus.status'] = availability;

  //     // Options de tri
  //     const sortOptions = {};
  //     switch(sortBy) {
  //       case 'rating':
  //         sortOptions['rating.average'] = -1;
  //         break;
  //       case 'price_low':
  //         sortOptions['services.price'] = 1;
  //         break;
  //       case 'price_high':
  //         sortOptions['services.price'] = -1;
  //         break;
  //       case 'views':
  //         sortOptions['profileStats.totalViews'] = -1;
  //         break;
  //       case 'recent':
  //         sortOptions['createdAt'] = -1;
  //         break;
  //       default: // relevance
  //         sortOptions['rating.average'] = -1;
  //         sortOptions['profileStats.totalViews'] = -1;
  //     }

  //     const providers = await ServiceProvider.find(query)
  //       .select('fullName profilePhoto rating services zones availability currentStatus description profileStats')
  //       .sort(sortOptions)
  //       .limit(limit * 1)
  //       .skip((page - 1) * limit)
  //       .lean();

  //     const total = await ServiceProvider.countDocuments(query);

  //     // 💾 Sauvegarde de la recherche si client connecté
  //     if (req.user && req.user.model === 'Client') {
  //       try {
  //         await Client.findByIdAndUpdate(req.user.id, {
  //           $push: {
  //             searchHistory: {
  //               query: searchQuery || '',
  //               filters: { service, zone, minRating, maxPrice },
  //               resultsCount: providers.length,
  //               searchedAt: new Date()
  //             }
  //           }
  //         });
  //       } catch (searchError) {
  //         console.log('⚠️ Sauvegarde recherche échouée:', searchError.message);
  //       }
  //     }

  //     res.json({
  //       success: true,
  //       data: providers,
  //       pagination: {
  //         page: parseInt(page),
  //         limit: parseInt(limit),
  //         total,
  //         totalPages: Math.ceil(total / limit)
  //       },
  //       search: {
  //         query: searchQuery,
  //         filters: { service, zone, minRating, maxPrice, availability },
  //         sortBy
  //       }
  //     });

  //   } catch (error) {
  //     console.error('❌ Erreur recherche prestataires:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Erreur lors de la recherche'
  //     });
  //   }
  // }

  /**
   * 🎖️ RÉCUPÉRER LES BADGES D'UN PRESTATAIRE
   */
  async getProviderBadges(req, res) {
    try {
      const { id } = req.params;

      const provider = await ServiceProvider.findById(id)
        .select('gamification.badges fullName profilePhoto');

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      res.json({
        success: true,
        data: {
          badges: provider.gamification.badges,
          provider: {
            name: provider.fullName,
            photo: provider.profilePhoto
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération badges:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des badges'
      });
    }
  }

  /**
   * 📅 RÉCUPÉRER LES DISPONIBILITÉS D'UN PRESTATAIRE
   */
  async getProviderAvailability(req, res) {
    try {
      const { id } = req.params;

      const provider = await ServiceProvider.findById(id)
        .select('availability currentStatus zones');

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      res.json({
        success: true,
        data: {
          availability: provider.availability,
          currentStatus: provider.currentStatus,
          isAvailableNow: provider.isAvailableNow(),
          zones: provider.zones
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération disponibilités:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des disponibilités'
      });
    }
  }

  /**
   * 🔧 METTRE À JOUR LES DISPONIBILITÉS
   */
  async updateProviderAvailability(req, res) {
    try {
      const { id } = req.params;
      const { availability } = req.body;

      if (req.user.id !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé à modifier les disponibilités'
        });
      }

      const provider = await ServiceProvider.findByIdAndUpdate(
        id,
        { $set: { availability } },
        { new: true, runValidators: true }
      ).select('availability currentStatus');

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      // 🔄 Mise à jour des badges de disponibilité
      await provider.updateBadges();

      res.json({
        success: true,
        message: 'Disponibilités mises à jour avec succès',
        data: {
          availability: provider.availability,
          currentStatus: provider.currentStatus
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour disponibilités:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour des disponibilités'
      });
    }
  }

  /**
   * 🗑️ SUPPRIMER UN PRESTATAIRE (soft delete)
   */
  async deleteProvider(req, res) {
    try {
      const { id } = req.params;

      if (req.user.id !== id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non autorisé à supprimer ce profil'
        });
      }

      const provider = await ServiceProvider.findByIdAndUpdate(
        id,
        { 
          isActive: false,
          currentStatus: { status: 'offline', lastUpdated: new Date() }
        },
        { new: true }
      );

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Profil prestataire désactivé avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur suppression prestataire:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du profil'
      });
    }
  }

  /**
   * 📈 RÉCUPÉRER LES PRESTATAIRES TRENDING (populaires)
   */
  async getTrendingProviders(req, res) {
    try {
      const { limit = 10, category } = req.query;

      const query = { isActive: true };
      if (category) query['services.label'] = category;

      const providers = await ServiceProvider.find(query)
        .select('fullName profilePhoto rating services zones profileStats gamification currentStatus')
        .sort({ 
          'profileStats.totalViews': -1,
          'rating.average': -1,
          'contactCount': -1
        })
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        data: providers,
        metadata: {
          category,
          period: 'current_week',
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération trending:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des prestataires populaires'
      });
    }
  }
}

module.exports = new ProviderController();